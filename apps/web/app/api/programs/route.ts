// apps/web/app/api/programs/route.ts
// Academic-program registry (Honors / Degree / B.Sc. Engineering / Master's /
// Ph.D. …) backing the "Academic Program" select in signup — see migration
// 0012_academic_programs.sql. Global table, so no university parameter.

import { registryGate } from '@/lib/registry-gate';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';
import { DEMO_ACADEMIC_PROGRAMS } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  // The gate is what keeps a broken `NEXT_PUBLIC_SUPABASE_URL` from escaping as
  // an unhandled HTML 500 (which the form can only render as `HTTP 500`): the
  // config check runs before the client is built, and construction is guarded.
  const gate = registryGate('programs', 'একাডেমিক প্রোগ্রামের তালিকা লোড করা যায়নি।');
  if (!gate.ok) return gate.response;
  const supabase = gate.client;
  const read = await registryRead<any[]>('programs.fetch', () =>
    supabase
      .from('academic_programs')
      .select('id, code, name_en, name_bn, cycle, duration_years, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
  );
  if (!read.ok) return registryFailure(read, 'একাডেমিক প্রোগ্রামের তালিকা লোড করা যায়নি।');

  return apiSuccess(read.data ?? [], 200, undefined, REGISTRY_NO_STORE);
}
