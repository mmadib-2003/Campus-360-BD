// apps/web/app/api/auth/request-otp/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { issueDemoChallenge } from '@/lib/demo-auth';
import { computeDemoOtp, demoOtpExpiresAt, isDemoAuthMode } from '@/lib/demo-otp';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
  // Track B — Demo OTP: deterministic 6-digit code per email when AUTH_MODE=demo.
  const demoMode = isDemoAuthMode();

  if (!isSupabaseServerConfigured()) {
    const demoCode = await computeDemoOtp(rawEmail);
    const demo = issueDemoChallenge({
      email: rawEmail,
      universityId,
      role: body?.role ?? body?.signupPayload?.role,
      fullName: body?.signupPayload?.fullName,
      studentId: body?.signupPayload?.studentId,
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
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        cooldownSeconds: 0,
        demoCode: demo.challenge.code,
        demo: true,
      },
      200,
      undefined,
      rlEmail.headers
    );
  }

  const admin = createSupabaseAdminClient();

  // Enforce University Email Domain Whitelist Server-Side
  let domainQuery = admin
    .from('university_email_domains')
    .select('id, university_id, domain, universities!inner(id, code, name_en, name_bn, is_active)')
    .eq('domain', emailDomain)
    .eq('is_active', true);

  if (universityId) {
    domainQuery = domainQuery.eq('university_id', universityId);
  }

  const { data: domainMatch } = await domainQuery.maybeSingle();

  if (!domainMatch) {
    return apiError(
      'DOMAIN_NOT_WHITELISTED',
      `The email domain @${emailDomain} is not on the approved Bangladesh public university registry.`,
      `@${emailDomain} ডোমেইনটি অনুমোদিত পাবলিক বিশ্ববিদ্যালয়ের তালিকায় নেই। আপনার প্রাতিষ্ঠানিক ইমেইল ব্যবহার করুন।`,
      403,
      undefined,
      rlEmail.headers
    );
  }

  // Enforce 60s resend cooldown per email
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { data: recentAttempt } = await admin
    .from('verification_attempts')
    .select('created_at')
    .eq('email', rawEmail)
    .gte('created_at', sixtySecondsAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentAttempt) {
    return apiError(
      'OTP_COOLDOWN',
      'Please wait 60 seconds before requesting another OTP code.',
      'নতুন ওটিপি কোডের জন্য অনুগ্রহ করে ৬০ সেকেন্ড অপেক্ষা করুন।',
      429,
      undefined,
      rlEmail.headers
    );
  }

  // Track B (demo): deterministic code per email. Track A (production): a
  // CSPRNG 6-digit OTP (100000 - 999999) delivered over custom SMTP — the
  // Supabase default provider only mails team members (2/hour project cap).
  const otpCode = demoMode ? await computeDemoOtp(rawEmail) : String(crypto.randomInt(100000, 1000000));
  const pepper = process.env.OTP_PEPPER_SECRET || 'default-dev-pepper-override-in-prod';
  const otpHash = crypto
    .createHmac('sha256', pepper)
    .update(`${rawEmail}:${otpCode}`)
    .digest('hex');

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const { error: insertErr } = await admin.from('verification_attempts').insert({
    email: rawEmail,
    university_id: domainMatch.university_id,
    otp_hash: otpHash,
    ip_address: ipAddress,
    max_attempts: 5,
    expires_at: expiresAt,
    signup_payload: { ...(body?.signupPayload ?? {}), role: body?.role ?? body?.signupPayload?.role ?? 'student' },
  });

  if (insertErr) {
    return apiError('DB_ERROR', 'Could not create verification challenge.', 'যাচাইকরণ প্রক্রিয়া শুরু করা যায়নি।', 500);
  }

  // Track B: persist the demo code in profiles.demo_otp with a 10-minute TTL
  // (pre-signup users get it on profile creation in /api/auth/verify-otp).
  if (demoMode) {
    await admin
      .from('profiles')
      .update({ demo_otp: otpCode, demo_otp_expires_at: demoOtpExpiresAt() })
      .eq('email', rawEmail);
  }

  // Track A — dispatch bilingual OTP via custom SMTP (Resend). Skipped in demo
  // mode so the scarce SMTP quota is never burned by the fallback path.
  if (!demoMode && process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM_ADDRESS || 'Campus360 BD <no-reply@campus360bd.com>',
        to: [rawEmail],
        subject: `Your Campus360 BD Verification Code: ${otpCode} / আপনার যাচাইকরণ কোড`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <h2 style="color: #059669; margin-top: 0;">Campus360 BD — University Verification</h2>
            <p>Your 6-digit verification code (valid for 10 minutes):</p>
            <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 16px; background: #ecfdf5; color: #065f46; border-radius: 12px; text-align: center;">
              ${otpCode}
            </div>
            <p style="margin-top: 16px;">আপনার ৬-সংখ্যার যাচাইকরণ কোড (১০ মিনিটের জন্য কার্যকর): <strong>${otpCode}</strong></p>
          </div>
        `,
      }),
    });
  }

  return apiSuccess(
    {
      email: rawEmail,
      universityId: domainMatch.university_id,
      expiresAt,
      cooldownSeconds: 60,
      // Track B — Demo OTP panel payload (rendered only when
      // NEXT_PUBLIC_AUTH_MODE === 'demo' on the verification screen).
      ...(demoMode ? { demo: true, demoCode: otpCode } : {}),
    },
    200,
    undefined,
    rlEmail.headers
  );
}
