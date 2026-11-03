// apps/web/app/api/archive/upload-url/route.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(req: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, university_id, trust_level')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('VERIFICATION_REQUIRED', 'Only email-verified university students can upload.', 'শুধুমাত্র যাচাইকৃত শিক্ষার্থীরা ফাইল আপলোড করতে পারবেন।', 403);
  }

  const body = await req.json();
  if (!ALLOWED_MIMES.has(body.mimeType) || Number(body.fileSizeBytes) > 52428800) {
    return apiError('INVALID_FILE', 'Unsupported file type or exceeds 50 MB limit.', 'ফাইলের ধরন অনুমোদিত নয় অথবা ৫০ মেগাবাইটের বেশি।', 400);
  }

  // Enforce 20 uploads/day/student and 200 uploads/day/university
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: userTodayCount } = await supabase
    .from('academic_files')
    .select('id', { count: 'exact', head: true })
    .eq('uploader_id', user.id)
    .gte('created_at', startOfDay.toISOString());

  if ((userTodayCount ?? 0) >= 20) {
    return apiError('USER_DAILY_QUOTA', 'Daily limit of 20 archive uploads reached.', 'দৈনিক সর্বোচ্চ ২০টি ফাইল আপলোডের সীমা পূর্ণ হয়েছে।', 429);
  }

  const { count: univTodayCount } = await supabase
    .from('academic_files')
    .select('id', { count: 'exact', head: true })
    .eq('university_id', profile.university_id)
    .gte('created_at', startOfDay.toISOString());

  if ((univTodayCount ?? 0) >= 200) {
    return apiError('UNIV_DAILY_QUOTA', 'University daily upload quota (200) reached.', 'বিশ্ববিদ্যালয়ের দৈনিক ২০০ ফাইল আপলোডের সীমা পূর্ণ হয়েছে।', 429);
  }

  const safeCourse = String(body.courseCode || 'GEN').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = String(body.filename || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.university_id}/${body.departmentId}/${safeCourse}/${crypto.randomUUID()}_${safeName}`;

  const admin = createSupabaseAdminClient();
  const { data: signed, error } = await admin.storage
    .from('academic-archive')
    .createSignedUploadUrl(storagePath);

  if (error || !signed) {
    return apiError('SIGN_URL_ERROR', 'Could not create signed upload URL.', 'সাইনড আপলোড লিংক তৈরি করা যায়নি।', 500);
  }

  return apiSuccess({
    storagePath,
    uploadUrl: signed.signedUrl,
    token: signed.token,
  });
}
