// apps/web/app/api/profile/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

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

  const body = await req.json();
  const allowedUpdates = {
    full_name: body.full_name,
    department_id: body.department_id,
    hall_id: body.hall_id,
    batch: body.batch,
    bio: body.bio,
    avatar_url: body.avatar_url,
    interests: body.interests,
    crisis_callback_phone: body.crisis_callback_phone,
    crisis_callback_consent: Boolean(body.crisis_callback_consent),
    preferred_language: body.preferred_language,
    onboarding_completed: true,
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(allowedUpdates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) return apiError('UPDATE_FAILED', error.message, 'প্রোফাইল আপডেট করা যায়নি।', 400);
  return apiSuccess(data);
}
