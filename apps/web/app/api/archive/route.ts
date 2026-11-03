// apps/web/app/api/archive/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get('pageSize') || 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('academic_files')
    .select('*, departments(code, name_en, name_bn), universities(code, name_en, name_bn)', { count: 'exact' })
    .is('deleted_at', null)
    .eq('dmca_quarantined', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (sp.get('universityId')) query = query.eq('university_id', sp.get('universityId')!);
  if (sp.get('departmentId')) query = query.eq('department_id', sp.get('departmentId')!);
  if (sp.get('courseCode')) query = query.ilike('course_code', `%${sp.get('courseCode')}%`);
  if (sp.get('category')) query = query.eq('category', sp.get('category')!);
  if (sp.get('year')) query = query.eq('academic_year', Number(sp.get('year')));
  if (sp.get('q')) query = query.textSearch('search_vector', sp.get('q')!, { type: 'websearch' });

  const { data, count, error } = await query;
  if (error) return apiError('ARCHIVE_QUERY_FAILED', error.message, 'আর্কাইভ লোড করা যায়নি।', 400);

  return apiSuccess(data, 200, { page, pageSize, total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('university_id, trust_level')
    .eq('id', user.id)
    .single();

  if (!profile || profile.trust_level === 'UNVERIFIED') {
    return apiError('FORBIDDEN', 'Verification required.', 'ইমেইল যাচাইকরণ আবশ্যক।', 403);
  }

  const body = await req.json();
  const { data: created, error } = await supabase
    .from('academic_files')
    .insert({
      university_id: profile.university_id,
      department_id: body.departmentId,
      uploader_id: user.id,
      course_code: body.courseCode,
      course_title: body.courseTitle,
      semester: body.semester,
      academic_year: Number(body.academicYear),
      category: body.category,
      language: body.language || 'en',
      visibility: body.visibility || 'PRIVATE_TO_UNIVERSITY',
      requires_same_university_verification: body.requiresSameUniversityVerification ?? true,
      license_attribution: body.licenseAttribution || 'CC-BY-NC-4.0',
      tags: body.tags || [],
      storage_path: body.storagePath,
      original_filename: body.originalFilename,
      mime_type: body.mimeType,
      file_size_bytes: Number(body.fileSizeBytes),
      checksum_sha256: body.checksumSha256,
    })
    .select('*')
    .single();

  if (error || !created) return apiError('INSERT_FAILED', error?.message || 'Error', 'ফাইল সংরক্ষণ করা যায়নি।', 400);

  await supabase.from('academic_file_versions').insert({
    file_id: created.id,
    university_id: profile.university_id,
    version_number: 1,
    storage_path: created.storage_path,
    original_filename: created.original_filename,
    mime_type: created.mime_type,
    file_size_bytes: created.file_size_bytes,
    checksum_sha256: created.checksum_sha256,
    uploaded_by: user.id,
    change_note: 'Initial upload',
  });

  return apiSuccess(created, 201);
}
