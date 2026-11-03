// apps/web/app/api/events/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const supabase = createSupabaseRouteClient();
  const univId = req.nextUrl.searchParams.get('universityId');

  let query = supabase
    .from('events')
    .select('*, universities(code, name_en, name_bn)')
    .is('deleted_at', null)
    .order('starts_at', { ascending: true });

  if (univId) query = query.eq('university_id', univId);

  const { data, error } = await query;
  if (error) return apiError('EVENTS_FETCH_FAILED', error.message, 'ইভেন্ট লোড করা যায়নি।', 400);
  return apiSuccess(data);
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('university_id, trust_level')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('FORBIDDEN', 'Verified account required to create events.', 'ইভেন্ট তৈরি করতে যাচাইকৃত অ্যাকাউন্ট প্রয়োজন।', 403);
  }

  const body = await req.json();
  const { data, error } = await supabase
    .from('events')
    .insert({
      university_id: profile.university_id,
      organizer_id: user.id,
      host_organization: body.hostOrganization,
      title_en: body.titleEn,
      title_bn: body.titleBn,
      description_en: body.descriptionEn,
      description_bn: body.descriptionBn,
      category: body.category,
      is_public: Boolean(body.isPublic),
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      venue_name: body.venueName,
      formatted_address: body.formattedAddress,
      text_directions_en: body.textDirectionsEn,
      text_directions_bn: body.textDirectionsBn,
      lat: Number(body.lat),
      lng: Number(body.lng),
      place_id: body.placeId,
      geofence_radius_m: Number(body.geofenceRadiusM || 150),
      capacity: body.capacity ? Number(body.capacity) : null,
      rsvp_required: body.rsvpRequired ?? true,
    })
    .select('*')
    .single();

  if (error) return apiError('EVENT_CREATE_FAILED', error.message, 'ইভেন্ট তৈরি করা যায়নি।', 400);
  return apiSuccess(data, 201);
}
