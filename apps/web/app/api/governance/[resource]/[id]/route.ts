// apps/web/app/api/governance/[resource]/[id]/route.ts
// Governance moderation actions — status changes, hall allocation decisions,
// notice deletion. Always scoped to the caller's university (RLS-enforced).

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { requireGovernance } from '@/lib/admin/server';

export const dynamic = 'force-dynamic';

const TABLES: Record<string, string> = {
  complaints: 'complaints',
  'hall-allocations': 'hall_allocations',
  notices: 'governance_notices',
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { resource: string; id: string } }
) {
  const table = TABLES[params.resource];
  if (!table) return apiError('UNKNOWN_RESOURCE', 'Unknown governance resource.', 'অজানা সংস্থান।', 404);

  const gate = await requireGovernance();
  if (gate.response) return gate.response;

  const body = await req.json().catch(() => ({}));

  const { demoUpdate } = await import('@/lib/modules/demo-data');
  if (gate.demo) {
    const updated = demoUpdate(table === 'governance_notices' ? 'governance_notices' : table, params.id, body);
    if (!updated) return apiError('NOT_FOUND', 'Row not found.', 'সারি পাওয়া যায়নি।', 404);
    return apiSuccess(updated);
  }

  const patch: Record<string, unknown> = { ...body };
  if (params.resource === 'hall-allocations' && (body.status === 'APPROVED' || body.status === 'REJECTED')) {
    patch.decided_by = gate.auth!.user.id;
    patch.decided_at = new Date().toISOString();
    if (!patch.note) delete patch.note;
  }

  const { data, error } = await gate.auth!.admin
    .from(table)
    .update(patch)
    .eq('id', params.id)
    .eq('university_id', gate.auth!.profile.university_id)
    .select('*')
    .maybeSingle();

  if (error) {
    return apiError('UPDATE_FAILED', error.message, 'আপডেট করা যায়নি।', 400);
  }
  if (!data) return apiError('NOT_FOUND', 'Row not found in your university.', 'আপনার বিশ্ববিদ্যালয়ে সারি পাওয়া যায়নি।', 404);
  return apiSuccess(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { resource: string; id: string } }
) {
  const table = TABLES[params.resource];
  if (!table) return apiError('UNKNOWN_RESOURCE', 'Unknown governance resource.', 'অজানা সংস্থান।', 404);

  const gate = await requireGovernance();
  if (gate.response) return gate.response;

  const { demoDelete } = await import('@/lib/modules/demo-data');
  if (gate.demo) {
    demoDelete(table, params.id);
    return apiSuccess({ deleted: true, id: params.id });
  }

  const { error } = await gate.auth!.admin
    .from(table)
    .delete()
    .eq('id', params.id)
    .eq('university_id', gate.auth!.profile.university_id);
  if (error) {
    return apiError('DELETE_FAILED', error.message, 'মুছে ফেলা যায়নি।', 400);
  }
  return apiSuccess({ deleted: true, id: params.id });
}
