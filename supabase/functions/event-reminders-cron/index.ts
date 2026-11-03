// supabase/functions/event-reminders-cron/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_WEBHOOK_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = Date.now();
  const in1h = new Date(now + 60 * 60 * 1000).toISOString();
  const in24h = new Date(now + 24 * 60 * 60 * 1000).toISOString();

  const { data: rsvps1h } = await supabase
    .from('event_rsvps')
    .select('id, user_id, university_id, events!inner(id, title_en, title_bn, starts_at, venue_name)')
    .eq('status', 'GOING')
    .eq('reminder_1h_sent', false)
    .lte('events.starts_at', in1h)
    .gt('events.starts_at', new Date(now).toISOString());

  for (const rsvp of rsvps1h ?? []) {
    const ev = Array.isArray(rsvp.events) ? rsvp.events[0] : rsvp.events;
    await supabase.from('notifications').insert({
      university_id: rsvp.university_id,
      user_id: rsvp.user_id,
      title_en: `Starting in 1 Hour: ${ev.title_en}`,
      title_bn: `১ ঘণ্টার মধ্যে শুরু হচ্ছে: ${ev.title_bn ?? ev.title_en}`,
      body_en: `Venue: ${ev.venue_name}. Tap to view live map and check in.`,
      body_bn: `স্থান: ${ev.venue_name}। লাইভ ম্যাপ ও চেক-ইন করতে ট্যাপ করুন।`,
      action_url: `/events/${ev.id}`,
      category: 'EVENT_REMINDER_1H',
    });
    await supabase.from('event_rsvps').update({ reminder_1h_sent: true }).eq('id', rsvp.id);
  }

  const { data: rsvps24h } = await supabase
    .from('event_rsvps')
    .select('id, user_id, university_id, events!inner(id, title_en, title_bn, starts_at, venue_name)')
    .eq('status', 'GOING')
    .eq('reminder_24h_sent', false)
    .lte('events.starts_at', in24h)
    .gt('events.starts_at', in1h);

  for (const rsvp of rsvps24h ?? []) {
    const ev = Array.isArray(rsvp.events) ? rsvp.events[0] : rsvp.events;
    await supabase.from('notifications').insert({
      university_id: rsvp.university_id,
      user_id: rsvp.user_id,
      title_en: `Tomorrow: ${ev.title_en}`,
      title_bn: `আগামীকাল: ${ev.title_bn ?? ev.title_en}`,
      body_en: `Scheduled at ${ev.venue_name}.`,
      body_bn: `স্থান: ${ev.venue_name}।`,
      action_url: `/events/${ev.id}`,
      category: 'EVENT_REMINDER_24H',
    });
    await supabase.from('event_rsvps').update({ reminder_24h_sent: true }).eq('id', rsvp.id);
  }

  return new Response(
    JSON.stringify({ ok: true, sent1h: rsvps1h?.length ?? 0, sent24h: rsvps24h?.length ?? 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
