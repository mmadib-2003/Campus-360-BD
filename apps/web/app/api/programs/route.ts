// apps/web/app/api/programs/route.ts
// Academic-program registry (Honors / Degree / B.Sc. Engineering / Master's /
// Ph.D. …) backing the "Academic Program" select in signup — see migration
// 0012_academic_programs.sql. Global table, so no university parameter.

import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryError } from '@/lib/registry-cache';
import { DEMO_ACADEMIC_PROGRAMS } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  const supabase = createSupabaseRouteClient();
  const { data, error } = await supabase
    .from('academic_programs')
    .select('id, code, name_en, name_bn, cycle, duration_years, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    registryError('programs.fetch', error);
    return apiError(
      'FETCH_FAILED',
      error.message,
      'একাডেমিক প্রোগ্রামের তালিকা লোড করা যায়নি।',
      500,
      undefined,
      REGISTRY_NO_STORE
    );
  }
  return apiSuccess(data ?? [], 200, undefined, REGISTRY_NO_STORE);
}
