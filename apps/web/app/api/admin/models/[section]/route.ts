// apps/web/app/api/admin/models/[section]/route.ts
// Generic list + create for the /admin/panel CRUD sections.

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getAdminSection } from '@/lib/admin/models';
import {
  badSection,
  pickSectionFields,
  requirePlatformAdmin,
  shapeCreateRow,
} from '@/lib/admin/server';
import { demoInsert, demoTable } from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { section: string } }) {
  const section = getAdminSection(params.section);
  if (!section) return badSection();

  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  if (gate.demo) {
    // Platform admin sees every campus — demoTable is unfiltered.
    return apiSuccess(demoTable(section.demoTable), 200, { total: demoTable(section.demoTable).length });
  }

  const admin = gate.auth!.admin;
  const orderBy = section.orderBy ?? { column: 'created_at', ascending: false };
  const { data, error } = await admin
    .from(section.table)
    .select('*')
    .order(orderBy.column, { ascending: orderBy.ascending })
    .limit(200);

  if (error) {
    return apiError('FETCH_FAILED', error.message, 'তালিকা লোড করা যায়নি।', 500);
  }
  return apiSuccess(data ?? [], 200, { total: data?.length ?? 0 });
}

export async function POST(req: NextRequest, { params }: { params: { section: string } }) {
  const section = getAdminSection(params.section);
  if (!section) return badSection();

  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const body = await req.json().catch(() => ({}));
  const values = pickSectionFields(section, body);

  if (gate.demo) {
    // Same shaping as the Supabase path so demo rows carry tracking codes,
    // SLA windows and required text columns.
    const shaped = await shapeCreateRow(section, values, {
      universityId: typeof body.university_id === 'string' ? body.university_id : '',
      userId: null,
    });
    const created = demoInsert(section.demoTable, shaped);
    return apiSuccess(created, 201);
  }

  const auth = gate.auth!;
  const universityId =
    typeof body.university_id === 'string' && body.university_id
      ? body.university_id
      : auth.profile.university_id;
  const row = await shapeCreateRow(section, values, {
    universityId,
    userId: auth.user.id,
    admin: auth,
  });

  const { data, error } = await auth.admin.from(section.table).insert(row).select('*').single();
  if (error) {
    return apiError('CREATE_FAILED', error.message, 'তৈরি করা যায়নি।', 400);
  }
  return apiSuccess(data, 201);
}
