// apps/web/app/api/departments/route.ts
// Department & Institute registry for `/signup` ("Join Your Campus") and
// faculty/course filters. Includes a static 38-unit fallback for
// Jahangirnagar University (JU) so cold starts, preview builds, or transient
// PostgREST blips always serve JU's exact 4 Institutes + 34 Departments.

import { NextRequest } from 'next/server';
import { registryGate } from '@/lib/registry-gate';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import {
  REGISTRY_NO_STORE,
  registryError,
  registryFailure,
  registryRead,
} from '@/lib/registry-cache';
import {
  JU_CANONICAL_UNIVERSITY_ID,
  getDemoUniversity,
  getStaticJuDepartments,
} from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

function isJuIdentifier(universityId: string, universityCode: string): boolean {
  if (universityCode.toUpperCase() === 'JU') return true;
  if (
    universityId === JU_CANONICAL_UNIVERSITY_ID ||
    universityId.toLowerCase() === 'demo-univ-ju'
  ) {
    return true;
  }
  const demo = getDemoUniversity(universityId);
  return demo?.code === 'JU';
}

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

  const juRequested = isJuIdentifier(universityId, universityCode);

  if (!isSupabaseServerConfigured()) {
    if (juRequested) {
      return apiSuccess(
        getStaticJuDepartments(universityId || JU_CANONICAL_UNIVERSITY_ID),
        200,
        undefined,
        REGISTRY_NO_STORE
      );
    }
    return apiSuccess([], 200, undefined, REGISTRY_NO_STORE);
  }

  const gate = registryGate('departments', 'বিভাগের তালিকা লোড করা যায়নি।');
  if (!gate.ok) {
    if (juRequested) {
      return apiSuccess(
        getStaticJuDepartments(universityId || JU_CANONICAL_UNIVERSITY_ID),
        200,
        undefined,
        REGISTRY_NO_STORE
      );
    }
    return gate.response;
  }

  const supabase = gate.client;
  let resolvedUniversityId = universityId;
  let resolvedIsJu = juRequested;

  if (!resolvedUniversityId) {
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
    if (!lookup.ok) {
      if (resolvedIsJu) {
        registryError('departments.fetch.lookup', lookup.error, { universityCode });
        return apiSuccess(
          getStaticJuDepartments(JU_CANONICAL_UNIVERSITY_ID),
          200,
          undefined,
          REGISTRY_NO_STORE
        );
      }
      return registryFailure(lookup, 'বিভাগের তালিকা লোড করা যায়নি।');
    }
    if (!lookup.data) {
      return apiSuccess(
        resolvedIsJu ? getStaticJuDepartments(JU_CANONICAL_UNIVERSITY_ID) : [],
        200,
        undefined,
        REGISTRY_NO_STORE
      );
    }
    resolvedUniversityId = lookup.data.id;
  } else if (!resolvedIsJu) {
    const uniLookup = await registryRead<{ code: string } | null>(
      'departments.fetch.code',
      () =>
        supabase
          .from('universities')
          .select('code')
          .eq('id', resolvedUniversityId)
          .maybeSingle(),
      { universityId: resolvedUniversityId }
    );
    if (uniLookup.ok && uniLookup.data?.code?.toUpperCase() === 'JU') {
      resolvedIsJu = true;
    }
  }

  const query = supabase
    .from('departments')
    .select('id, university_id, code, name_en, name_bn, faculty_en, faculty_bn')
    .eq('university_id', resolvedUniversityId)
    .order('faculty_en', { ascending: true })
    .order('name_en', { ascending: true });

  const read = await registryRead<any[]>('departments.fetch', () => query, {
    universityId: resolvedUniversityId,
    universityCode,
  });

  if (!read.ok) {
    if (resolvedIsJu) {
      registryError('departments.fetch', read.error, {
        universityId: resolvedUniversityId,
      });
      return apiSuccess(
        getStaticJuDepartments(resolvedUniversityId),
        200,
        undefined,
        REGISTRY_NO_STORE
      );
    }
    return registryFailure(read, 'বিভাগের তালিকা লোড করা যায়নি।');
  }

  const rows = read.data ?? [];
  if (rows.length === 0 && resolvedIsJu) {
    return apiSuccess(
      getStaticJuDepartments(resolvedUniversityId),
      200,
      undefined,
      REGISTRY_NO_STORE
    );
  }

  return apiSuccess(rows, 200, undefined, REGISTRY_NO_STORE);
}
