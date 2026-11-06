// apps/web/app/api/auth/verify-otp/route.ts
// ============================================================================
// Step 2 of the email OTP flow: validate the submitted code against the
// digest stored in `verification_attempts`, enforce the 5-minute TTL and the
// 5-attempt budget, retire the challenge, provision the Supabase user and
// establish the session cookie.
//
//   POST /api/auth/verify-otp   { email, otp, role?, programSession?, hallId? }
//
// On success the challenge is consumed atomically-ish (verified_at +
// consumed_at set, otp_hash nulled) so a captured code cannot be replayed even
// if the response is lost and the request is retried.
//
// Idempotency & serverless safety (the "stuck on /verify-email" fix):
//   • A caller that already holds a verified session for the submitted email
//     gets `200 { alreadyVerified: true, redirectTo: '/' }` — never
//     "No active OTP challenge found".
//   • A duplicate submission of the same code within 120s of a successful
//     verification matches the signed `campus360_otp_verified` receipt cookie
//     (and, when readable, the recently-verified database row) and also gets
//     `alreadyVerified` — with the session cookies refreshed/re-minted.
//   • When the database challenge lookup misses (Vercel cold start, RLS
//     hiccup), the signed `campus360_otp_challenge` cookie set by request-otp
//     is a stateless backup the code can be validated against.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { authError, authLog } from '@/lib/auth-log';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  DEMO_OTP_COOKIE,
  demoNextStep,
  normalizeDemoRole,
  readSignedDemoSession,
  verifyDemoChallenge,
  issueSignedDemoSession,
} from '@/lib/demo-auth';
import { DEMO_UNIVERSITIES, DEMO_UNIVERSITY_HALLS } from '@/lib/modules/demo-data';
import { ProgramSessionSchema, VerifyOtpSchema } from '@campus360/shared';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  isDemoAuthMode,
  redactEmail,
  remainingOtpSeconds,
} from '@/lib/demo-otp';
import { hashOtp, normalizeOtpInput, otpHashMatches, otpSecurityConfigError } from '@/lib/otp-crypto';
import {
  clearProfileDemoOtp,
  consumeOtpChallenge,
  hasAttemptsLeft,
  isChallengeExpired,
  readActiveOtpChallenge,
  readRecentVerifiedOtpChallenge,
  recordOtpFailure,
} from '@/lib/otp-store';
import {
  OTP_IDEMPOTENCY_WINDOW_SECONDS,
  clearOtpChallengeCookie,
  otpVerifiedReceiptMatches,
  readOtpChallengeCookie,
  readOtpVerifiedReceiptRaw,
  setOtpVerifiedReceipt,
  type OtpChallengeCookiePayload,
} from '@/lib/otp-challenge-cookie';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    return await handleVerifyOtp(req);
  } catch (error) {
    // Same rule as request-otp: the client must always get the JSON envelope,
    // and the operator must always get the real fault.
    authError('verify-otp.unhandled', error);
    return apiError(
      'OTP_VERIFY_FAILED',
      'Verification could not be completed. Please try again.',
      'যাচাইকরণ সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      500
    );
  }
}

async function handleVerifyOtp(req: NextRequest) {
  const rl = checkRateLimit(req, 'verify-otp', 10, 600);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Too many verification attempts.', 'অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে।', 429);
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const otp = normalizeOtpInput(body?.otp);

  if (!email || !otp) {
    return apiError('INVALID_INPUT', 'A valid email and 6-digit OTP are required.', 'সঠিক ইমেইল এবং ৬-সংখ্যার ওটিপি প্রয়োজন।', 400);
  }
  const submitted = VerifyOtpSchema.safeParse(body);
  if (!submitted.success) {
    return apiError('INVALID_OTP_CONTEXT', submitted.error.issues[0]?.message ?? 'Invalid verification details.',
      'যাচাইকরণের তথ্য সঠিক নয়।', 400);
  }

  // Local preview (no Supabase): the cookie-issued demo challenge.
  if (!isSupabaseServerConfigured()) {
    // Idempotent: the first successful call already issued the demo session.
    const demoSession = readSignedDemoSession();
    if (demoSession && demoSession.email.trim().toLowerCase() === email && demoSession.email_verified) {
      return alreadyVerifiedSuccess();
    }
    // Role-based preview OTP is sealed by request-otp; legacy quick-demo
    // challenges still use their original, untouched verification path.
    const preview = readOtpChallengeCookie();
    if (preview && preview.email === email) {
      if (!otpHashMatches(preview.otpHash, email, otp) || !contextMatches(preview, submitted.data)) {
        return apiError('INVALID_OTP', 'Invalid OTP or verification details.', 'ভুল ওটিপি বা যাচাইকরণের তথ্য।', 401);
      }
      const university = DEMO_UNIVERSITIES.find((entry) => entry.id === preview.universityId);
      const role = normalizeDemoRole(preview.role);
      const hall = role === 'student' ? DEMO_UNIVERSITY_HALLS.find((entry) => entry.id === preview.hallId) : null;
      const { payload } = issueSignedDemoSession({ email, role,
        name: preview.fullName ?? email.split('@')[0], studentId: preview.studentId ?? 'PENDING',
        university_id: preview.universityId, universityCode: university?.code ?? 'JU',
        hall_id: role === 'student' ? preview.hallId ?? null : null, hall_name: hall?.name ?? null,
        department_id: preview.departmentId || null, program_session: preview.programSession ?? null });
      finalizeVerificationCookies(email, otp);
      const nextStep = payload.program_session ? demoNextStep(role) : '/onboarding';
      return apiSuccess({ ok: true, verified: true, demo: true, role, universityId: preview.universityId,
        nextStep, redirectTo: nextStep, trustLevel: 'EMAIL_VERIFIED' });
    }
    const demo = verifyDemoChallenge(email, otp);
    if (!demo.ok) {
      return apiError('INVALID_OTP', demo.error, demo.errorBn, demo.status);
    }
    return apiSuccess({
      ok: true,
      verified: true,
      demo: true,
      role: demo.session.role,
      universityId: demo.session.universityId,
      nextStep: demoNextStep(demo.session.role),
      redirectTo: demoNextStep(demo.session.role),
      trustLevel: 'EMAIL_VERIFIED',
    });
  }

  if (otpSecurityConfigError()) {
    return apiError(
      'AUTH_CONFIG_UNAVAILABLE',
      'The server is not ready to verify OTP codes. Please contact support.',
      'সার্ভার এই মুহূর্তে ওটিপি যাচাই করতে পারছে না। অনুগ্রহ করে সহায়তার সাথে যোগাযোগ করুন।',
      503
    );
  }

  const admin = createSupabaseAdminClient();

  // --- Idempotency guard A: a verified session already exists for this email.
  // This is the double-submit / retry case: the first POST established the
  // session, the browser sent the cookies along, and the challenge row is
  // already consumed. Answer success instead of "No active OTP challenge".
  if (await hasVerifiedSessionForEmail(email)) {
    authLog('verify-otp.idempotent-session', { email: redactEmail(email) });
    return alreadyVerifiedSuccess();
  }

  // --- Idempotency guard B: this exact code was verified moments ago. The
  // signed receipt cookie survives across Vercel instances; the database row
  // (verified_at within the window) corroborates it when readable.
  if (otpVerifiedReceiptMatches(readOtpVerifiedReceiptRaw(), email, otp)) {
    const recent = await readRecentVerifiedOtpChallenge(admin, email, OTP_IDEMPOTENCY_WINDOW_SECONDS);
    if (recent && !contextMatches({ role: String(recent.signup_payload?.role ?? 'student'),
      hallId: typeof recent.signup_payload?.hallId === 'string' ? recent.signup_payload.hallId : null,
      programSession: typeof recent.signup_payload?.programSession === 'string' ? recent.signup_payload.programSession : null }, submitted.data)) {
      return apiError('OTP_CONTEXT_MISMATCH', 'Verification details do not match the issued code. Request a new code.',
        'যাচাইকরণের তথ্য প্রদত্ত কোডের সাথে মেলে না। নতুন কোড নিন।', 409);
    }
    authLog('verify-otp.idempotent-receipt', {
      email: redactEmail(email),
      dbCorroborated: Boolean(recent),
    });
    // The first response's Set-Cookie may have been lost — re-mint if needed.
    await refreshOrEstablishSession(email);
    return alreadyVerifiedSuccess();
  }

  const challenge = await readActiveOtpChallenge(admin, email);

  if (!challenge) {
    // --- Serverless cookie fallback: the database lookup missed (cold start,
    // RLS, replica lag) but request-otp sealed the same digest into a signed
    // HTTP-only cookie. Validate against it rather than failing the sign-in.
    const cookieChallenge = readOtpChallengeCookie();
    if (cookieChallenge && cookieChallenge.email === email) {
      if (!contextMatches(cookieChallenge, submitted.data)) return contextMismatch();
      if (!otpHashMatches(cookieChallenge.otpHash, email, otp)) {
        return apiError(
          'INVALID_OTP',
          'Invalid OTP code. Please check the code and try again.',
          'ভুল ওটিপি কোড। কোডটি যাচাই করে আবার চেষ্টা করুন।',
          401
        );
      }
      return verifyViaCookieFallback(admin, email, otp, cookieChallenge);
    }

    // `readActiveOtpChallenge` already logged a lookup failure when the query
    // itself errored; this line ties that log line to the user's attempt.
    authLog('verify-otp.no-active-challenge', { email: redactEmail(email) });
    return apiError(
      'CHALLENGE_NOT_FOUND',
      'No active OTP challenge found. Request a new code.',
      'সক্রিয় ওটিপি পাওয়া যায়নি। নতুন কোড অনুরোধ করুন।',
      404
    );
  }

  if (!contextMatches({ role: String(challenge.signup_payload?.role ?? 'student'),
    hallId: typeof challenge.signup_payload?.hallId === 'string' ? challenge.signup_payload.hallId : null,
    programSession: typeof challenge.signup_payload?.programSession === 'string' ? challenge.signup_payload.programSession : null }, submitted.data)) {
    return contextMismatch();
  }

  if (isChallengeExpired(challenge)) {
    // Retire it immediately so the client cannot keep hammering a dead code.
    await consumeOtpChallenge(admin, challenge.id, { verified: false, clearHash: true });
    return apiError(
      'OTP_EXPIRED',
      `This OTP has expired (${Math.round(OTP_TTL_SECONDS / 60)}-minute TTL). Request a new code.`,
      `এই ওটিপির মেয়াদ শেষ হয়ে গেছে (${Math.round(OTP_TTL_SECONDS / 60)} মিনিট)। নতুন কোড অনুরোধ করুন।`,
      410
    );
  }

  if (!hasAttemptsLeft(challenge)) {
    await consumeOtpChallenge(admin, challenge.id, { verified: false, clearHash: true });
    return apiError(
      'MAX_ATTEMPTS_EXCEEDED',
      `Maximum ${OTP_MAX_ATTEMPTS} attempts exceeded. Please request a new OTP.`,
      `সর্বোচ্চ ${OTP_MAX_ATTEMPTS} বার ভুল চেষ্টা করা হয়েছে। নতুন ওটিপি নিন।`,
      429
    );
  }

  // Constant-time digest comparison — the plaintext code was never stored.
  if (!otpHashMatches(challenge.otp_hash, email, otp)) {
    await recordOtpFailure(admin, challenge);
    const attemptsUsed = Number(challenge.attempt_count ?? 0) + 1;
    const attemptsLeft = Math.max(0, Number(challenge.max_attempts ?? OTP_MAX_ATTEMPTS) - attemptsUsed);

    return apiError(
      'INVALID_OTP',
      attemptsLeft > 0
        ? `Invalid OTP code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining before the code is revoked.`
        : 'Invalid OTP code. This code has been revoked — request a new one.',
      attemptsLeft > 0
        ? `ভুল ওটিপি কোড। আর ${attemptsLeft} বার চেষ্টা করতে পারবেন।`
        : 'ভুল ওটিপি কোড। এই কোডটি বাতিল করা হয়েছে — নতুন কোড অনুরোধ করুন।',
      401,
      { attemptsRemaining: attemptsLeft }
    );
  }

  const issuedPayload = challenge.signup_payload ?? {};
  if (issuedPayload.purpose === 'signup' && !ProgramSessionSchema.safeParse(issuedPayload.programSession).success) {
    return apiError('PROGRAM_SESSION_REQUIRED', 'Select a valid program session before creating your account.',
      'অ্যাকাউন্ট তৈরির আগে সঠিক প্রোগ্রাম সেশন নির্বাচন করুন।', 400);
  }
  // Valid: consume the challenge and clear the digest from the database.
  await consumeOtpChallenge(admin, challenge.id, { verified: true, clearHash: true });
  // Track B housekeeping — a demo code never outlives its verification.
  await clearProfileDemoOtp(admin, email);

  const secondsLeft = remainingOtpSeconds(challenge.expires_at);

  // Provision or locate the Supabase user + profile.
  const payload = issuedPayload as Record<string, string | null>;
  const provisioned = await provisionVerifiedUser(admin, email, challenge.university_id, payload);
  if (!provisioned.ok) return provisioned.response;
  const { userId, isNewUser, needsOnboarding, role: accountRole } = provisioned;

  await authLogged('verify-otp.audit-insert-failed', () =>
    admin.from('audit_log').insert({
    university_id: challenge.university_id,
    actor_id: userId,
    action: 'EMAIL_OTP_VERIFIED',
    entity_type: 'PROFILE',
    entity_id: userId,
    metadata: {
      email: redactEmail(email),
      challenge_id: challenge.id,
      seconds_used: OTP_TTL_SECONDS - secondsLeft,
      demo: isDemoAuthMode(),
    },
    })
  );

  // Log the user in (session cookies land on path '/').
  const session = await establishSupabaseSession(email);
  if (!session.ok) return session.response;

  // Retire the cookie backup + any stale preview OTP cookie, and seal a
  // short-lived verification receipt so duplicate submissions succeed.
  finalizeVerificationCookies(email, otp);

  const nextStep = isNewUser || (needsOnboarding && accountRole !== 'admin') ? '/onboarding' : demoNextStep(normalizeDemoRole(accountRole));
  return apiSuccess({
    ok: true,
    verified: true,
    userId,
    universityId: challenge.university_id,
    role: accountRole,
    trustLevel: 'EMAIL_VERIFIED',
    challengeConsumed: true,
    nextStep,
    redirectTo: nextStep,
  });
}

function contextMismatch() {
  return apiError('OTP_CONTEXT_MISMATCH', 'Verification details do not match the issued code. Request a new code.',
    'যাচাইকরণের তথ্য প্রদত্ত কোডের সাথে মেলে না। নতুন কোড নিন।', 409);
}

/** Optional only for old clients; supplied values must match the challenge. */
function contextMatches(issued: { role?: string | null; hallId?: string | null; programSession?: string | null },
  submitted: { role?: string; hallId?: string | null; programSession?: string }): boolean {
  return (submitted.role === undefined || submitted.role === (issued.role ?? 'student'))
    && (submitted.hallId === undefined || submitted.hallId === (issued.hallId ?? null))
    && (submitted.programSession === undefined || submitted.programSession === (issued.programSession ?? null));
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/** The seamless duplicate/retry answer: 200, verified, redirect home. */
function alreadyVerifiedSuccess(): NextResponse {
  return apiSuccess({
    ok: true,
    verified: true,
    alreadyVerified: true,
    redirectTo: '/',
    nextStep: '/',
  });
}

/**
 * True when the request already carries a verified session for `email`:
 * either the signed quick-demo cookie or a Supabase session whose address is
 * confirmed. `getUser()` also refreshes the Supabase cookies via the SSR
 * client, so the caller's session is extended just by asking.
 */
async function hasVerifiedSessionForEmail(email: string): Promise<boolean> {
  try {
    const demo = readSignedDemoSession();
    if (demo && demo.email.trim().toLowerCase() === email && demo.email_verified) return true;
  } catch {
    /* no request scope / malformed cookie — fall through to Supabase */
  }
  try {
    const routeSupabase = createSupabaseRouteClient();
    const {
      data: { user },
      error,
    } = await routeSupabase.auth.getUser();
    if (user && !error && user.email?.trim().toLowerCase() === email) {
      return Boolean(user.email_confirmed_at) || user.user_metadata?.email_verified === true;
    }
  } catch (error) {
    // A Supabase outage must not block a first-time verification that the
    // challenge row (or cookie backup) can still satisfy.
    authError('verify-otp.session-precheck-failed', error, { email: redactEmail(email) });
  }
  return false;
}

/** Best-effort session refresh/re-mint for the idempotent path. */
async function refreshOrEstablishSession(email: string): Promise<void> {
  try {
    const routeSupabase = createSupabaseRouteClient();
    const {
      data: { user },
    } = await routeSupabase.auth.getUser();
    if (user?.email?.trim().toLowerCase() === email) return; // cookies refreshed

    const admin = createSupabaseAdminClient();
    const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkData?.properties?.hashed_token) {
      await routeSupabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token,
      });
    }
  } catch (error) {
    authError('verify-otp.idempotent-session-refresh-failed', error, { email: redactEmail(email) });
  }
}

/** Clear the challenge backup + stale preview cookie; seal the 120s receipt. */
function finalizeVerificationCookies(email: string, otp: string): void {
  clearOtpChallengeCookie();
  try {
    // A stale unverified preview challenge must never shadow the new session.
    cookies().set(DEMO_OTP_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  } catch {
    /* ignore outside request scope */
  }
  setOtpVerifiedReceipt(email, hashOtp(email, otp));
}

// ---------------------------------------------------------------------------
// Serverless cookie fallback
// ---------------------------------------------------------------------------

async function verifyViaCookieFallback(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  otp: string,
  cookieChallenge: OtpChallengeCookiePayload
): Promise<NextResponse> {
  authLog('verify-otp.cookie-fallback', { email: redactEmail(email) });

  if (cookieChallenge.purpose === 'signup' && !ProgramSessionSchema.safeParse(cookieChallenge.programSession).success) {
    return apiError('PROGRAM_SESSION_REQUIRED', 'Select a valid program session before creating your account.',
      'অ্যাকাউন্ট তৈরির আগে সঠিক প্রোগ্রাম সেশন নির্বাচন করুন।', 400);
  }
  const payload: Record<string, string | null> = {
    fullName: cookieChallenge.fullName ?? '',
    studentId: cookieChallenge.studentId ?? '',
    role: cookieChallenge.role ?? 'student',
    hallId: cookieChallenge.role === 'student' || !cookieChallenge.role ? cookieChallenge.hallId ?? '' : null,
    programSession: cookieChallenge.programSession ?? null,
    purpose: cookieChallenge.purpose ?? 'signin',
    departmentId: cookieChallenge.departmentId ?? '',
    programId: cookieChallenge.programId ?? '',
  };

  const provisioned = await provisionVerifiedUser(admin, email, cookieChallenge.universityId, payload);
  if (!provisioned.ok) return provisioned.response;
  const { userId, isNewUser, needsOnboarding, role: accountRole } = provisioned;

  // Best-effort: retire the database row too, when this instance can see it.
  if (cookieChallenge.challengeId) {
    await consumeOtpChallenge(admin, cookieChallenge.challengeId, { verified: true, clearHash: true });
  }
  await clearProfileDemoOtp(admin, email);

  await authLogged('verify-otp.audit-insert-failed', () =>
    admin.from('audit_log').insert({
      university_id: cookieChallenge.universityId,
      actor_id: userId,
      action: 'EMAIL_OTP_VERIFIED',
      entity_type: 'PROFILE',
      entity_id: userId,
      metadata: {
        email: redactEmail(email),
        challenge_id: cookieChallenge.challengeId ?? null,
        via_cookie_fallback: true,
        demo: isDemoAuthMode(),
      },
    })
  );

  const session = await establishSupabaseSession(email);
  if (!session.ok) return session.response;

  finalizeVerificationCookies(email, otp);

  const nextStep = isNewUser || (needsOnboarding && accountRole !== 'admin') ? '/onboarding' : demoNextStep(normalizeDemoRole(accountRole));
  return apiSuccess({
    ok: true,
    verified: true,
    userId,
    universityId: cookieChallenge.universityId,
    role: accountRole,
    trustLevel: 'EMAIL_VERIFIED',
    challengeConsumed: true,
    viaCookieFallback: true,
    nextStep,
    redirectTo: nextStep,
  });
}

// ---------------------------------------------------------------------------
// Provisioning + session issuance (shared by the DB and cookie paths)
// ---------------------------------------------------------------------------

type ProvisionResult =
  | { ok: true; userId: string; isNewUser: boolean; needsOnboarding: boolean; role: string }
  | { ok: false; response: NextResponse };

async function provisionVerifiedUser(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  universityId: string,
  payload: Record<string, string | null>
): Promise<ProvisionResult> {
  const requestedRole = String(payload.role ?? 'student').toLowerCase();
  const programSession = ProgramSessionSchema.safeParse(payload.programSession).success
    ? String(payload.programSession) : null;
  const { data: existingProfile, error: profileErr } = await admin.from('profiles')
    .select('id, university_id, role, program_session, user_roles(role)')
    .eq('email', email).maybeSingle();
  if (profileErr) {
    authError('verify-otp.profile-lookup-failed', profileErr, { email: redactEmail(email) });
    return { ok: false, response: apiError('PROFILE_LOOKUP_FAILED',
      'Your email is verified, but the account could not be loaded. Please request a new code and sign in again.',
      'ইমেইল যাচাই হয়েছে, তবে অ্যাকাউন্ট লোড করা যায়নি। নতুন কোড দিয়ে আবার সাইন ইন করুন।', 503) };
  }

  if (existingProfile) {
    const userId = String(existingProfile.id);
    // An existing account's authoritative role is never replaced by a login
    // selector. In particular, a public form cannot remove administrative roles.
    const assignedRoles = Array.isArray(existingProfile.user_roles)
      ? existingProfile.user_roles.map((row: { role?: unknown }) => String(row.role ?? '').toLowerCase()) : [];
    const privileged = assignedRoles.some((role: string) => ['admin', 'super_admin', 'university_admin', 'governance', 'governing_body'].includes(role));
    const actualRole = privileged ? 'admin' : assignedRoles[0] ?? String(existingProfile.role ?? requestedRole).toLowerCase();
    const updates: Record<string, unknown> = {};
    if (programSession) updates.program_session = programSession;
    if (existingProfile.university_id === universityId && actualRole === requestedRole) {
      if (requestedRole === 'student' && payload.hallId) updates.hall_id = payload.hallId;
      if (requestedRole === 'faculty' || requestedRole === 'alumni') updates.hall_id = null;
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await admin.from('profiles').update(updates).eq('id', userId).eq('university_id', universityId);
      if (error) {
        authError('verify-otp.profile-update-failed', error, { email: redactEmail(email) });
        return { ok: false, response: apiError('PROFILE_UPDATE_FAILED',
          'Your verified account details could not be saved. Please try a new code.',
          'যাচাইকৃত অ্যাকাউন্টের তথ্য সংরক্ষণ করা যায়নি। নতুন কোড দিয়ে চেষ্টা করুন।', 503) };
      }
    }
    await admin.from('profiles').update({ trust_level: 'EMAIL_VERIFIED' }).eq('id', userId).eq('trust_level', 'UNVERIFIED');
    return { ok: true, userId, isNewUser: false, needsOnboarding: !(programSession ?? existingProfile.program_session), role: actualRole };
  }

  const tempPassword = crypto.randomBytes(24).toString('hex');
  const { data: createdAuth, error: authErr } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
    user_metadata: { university_id: universityId, full_name: payload.fullName ?? email.split('@')[0], role: requestedRole },
  });
  if (authErr || !createdAuth.user) {
    authError('verify-otp.user-create-failed', authErr ?? new Error('createUser returned no user'), { email: redactEmail(email) });
    return { ok: false, response: apiError('AUTH_CREATE_FAILED', 'Failed to provision verified user account.', 'অ্যাকাউন্ট তৈরি করা যায়নি।', 500) };
  }
  const userId = createdAuth.user.id;
  const { error: insertError } = await admin.from('profiles').insert({
    id: userId,
    university_id: universityId,
    department_id: payload.departmentId || null,
    hall_id: requestedRole === 'student' ? payload.hallId || null : null,
    // Migration 0012. The academic program remains optional and independent.
    program_id: payload.programId || null,
    program_session: programSession,
    role: requestedRole,
    email,
    full_name: payload.fullName || email.split('@')[0],
    student_id: payload.studentId || 'PENDING',
    trust_level: 'EMAIL_VERIFIED',
    onboarding_completed: Boolean(programSession),
  });
  if (insertError) {
    authError('verify-otp.profile-create-failed', insertError, { email: redactEmail(email) });
    return { ok: false, response: apiError('PROFILE_CREATE_FAILED',
      'Your email is verified, but the profile could not be saved. Please sign in again to finish setup.',
      'ইমেইল যাচাই হয়েছে, তবে প্রোফাইল সংরক্ষণ করা যায়নি। আবার সাইন ইন করে সেটআপ সম্পূর্ণ করুন।', 503) };
  }
  const roleMap: Record<string, string> = {
    student: 'STUDENT', faculty: 'FACULTY', alumni: 'ALUMNI', admin: 'ADMIN', governance: 'GOVERNANCE',
  };
  const { error: roleError } = await admin.from('user_roles').insert({
    user_id: userId, university_id: universityId, role: roleMap[requestedRole] ?? 'STUDENT',
  });
  if (roleError) {
    authError('verify-otp.role-create-failed', roleError, { email: redactEmail(email) });
    return { ok: false, response: apiError('ROLE_ASSIGNMENT_FAILED',
      'Your profile was saved, but its role could not be assigned. Please contact support.',
      'প্রোফাইল সংরক্ষিত হয়েছে, কিন্তু ভূমিকা নির্ধারণ করা যায়নি। সহায়তার সাথে যোগাযোগ করুন।', 503) };
  }
  return { ok: true, userId, isNewUser: true, needsOnboarding: !programSession, role: requestedRole };
}

type SessionResult = { ok: true } | { ok: false; response: NextResponse };

/** Mint a magiclink with the service client and exchange it through the SSR
 *  client so the verified session lands in cookies on path '/'. */
async function establishSupabaseSession(email: string): Promise<SessionResult> {
  const admin = createSupabaseAdminClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) {
    authError('verify-otp.generate-link-failed', linkErr, { email: redactEmail(email) });
  }

  const routeSupabase = createSupabaseRouteClient();

  if (!linkData?.properties?.hashed_token) {
    // No token, no cookie. Reporting success from here told the client
    // "verified" while leaving it signed out — which is exactly what looked like
    // "sign-in crashing" from the browser. The challenge is already consumed, so
    // the message says what to do next rather than inviting a retry of the code.
    authError(
      'verify-otp.session-token-missing',
      linkErr ?? new Error('generateLink returned no hashed_token'),
      { email: redactEmail(email) }
    );
    return {
      ok: false,
      response: apiError(
        'SESSION_ISSUE_FAILED',
        'Email verified, but the session could not be started. Please request a new code and sign in again.',
        'ইমেইল যাচাই সফল হয়েছে, তবে সেশন শুরু করা যায়নি। নতুন কোড অনুরোধ করে আবার সাইন ইন করুন।',
        500
      ),
    };
  }

  const {
    error: sessionErr,
    data: { user },
  } = await routeSupabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });

  if (sessionErr || !user) {
    authError('verify-otp.session-exchange-failed', sessionErr ?? new Error('verifyOtp returned no user'), {
      email: redactEmail(email),
    });
    return {
      ok: false,
      response: apiError(
        'SESSION_ISSUE_FAILED',
        'Email verified, but the session could not be started. Please sign in again.',
        'ইমেইল যাচাই সফল হয়েছে, তবে সেশন শুরু করা যায়নি। আবার সাইন ইন করুন।',
        500
      ),
    };
  }

  return { ok: true };
}

// verify-otp helper: bookkeeping writes (audit trail) must never turn a
// successful verification into an error response, but they must not be silent
// either. This keeps that contract to one line at each call site.
async function authLogged(stage: string, run: () => PromiseLike<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    authError(stage, error);
  }
}
