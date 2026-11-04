// apps/web/app/api/admin/models/[section]/[id]/route.ts
// Generic update + delete for the /admin/panel CRUD sections.

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getAdminSection } from '@/lib/admin/models';
import { badSection, pickSectionFields, requirePlatformAdmin } from '@/lib/admin/server';
import { demoDelete, demoUpdate } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { section: string; id: string } }
) {
  const section = getAdminSection(params.section);
  if (!section) return badSection();

  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const body = await req.json().catch(() => ({}));
  const values = pickSectionFields(section, body);

  if (gate.demo) {
    const updated = demoUpdate(section.demoTable, params.id, values);
    if (!updated) return apiError('NOT_FOUND', 'Row not found.', 'সারি পাওয়া যায়নি।', 404);
    return apiSuccess(updated);
  }

  const { data, error } = await gate.auth!.admin
    .from(section.table)
    .update(values)
    .eq('id', params.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return apiError('UPDATE_FAILED', error.message, 'আপডেট করা যায়নি।', 400);
  }
  if (!data) return apiError('NOT_FOUND', 'Row not found.', 'সারি পাওয়া যায়নি।', 404);
  return apiSuccess(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { section: string; id: string } }
) {
  const section = getAdminSection(params.section);
  if (!section) return badSection();

  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  if (gate.demo) {
    demoDelete(section.demoTable, params.id);
    return apiSuccess({ deleted: true, id: params.id });
  }

  const { error } = await gate.auth!.admin.from(section.table).delete().eq('id', params.id);
  if (error) {
    return apiError('DELETE_FAILED', error.message, 'মুছে ফেলা যায়নি।', 400);
  }
  return apiSuccess({ deleted: true, id: params.id });
}
