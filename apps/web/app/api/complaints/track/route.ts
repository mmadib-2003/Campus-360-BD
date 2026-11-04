// apps/web/app/api/complaints/track/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const trackingCode = String(body.trackingCode || '').trim().toUpperCase();
  const trackingSecret = typeof body.trackingSecret === 'string' ? body.trackingSecret.trim() : '';

  if (!trackingCode) {
    return apiError('MISSING_CODE', 'Tracking code is required.', 'ট্র্যাকিং কোড প্রদান করা আবশ্যক।', 400);
  }

  const admin = createSupabaseAdminClient();
  const complaintSelect = `
      id,
      university_id,
      tracking_code,
      student_id,
      is_anonymous,
      tracking_secret_hash,
      title,
      category,
      severity,
      status,
      sla_hours,
      sla_due_at,
      sla_breached,
      resolution_summary,
      student_rating,
      last_activity_at,
      created_at,
      governing_units(name_en, name_bn, unit_code),
      complaint_status_history(from_status, to_status, reason, created_at)
    `;

  // Complaints resolve by tracking_code; civic tickets also resolve by ticket ID.
  let { data: complaint } = await admin
    .from('complaints')
    .select(complaintSelect)
    .eq('tracking_code', trackingCode)
    .maybeSingle();

  if (!complaint && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackingCode)) {
    const { data: byId } = await admin
      .from('complaints')
      .select(complaintSelect)
      .eq('id', trackingCode)
      .maybeSingle();
    complaint = byId;
  }

  if (!complaint) {
    return apiError('NOT_FOUND', 'No complaint found matching that tracking code.', 'এই ট্র্যাকিং কোডে কোনো অভিযোগ পাওয়া যায়নি।', 404);
  }

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

  let hasFullAccess = false;
  if (complaint.student_id && user?.id === complaint.student_id) {
    hasFullAccess = true;
  } else if (complaint.is_anonymous && trackingSecret && complaint.tracking_secret_hash) {
    const pepper = process.env.ANON_COMPLAINT_PEPPER || 'default-anon-pepper';
    const candidateHash = crypto
      .createHmac('sha256', pepper)
      .update(`${trackingCode}:${trackingSecret}`)
      .digest('hex');
    hasFullAccess = crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(complaint.tracking_secret_hash, 'hex')
    );
  }

  const { data: messages } = hasFullAccess
    ? await admin
        .from('complaint_messages')
        .select('id, sender_role, body, attachment_paths, created_at')
        .eq('complaint_id', complaint.id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true })
    : { data: [] };

  const { tracking_secret_hash: _omitted, ...safeComplaint } = complaint;

  return apiSuccess({
    complaint: safeComplaint,
    hasFullAccess,
    messages: messages ?? [],
  });
}
