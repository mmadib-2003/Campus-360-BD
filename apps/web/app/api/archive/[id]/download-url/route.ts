// apps/web/app/api/archive/[id]/download-url/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required to download archive files.', 'ফাইল ডাউনলোড করতে লগইন করুন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, university_id, trust_level')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('UNVERIFIED', 'University email verification required.', 'বিশ্ববিদ্যালয়ের ইমেইল যাচাই করা আবশ্যক।', 403);
  }

  const { data: file } = await supabase
    .from('academic_files')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!file) return apiError('NOT_FOUND', 'Archive file not found.', 'ফাইলটি পাওয়া যায়নি।', 404);
  if (file.scan_status === 'QUARANTINED' || file.dmca_quarantined) {
    return apiError('QUARANTINED', 'File is quarantined for safety/copyright review.', 'নিরাপত্তা বা কপিরাইট কারণে ফাইলটি স্থগিত রয়েছে।', 451);
  }
  if (file.requires_same_university_verification && file.university_id !== profile.university_id) {
    return apiError('CROSS_TENANT_DENIED', 'Uploader restricted this file to verified students of the same university.', 'এই ফাইলটি শুধুমাত্র একই বিশ্ববিদ্যালয়ের শিক্ষার্থীদের জন্য সংরক্ষিত।', 403);
  }

  const admin = createSupabaseAdminClient();
  // Short-lived 5-minute (300s) signed download URL
  const { data: signed, error } = await admin.storage
    .from('academic-archive')
    .createSignedUrl(file.storage_path, 300, { download: file.original_filename });

  if (error || !signed) return apiError('SIGN_ERROR', 'Could not sign download URL.', 'ডাউনলোড লিংক তৈরি করা যায়নি।', 500);

  await admin
    .from('academic_files')
    .update({ downloads_count: file.downloads_count + 1 })
    .eq('id', file.id);

  await admin.from('audit_log').insert({
    university_id: profile.university_id,
    actor_id: user.id,
    action: 'ARCHIVE_FILE_DOWNLOAD',
    entity_type: 'ACADEMIC_FILE',
    entity_id: file.id,
    metadata: { filename: file.original_filename },
  });

  return apiSuccess({ signedUrl: signed.signedUrl, expiresInSeconds: 300 });
}
