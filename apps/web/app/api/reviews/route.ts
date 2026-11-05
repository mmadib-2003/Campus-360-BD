// apps/web/app/api/reviews/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteClient, createSupabasePublicClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured, requireAuth } from '@/lib/request-context';
import { parseCampusScope } from '@/lib/campus-scope';

export const dynamic = 'force-dynamic';

const PROFANITY_REGEX = /\b(abuseword1|slurword2|harassword3)\b/i;

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503
    );
  }

  const { auth } = await requireAuth();
  const sp = req.nextUrl.searchParams;
  const allCampuses = parseCampusScope(sp.get('scope')) === 'all';
  const supabase = allCampuses || !auth ? createSupabasePublicClient() : auth.supabase;
  const targetType = sp.get('targetType');
  const targetId = sp.get('targetId');

  let query = supabase
    .from('reviews')
    .select(allCampuses || !auth ? 'id, university_id, author_id, target_type, target_id, rating, title, body, photo_urls, tags, verified_participation, pending_reports_count, is_hidden, deleted_at, created_at, updated_at, profiles(full_name, avatar_url, trust_level)' : '*, profiles(full_name, avatar_url, trust_level)')
    .is('deleted_at', null)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (auth && !allCampuses) query = query.eq('university_id', auth.profile.university_id);
  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);

  const { data: reviews, error } = await query;
  if (error) return apiError('REVIEWS_FETCH_FAILED', error.message, 'রিভিউ লোড করা যায়নি।', 400);

  // Cross-campus averages use the visible returned reviews, not private aggregates.
  if (allCampuses || !auth) {
    const ratings = (reviews ?? []).map((review: any) => Number(review.rating)).filter(Number.isFinite);
    return apiSuccess({ reviews, aggregate: ratings.length ? { avg_rating: ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length } : null });
  }
  let aggregateQuery = supabase.from('review_aggregates').select('*');
  if (auth) aggregateQuery = aggregateQuery.eq('university_id', auth.profile.university_id);
  const { data: aggregate } = targetType && targetId
    ? await aggregateQuery.eq('target_type', targetType).eq('target_id', targetId).maybeSingle()
    : { data: null };

  return apiSuccess({ reviews, aggregate });
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

  const body = await req.json();
  if (PROFANITY_REGEX.test(body.body || '') || PROFANITY_REGEX.test(body.title || '')) {
    return apiError('PROFANITY_BLOCKED', 'Review contains prohibited language.', 'আপনার রিভিউতে অগ্রহণযোগ্য শব্দ রয়েছে।', 422);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('university_id, trust_level')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('UNVERIFIED', 'Email verification required to post reviews.', 'রিভিউ দিতে ইমেইল যাচাই করা আবশ্যক।', 403);
  }

  // Server-side verified_participation check
  const admin = createSupabaseAdminClient();
  let verifiedParticipation = false;

  if (body.targetType === 'EVENT') {
    const { data: checkin } = await admin
      .from('event_rsvps')
      .select('checked_in_at')
      .eq('event_id', body.targetId)
      .eq('user_id', user.id)
      .not('checked_in_at', 'is', null)
      .maybeSingle();
    verifiedParticipation = Boolean(checkin);
  } else if (body.targetType === 'ARCHIVE_FILE') {
    const { data: dlAudit } = await admin
      .from('audit_log')
      .select('id')
      .eq('actor_id', user.id)
      .eq('action', 'ARCHIVE_FILE_DOWNLOAD')
      .eq('entity_id', body.targetId)
      .limit(1)
      .maybeSingle();
    verifiedParticipation = Boolean(dlAudit);
  } else if (body.targetType === 'COMPLAINT_RESOLUTION') {
    const { data: comp } = await admin
      .from('complaints')
      .select('id')
      .eq('id', body.targetId)
      .eq('student_id', user.id)
      .in('status', ['RESOLVED', 'CLOSED'])
      .maybeSingle();
    verifiedParticipation = Boolean(comp);
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      university_id: profile.university_id,
      author_id: user.id,
      target_type: body.targetType,
      target_id: body.targetId,
      rating: Number(body.rating),
      title: body.title,
      body: body.body,
      photo_urls: body.photoUrls || [],
      tags: body.tags || [],
      verified_participation: verifiedParticipation,
    })
    .select('*, profiles(full_name, avatar_url, trust_level)')
    .single();

  if (error) return apiError('REVIEW_CREATE_FAILED', error.message, 'রিভিউ জমা দেওয়া যায়নি।', 400);
  return apiSuccess(review, 201);
}
