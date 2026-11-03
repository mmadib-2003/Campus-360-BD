// apps/web/app/api/auth/session/route.ts
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiSuccess({ authenticated: false, profile: null, roles: [] });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, universities(code, name_en, name_bn), departments(code, name_en, name_bn), halls(code, name_en, name_bn)')
    .eq('id', user.id)
    .maybeSingle();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, university_id, governing_unit_id')
    .eq('user_id', user.id);

  return apiSuccess({
    authenticated: true,
    profile,
    roles: roles ?? [],
  });
}
