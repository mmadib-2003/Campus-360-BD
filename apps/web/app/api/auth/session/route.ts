// apps/web/app/api/auth/session/route.ts
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiSuccess } from '@/lib/api-response';

export async function GET() {
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
