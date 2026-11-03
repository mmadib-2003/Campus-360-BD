// apps/web/app/api/health/blood/route.ts
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { requireAuth } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

const COMPATIBILITY: Record<string, string[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-'],
};

/** Real-time donor search with blood-group compatibility + eligibility window. */
export async function GET(req: NextRequest) {
  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const group = req.nextUrl.searchParams.get('blood_group')?.toUpperCase() ?? '';
  const compatibleOnly = req.nextUrl.searchParams.get('compatible') === 'true';
  const groups = compatibleOnly && COMPATIBILITY[group] ? COMPATIBILITY[group] : group ? [group] : [];

  let query = auth.supabase
    .from('health_donors')
    .select('id, user_id, blood_group, is_available, last_donated_at, verified_donations_count, hall_id, halls(name_en, name_bn), profiles:user_id(full_name, avatar_url, trust_level)')
    .eq('university_id', auth.profile.university_id)
    .eq('is_available', true)
    .limit(100);

  if (groups.length) query = query.in('blood_group', groups);

  const { data, error } = await query;
  if (error) return apiError('DONOR_QUERY_FAILED', error.message, 'ডোনার তালিকা লোড করা যায়নি।', 400);

  const ELIGIBILITY_DAYS = 90;
  const donors = (data ?? []).map((donor) => {
    const lastDonated = donor.last_donated_at ? new Date(String(donor.last_donated_at)).getTime() : null;
    const daysSince = lastDonated ? Math.floor((Date.now() - lastDonated) / 86_400_000) : null;
    return {
      ...donor,
      days_since_donation: daysSince,
      eligible: daysSince === null || daysSince >= ELIGIBILITY_DAYS,
      contact_visible: false, // phone numbers are never exposed in list responses
    };
  });

  // Privacy: strip phone numbers from the response entirely.
  return apiSuccess(donors, 200, { count: donors.length, compatibility: groups });
}

/** Toggle donor availability / register as a donor. */
export async function POST(req: NextRequest) {
  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const body = await req.json().catch(() => null);
  if (!body) return apiError('INVALID_BODY', 'A JSON body is required.', 'অবৈধ অনুরোধ।', 400);

  const payload: Record<string, unknown> = {
    university_id: auth.profile.university_id,
    user_id: auth.user.id,
    is_available: Boolean((body as Record<string, unknown>).is_available ?? true),
  };

  const bloodGroup = String((body as Record<string, unknown>).blood_group ?? '').toUpperCase();
  if (bloodGroup && Object.keys(COMPATIBILITY).includes(bloodGroup)) payload.blood_group = bloodGroup;
  const phone = (body as Record<string, unknown>).contact_phone;
  if (typeof phone === 'string' && phone.trim()) payload.contact_phone = phone.trim().slice(0, 32);
  const lastDonated = (body as Record<string, unknown>).last_donated_at;
  if (typeof lastDonated === 'string' && lastDonated) payload.last_donated_at = lastDonated.slice(0, 10);

  const { data: existing } = await auth.supabase
    .from('health_donors')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await auth.supabase
      .from('health_donors')
      .update(payload)
      .eq('id', existing.id as string)
      .select('*')
      .single();
    if (error) return apiError('DONOR_UPDATE_FAILED', error.message, 'আপডেট করা যায়নি।', 400);
    return apiSuccess(data);
  }

  if (!payload.blood_group || !payload.contact_phone) {
    return apiError(
      'MISSING_DONOR_FIELDS',
      'Blood group and contact phone are required to register as a donor.',
      'ডোনার হিসেবে নিবন্ধনে রক্তের গ্রুপ ও ফোন নম্বর প্রয়োজন।',
      422
    );
  }

  const { data, error } = await auth.supabase
    .from('health_donors')
    .insert(payload)
    .select('*')
    .single();
  if (error) return apiError('DONOR_CREATE_FAILED', error.message, 'ডোনার নিবন্ধন ব্যর্থ হয়েছে।', 400);
  return apiSuccess(data, 201);
}
