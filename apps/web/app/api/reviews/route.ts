// apps/web/app/api/reviews/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

const PROFANITY_REGEX = /\b(abuseword1|slurword2|harassword3)\b/i;

export async function GET(req: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const sp = req.nextUrl.searchParams;
  const targetType = sp.get('targetType');
  const targetId = sp.get('targetId');

  let query = supabase
    .from('reviews')
    .select('*, profiles(full_name, avatar_url, trust_level)')
    .is('deleted_at', null)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (targetType) query = query.eq('target_type', targetType);
  if (targetId) query = query.eq('target_id', targetId);

  const { data: reviews, error } = await query;
  if (error) return apiError('REVIEWS_FETCH_FAILED', error.message, 'রিভিউ লোড করা যায়নি।', 400);

  const { data: aggregate } =
    targetType && targetId
      ? await supabase
          .from('review_aggregates')
          .select('*')
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .maybeSingle()
      : { data: null };

  return apiSuccess({ reviews, aggregate });
}

export async function POST(req: NextRequest) {
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
