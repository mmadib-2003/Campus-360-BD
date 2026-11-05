// apps/web/app/api/civic/tickets/route.ts
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured, requireAuth } from '@/lib/request-context';
import { isDemoEmail, readSignedDemoSession } from '@/lib/demo-auth';
import { demoTickets } from '@/lib/demo-tickets';

export const dynamic = 'force-dynamic';

/** Categories that must never appear on the public civic board. */
const PRIVATE_CATEGORIES = ['HARASSMENT', 'RAGGING_BULLYING', 'SEXUAL_HARASSMENT', 'DISCRIMINATION', 'FINANCIAL'];

const PUBLIC_COLUMNS =
  'id, tracking_code, title, category, severity, status, upvotes_count, is_public_issue, location_hint, evidence_urls, sla_due_at, sla_breached, created_at, last_activity_at, resolved_at, resolution_summary';

/**
 * Public civic ticket board.
 * Returns only anonymous-safe columns — never `student_id`, tracking secrets or
 * description text of sensitive categories.
 */
export async function GET(req: NextRequest) {
  const demoSession = readSignedDemoSession();
  if (!isSupabaseServerConfigured() && demoSession) {
    return apiSuccess(demoTickets(demoSession.university_id, demoSession.universityCode), 200, { demo: true });
  }
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  const scope = req.nextUrl.searchParams.get('scope');
  const isAdminScope = scope === 'admin' && auth.isAdmin;
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 60)));

  let query = auth.admin
    .from('complaints')
    .select(isAdminScope ? `${PUBLIC_COLUMNS}, is_anonymous, assigned_unit_id, student_rating` : PUBLIC_COLUMNS)
    .eq('university_id', auth.profile.university_id)
    .neq('category', 'SEXUAL_HARASSMENT')
    .neq('category', 'RAGGING_BULLYING')
    .neq('category', 'HARASSMENT')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!isAdminScope) query = query.eq('is_public_issue', true);

  const { data, error } = await query;
  if (error) {
    return apiError('CIVIC_QUERY_FAILED', error.message, 'টিকিট লোড করা যায়নি।', 400);
  }

  const rows = data?.length ? data : ((demoSession && demoSession.id === auth.user.id) || isDemoEmail(auth.user.email))
    ? demoTickets(auth.profile.university_id, auth.profile.universities?.code ?? 'JU').slice(0, limit) : [];
  return apiSuccess(rows, 200, { total: rows.length, admin: isAdminScope });
}

/**
 * Public civic ticket submission.
 * Thin wrapper over the grievance pipeline that guarantees a non-anonymous,
 * publicly visible maintenance/security report.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const { auth, response } = await requireAuth();
  if (!auth) return response!;

  if (auth.profile.trust_level === 'UNVERIFIED') {
    return apiError(
      'VERIFICATION_REQUIRED',
      'Verify your university email before reporting issues.',
      'অভিযোগ জানানোর আগে ইমেইল যাচাই করুন।',
      403
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return apiError('INVALID_BODY', 'A JSON body is required.', 'অবৈধ অনুরোধ।', 400);
  }

  const title = String((body as Record<string, unknown>).title ?? '').trim();
  const description = String((body as Record<string, unknown>).description ?? '').trim();
  const category = String((body as Record<string, unknown>).category ?? 'INFRASTRUCTURE').toUpperCase();
  const severity = String((body as Record<string, unknown>).severity ?? 'MEDIUM').toUpperCase();
  const locationHint = String((body as Record<string, unknown>).location_hint ?? '').trim();
  const evidenceUrls = Array.isArray((body as Record<string, unknown>).evidence_urls)
    ? ((body as Record<string, unknown>).evidence_urls as string[]).slice(0, 5)
    : [];

  if (title.length < 5 || description.length < 10) {
    return apiError(
      'VALIDATION_FAILED',
      'A title (5+ chars) and description (10+ chars) are required.',
      'শিরোনাম ও বিবরণ প্রয়োজন।',
      422
    );
  }

  if (PRIVATE_CATEGORIES.includes(category)) {
    return apiError(
      'USE_FORMAL_GRIEVANCE',
      'Sensitive categories must be filed through the confidential grievance system.',
      'সংবেদনশীল বিষয়ে গোপনীয় অভিযোগ ব্যবস্থা ব্যবহার করুন।',
      422
    );
  }

  const allowedCategories = ['INFRASTRUCTURE', 'SECURITY', 'TRANSPORT', 'HALL_RESIDENCE', 'HEALTH', 'ACADEMIC', 'OTHER'];
  const allowedSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  const { data: routeRule } = await auth.admin
    .from('complaint_routing')
    .select('primary_unit_id, sla_hours')
    .eq('university_id', auth.profile.university_id)
    .eq('category', allowedCategories.includes(category) ? category : 'OTHER')
    .maybeSingle();

  const slaHours = routeRule?.sla_hours ?? 72;
  const univCode = auth.profile.universities?.code ?? 'BD';
  const trackingCode = `${univCode}-CASE-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;

  const { data: complaint, error } = await auth.admin
    .from('complaints')
    .insert({
      university_id: auth.profile.university_id,
      tracking_code: trackingCode,
      student_id: auth.user.id,
      is_anonymous: false,
      consent_to_share_identity: false,
      title: title.slice(0, 160),
      category: allowedCategories.includes(category) ? category : 'OTHER',
      description: `${description.slice(0, 4000)}${locationHint ? `\n\nLocation: ${locationHint}` : ''}`,
      severity: allowedSeverities.includes(severity) ? severity : 'MEDIUM',
      status: 'SUBMITTED',
      assigned_unit_id: routeRule?.primary_unit_id ?? null,
      sla_hours: slaHours,
      sla_due_at: new Date(Date.now() + slaHours * 3_600_000).toISOString(),
      is_public_issue: true,
      location_hint: locationHint.slice(0, 200) || null,
      evidence_urls: evidenceUrls,
    })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error || !complaint) {
    return apiError('CIVIC_CREATE_FAILED', error?.message ?? 'Could not submit ticket.', 'টিকিট জমা দেওয়া যায়নি।', 400);
  }

  // Notify the governing unit's officers that a new civic ticket is in the queue.
  const { data: officers } = await auth.admin
    .from('user_roles')
    .select('user_id')
    .eq('university_id', auth.profile.university_id)
    .in('role', ['GOVERNING_BODY', 'UNIVERSITY_ADMIN'])
    .limit(30);

  if (officers?.length) {
    await auth.admin.from('notifications').insert(
      officers.map((officer) => ({
        university_id: auth.profile.university_id,
        user_id: officer.user_id,
        title_en: `New civic ticket: ${complaint.title}`,
        title_bn: `নতুন সিভিক টিকিট: ${complaint.title}`,
        body_en: `${severity} priority • ${complaint.tracking_code}`,
        body_bn: `${severity} অগ্রাধিকার • ${complaint.tracking_code}`,
        action_url: '/admin/console',
        category: 'CIVIC_TICKET',
      }))
    );
  }

  return apiSuccess(complaint, 201, { trackingCode });
}
