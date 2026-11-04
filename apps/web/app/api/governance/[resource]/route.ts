// apps/web/app/api/governance/[resource]/route.ts
// University Governance dashboard API (success criterion 4) — scoped to the
// governance user's own university. RLS (migration 0010) enforces the tenant
// boundary server-side; this route only adds the role gate.

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { requireGovernance } from '@/lib/admin/server';

export const dynamic = 'force-dynamic';

const RESOURCES: Record<string, { table: string; demoTable: string; orderBy: string }> = {
  complaints: { table: 'complaints', demoTable: 'complaints_public', orderBy: 'created_at' },
  'hall-allocations': { table: 'hall_allocations', demoTable: 'hall_allocations', orderBy: 'created_at' },
  notices: { table: 'governance_notices', demoTable: 'governance_notices', orderBy: 'created_at' },
};

export async function GET(_req: NextRequest, { params }: { params: { resource: string } }) {
  const resource = RESOURCES[params.resource];
  if (!resource) return apiError('UNKNOWN_RESOURCE', 'Unknown governance resource.', 'অজানা সংস্থান।', 404);

  const gate = await requireGovernance();
  if (gate.response) return gate.response;

  const { demoTable } = await import('@/lib/modules/demo-data');
  if (gate.demo) {
    return apiSuccess(demoTable(resource.demoTable), 200, { total: demoTable(resource.demoTable).length });
  }

  const { data, error } = await gate.auth!.admin
    .from(resource.table)
    .select('*')
    .eq('university_id', gate.auth!.profile.university_id)
    .order(resource.orderBy, { ascending: false })
    .limit(200);

  if (error) {
    return apiError('FETCH_FAILED', error.message, 'তালিকা লোড করা যায়নি।', 500);
  }
  return apiSuccess(data ?? [], 200, { total: data?.length ?? 0 });
}

export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const resource = RESOURCES[params.resource];
  if (!resource) return apiError('UNKNOWN_RESOURCE', 'Unknown governance resource.', 'অজানা সংস্থান।', 404);
  if (params.resource !== 'notices' && params.resource !== 'hall-allocations') {
    return apiError('METHOD_NOT_ALLOWED', 'Create is only available for notices and hall allocations.', 'শুধুমাত্র নোটিশ ও হল বরাদ্দ তৈরি করা যায়।', 405);
  }

  const gate = await requireGovernance();
  if (gate.response) return gate.response;

  const body = await req.json().catch(() => ({}));
  const universityId = gate.demo ? String(body.university_id ?? '') : gate.auth!.profile.university_id;

  const { demoInsert } = await import('@/lib/modules/demo-data');
  if (gate.demo) {
    const created = demoInsert(resource.demoTable, {
      ...body,
      university_id: universityId || undefined,
    });
    return apiSuccess(created, 201);
  }

  const row: Record<string, unknown> = {
    ...body,
    university_id: universityId,
  };
  if (params.resource === 'notices') {
    row.created_by = gate.auth!.user.id;
    if (!row.title || !row.body) {
      return apiError('INVALID_INPUT', 'Title and body are required.', 'শিরোনাম ও বিবরণ প্রয়োজন।', 400);
    }
    if (!row.audience) row.audience = 'ALL';
  }

  const { data, error } = await gate.auth!.admin.from(resource.table).insert(row).select('*').single();
  if (error) {
    return apiError('CREATE_FAILED', error.message, 'তৈরি করা যায়নি।', 400);
  }
  return apiSuccess(data, 201);
}
