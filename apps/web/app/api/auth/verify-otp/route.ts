// apps/web/app/api/auth/verify-otp/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { demoNextStep, verifyDemoChallenge } from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'verify-otp', 10, 600);
  if (!rl.allowed) {
    return apiError('RATE_LIMITED', 'Too many verification attempts.', 'অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে।', 429);
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';

  if (!email || !/^\d{6}$/.test(otp)) {
    return apiError('INVALID_INPUT', 'A valid email and 6-digit OTP are required.', 'সঠিক ইমেইল এবং ৬-সংখ্যার ওটিপি প্রয়োজন।', 400);
  }

  if (!isSupabaseServerConfigured()) {
    const demo = verifyDemoChallenge(email, otp);
    if (!demo.ok) {
      return apiError('INVALID_OTP', demo.error, demo.errorBn, demo.status);
    }
    return apiSuccess({
      verified: true,
      demo: true,
      role: demo.session.role,
      universityId: demo.session.universityId,
      nextStep: demoNextStep(demo.session.role),
      trustLevel: 'EMAIL_VERIFIED',
    });
  }

  const admin = createSupabaseAdminClient();
  const { data: challenge } = await admin
    .from('verification_attempts')
    .select('*')
    .eq('email', email)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    return apiError('CHALLENGE_NOT_FOUND', 'No active OTP challenge found. Request a new code.', 'সক্রিয় ওটিপি পাওয়া যায়নি। নতুন কোড অনুরোধ করুন।', 404);
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return apiError('OTP_EXPIRED', 'This OTP has expired (10-minute TTL).', 'এই ওটিপির মেয়াদ শেষ হয়ে গেছে (১০ মিনিট)।', 410);
  }

  if (challenge.attempt_count >= challenge.max_attempts) {
    return apiError('MAX_ATTEMPTS_EXCEEDED', 'Maximum 5 attempts exceeded. Please request a new OTP.', 'সর্বোচ্চ ৫ বার ভুল চেষ্টা করা হয়েছে। নতুন ওটিপি নিন।', 429);
  }

  const pepper = process.env.OTP_PEPPER_SECRET || 'default-dev-pepper-override-in-prod';
  const candidateHash = crypto
    .createHmac('sha256', pepper)
    .update(`${email}:${otp}`)
    .digest('hex');

  const isMatch = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(challenge.otp_hash, 'hex')
  );

  if (!isMatch) {
    await admin
      .from('verification_attempts')
      .update({ attempt_count: challenge.attempt_count + 1 })
      .eq('id', challenge.id);

    return apiError(
      'INVALID_OTP',
      `Invalid OTP code. ${challenge.max_attempts - (challenge.attempt_count + 1)} attempts remaining.`,
      `ভুল ওটিপি কোড। আর ${challenge.max_attempts - (challenge.attempt_count + 1)} বার চেষ্টা করতে পারবেন।`,
      401
    );
  }

  // Mark challenge verified
  await admin
    .from('verification_attempts')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', challenge.id);

  // Provision or locate Supabase user + profile
  const payload = (challenge.signup_payload ?? {}) as Record<string, string>;
  let userId: string | undefined;

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, university_id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    userId = existingProfile.id;
    await admin
      .from('profiles')
      .update({ trust_level: 'EMAIL_VERIFIED' })
      .eq('id', userId)
      .eq('trust_level', 'UNVERIFIED');
  } else {
    const tempPassword = crypto.randomBytes(24).toString('hex');
    const { data: createdAuth, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        university_id: challenge.university_id,
        full_name: payload.fullName ?? email.split('@')[0],
      },
    });

    if (authErr || !createdAuth.user) {
      return apiError('AUTH_CREATE_FAILED', 'Failed to provision verified user account.', 'অ্যাকাউন্ট তৈরি করা যায়নি।', 500);
    }

    userId = createdAuth.user.id;
    await admin.from('profiles').insert({
      id: userId,
      university_id: challenge.university_id,
      department_id: payload.departmentId || null,
      hall_id: payload.hallId || null,
      email,
      full_name: payload.fullName || email.split('@')[0],
      student_id: payload.studentId || 'PENDING',
      trust_level: 'EMAIL_VERIFIED',
    });

    const requestedRole = String(payload.role ?? 'student').toLowerCase();
    const roleMap: Record<string, string> = {
      student: 'STUDENT',
      faculty: 'FACULTY',
      alumni: 'ALUMNI',
      admin: 'UNIVERSITY_ADMIN',
    };
    await admin.from('user_roles').insert({
      user_id: userId,
      university_id: challenge.university_id,
      role: roleMap[requestedRole] ?? 'STUDENT',
    });
  }

  await admin.from('audit_log').insert({
    university_id: challenge.university_id,
    actor_id: userId,
    action: 'EMAIL_OTP_VERIFIED',
    entity_type: 'PROFILE',
    entity_id: userId,
    metadata: { email },
  });

  // Generate session magic link token & exchange into cookie session
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const routeSupabase = createSupabaseRouteClient();
  if (linkData?.properties?.hashed_token) {
    await routeSupabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    });
  }

  const requestedRole = String(payload.role ?? 'student').toLowerCase();
  return apiSuccess({
    verified: true,
    userId,
    universityId: challenge.university_id,
    role: requestedRole,
    trustLevel: 'EMAIL_VERIFIED',
    nextStep: existingProfile ? demoNextStep(requestedRole as 'student' | 'faculty' | 'alumni' | 'admin') : '/onboarding',
  });
}
