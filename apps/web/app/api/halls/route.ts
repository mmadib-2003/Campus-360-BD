// apps/web/app/api/halls/route.ts
// Residential hall registry for the mandatory student-signup hall selector
// (success criterion 2). Reads from university_halls (seeded with real halls
// for DU, RU, CU, BUET and SUST in supabase/seed/seed_university_halls.sql),
// with the marked demo dataset as the preview fallback.

import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { DEMO_UNIVERSITY_HALLS, getDemoUniversity } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const universityId = req.nextUrl.searchParams.get('universityId')?.trim() ?? '';
  const universityCode = req.nextUrl.searchParams.get('universityCode')?.trim() ?? '';

  if (!universityId && !universityCode) {
    return apiError('MISSING_UNIVERSITY', 'universityId or universityCode is required.', 'বিশ্ববিদ্যালয় নির্বাচন করা আবশ্যক।', 400);
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
    return apiSuccess(halls);
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
    const { data: university } = await supabase
      .from('universities')
      .select('id')
      .eq('code', universityCode.toUpperCase())
      .maybeSingle();
    if (!university) return apiSuccess([]);
    query = query.eq('university_id', university.id);
  }

  const { data, error } = await query;
  if (error) {
    return apiError('FETCH_FAILED', error.message, 'হল তালিকা লোড করা যায়নি।', 500);
  }
  return apiSuccess(data ?? []);
}
