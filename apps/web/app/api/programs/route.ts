// apps/web/app/api/programs/route.ts
// Academic program registry for `/signup` (Bachelor's Honors, B.B.A., LL.B.,
// B.Sc. in Engineering, B.Pharm, Master's, M.B.A., LL.M., M.Phil., PGD, Ph.D.).
// Falls back to `DEMO_ACADEMIC_PROGRAMS` on preview builds, cold starts, or
// empty tables so the signup form never renders an empty program dropdown.

import { NextRequest } from 'next/server';
import { registryGate } from '@/lib/registry-gate';
import { apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import {
  REGISTRY_NO_STORE,
  registryError,
  registryFailure,
  registryRead,
} from '@/lib/registry-cache';
import { DEMO_ACADEMIC_PROGRAMS } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const strict = req.nextUrl?.searchParams.get('strict') === '1';

  if (!isSupabaseServerConfigured()) {
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  const gate = registryGate('programs', 'একাডেমিক প্রোগ্রামের তালিকা লোড করা যায়নি।');
  if (!gate.ok) {
    if (strict) return gate.response;
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  const supabase = gate.client;
  const read = await registryRead<any[]>('programs.fetch', () =>
    supabase
      .from('academic_programs')
      .select('id, code, name_en, name_bn, cycle, duration_years, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
  );

  if (!read.ok) {
    if (strict) {
      return registryFailure(read, 'একাডেমিক প্রোগ্রামের তালিকা লোড করা যায়নি।');
    }
    registryError('programs.fetch', read.error);
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  const rows = read.data ?? [];
  if (rows.length === 0) {
    return apiSuccess(DEMO_ACADEMIC_PROGRAMS, 200, undefined, REGISTRY_NO_STORE);
  }

  return apiSuccess(rows, 200, undefined, REGISTRY_NO_STORE);
}
