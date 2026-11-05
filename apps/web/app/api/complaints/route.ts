// apps/web/app/api/complaints/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured, requireAuth } from '@/lib/request-context';
import { isDemoEmail, readSignedDemoSession } from '@/lib/demo-auth';
import { demoTickets } from '@/lib/demo-tickets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const demoSession = readSignedDemoSession();
  if (!isSupabaseServerConfigured() && demoSession) {
    return apiSuccess(demoTickets(demoSession.university_id, demoSession.universityCode), 200, { demo: true });
  }
  const { auth, response } = await requireAuth();
  if (!auth) return response!;
  // Never return other users' complaints, especially confidential grievances.
  const { data, error } = await auth.admin.from('complaints')
    .select('id, university_id, tracking_code, title, category, status, severity, created_at')
    .eq('university_id', auth.profile.university_id).eq('student_id', auth.user.id)
    .order('created_at', { ascending: false }).limit(30);
  if (error) return apiError('COMPLAINT_QUERY_FAILED', 'Could not load tickets.', 'টিকিট লোড করা যায়নি।', 500);
  const rows = data?.length ? data : ((demoSession && demoSession.id === auth.user.id) || isDemoEmail(auth.user.email))
    ? demoTickets(auth.profile.university_id, auth.profile.universities?.code ?? 'JU') : [];
  return apiSuccess(rows, 200, { total: rows.length });
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
