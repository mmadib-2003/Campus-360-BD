// supabase/functions/sla-escalation-cron/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  const expectedSecret = `Bearer ${Deno.env.get('CRON_WEBHOOK_SECRET')}`;
  if (!authHeader || authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const nowIso = new Date().toISOString();

  const { data: breached, error: fetchError } = await supabase
    .from('complaints')
    .select(`
      id,
      university_id,
      tracking_code,
      category,
      status,
      assigned_unit_id,
      student_id
    `)
    .in('status', ['SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW'])
    .eq('sla_breached', false)
    .lt('sla_due_at', nowIso);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  let escalatedCount = 0;

  for (const item of breached ?? []) {
    const { data: routing } = await supabase
      .from('complaint_routing')
      .select('escalation_unit_id')
      .eq('university_id', item.university_id)
      .eq('category', item.category)
      .maybeSingle();

    const nextUnitId = routing?.escalation_unit_id ?? item.assigned_unit_id;

    const { error: updateError } = await supabase
      .from('complaints')
      .update({
        status: 'ESCALATED',
        sla_breached: true,
        escalated_at: nowIso,
        assigned_unit_id: nextUnitId,
      })
      .eq('id', item.id);

    if (!updateError) {
      escalatedCount++;
      await supabase.from('complaint_messages').insert({
        complaint_id: item.id,
        university_id: item.university_id,
        sender_role: 'SYSTEM',
        is_internal_note: false,
        body: `SLA window exceeded. Case ${item.tracking_code} has been automatically escalated to the higher governing authority.`,
      });

      if (item.student_id) {
        await supabase.from('notifications').insert({
          university_id: item.university_id,
          user_id: item.student_id,
          title_en: `Complaint ${item.tracking_code} Escalated`,
          title_bn: `অভিযোগ ${item.tracking_code} উর্ধ্বতন কর্তৃপক্ষের কাছে পাঠানো হয়েছে`,
          body_en: `Your complaint breached the response SLA and was auto-escalated.`,
          body_bn: `নির্ধারিত সময়ের মধ্যে সমাধান না হওয়ায় আপনার অভিযোগটি স্বয়ংক্রিয়ভাবে উর্ধ্বতন ইউনিটে পাঠানো হয়েছে।`,
          action_url: `/complaints/track?code=${item.tracking_code}`,
          category: 'COMPLAINT_SLA',
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: breached?.length ?? 0, escalatedCount }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
