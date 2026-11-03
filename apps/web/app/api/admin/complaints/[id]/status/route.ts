// apps/web/app/api/admin/complaints/[id]/status/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const supabase = createSupabaseRouteClient();
  const body = await req.json();

  const updateFields: Record<string, unknown> = {
    status: body.status,
  };
  if (body.status === 'RESOLVED') {
    updateFields.resolved_at = new Date().toISOString();
    updateFields.resolution_summary = body.resolutionSummary;
    updateFields.resolution_proof_path = body.resolutionProofPath ?? null;
  }
  if (body.status === 'REJECTED_WITH_REASON') {
    updateFields.rejection_reason = body.rejectionReason;
  }

  const { data, error } = await supabase
    .from('complaints')
    .update(updateFields)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error || !data) {
    return apiError('STATUS_UPDATE_DENIED', error?.message || 'Forbidden', 'অভিযোগের স্ট্যাটাস পরিবর্তন করা যায়নি।', 403);
  }

  if (data.student_id) {
    await supabase.from('notifications').insert({
      university_id: data.university_id,
      user_id: data.student_id,
      title_en: `Case ${data.tracking_code} Updated to ${data.status}`,
      title_bn: `অভিযোগ ${data.tracking_code}-এর নতুন অবস্থা: ${data.status}`,
      body_en: body.resolutionSummary || `Your complaint status changed to ${data.status}.`,
      body_bn: body.resolutionSummary || `আপনার অভিযোগের বর্তমান অবস্থা ${data.status}।`,
      action_url: `/complaints/track?code=${data.tracking_code}`,
      category: 'COMPLAINT_STATUS',
    });
  }

  return apiSuccess(data);
}
