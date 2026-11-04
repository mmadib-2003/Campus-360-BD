// apps/web/app/api/halls/route.ts
// Residential hall registry for the mandatory student-signup hall selector
// (success criterion 2). Reads from university_halls (seeded with real halls
// for DU, RU, CU, BUET and SUST in supabase/seed/seed_university_halls.sql),
// with the marked demo dataset as the preview fallback.

import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';
import { DEMO_UNIVERSITY_HALLS, getDemoUniversity } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const universityId = req.nextUrl.searchParams.get('universityId')?.trim() ?? '';
  const universityCode = req.nextUrl.searchParams.get('universityCode')?.trim() ?? '';

  if (!universityId && !universityCode) {
    return apiError(
      'MISSING_UNIVERSITY',
      'universityId or universityCode is required.',
      'বিশ্ববিদ্যালয় নির্বাচন করা আবশ্যক।',
      400,
      undefined,
      REGISTRY_NO_STORE
    );
  }

  if (!isSupabaseServerConfigured()) {
    const university = getDemoUniversity(universityId || universityCode);
    const halls = DEMO_UNIVERSITY_HALLS.filter(
      (hall) => university && hall.universityCode === university.code
    ).map((hall) => ({
      id: hall.id,
      university_id: university!.id,
      name: hall.name,
      name_bn: hall.name_bn,
      type: hall.type,
      is_active: true,
    }));
    return apiSuccess(halls, 200, undefined, REGISTRY_NO_STORE);
  }

  const supabase = createSupabaseRouteClient();
  let query = supabase
    .from('university_halls')
    .select('id, university_id, name, name_bn, type, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (universityId) {
    query = query.eq('university_id', universityId);
  } else {
    // The code -> id lookup is a registry read too. It used to ignore `error`,
    // so an unreachable database answered "here are your halls: none" with a
    // 200. Fail loudly instead of showing an empty dropdown.
    const lookup = await registryRead<{ id: string } | null>(
      'halls.fetch.lookup',
      () =>
        supabase
          .from('universities')
          .select('id')
          .eq('code', universityCode.toUpperCase())
          .maybeSingle(),
      { universityCode }
    );
    if (!lookup.ok) return registryFailure(lookup, 'হল তালিকা লোড করা যায়নি।');
    if (!lookup.data) return apiSuccess([], 200, undefined, REGISTRY_NO_STORE);
    query = query.eq('university_id', lookup.data.id);
  }

  const read = await registryRead<any[]>('halls.fetch', () => query, { universityId, universityCode });
  if (!read.ok) return registryFailure(read, 'হল তালিকা লোড করা যায়নি।');

  return apiSuccess(read.data ?? [], 200, undefined, REGISTRY_NO_STORE);
}
