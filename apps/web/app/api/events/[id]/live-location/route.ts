// apps/web/app/api/events/[id]/live-location/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

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
  const { data, error } = await supabase
    .from('events')
    .update({
      live_override: body.liveOverride || 'FORCE_LIVE',
      live_ping_lat: Number(body.lat),
      live_ping_lng: Number(body.lng),
      live_ping_updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('organizer_id', user.id)
    .select('*')
    .single();

  if (error || !data) return apiError('FORBIDDEN', 'Only the event organizer can broadcast live coordinates.', 'শুধুমাত্র আয়োজক লাইভ লোকেশন আপডেট করতে পারবেন।', 403);
  return apiSuccess(data);
}
