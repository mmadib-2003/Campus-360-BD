// apps/web/app/api/profile/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { ProgramSessionSchema } from '@campus360/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, universities(*), departments(*), halls:university_halls(*)')
    .eq('id', user.id)
    .single();

  return apiSuccess(profile);
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError('INVALID_INPUT', 'A profile update object is required.', 'প্রোফাইল আপডেটের তথ্য প্রয়োজন।', 400);
  }
  const { data: current, error: readError } = await supabase.from('profiles')
    .select('id, university_id, role, hall_id, program_session').eq('id', user.id).single();
  if (readError || !current) return apiError('PROFILE_NOT_FOUND', 'Your profile could not be loaded.', 'আপনার প্রোফাইল লোড করা যায়নি।', 404);
  const { data: roleRows, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (roleError) return apiError('PROFILE_LOOKUP_FAILED', 'Your account role could not be verified.', 'অ্যাকাউন্টের ভূমিকা যাচাই করা যায়নি।', 503);
  const roles = (roleRows ?? []).map((row) => String(row.role).toLowerCase());
  const privileged = roles.some((role) => ['admin', 'super_admin', 'university_admin', 'governance', 'governing_body'].includes(role));
  const role = privileged ? 'admin' : roles[0] ?? String(current.role ?? 'student').toLowerCase();

  // Never spread the request into a database write: role, email, university and
  // trust fields are not self-service. Omitted fields retain their stored value.
  const allowedUpdates: Record<string, unknown> = {};
  for (const key of ['full_name', 'department_id', 'program_id', 'batch', 'bio', 'avatar_url',
    'interests', 'crisis_callback_phone', 'preferred_language'] as const) {
    if (body[key] !== undefined) allowedUpdates[key] = body[key];
  }
  // Keep the academic-program contract explicit (migration 0012).
  if (body.program_id !== undefined) allowedUpdates.program_id = body.program_id;
  if (body.crisis_callback_consent !== undefined) allowedUpdates.crisis_callback_consent = Boolean(body.crisis_callback_consent);
  if (body.full_name !== undefined && (typeof body.full_name !== 'string' || !body.full_name.trim())) {
    return apiError('INVALID_NAME', 'Enter your full name.', 'আপনার পূর্ণ নাম লিখুন।', 400);
  }
  if (typeof allowedUpdates.full_name === 'string') allowedUpdates.full_name = allowedUpdates.full_name.trim();
  if (body.preferred_language !== undefined && !['en', 'bn'].includes(body.preferred_language)) {
    return apiError('INVALID_LANGUAGE', 'Choose English or Bangla.', 'ইংরেজি বা বাংলা নির্বাচন করুন।', 400);
  }
  for (const key of ['department_id', 'program_id'] as const) {
    const value = allowedUpdates[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value))) {
      return apiError('INVALID_SELECTION', 'Select a valid academic department and program.', 'সঠিক বিভাগ ও প্রোগ্রাম নির্বাচন করুন।', 400);
    }
  }
  if (body.program_session !== undefined) {
    const parsed = ProgramSessionSchema.safeParse(body.program_session);
    if (!parsed.success) return apiError('INVALID_PROGRAM_SESSION',
      'Enter consecutive years in YYYY-YY format, for example 2023-24.',
      'YYYY-YY format-এ ধারাবাহিক বছর লিখুন, যেমন 2023-24।', 400);
    allowedUpdates.program_session = parsed.data;
  }
  let hallId = current.hall_id;
  if (body.hall_id !== undefined) {
    if (role !== 'student') {
      if (body.hall_id !== null) return apiError('HALL_NOT_ALLOWED', 'Only students may submit a residential hall.', 'শুধু শিক্ষার্থীরা আবাসিক হল জমা দিতে পারেন।', 400);
      hallId = null;
    } else {
      if (typeof body.hall_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.hall_id)) {
        return apiError('INVALID_HALL', 'Select your residential hall.', 'আপনার আবাসিক হল নির্বাচন করুন।', 400);
      }
      const { data: hall, error } = await supabase.from('university_halls').select('id')
        .eq('id', body.hall_id).eq('university_id', current.university_id).eq('is_active', true).maybeSingle();
      if (error) return apiError('HALL_LOOKUP_FAILED', 'Could not validate the selected hall.', 'হল যাচাই করা যায়নি।', 503);
      if (!hall) return apiError('INVALID_HALL', 'Select a hall belonging to your university.', 'আপনার বিশ্ববিদ্যালয়ের হল নির্বাচন করুন।', 400);
      hallId = hall.id;
    }
    allowedUpdates.hall_id = hallId;
  }
  const completing = body.onboarding_completed === true;
  const storedSession = allowedUpdates.program_session ?? current.program_session;
  if (completing && !ProgramSessionSchema.safeParse(storedSession).success) {
    return apiError('PROGRAM_SESSION_REQUIRED', 'Select your program session before completing onboarding.',
      'অনবোর্ডিং সম্পূর্ণ করার আগে প্রোগ্রাম সেশন নির্বাচন করুন।', 400);
  }
  if (completing && role === 'student' && !hallId) {
    return apiError('HALL_REQUIRED', 'Students must select a residential hall.', 'শিক্ষার্থীদের আবাসিক হল নির্বাচন করতে হবে।', 400);
  }
  if (body.onboarding_completed !== undefined) {
    if (typeof body.onboarding_completed !== 'boolean') return apiError('INVALID_INPUT', 'Invalid onboarding status.', 'অনবোর্ডিং স্ট্যাটাস সঠিক নয়।', 400);
    allowedUpdates.onboarding_completed = body.onboarding_completed;
  }
  if (Object.keys(allowedUpdates).length === 0) return apiSuccess(current);

  const { data, error } = await supabase.from('profiles').update(allowedUpdates)
    .eq('id', user.id).select('*').single();
  if (error) return apiError('UPDATE_FAILED', error.message, 'প্রোফাইল আপডেট করা যায়নি।', 400);
  return apiSuccess(data);
}
