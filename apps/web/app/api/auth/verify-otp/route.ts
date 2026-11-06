// apps/web/app/api/auth/verify-otp/route.ts
// ============================================================================
// Step 2 of the email OTP flow: validate the submitted code against the
// digest stored in `verification_attempts`, enforce the 5-minute TTL and the
// 5-attempt budget, retire the challenge, provision the Supabase user and
// establish the session cookies.
//
//   POST /api/auth/verify-otp
//   { email, otp, role?, universityId?, hallId?, programSession?,
//     departmentId?, programId?, fullName?, studentId? }
//
// On success the challenge is consumed atomically-ish (verified_at +
// consumed_at set, otp_hash nulled) so a captured code cannot be replayed even
// if the response is lost and the request is retried.
//
// A valid code ALWAYS signs the user in
// -------------------------------------
// Once the digest matches, the mailbox is proven. Account provisioning
// (lib/otp-account.ts) and the Supabase session exchange are therefore
// best-effort: if the service role key, RLS, a trigger or GoTrue misbehaves,
// the verified identity is sealed into the signed HTTP-only
// `campus360_verified_session` cookie and the response is still 200. The old
// "Your email is verified, but the account could not be loaded" dead end is
// gone; `/api/auth/session` repairs the database write on the next read.
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
import type { SupabaseClient } from '@supabase/supabase-js';
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
import {
  ensureVerifiedAccount,
  resolveAccountContext,
  type AccountContext,
} from '@/lib/otp-account';
import { issueVerifiedSession, readVerifiedSession } from '@/lib/verified-session';

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
    if (recent && !contextMatches(payloadContext(recent.signup_payload), submitted.data)) {
      return contextMismatch();
    }
    authLog('verify-otp.idempotent-receipt', {
      email: redactEmail(email),
      dbCorroborated: Boolean(recent),
    });
    // The first response's Set-Cookie may have been lost — re-mint if needed.
    await refreshOrEstablishSession(email, payloadContext(recent?.signup_payload), submitted.data);
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
      return verifyViaCookieFallback(admin, email, otp, cookieChallenge, submitted.data);
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

  const issued = payloadContext(challenge.signup_payload);
  if (!contextMatches(issued, submitted.data)) return contextMismatch();

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

  if (issued.purpose === 'signup' && !ProgramSessionSchema.safeParse(issued.programSession).success) {
    return apiError('PROGRAM_SESSION_REQUIRED', 'Select a valid program session before creating your account.',
      'অ্যাকাউন্ট তৈরির আগে সঠিক প্রোগ্রাম সেশন নির্বাচন করুন।', 400);
  }
  // Valid: consume the challenge and clear the digest from the database.
  await consumeOtpChallenge(admin, challenge.id, { verified: true, clearHash: true });
  // Track B housekeeping — a demo code never outlives its verification.
  await clearProfileDemoOtp(admin, email);

  const secondsLeft = remainingOtpSeconds(challenge.expires_at);

  return completeVerification(admin, {
    email,
    otp,
    issued: { ...issued, email, universityId: challenge.university_id },
    submitted: submitted.data,
    challengeId: challenge.id,
    secondsUsed: OTP_TTL_SECONDS - secondsLeft,
    viaCookieFallback: false,
  });
}

function contextMismatch() {
  return apiError('OTP_CONTEXT_MISMATCH', 'Verification details do not match the issued code. Request a new code.',
    'যাচাইকরণের তথ্য প্রদত্ত কোডের সাথে মেলে না। নতুন কোড নিন।', 409);
}

/** The metadata request-otp sealed into verification_attempts.signup_payload. */
function payloadContext(payload: Record<string, unknown> | null | undefined): AccountContext {
  const source = payload ?? {};
  const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    email: text(source.email),
    universityId: text(source.universityId),
    // Challenges issued before explicit role selection were student-only.
    role: text(source.role) ?? 'student',
    hallId: text(source.hallId),
    departmentId: text(source.departmentId),
    programId: text(source.programId),
    programSession: text(source.programSession),
    fullName: text(source.fullName),
    studentId: text(source.studentId),
    purpose: text(source.purpose) ?? 'signin',
  };
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
 * the signed verified-session cookie, the signed quick-demo cookie, or a
 * Supabase session whose address is confirmed. `getUser()` also refreshes the
 * Supabase cookies via the SSR client, so the session is extended by asking.
 */
async function hasVerifiedSessionForEmail(email: string): Promise<boolean> {
  const verified = readVerifiedSession();
  if (verified && verified.email === email && verified.emailVerified) return true;
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
async function refreshOrEstablishSession(
  email: string,
  issued: AccountContext,
  submitted: AccountContext
): Promise<void> {
  try {
    const routeSupabase = createSupabaseRouteClient();
    const {
      data: { user },
    } = await routeSupabase.auth.getUser();
    if (user?.email?.trim().toLowerCase() === email && readVerifiedSession()?.email === email) return;
  } catch {
    /* fall through to a fresh mint */
  }

  try {
    const admin = createSupabaseAdminClient();
    const context = resolveAccountContext({ ...issued, email }, { ...submitted, email });
    const account = await ensureVerifiedAccount(admin, context);
    const supabaseSession = await establishSupabaseSession(email);
    issueVerifiedSession({
      id: account.userId,
      email,
      role: account.role,
      fullName: account.fullName,
      studentId: account.studentId,
      universityId: account.universityId,
      universityCode: account.universityCode,
      universityName: account.universityName,
      hallId: account.hallId,
      departmentId: account.departmentId,
      programId: account.programId,
      programSession: account.programSession,
      persistence: account.persisted ? 'supabase' : 'pending',
      needsOnboarding: account.needsOnboarding,
    });
    if (!supabaseSession) {
      authLog('verify-otp.idempotent-signed-cookie-session', { email: redactEmail(email) });
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
  admin: SupabaseClient,
  email: string,
  otp: string,
  cookieChallenge: OtpChallengeCookiePayload,
  submitted: AccountContext
): Promise<NextResponse> {
  authLog('verify-otp.cookie-fallback', { email: redactEmail(email) });

  if (cookieChallenge.purpose === 'signup' && !ProgramSessionSchema.safeParse(cookieChallenge.programSession).success) {
    return apiError('PROGRAM_SESSION_REQUIRED', 'Select a valid program session before creating your account.',
      'অ্যাকাউন্ট তৈরির আগে সঠিক প্রোগ্রাম সেশন নির্বাচন করুন।', 400);
  }

  // Best-effort: retire the database row too, when this instance can see it.
  if (cookieChallenge.challengeId) {
    await consumeOtpChallenge(admin, cookieChallenge.challengeId, { verified: true, clearHash: true });
  }
  await clearProfileDemoOtp(admin, email);

  return completeVerification(admin, {
    email,
    otp,
    issued: {
      email,
      universityId: cookieChallenge.universityId,
      role: cookieChallenge.role ?? 'student',
      hallId: cookieChallenge.hallId ?? null,
      departmentId: cookieChallenge.departmentId ?? null,
      programId: cookieChallenge.programId ?? null,
      programSession: cookieChallenge.programSession ?? null,
      fullName: cookieChallenge.fullName ?? null,
      studentId: cookieChallenge.studentId ?? null,
      purpose: cookieChallenge.purpose ?? 'signin',
    },
    submitted,
    challengeId: cookieChallenge.challengeId ?? null,
    secondsUsed: null,
    viaCookieFallback: true,
  });
}

// ---------------------------------------------------------------------------
// Account + session establishment (shared by the DB and cookie paths)
// ---------------------------------------------------------------------------

interface CompleteVerificationInput {
  email: string;
  otp: string;
  issued: AccountContext;
  submitted: AccountContext;
  challengeId: string | null;
  secondsUsed: number | null;
  viaCookieFallback: boolean;
}

/**
 * The code matched: provision the account, start the Supabase session when
 * possible, and ALWAYS leave the browser with a signed verified session.
 * Nothing in here returns an error response — a proven mailbox is a sign-in.
 */
async function completeVerification(
  admin: SupabaseClient,
  input: CompleteVerificationInput
): Promise<NextResponse> {
  const { email, otp } = input;
  const context = resolveAccountContext(input.issued, { ...input.submitted, email });
  const account = await ensureVerifiedAccount(admin, context);

  await authLogged('verify-otp.audit-insert-failed', () =>
    admin.from('audit_log').insert({
      university_id: account.universityId,
      actor_id: account.synthetic ? null : account.userId,
      action: 'EMAIL_OTP_VERIFIED',
      entity_type: 'PROFILE',
      entity_id: account.userId,
      metadata: {
        email: redactEmail(email),
        challenge_id: input.challengeId,
        seconds_used: input.secondsUsed,
        via_cookie_fallback: input.viaCookieFallback,
        profile_persisted: account.persisted,
        degraded: account.degraded,
        demo: isDemoAuthMode(),
      },
    })
  );

  // Supabase's own session cookies are the preferred transport, but they are
  // an optimization now — not a precondition for being signed in.
  const supabaseSession = await establishSupabaseSession(email);
  issueVerifiedSession({
    id: account.userId,
    email,
    role: account.role,
    fullName: account.fullName,
    studentId: account.studentId,
    universityId: account.universityId,
    universityCode: account.universityCode,
    universityName: account.universityName,
    hallId: account.hallId,
    departmentId: account.departmentId,
    programId: account.programId,
    programSession: account.programSession,
    persistence: account.persisted ? 'supabase' : 'pending',
    needsOnboarding: account.needsOnboarding,
  });

  // Retire the cookie backup + any stale preview OTP cookie, and seal a
  // short-lived verification receipt so duplicate submissions succeed.
  finalizeVerificationCookies(email, otp);

  const nextStep = account.isNewUser || (account.needsOnboarding && account.role !== 'admin')
    ? '/onboarding'
    : demoNextStep(normalizeDemoRole(account.role));

  authLog('verify-otp.verified', {
    email: redactEmail(email),
    role: account.role,
    newUser: account.isNewUser,
    profilePersisted: account.persisted,
    sessionMode: supabaseSession ? 'supabase' : 'signed-cookie',
    degraded: account.degraded,
  });

  return apiSuccess({
    ok: true,
    verified: true,
    userId: account.userId,
    user: {
      id: account.userId,
      email,
      role: account.role,
      fullName: account.fullName,
      universityId: account.universityId,
      hallId: account.hallId,
      departmentId: account.departmentId,
      programId: account.programId,
      programSession: account.programSession,
      emailVerified: true,
    },
    universityId: account.universityId,
    role: account.role,
    trustLevel: 'EMAIL_VERIFIED',
    challengeConsumed: true,
    profilePersisted: account.persisted,
    sessionMode: supabaseSession ? 'supabase' : 'signed-cookie',
    ...(account.degraded.length > 0 ? { degraded: account.degraded } : {}),
    ...(input.viaCookieFallback ? { viaCookieFallback: true } : {}),
    nextStep,
    redirectTo: nextStep,
  });
}

/**
 * Mint a magiclink with the service client and exchange it through the SSR
 * client so the Supabase session lands in cookies on path '/'. Best-effort:
 * a failure here is logged and answered by the signed verified-session cookie.
 */
async function establishSupabaseSession(email: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr) {
      authError('verify-otp.generate-link-failed', linkErr, { email: redactEmail(email) });
    }
    if (!linkData?.properties?.hashed_token) {
      authError('verify-otp.session-token-missing', linkErr ?? new Error('generateLink returned no hashed_token'), {
        email: redactEmail(email),
      });
      return false;
    }

    const routeSupabase = createSupabaseRouteClient();
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
      return false;
    }
    return true;
  } catch (error) {
    authError('verify-otp.session-establish-failed', error, { email: redactEmail(email) });
    return false;
  }
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
