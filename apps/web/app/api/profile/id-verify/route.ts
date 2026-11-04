// apps/web/app/api/profile/id-verify/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    const demoBody = await req.json().catch(() => ({}));
    const status = demoBody?.status === 'VERIFIED' ? 'VERIFIED' : 'MANUAL_REVIEW';
    return apiSuccess(
      {
        demo: true,
        verification: {
          id: `demo-idv-${Date.now()}`,
          student_id_number: String(demoBody?.studentIdNumber ?? ''),
          name: String(demoBody?.name ?? ''),
          confidence: Number(demoBody?.confidence ?? 0),
          status,
          matches: Boolean(demoBody?.matches),
          university_code: String(demoBody?.universityCode ?? ''),
          created_at: new Date().toISOString(),
        },
        uploadUrl: null,
        storagePath: null,
      },
      201
    );
  }

  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, university_id, trust_level, student_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('EMAIL_UNVERIFIED', 'Verify your university email first.', 'প্রথমে আপনার বিশ্ববিদ্যালয়ের ইমেইল যাচাই করুন।', 403);
  }

  const body = await req.json();
  const admin = createSupabaseAdminClient();
  const storagePath = `${profile.university_id}/${user.id}/${Date.now()}_id_card.jpg`;

  const { data: signedUpload, error: signErr } = await admin.storage
    .from('id-verifications')
    .createSignedUploadUrl(storagePath);

  if (signErr || !signedUpload) {
    return apiError('STORAGE_ERROR', 'Failed to issue signed upload URL.', 'আপলোড লিংক তৈরি করা যায়নি।', 500);
  }

  const retentionDays = Number(process.env.ID_VERIFICATION_RETENTION_DAYS || 7);
  const purgeDate = new Date(Date.now() + retentionDays * 86400 * 1000).toISOString();

  const { data: record, error: dbErr } = await supabase
    .from('id_verification')
    .insert({
      user_id: user.id,
      university_id: profile.university_id,
      student_id_number: body.studentIdNumber || profile.student_id,
      front_storage_path: storagePath,
      file_purge_after: purgeDate,
    })
    .select('*')
    .single();

  if (dbErr) return apiError('DB_ERROR', dbErr.message, 'আইডি যাচাইয়ের আবেদন জমা দেওয়া যায়নি।', 400);

  return apiSuccess({
    verification: record,
    uploadUrl: signedUpload.signedUrl,
    token: signedUpload.token,
    storagePath,
  }, 201);
}
