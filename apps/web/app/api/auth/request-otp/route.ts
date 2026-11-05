// apps/web/app/api/auth/request-otp/route.ts
// ============================================================================
// Step 1 of the email OTP flow: whitelist the institutional domain, mint a
// 6-digit CSPRNG code, persist its HMAC digest + 5-minute expiry in Supabase,
// and deliver the code to the inbox in real time over Gmail SMTP (Nodemailer).
//
//   POST /api/auth/request-otp
//   { email, universityId?, role?, signupPayload?: { fullName, studentId, ... } }
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
import { otpSecurityConfigError } from '@/lib/otp-crypto';
import {
  createOtpChallenge,
  deleteOtpChallenge,
  isOtpRequestInCooldown,
  markOtpEmailSent,
  storeProfileDemoOtp,
} from '@/lib/otp-store';

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
  const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const universityId = typeof body?.universityId === 'string' ? body.universityId : undefined;

  if (!rawEmail || !rawEmail.includes('@')) {
    return apiError(
      'INVALID_EMAIL',
      'Please enter a valid institutional email address.',
      'অনুগ্রহ করে একটি সঠিক বিশ্ববিদ্যালয়ের ইমেইল প্রদান করুন।',
      400
    );
  }

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

  // Local preview with no Supabase credentials: cookie-backed demo challenge.
  if (!isSupabaseServerConfigured()) {
    const demoCode = await computeDemoOtp(rawEmail);
    const demoExpiresAt = otpExpiresAt();
    const demo = issueDemoChallenge({
      email: rawEmail,
      universityId,
      role: body?.role ?? body?.signupPayload?.role,
      fullName: body?.signupPayload?.fullName,
      studentId: body?.signupPayload?.studentId,
      hallId: body?.signupPayload?.hallId,
      code: demoCode,
    });
    if (!demo.ok) {
      return apiError('DOMAIN_NOT_WHITELISTED', demo.error, demo.errorBn, demo.status);
    }
    return apiSuccess(
      {
        email: rawEmail,
        universityId: demo.challenge.universityId,
        role: demo.challenge.role,
        expiresAt: demoExpiresAt,
        secondsRemaining: remainingOtpSeconds(demoExpiresAt),
        cooldownSeconds: 0,
        demoCode: demo.challenge.code,
        demo: true,
      },
      200,
      { delivery: 'demo' },
      rlEmail.headers
    );
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

  // Enforce University Email Domain Whitelist Server-Side.
  //
  let domainQuery = admin
    .from('university_email_domains')
    .select('id, university_id, domain, universities!inner(id, code, name_en, name_bn, is_active)')
    .eq('domain', emailDomain)
    .eq('is_active', true)
    .eq('universities.is_active', true);

  if (universityId) {
    domainQuery = domainQuery.eq('university_id', universityId);
  }

  const { data: domainMatch, error: domainError } = await domainQuery.maybeSingle();

  if (domainError) {
    // This is NOT "your domain is not approved". Reading the registry can fail
    // for its own reasons (missing relation, JWT/role issue, transient PostgREST
    // error) and telling a student their address is unlisted sends them to the
    // wrong support queue. Fail loudly, distinctly, and in the log.
    authError('request-otp.registry-lookup-failed', domainError, {
      attemptedDomain: emailDomain,
      universityId: universityId ?? null,
    });
    return apiError(
      'AUTH_REGISTRY_UNAVAILABLE',
      'The university registry could not be read right now. Please try again shortly.',
      'বিশ্ববিদ্যালয়ের তালিকা এই মুহূর্তে পড়া যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      503,
      undefined,
      rlEmail.headers
    );
  }

  if (!domainMatch) {
    authLog('request-otp.domain-not-whitelisted', {
      attemptedDomain: emailDomain,
      universityId: universityId ?? null,
      note: 'no active row in university_email_domains for this domain',
    });
    return apiError(
      'DOMAIN_NOT_WHITELISTED',
      `The email domain @${emailDomain} is not on the approved Bangladesh public university registry.`,
      `@${emailDomain} ডোমেইনটি অনুমোদিত পাবলিক বিশ্ববিদ্যালয়ের তালিকায় নেই। আপনার প্রাতিষ্ঠানিক ইমেইল ব্যবহার করুন।`,
      403,
      undefined,
      rlEmail.headers
    );
  }

  const hallId = typeof body?.signupPayload?.hallId === 'string' ? body.signupPayload.hallId : '';
  if (hallId) {
    const { data: hall, error: hallError } = await admin.from('university_halls').select('id')
      .eq('id', hallId).eq('university_id', domainMatch.university_id).eq('is_active', true).maybeSingle();
    if (hallError) return apiError('HALL_LOOKUP_FAILED', 'Could not validate the selected hall.', 'হল যাচাই করা যায়নি।', 503);
    if (!hall) return apiError('INVALID_HALL', 'Please select a hall belonging to your university.', 'আপনার বিশ্ববিদ্যালয়ের হল নির্বাচন করুন।', 400);
  }

  const university = (domainMatch.universities ?? {}) as { code?: string; name_en?: string; name_bn?: string };

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
  const signupPayload = {
    ...(body?.signupPayload ?? {}),
    role: body?.role ?? body?.signupPayload?.role ?? 'student',
  };

  // Store the digest + 5-minute expiry in Supabase first: the code must be
  // verifiable the instant the email lands, and the row's id seeds the
  // Message-ID so a retried request cannot produce a second, competing code.
  const challenge = await createOtpChallenge({
    admin,
    email: rawEmail,
    universityId: domainMatch.university_id,
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
        universityId: domainMatch.university_id,
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
    authError('request-otp.delivery-failed', new Error(delivery.error), {
      email: redactEmail(rawEmail),
      provider: delivery.provider,
      retryable: delivery.retryable,
      challengeId: challenge.id,
      cooldownCleared: true,
    });
    try {
      await admin.from('audit_log').insert({
        university_id: domainMatch.university_id,
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
      universityId: domainMatch.university_id,
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
