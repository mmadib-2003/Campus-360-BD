// supabase/functions/push-dispatcher/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async (req: Request) => {
  const payload = await req.json();
  const record = payload.record;
  if (!record || !record.user_id) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('mobile_push_enabled, expo_push_token')
    .eq('user_id', record.user_id)
    .maybeSingle();

  if (prefs?.mobile_push_enabled && prefs.expo_push_token) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''}`,
      },
      body: JSON.stringify({
        to: prefs.expo_push_token,
        title: record.title_en,
        body: record.body_en,
        data: { url: `campus360bd://${(record.action_url ?? '').replace(/^\//, '')}` },
        sound: 'default',
      }),
    });
  }

  return new Response(JSON.stringify({ dispatched: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
