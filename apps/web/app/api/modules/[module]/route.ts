// apps/web/app/api/modules/[module]/route.ts
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured, requireAuth } from '@/lib/request-context';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { getModule, ModuleSpec, resolveListingAccess } from '@/lib/modules/registry';
import { coerceField, randomCode } from '@/lib/modules/coerce';
import { clampNumber } from '@/lib/utils';
import { runModuleSideEffects } from '@/lib/modules/side-effects';

const MAX_LIMIT = 100;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { module: string } }) {
  const spec = getModule(params.module);
  if (!spec) {
    return apiError('UNKNOWN_MODULE', 'Unknown module.', 'অজানা মডিউল।', 404);
  }

  // requireAuth() stays the entry point even for public modules: it is what answers
  // 503 when the server has no database credentials (a silent empty list would look
  // like an empty campus) and it is where a real session is detected. What changes is
  // what happens when there is no session -- publicRead modules continue as `anon`.
  const { auth, response } = await requireAuth();
  const access = resolveListingAccess(spec, {
    hasSession: Boolean(auth),
    serverConfigured: isSupabaseServerConfigured(),
  });
  if (access === 'deny') return response!;

  const sp = req.nextUrl.searchParams;
  const limit = clampNumber(sp.get('limit'), 50, 1, MAX_LIMIT);
  const offset = clampNumber(sp.get('offset'), 0, 0, 100000);

  // An anonymous read is not tenant-scoped: there is no profile to scope it to, and
  // every row carries university_id plus a CampusBadge, so the campus travels with the
  // listing instead of filtering it. RLS is what bounds this request -- the policy in
  // 0013 limits it to currently-listed rows, and the column grants drop contact
  // details, which is why `publicSelect` exists.
  const supabase = auth ? auth.supabase : createSupabaseRouteClient();
  const selection =
    access === 'public' ? (spec.publicSelect ?? spec.select) : (spec.select ?? '*');
  let query = supabase.from(spec.table).select(selection ?? '*', { count: 'exact' });
  if (auth) query = query.eq('university_id', auth.profile.university_id);

  if (spec.softDelete) query = query.is('deleted_at', null);

  for (const column of spec.filters ?? []) {
    const value = sp.get(column);
    if (value !== null && value !== '' && value !== 'ALL') {
      query = query.eq(column, value);
    }
  }

  const search = sp.get('q')?.trim();
  if (search && spec.searchColumns?.length) {
    query = query.or(spec.searchColumns.map((c) => `${c}.ilike.%${search.replace(/[%,]/g, '')}%`).join(','));
  }

  if (auth && spec.ownerColumn && sp.get('mine') === 'true') {
    query = query.eq(spec.ownerColumn, auth.user.id);
  }

  const orderBy = spec.orderBy ?? { column: 'created_at', ascending: false };
  const { data, error, count } = await query
    .order(orderBy.column, { ascending: orderBy.ascending })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError('QUERY_FAILED', error.message, 'ডেটা লোড করা যায়নি।', 400, { module: spec.key });
  }

  return apiSuccess(data ?? [], 200, { total: count ?? 0, limit, offset, module: spec.key });
}

export async function POST(req: NextRequest, { params }: { params: { module: string } }) {
  const spec = getModule(params.module);
  if (!spec) return apiError('UNKNOWN_MODULE', 'Unknown module.', 'অজানা মডিউল।', 404);

  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  if (spec.verifiedOnly && auth.profile.trust_level === 'UNVERIFIED') {
    return apiError(
      'VERIFICATION_REQUIRED',
      'Verify your university email before posting.',
      'পোস্ট করার আগে বিশ্ববিদ্যালয়ের ইমেইল যাচাই করুন।',
      403
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return apiError('INVALID_BODY', 'A JSON body is required.', 'অবৈধ অনুরোধ।', 400);
  }

  const payload: Record<string, unknown> = {
    university_id: auth.profile.university_id,
  };
  const errors: string[] = [];

  for (const field of spec.fields) {
    if (field.owner) continue;
    const { value, error } = coerceField(field, (body as Record<string, unknown>)[field.column]);
    if (error) {
      errors.push(error);
      continue;
    }
    if (value !== null) payload[field.column] = value;
  }

  if (errors.length) {
    return apiError('VALIDATION_FAILED', errors.join('; '), 'তথ্য সঠিকভাবে পূরণ করুন।', 422, errors);
  }

  // Owner + system columns injected server-side (never trusted from client).
  if (spec.ownerColumn) payload[spec.ownerColumn] = auth.user.id;

  switch (spec.key) {
    case 'marketplace': {
      const title = String(payload.title ?? '');
      payload.keyword_tags = Array.isArray(payload.keyword_tags) && (payload.keyword_tags as string[]).length
        ? payload.keyword_tags
        : title.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 8);
      break;
    }
    case 'clubs': {
      payload.slug = String(payload.name_en ?? 'club')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || `club-${Date.now()}`;
      payload.description_bn = payload.description_bn ?? payload.description_en;
      payload.name_bn = payload.name_bn ?? payload.name_en;
      break;
    }
    case 'marketplace-orders':
      payload.order_code = randomCode('ORD');
      payload.buyer_id = auth.user.id;
      break;
    case 'food-orders':
      payload.order_code = randomCode('FOOD');
      payload.buyer_id = auth.user.id;
      break;
    case 'disputes':
      payload.reference_code = randomCode('DSP');
      payload.opened_by = auth.user.id;
      break;
    case 'conversations': {
      const other = String(payload.user_b ?? '');
      if (!other || other === auth.user.id) {
        return apiError('INVALID_PARTICIPANT', 'Choose another student to message.', 'অন্য একজন শিক্ষার্থী নির্বাচন করুন।', 422);
      }
      payload.user_a = auth.user.id;
      payload.user_b = other;
      break;
    }
    case 'donations': {
      if (payload.is_anonymous) payload.donor_name = 'Anonymous';
      else payload.donor_name = payload.donor_name || auth.profile.full_name;
      payload.donor_id = auth.user.id;
      payload.status = 'CONFIRMED';
      break;
    }
    case 'career-applications':
      payload.applicant_id = auth.user.id;
      break;
    case 'mentorship-bookings': {
      payload.mentee_id = auth.user.id;
      const { data: slot } = await auth.supabase
        .from('mentorship_slots')
        .select('capacity, booked_count, mentor_id')
        .eq('id', payload.slot_id as string)
        .maybeSingle();
      if (slot && Number(slot.booked_count) >= Number(slot.capacity)) {
        return apiError('SLOT_FULL', 'That mentorship slot is already booked.', 'এই স্লটটি ইতিমধ্যে বুক করা হয়েছে।', 409);
      }
      if (slot) payload.mentor_id = slot.mentor_id;
      break;
    }
    case 'venue-bookings': {
      const { data: clash } = await auth.supabase
        .from('sports_venue_bookings')
        .select('id')
        .eq('venue_id', payload.venue_id as string)
        .eq('status', 'CONFIRMED')
        .lt('starts_at', payload.ends_at as string)
        .gt('ends_at', payload.starts_at as string)
        .maybeSingle();
      if (clash) {
        return apiError('VENUE_BUSY', 'That venue is already booked for this window.', 'এই সময়ে ভেন্যুটি বুকড আছে।', 409);
      }
      break;
    }
    case 'blood-responses': {
      const { data: donor } = await auth.supabase
        .from('health_donors')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (donor) payload.donor_id = donor.id;
      break;
    }
    default:
      break;
  }

  // Single-row-per-user modules: upsert semantics for a friendlier UX.
  const upsertKeys: Record<string, string> = {
    donors: 'user_id',
    mentors: 'user_id',
    alumni: 'user_id',
  };
  const upsertKey = upsertKeys[spec.key];

  if (upsertKey) {
    const { data: existing } = await auth.supabase
      .from(spec.table)
      .select('id')
      .eq(upsertKey, auth.user.id)
      .maybeSingle();
    if (existing?.id) {
      const { data, error } = await auth.supabase
        .from(spec.table)
        .update(payload)
        .eq('id', existing.id as string)
        .select(spec.select ?? '*')
        .single();
      if (error) {
        return apiError('UPDATE_FAILED', error.message, 'সংরক্ষণ করা যায়নি।', 400);
      }
      return apiSuccess(data, 200, { module: spec.key, updated: true });
    }
  }

  const { data, error } = await auth.supabase
    .from(spec.table)
    .insert(payload)
    .select(spec.select ?? '*')
    .single();

  if (error) {
    const friendly =
      error.code === '23505'
        ? 'You already submitted this item.'
        : error.code === '42501'
          ? 'Your account is not permitted to perform this action.'
          : error.message;
    return apiError('INSERT_FAILED', friendly, 'সংরক্ষণ করা যায়নি।', 400, { code: error.code });
  }

  // Non-blocking module-specific notifications / matching.
  try {
    await runModuleSideEffects({ spec, auth, row: data as unknown as Record<string, unknown>, payload });
  } catch {
    // Side effects must never fail the primary write.
  }

  return apiSuccess(data, 201, { module: spec.key });
}

export async function PATCH(req: NextRequest, { params }: { params: { module: string } }) {
  const spec = getModule(params.module);
  if (!spec) return apiError('UNKNOWN_MODULE', 'Unknown module.', 'অজানা মডিউল।', 404);

  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const body = await req.json().catch(() => null);
  const id = (body as Record<string, unknown> | null)?.id;
  if (!body || typeof id !== 'string') {
    return apiError('MISSING_ID', 'An id is required.', 'আইডি প্রয়োজন।', 400);
  }

  const payload: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of spec.fields) {
    if (!(field.column in (body as Record<string, unknown>))) continue;
    const { value, error } = coerceField(field, (body as Record<string, unknown>)[field.column]);
    if (error) {
      errors.push(error);
      continue;
    }
    payload[field.column] = value;
  }

  if (errors.length) {
    return apiError('VALIDATION_FAILED', errors.join('; '), 'তথ্য সঠিকভাবে পূরণ করুন।', 422, errors);
  }
  if (!Object.keys(payload).length) {
    return apiError('NOTHING_TO_UPDATE', 'No updatable fields were provided.', 'কোনো পরিবর্তন দেওয়া হয়নি।', 400);
  }

  let update = auth.supabase
    .from(spec.table)
    .update(payload)
    .eq('id', id)
    .eq('university_id', auth.profile.university_id);

  if (spec.ownerColumn) update = update.eq(spec.ownerColumn, auth.user.id);

  const { data, error } = await update.select(spec.select ?? '*').single();

  if (error || !data) {
    return apiError(
      'UPDATE_FAILED',
      error?.message ?? 'Update was not permitted.',
      'আপডেট করা যায়নি।',
      403
    );
  }

  return apiSuccess(data, 200, { module: spec.key });
}

export async function DELETE(req: NextRequest, { params }: { params: { module: string } }) {
  const spec = getModule(params.module);
  if (!spec) return apiError('UNKNOWN_MODULE', 'Unknown module.', 'অজানা মডিউল।', 404);

  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return apiError('MISSING_ID', 'An id is required.', 'আইডি প্রয়োজন।', 400);

  if (spec.softDelete) {
    const { error } = await auth.supabase
      .from(spec.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('university_id', auth.profile.university_id);
    if (error) return apiError('DELETE_FAILED', error.message, 'মুছে ফেলা যায়নি।', 400);
    return apiSuccess({ id, deleted: true });
  }

  let del = auth.supabase.from(spec.table).delete().eq('id', id).eq('university_id', auth.profile.university_id);
  if (spec.ownerColumn) del = del.eq(spec.ownerColumn, auth.user.id);

  const { error } = await del;
  if (error) return apiError('DELETE_FAILED', error.message, 'মুছে ফেলা যায়নি।', 400);
  return apiSuccess({ id, deleted: true });
}
