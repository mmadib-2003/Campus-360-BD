// apps/web/app/api/departments/route.ts
// Department registry for the signup form (and any later faculty/course filter).
//
// Reads `departments`, which is keyed by university with UNIQUE (university_id,
// code) — see 0002. Note there is deliberately NO `is_active` filter here:
// unlike university_halls, `departments` has no status column, and asking for
// one would turn every request into a 500 that the client renders as an empty
// list. The exhaustive roster lives in supabase/seed/seed_departments_by_faculty.sql.

import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';

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
    // Preview deployments have no department fixture; the field is optional in
    // the form, so an empty list is a working state rather than an error.
    return apiSuccess([], 200, undefined, REGISTRY_NO_STORE);
  }

  const supabase = createSupabaseRouteClient();
  let query = supabase
    .from('departments')
    .select('id, university_id, code, name_en, name_bn, faculty_en, faculty_bn')
    .order('faculty_en', { ascending: true })
    .order('name_en', { ascending: true });

  if (universityId) {
    query = query.eq('university_id', universityId);
  } else {
    // The code -> id lookup is a registry read too. It used to ignore `error`,
    // so an unreachable database answered "here are your halls: none" with a
    // 200. Fail loudly instead of showing an empty dropdown.
    const lookup = await registryRead<{ id: string } | null>(
      'departments.fetch.lookup',
      () =>
        supabase
          .from('universities')
          .select('id')
          .eq('code', universityCode.toUpperCase())
          .maybeSingle(),
      { universityCode }
    );
    if (!lookup.ok) return registryFailure(lookup, 'বিভাগের তালিকা লোড করা যায়নি।');
    if (!lookup.data) return apiSuccess([], 200, undefined, REGISTRY_NO_STORE);
    query = query.eq('university_id', lookup.data.id);
  }

  const read = await registryRead<any[]>('departments.fetch', () => query, { universityId, universityCode });
  if (!read.ok) return registryFailure(read, 'বিভাগের তালিকা লোড করা যায়নি।');

  return apiSuccess(read.data ?? [], 200, undefined, REGISTRY_NO_STORE);
}
