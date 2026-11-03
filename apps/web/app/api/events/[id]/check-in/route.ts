// apps/web/app/api/events/[id]/check-in/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const body = await req.json();
  const userLat = Number(body.lat);
  const userLng = Number(body.lng);

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!event) return apiError('NOT_FOUND', 'Event not found.', 'ইভেন্ট পাওয়া যায়নি।', 404);

  const targetLat = event.live_ping_lat ?? event.lat;
  const targetLng = event.live_ping_lng ?? event.lng;
  const distanceMeters = haversineDistanceMeters(userLat, userLng, targetLat, targetLng);

  if (distanceMeters > event.geofence_radius_m) {
    return apiError(
      'OUTSIDE_GEOFENCE',
      `You are ${Math.round(distanceMeters)}m away. Move within ${event.geofence_radius_m}m of ${event.venue_name} to check in.`,
      `আপনি ভেন্যু থেকে ${Math.round(distanceMeters)} মিটার দূরে আছেন। চেক-ইন করতে ${event.geofence_radius_m} মিটারের মধ্যে আসুন।`,
      403,
      { distanceMeters: Math.round(distanceMeters), allowedRadiusMeters: event.geofence_radius_m }
    );
  }

  const { data: rsvp, error } = await supabase
    .from('event_rsvps')
    .upsert(
      {
        event_id: event.id,
        university_id: event.university_id,
        user_id: user.id,
        status: 'GOING',
        checked_in_at: new Date().toISOString(),
        checkin_lat: userLat,
        checkin_lng: userLng,
        checkin_distance_m: Math.round(distanceMeters),
      },
      { onConflict: 'event_id,user_id' }
    )
    .select('*')
    .single();

  if (error) return apiError('CHECKIN_FAILED', error.message, 'চেক-ইন সম্পন্ন করা যায়নি।', 400);
  return apiSuccess({ rsvp, distanceMeters: Math.round(distanceMeters) });
}
