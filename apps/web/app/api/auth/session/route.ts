// apps/web/app/api/auth/session/route.ts
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { demoNextStep, readDemoSessionPayload } from '@/lib/demo-auth';
import { demoFindUniversity } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    const demo = readDemoSessionPayload();
    if (!demo) return apiSuccess({ authenticated: false, profile: null, roles: [], demo: true });
    const university = demoFindUniversity(demo.universityId);
    const role = demo.role === 'admin' ? 'UNIVERSITY_ADMIN' : demo.role === 'faculty' ? 'FACULTY' : demo.role === 'alumni' ? 'ALUMNI' : 'STUDENT';
    return apiSuccess({
      authenticated: true,
      demo: true,
      profile: {
        id: `demo-user-${university?.code.toLowerCase()}-${demo.role}`,
        university_id: demo.universityId,
        email: demo.email,
        full_name: demo.fullName,
        student_id: demo.studentId,
        trust_level: 'ID_VERIFIED',
        universities: university
          ? { code: university.code, name_en: university.name_en, name_bn: university.name_bn }
          : null,
      },
      roles: [{ role, university_id: demo.universityId }],
      nextStep: demoNextStep(demo.role),
    });
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
    .select('*, universities(code, name_en, name_bn), departments(code, name_en, name_bn), halls:university_halls(name, name_bn, type)')
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
