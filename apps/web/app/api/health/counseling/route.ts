// apps/web/app/api/health/counseling/route.ts
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { requireAuth } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

/**
 * Anonymous counselling booking.
 *
 * Identity privacy guarantees:
 *  - the appointment row stores only an alias and, at most, a voluntarily
 *    supplied contact method;
 *  - `user_id` is never persisted (remains NULL);
 *  - the client receives a one-time booking reference, and only a hash of the
 *    optional retrieval token is stored, so the record cannot be linked back to
 *    the student from the database alone.
 */
export async function POST(req: NextRequest) {
  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return apiError('INVALID_BODY', 'A JSON body is required.', 'অবৈধ অনুরোধ।', 400);
  }

  const slotId = String((body as Record<string, unknown>).slot_id ?? '');
  if (!slotId) {
    return apiError('MISSING_SLOT', 'Choose a counselling slot.', 'একটি স্লট নির্বাচন করুন।', 400);
  }

  const { data: slot } = await auth.admin
    .from('counseling_slots')
    .select('id, university_id, capacity, booked_count, is_active, starts_at')
    .eq('id', slotId)
    .eq('university_id', auth.profile.university_id)
    .maybeSingle();

  if (!slot || !slot.is_active) {
    return apiError('SLOT_UNAVAILABLE', 'That slot is no longer available.', 'স্লটটি আর পাওয়া যাচ্ছে না।', 404);
  }
  if (Number(slot.booked_count) >= Number(slot.capacity)) {
    return apiError('SLOT_FULL', 'That slot is already booked.', 'স্লটটি ইতিমধ্যে বুক করা হয়েছে।', 409);
  }

  const bookingRef = `CNS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const retrievalToken = crypto.randomBytes(24).toString('hex');
  const pepper = process.env.ANON_COMPLAINT_PEPPER || 'campus360-anon-pepper';
  const anonymousTokenHash = crypto
    .createHmac('sha256', pepper)
    .update(`${bookingRef}:${retrievalToken}`)
    .digest('hex');

  const alias = String((body as Record<string, unknown>).alias ?? '').trim() || `Anonymous ${bookingRef.slice(-3)}`;
  const note = typeof (body as Record<string, unknown>).note === 'string'
    ? String((body as Record<string, unknown>).note).slice(0, 1000)
    : null;
  const contactMethod = String((body as Record<string, unknown>).contact_method ?? 'IN_APP');
  const contactValue = typeof (body as Record<string, unknown>).contact_value === 'string'
    ? String((body as Record<string, unknown>).contact_value).slice(0, 160)
    : null;

  const { data: booking, error } = await auth.admin
    .from('counseling_bookings')
    .insert({
      university_id: auth.profile.university_id,
      slot_id: slot.id,
      booking_ref: bookingRef,
      alias,
      contact_method: ['IN_APP', 'PHONE', 'EMAIL'].includes(contactMethod) ? contactMethod : 'IN_APP',
      contact_value: contactValue,
      note,
      anonymous_token_hash: anonymousTokenHash,
      user_id: null,
      status: 'BOOKED',
    })
    .select('id, booking_ref, slot_id, status, created_at')
    .single();

  if (error || !booking) {
    return apiError('BOOKING_FAILED', error?.message ?? 'Could not book.', 'বুকিং সম্পন্ন হয়নি।', 400);
  }

  await auth.admin.from('notifications').insert({
    university_id: auth.profile.university_id,
    user_id: auth.user.id,
    title_en: 'Confidential counselling session booked',
    title_bn: 'গোপনীয় কাউন্সেলিং সেশন বুক হয়েছে',
    body_en: `Your booking reference is ${bookingRef}. Keep it private — it is the only way to manage this session.`,
    body_bn: `আপনার বুকিং রেফারেন্স ${bookingRef}। এটি গোপন রাখুন।`,
    action_url: '/health',
    category: 'COUNSELING',
  });

  return apiSuccess(
    {
      booking,
      bookingRef,
      retrievalToken, // returned once; never stored in plain text
      startsAt: slot.starts_at,
    },
    201
  );
}

/** Anonymous status lookup: requires the reference + the one-time retrieval token. */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')?.trim().toUpperCase();
  const token = req.nextUrl.searchParams.get('token')?.trim();

  if (!ref || !token) {
    return apiError('MISSING_CREDENTIALS', 'Booking reference and token are required.', 'রেফারেন্স ও টোকেন প্রয়োজন।', 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message_en: 'Server not configured.' } },
      { status: 503 }
    );
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase-server');
  const admin = createSupabaseAdminClient();
  const pepper = process.env.ANON_COMPLAINT_PEPPER || 'campus360-anon-pepper';

  const { data: booking } = await admin
    .from('counseling_bookings')
    .select('id, booking_ref, slot_id, status, note, anonymous_token_hash, created_at, counseling_slots(starts_at, ends_at, mode, counselor_alias)')
    .eq('booking_ref', ref)
    .maybeSingle();

  if (!booking) {
    return apiError('NOT_FOUND', 'Booking not found.', 'বুকিং পাওয়া যায়নি।', 404);
  }

  const expected = crypto
    .createHmac('sha256', pepper)
    .update(`${ref}:${token}`)
    .digest('hex');

  const a = Buffer.from(String(booking.anonymous_token_hash ?? ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return apiError('INVALID_TOKEN', 'That token does not match this booking.', 'টোকেন মেলেনি।', 403);
  }

  const { anonymous_token_hash: _omit, ...safe } = booking as Record<string, unknown>;
  return apiSuccess(safe);
}
