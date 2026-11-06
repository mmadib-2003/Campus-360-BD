// apps/web/app/api/auth/request-otp/route.ts
// ============================================================================
// Step 1 of the email OTP flow: apply role/email/hall rules, mint a
// 6-digit CSPRNG code, persist its HMAC digest + 5-minute expiry in Supabase,
// and deliver the code to the inbox in real time over Gmail SMTP (Nodemailer).
//
//   POST /api/auth/request-otp
//   { email, universityId, role, hallId?, programSession?, purpose?, signupPayload? }
//
// The plaintext code is returned to the client ONLY on the Track B demo path
// (no SMTP credentials + NEXT_PUBLIC_AUTH_MODE=demo). On the real path the
// response carries the expiry and cooldown — never the code, which exists only
// inside the email.
// ============================================================================
import { NextRequest } from 'next/server';
import { authError, authLog } from '@/lib/auth-log';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueDemoChallenge } from '@/lib/demo-auth';
import { DEMO_UNIVERSITIES, DEMO_UNIVERSITY_HALLS } from '@/lib/modules/demo-data';
import { matchesUniversityDomain } from '@/lib/auth-rules';
import { ProgramSessionSchema, RequestOtpSchema } from '@campus360/shared';
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  computeDemoOtp,
  generateOtpCode,
  isDemoAuthMode,
  otpExpiresAt,
  redactEmail,
  remainingOtpSeconds,
} from '@/lib/demo-otp';
import { isSmtpConfigured, sendOtpEmail } from '@/lib/otp-email';
import { hashOtp, otpSecurityConfigError } from '@/lib/otp-crypto';
import {
  createOtpChallenge,
  deleteOtpChallenge,
  isOtpRequestInCooldown,
  markOtpEmailSent,
  storeProfileDemoOtp,
} from '@/lib/otp-store';
import { clearOtpChallengeCookie, setOtpChallengeCookie } from '@/lib/otp-challenge-cookie';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    return await handleOtpRequest(req);
  } catch (error) {
    // A throw inside this handler would otherwise reach the browser as Next.js's
    // HTML error page, which the sign-in client cannot parse — it shows up as
    // "the button did nothing". Every failure mode must be JSON + logged.
    authError('request-otp.unhandled', error);
    return apiError(
      'OTP_REQUEST_FAILED',
      'The verification request could not be completed. Please try again.',
      'যাচাইকরণ অনুরোধটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      500
    );
  }
}

async function handleOtpRequest(req: NextRequest) {
  const body = await req.json().catch(() => null);
  // Keep the separate institutional administrator login compatible. Public
  // forms cannot request admin/governance: the shared schema allows only the
  // three public roles, and verification never accepts a replacement role.
  const legacyAdmin = body?.role === 'admin' || body?.signupPayload?.role === 'admin';
  const validation = RequestOtpSchema.safeParse(body);
  if (!legacyAdmin && !validation.success) {
    return apiError('INVALID_OTP_CONTEXT',
      validation.error?.issues[0]?.message ?? 'Check your email, role, hall and program session.',
      'ইমেইল, ভূমিকা, হল ও প্রোগ্রাম সেশন যাচাই করুন।', 400);
  }
  const input = validation.success ? validation.data : {
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
    universityId: typeof body?.universityId === 'string' ? body.universityId : undefined,
    role: 'admin', hallId: null, programSession: undefined, purpose: undefined,
    signupPayload: body?.signupPayload ?? {},
  };
  const rawEmail = input.email;
  const universityId = input.universityId;
  const role = input.role ?? input.signupPayload?.role ?? 'student';
  const hallId = role === 'student' ? (input.hallId ?? input.signupPayload?.hallId ?? null) : null;
  const programSession = input.programSession ?? input.signupPayload?.programSession ?? null;
  if (legacyAdmin && (!rawEmail.includes('@') || (programSession && !ProgramSessionSchema.safeParse(programSession).success))) {
    return apiError('INVALID_EMAIL', 'Please enter a valid institutional email address.',
      'অনুগ্রহ করে একটি সঠিক বিশ্ববিদ্যালয়ের ইমেইল প্রদান করুন।', 400);
  }
  const signupPayload = { ...input.signupPayload, role, hallId, programSession, purpose: input.purpose ?? 'signin' };

  const rlIp = checkRateLimit(req, 'otp-ip', 10, 600);
  const rlEmail = checkRateLimit(req, 'otp-email', 5, 600, rawEmail);
  if (!rlIp.allowed || !rlEmail.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many OTP requests. Please wait before trying again.',
      'অতিরিক্ত ওটিপি অনুরোধ করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।',
      429,
      undefined,
      rlEmail.headers
    );
  }

  const emailDomain = rawEmail.split('@')[1];
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') ?? 'unknown';

  // Local preview with no Supabase credentials. The quick-demo endpoint is
  // untouched; ordinary role-based OTP uses the same signed backup as production.
  if (!isSupabaseServerConfigured()) {
    if (legacyAdmin) {
      const demoCode = await computeDemoOtp(rawEmail);
      const demo = issueDemoChallenge({ email: rawEmail, universityId, role: 'admin',
        fullName: signupPayload.fullName, studentId: signupPayload.studentId, code: demoCode });
      if (!demo.ok) return apiError('DOMAIN_NOT_WHITELISTED', demo.error, demo.errorBn, demo.status);
      return apiSuccess({ email: rawEmail, universityId: demo.challenge.universityId, role,
        expiresAt: otpExpiresAt(), secondsRemaining: OTP_TTL_SECONDS, cooldownSeconds: 0,
        demoCode, demo: true }, 200, { delivery: 'demo' }, rlEmail.headers);
    }
    const university = DEMO_UNIVERSITIES.find((entry) => entry.id === universityId || entry.code === universityId);
    if (!university) return apiError('INVALID_UNIVERSITY', 'Select your university.', 'আপনার বিশ্ববিদ্যালয় নির্বাচন করুন।', 400);
    if (role === 'student' && !matchesUniversityDomain(rawEmail, university.domains)) {
      return apiError('DOMAIN_NOT_WHITELISTED', 'Students must use an approved email domain for the selected university.',
        'শিক্ষার্থীদের নির্বাচিত বিশ্ববিদ্যালয়ের অনুমোদিত ইমেইল ডোমেইন ব্যবহার করতে হবে।', 403);
    }
    const hall = role === 'student' ? DEMO_UNIVERSITY_HALLS.find((entry) => entry.id === hallId && entry.universityCode === university.code) : null;
    if (role === 'student' && !hall) return apiError('INVALID_HALL', 'Select a residential hall at your university.', 'আপনার বিশ্ববিদ্যালয়ের আবাসিক হল নির্বাচন করুন।', 400);
    if (otpSecurityConfigError()) return apiError('AUTH_CONFIG_UNAVAILABLE', 'OTP signing is not configured.', 'ওটিপি স্বাক্ষর কনফিগার করা নেই।', 503);
    const demoCode = await computeDemoOtp(rawEmail);
    const expiresAt = otpExpiresAt();
    setOtpChallengeCookie({ email: rawEmail, otpHash: hashOtp(rawEmail, demoCode), expiresAt,
      universityId: university.id, role, hallId, programSession,
      fullName: signupPayload.fullName ?? null, studentId: signupPayload.studentId ?? null,
      departmentId: signupPayload.departmentId || null, programId: signupPayload.programId || null,
      purpose: signupPayload.purpose });
    return apiSuccess({ email: rawEmail, universityId: university.id, role, expiresAt,
      secondsRemaining: remainingOtpSeconds(expiresAt), cooldownSeconds: 0, demoCode, demo: true },
      200, { delivery: 'demo' }, rlEmail.headers);
  }

  if (otpSecurityConfigError()) {
    return apiError(
      'AUTH_CONFIG_UNAVAILABLE',
      'The server is not ready to issue OTP codes. Please contact support.',
      'সার্ভার এই মুহূর্তে ওটিপি কোড তৈরি করতে পারছে না। অনুগ্রহ করে সহায়তার সাথে যোগাযোগ করুন।',
      503
    );
  }

  const admin = createSupabaseAdminClient();

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((universityId && !uuidPattern.test(universityId)) || (hallId && !uuidPattern.test(hallId))) {
    return apiError('INVALID_SELECTION', 'Select a valid university and hall.', 'সঠিক বিশ্ববিদ্যালয় ও হল নির্বাচন করুন।', 400);
  }
  // Students (and legacy admins) must match an active approved domain. Faculty
  // and alumni use any valid email; their tenant comes from the selected active
  // university, never from a personal-email domain or a default campus.
  let registry: { university_id: string; universities: { code?: string; name_en?: string; name_bn?: string } } | null = null;
  if (role === 'student' || legacyAdmin) {
    let domainQuery = admin.from('university_email_domains')
      .select('id, university_id, domain, universities!inner(id, code, name_en, name_bn, is_active)')
      .eq('domain', emailDomain).eq('is_active', true).eq('universities.is_active', true);
    if (universityId) domainQuery = domainQuery.eq('university_id', universityId);
    const { data, error } = await domainQuery.maybeSingle();
    if (error) {
      authError('request-otp.registry-lookup-failed', error, { attemptedDomain: emailDomain, universityId: universityId ?? null });
    } else if (data) {
      const joined = Array.isArray(data.universities) ? data.universities[0] : data.universities;
      registry = { university_id: data.university_id, universities: joined ?? {} };
    }
    if (!registry) {
      if (error) return apiError('AUTH_REGISTRY_UNAVAILABLE',
        'The university registry could not be read right now. Please try again shortly.',
        'বিশ্ববিদ্যালয়ের তালিকা পড়া যাচ্ছে না। আবার চেষ্টা করুন।', 503, undefined, rlEmail.headers);
      authLog('request-otp.domain-not-whitelisted', { attemptedDomain: emailDomain, universityId: universityId ?? null });
      return apiError('DOMAIN_NOT_WHITELISTED',
        `The email domain @${emailDomain} is not approved for the selected university.`,
        `@${emailDomain} ডোমেইনটি নির্বাচিত বিশ্ববিদ্যালয়ের জন্য অনুমোদিত নয়।`, 403, undefined, rlEmail.headers);
    }
  } else {
    const { data, error } = await admin.from('universities').select('id, code, name_en, name_bn')
      .eq('id', universityId!).eq('is_active', true).maybeSingle();
    if (error) {
      authError('request-otp.registry-lookup-failed', error, { universityId });
      return apiError('AUTH_REGISTRY_UNAVAILABLE', 'The university registry is unavailable. Please try again.',
        'বিশ্ববিদ্যালয়ের তালিকা পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।', 503);
    }
    if (!data) return apiError('INVALID_UNIVERSITY', 'Select an active supported university.', 'একটি সক্রিয় সমর্থিত বিশ্ববিদ্যালয় নির্বাচন করুন।', 400);
    registry = { university_id: data.id, universities: data };
  }
  const tenantId = registry.university_id;
  const university = registry.universities;
  if (role === 'student') {
    if (!hallId) return apiError('HALL_REQUIRED', 'Students must select a residential hall.', 'শিক্ষার্থীদের আবাসিক হল নির্বাচন করতে হবে।', 400);
    const { data: hall, error } = await admin.from('university_halls').select('id')
      .eq('id', hallId).eq('university_id', tenantId).eq('is_active', true).maybeSingle();
    if (error) return apiError('HALL_LOOKUP_FAILED', 'Could not validate the selected hall.', 'হল যাচাই করা যায়নি।', 503);
    if (!hall) return apiError('INVALID_HALL', 'Please select a hall belonging to your university.', 'আপনার বিশ্ববিদ্যালয়ের হল নির্বাচন করুন।', 400);
  }

  // Enforce the 60s resend cooldown per email.
  if (await isOtpRequestInCooldown(admin, rawEmail, OTP_RESEND_COOLDOWN_SECONDS)) {
    return apiError(
      'OTP_COOLDOWN',
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP code.`,
      `নতুন ওটিপি কোডের জন্য অনুগ্রহ করে ${OTP_RESEND_COOLDOWN_SECONDS} সেকেন্ড অপেক্ষা করুন।`,
      429,
      { retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS },
      rlEmail.headers
    );
  }

  // Track A (real email) is the default. Track B (deterministic demo code in
  // the panel) only applies while no SMTP credentials are configured — setting
  // GMAIL_USER + GMAIL_APP_PASSWORD promotes the deployment to real delivery.
  const mailConfigured = isSmtpConfigured();
  const demoMode = isDemoAuthMode() && !mailConfigured;

  if (!mailConfigured && !demoMode) {
    return apiError(
      'EMAIL_PROVIDER_NOT_CONFIGURED',
      'OTP email delivery is not configured on this server (missing GMAIL_USER / GMAIL_APP_PASSWORD).',
      'এই সার্ভারে ওটিপি ইমেইল পাঠানো সেটআপ করা নেই (GMAIL_USER / GMAIL_APP_PASSWORD অনুপস্থিত)।',
      503
    );
  }

  // Track A: CSPRNG 6-digit code (100000–999999). Track B: SHA-256(email)
  // derivation so the offline panel can show the same value client-side.
  const otpCode = demoMode ? await computeDemoOtp(rawEmail) : generateOtpCode();

  // Store the digest + 5-minute expiry in Supabase first: the code must be
  // verifiable the instant the email lands, and the row's id seeds the
  // Message-ID so a retried request cannot produce a second, competing code.
  const challenge = await createOtpChallenge({
    admin,
    email: rawEmail,
    universityId: tenantId,
    code: otpCode,
    ipAddress,
    signupPayload,
  });

  if (!challenge.ok) {
    // The store returns the PostgREST message; surface it to the operator, not
    // to the browser (it can name columns and constraints).
    authError('request-otp.challenge-store-failed', new Error(challenge.error), {
      email: redactEmail(rawEmail),
    });
    return apiError(
      'DB_ERROR',
      'Could not create verification challenge.',
      'যাচাইকরণ প্রক্রিয়া শুরু করা যায়নি।',
      500
    );
  }

  // Serverless-safe backup: seal the same digest into an HTTP-only HMAC-signed
  // cookie so a verify-otp call that lands on a different Vercel instance (or
  // hits a transient RLS/cold-start miss on verification_attempts) can still
  // validate the code. Digest only — the plaintext code never leaves the email.
  setOtpChallengeCookie({
    email: rawEmail,
    otpHash: hashOtp(rawEmail, otpCode),
    expiresAt: challenge.expiresAt,
    universityId: tenantId,
    hallId: typeof signupPayload.hallId === 'string' ? signupPayload.hallId : null,
    departmentId: typeof signupPayload.departmentId === 'string' ? signupPayload.departmentId : null,
    programId: typeof signupPayload.programId === 'string' ? signupPayload.programId : null,
    fullName: typeof signupPayload.fullName === 'string' ? signupPayload.fullName : null,
    studentId: typeof signupPayload.studentId === 'string' ? signupPayload.studentId : null,
    role,
    programSession,
    purpose: signupPayload.purpose,
    challengeId: challenge.id,
  });

  if (demoMode) {
    // No email is sent: mirror the code onto profiles.demo_otp for the panel
    // and for the pre-signup case where the profile does not exist yet.
    // Best-effort bookkeeping: a failed mirror write must not lose the code the
    // panel already has, so it is logged and swallowed rather than thrown.
    try {
      await storeProfileDemoOtp(admin, rawEmail, otpCode, challenge.expiresAt);
    } catch (error) {
      authError('request-otp.demo-mirror-failed', error, { email: redactEmail(rawEmail) });
    }
    return apiSuccess(
      {
        email: rawEmail,
        universityId: tenantId,
        role,
        expiresAt: challenge.expiresAt,
        secondsRemaining: challenge.secondsRemaining,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        ttlSeconds: OTP_TTL_SECONDS,
        demo: true,
        demoCode: otpCode,
      },
      200,
      { delivery: 'demo' },
      rlEmail.headers
    );
  }

  const delivery = await sendOtpEmail({
    to: rawEmail,
    code: otpCode,
    expiresAt: challenge.expiresAt,
    ttlSeconds: OTP_TTL_SECONDS,
    fullName: typeof signupPayload.fullName === 'string' ? signupPayload.fullName : null,
    universityName: university.name_en ?? university.name_bn ?? null,
    universityCode: university.code ?? null,
    idempotencyKey: challenge.id,
  });

  if (!delivery.ok) {
    // Roll the challenge back: an undelivered code must not sit in the table
    // (and deleting it clears the 60s cooldown so the user can retry now).
    await deleteOtpChallenge(admin, challenge.id);
    clearOtpChallengeCookie(); // the cookie backup must die with the row
    authError('request-otp.delivery-failed', new Error(delivery.error), {
      email: redactEmail(rawEmail),
      provider: delivery.provider,
      retryable: delivery.retryable,
      challengeId: challenge.id,
      cooldownCleared: true,
    });
    try {
      await admin.from('audit_log').insert({
        university_id: tenantId,
        action: 'OTP_DELIVERY_FAILED',
        entity_type: 'VERIFICATION_ATTEMPT',
        entity_id: challenge.id,
        metadata: { email: redactEmail(rawEmail), provider: delivery.provider, error: delivery.error },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (error) {
      // The user already has their answer; a broken audit trail is a secondary
      // fault and must not convert a 502 into an unhandled 500.
      authError('request-otp.audit-insert-failed', error, { challengeId: challenge.id });
    }

    return apiError(
      'OTP_DELIVERY_FAILED',
      delivery.retryable
        ? 'We could not send the verification email. Please try again in a moment.'
        : 'Email delivery is unavailable for this address. Please contact support.',
      'যাচাইকরণ ইমেইল পাঠানো যায়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      delivery.retryable ? 502 : 503,
      { retryable: delivery.retryable },
      rlEmail.headers
    );
  }

  try {
    await markOtpEmailSent(admin, challenge.id, delivery.messageId);
  } catch (error) {
    // The email is already in the recipient's inbox: losing the delivery_status
    // write must never fail the request the user is waiting on.
    authError('request-otp.mark-sent-failed', error, { challengeId: challenge.id });
  }

  authLog('request-otp.issued', {
    email: redactEmail(rawEmail),
    universityCode: university.code ?? null,
    challengeId: challenge.id,
    messageId: delivery.messageId,
    secondsRemaining: remainingOtpSeconds(challenge.expiresAt),
  });

  return apiSuccess(
    {
      email: rawEmail,
      universityId: tenantId,
      universityCode: university.code ?? null,
      expiresAt: challenge.expiresAt,
      secondsRemaining: remainingOtpSeconds(challenge.expiresAt),
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      ttlSeconds: OTP_TTL_SECONDS,
      delivery: 'email',
      messageId: delivery.messageId,
    },
    200,
    { delivery: delivery.provider },
    rlEmail.headers
  );
}
