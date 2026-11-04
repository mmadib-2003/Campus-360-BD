// apps/web/lib/admin/server.ts
// Server-side guard + row shaping for the /admin/panel and /governance APIs.

import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-response';
import { isSupabaseServerConfigured, requireAuth, type RequestAuth } from '@/lib/request-context';
import { isPlatformAdminRole, isGovernanceRole, type AdminSection } from './models';

export interface AdminGate {
  auth?: RequestAuth;
  demo: boolean;
  response?: Response;
}

/** Platform-admin gate. In preview mode (no Supabase) the page-level demo
 *  session already gates access, so the API stays open to the local store. */
export async function requirePlatformAdmin(): Promise<AdminGate> {
  if (!isSupabaseServerConfigured()) {
    return { demo: true };
  }
  const { auth, response } = await requireAuth();
  if (response) return { demo: false, response };
  if (!isPlatformAdminRole(auth!.roles)) {
    return {
      demo: false,
      response: apiError('FORBIDDEN', 'Platform admin access required.', 'প্ল্যাটফর্ম অ্যাডমিন প্রবেশাধিকার প্রয়োজন।', 403),
    };
  }
  return { demo: false, auth };
}

/** Governance gate — university governing body (own campus only, enforced by RLS). */
export async function requireGovernance(): Promise<AdminGate> {
  if (!isSupabaseServerConfigured()) {
    return { demo: true };
  }
  const { auth, response } = await requireAuth();
  if (response) return { demo: false, response };
  if (!isGovernanceRole(auth!.roles) && !isPlatformAdminRole(auth!.roles)) {
    return {
      demo: false,
      response: apiError('FORBIDDEN', 'University governance access required.', 'বিশ্ববিদ্যালয় গভর্ন্যান্স প্রবেশাধিকার প্রয়োজন।', 403),
    };
  }
  return { demo: false, auth };
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Fill NOT NULL columns the compact admin forms do not expose (owners,
 * tracking codes, SLA windows …) so creates succeed against the real schema.
 */
export async function shapeCreateRow(
  section: AdminSection,
  values: Record<string, unknown>,
  ctx: { universityId: string; userId: string | null; admin?: RequestAuth }
): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = { ...values };
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const in72h = new Date(now.getTime() + 72 * 3600_000).toISOString();

  if (ctx.universityId && !row.university_id) row.university_id = ctx.universityId;

  // A same-campus profile to own rows that require a FK to profiles.
  let fallbackProfileId = ctx.userId;
  if (!fallbackProfileId && ctx.admin && ctx.universityId) {
    const { data } = await ctx.admin.admin
      .from('profiles')
      .select('id')
      .eq('university_id', ctx.universityId)
      .limit(1)
      .maybeSingle();
    fallbackProfileId = data?.id ?? null;
  }

  switch (section.key) {
    case 'civic-tickets':
      if (!row.tracking_code) {
        const prefix = (row.tracking_code_hint as string) || 'ADM';
        row.tracking_code = `${prefix}-CASE-${now.getFullYear()}-${randomSuffix()}`;
      }
      delete row.tracking_code_hint;
      if (!row.description) row.description = String(row.title ?? 'Managed via admin panel');
      if (!row.sla_due_at) row.sla_due_at = in72h;
      break;
    case 'blood-requests':
      if (!row.contact_phone) row.contact_phone = '+880-0000000000';
      if (!row.hospital_address) row.hospital_address = String(row.hospital_name ?? 'Campus clinic');
      if (!row.needed_by) row.needed_by = in24h;
      if (!row.requester_id && fallbackProfileId) row.requester_id = fallbackProfileId;
      break;
    case 'events':
      if (!row.host_organization) row.host_organization = 'Campus360 Administration';
      if (!row.description_en) row.description_en = String(row.title_en ?? 'Campus event');
      if (!row.formatted_address) row.formatted_address = String(row.venue_name ?? 'Campus');
      if (!row.text_directions_en) row.text_directions_en = 'Enter from the main gate and follow the campus signs.';
      if (!row.place_id) row.place_id = `place-${randomSuffix().toLowerCase()}`;
      if (row.lat === undefined || row.lat === null || row.lat === '') row.lat = 23.8103;
      if (row.lng === undefined || row.lng === null || row.lng === '') row.lng = 90.4125;
      if (!row.ends_at) row.ends_at = new Date(now.getTime() + 3 * 3600_000).toISOString();
      if (!row.starts_at) row.starts_at = now.toISOString();
      if (!row.organizer_id && fallbackProfileId) row.organizer_id = fallbackProfileId;
      break;
    case 'lost-items':
      if (!row.description) row.description = String(row.title ?? 'Managed via admin panel');
      if (!row.reporter_id && fallbackProfileId) row.reporter_id = fallbackProfileId;
      break;
    case 'disputes':
      if (!row.description) row.description = String(row.subject ?? 'Managed via admin panel');
      if (!row.reference_code) row.reference_code = `ADM-DSP-${randomSuffix()}`;
      if (!row.opened_by && fallbackProfileId) row.opened_by = fallbackProfileId;
      break;
    case 'career-posts':
      if (!row.description) row.description = String(row.title ?? 'Managed via admin panel');
      if (!row.company) row.company = 'Campus Partner';
      if (ctx.admin && !row.alumni_id) {
        const { data } = await ctx.admin.admin
          .from('alumni_profiles')
          .select('id')
          .eq('university_id', ctx.universityId)
          .limit(1)
          .maybeSingle();
        if (data?.id) row.alumni_id = data.id;
      }
      break;
    case 'housing-listings':
      if (!row.description) row.description = String(row.title ?? 'Managed via admin panel');
      if (!row.owner_id && fallbackProfileId) row.owner_id = fallbackProfileId;
      break;
    case 'marketplace-listings':
      if (!row.description) row.description = String(row.title ?? 'Managed via admin panel');
      if (!row.seller_id && fallbackProfileId) row.seller_id = fallbackProfileId;
      break;
    case 'cafeteria-menus':
      if (!row.name_bn) row.name_bn = String(row.name_en ?? '');
      if (!row.serving_date) row.serving_date = now.toISOString().slice(0, 10);
      break;
    default:
      break;
  }
  return row;
}

/** Keep only columns declared for the section (plus the row identity). */
export function pickSectionFields(section: AdminSection, body: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(section.fields.map((field) => field.column));
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key) && value !== undefined) values[key] = value;
  }
  return values;
}

export function badSection(): Response {
  return apiError('UNKNOWN_SECTION', 'Unknown admin section.', 'অজানা অ্যাডমিন বিভাগ।', 404);
}

export type { NextRequest };
