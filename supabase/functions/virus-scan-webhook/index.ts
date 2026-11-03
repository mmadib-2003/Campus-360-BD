// supabase/functions/virus-scan-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface ScanWebhookPayload {
  bucket: 'academic-archive' | 'complaint-evidence';
  storagePath: string;
  verdict: 'CLEAN' | 'QUARANTINED';
  signature: string;
  threatName?: string;
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get('CLAMAV_WEBHOOK_SECRET');
  const headerSig = req.headers.get('x-clamav-signature');
  if (!secret || headerSig !== secret) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401 });
  }

  const payload = (await req.json()) as ScanWebhookPayload;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (payload.bucket === 'academic-archive') {
    const { data: fileRow } = await supabase
      .from('academic_files')
      .update({ scan_status: payload.verdict })
      .eq('storage_path', payload.storagePath)
      .select('id, university_id, uploader_id')
      .maybeSingle();

    await supabase
      .from('academic_file_versions')
      .update({ scan_status: payload.verdict })
      .eq('storage_path', payload.storagePath);

    if (payload.verdict === 'QUARANTINED' && fileRow) {
      await supabase.storage.from('academic-archive').remove([payload.storagePath]);
      await supabase.from('audit_log').insert({
        university_id: fileRow.university_id,
        actor_id: fileRow.uploader_id,
        action: 'FILE_QUARANTINED_MALWARE',
        entity_type: 'ACADEMIC_FILE',
        entity_id: fileRow.id,
        metadata: { storagePath: payload.storagePath, threatName: payload.threatName ?? 'Unknown' },
      });
    }
  } else if (payload.bucket === 'complaint-evidence') {
    await supabase
      .from('complaint_attachments')
      .update({ scan_status: payload.verdict })
      .eq('storage_path', payload.storagePath);

    if (payload.verdict === 'QUARANTINED') {
      await supabase.storage.from('complaint-evidence').remove([payload.storagePath]);
    }
  }

  return new Response(JSON.stringify({ ok: true, status: payload.verdict }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
