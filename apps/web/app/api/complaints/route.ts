// apps/web/app/api/complaints/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, university_id, trust_level, universities(code)')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('UNVERIFIED', 'Only verified students can submit complaints.', 'শুধুমাত্র যাচাইকৃত শিক্ষার্থীরা অভিযোগ জমা দিতে পারবেন।', 403);
  }

  const body = await req.json();
  const isHarassmentCategory = ['HARASSMENT', 'RAGGING_BULLYING', 'SEXUAL_HARASSMENT'].includes(body.category);
  const isAnonymous = body.isAnonymous ?? isHarassmentCategory;

  const admin = createSupabaseAdminClient();

  // Lookup university routing rule and SLA hours
  const { data: routeRule } = await admin
    .from('complaint_routing')
    .select('primary_unit_id, sla_hours')
    .eq('university_id', profile.university_id)
    .eq('category', body.category)
    .maybeSingle();

  const slaHours = routeRule?.sla_hours ?? 72;
  const slaDueAt = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  const univObj = Array.isArray(profile.universities) ? profile.universities[0] : profile.universities;
  const univCode = univObj?.code || 'BD';
  const year = new Date().getUTCFullYear();
  const seq = String(crypto.randomInt(100000, 999999));
  const trackingCode = `${univCode}-CASE-${year}-${seq}`;

  let rawTrackingSecret: string | null = null;
  let trackingSecretHash: string | null = null;

  if (isAnonymous) {
    rawTrackingSecret = crypto.randomBytes(24).toString('hex');
    const pepper = process.env.ANON_COMPLAINT_PEPPER || 'default-anon-pepper';
    trackingSecretHash = crypto
      .createHmac('sha256', pepper)
      .update(`${trackingCode}:${rawTrackingSecret}`)
      .digest('hex');
  }

  const { data: complaint, error } = await admin
    .from('complaints')
    .insert({
      university_id: profile.university_id,
      tracking_code: trackingCode,
      student_id: isAnonymous ? null : user.id,
      is_anonymous: isAnonymous,
      consent_to_share_identity: isAnonymous ? Boolean(body.consentToShareIdentity) : true,
      tracking_secret_hash: trackingSecretHash,
      title: body.title,
      category: body.category,
      description: body.description,
      severity: body.severity || 'MEDIUM',
      preferred_language: body.preferredLanguage || 'en',
      status: 'SUBMITTED',
      assigned_unit_id: routeRule?.primary_unit_id ?? null,
      sla_hours: slaHours,
      sla_due_at: slaDueAt,
    })
    .select('*')
    .single();

  if (error || !complaint) {
    return apiError('CREATE_COMPLAINT_FAILED', error?.message || 'Error', 'অভিযোগ জমা দেওয়া যায়নি।', 400);
  }

  return apiSuccess(
    {
      complaint,
      trackingCode,
      trackingSecret: rawTrackingSecret, // Returned ONCE for SecureStore / localStorage persistence
      slaHours,
      slaDueAt,
    },
    201
  );
}
