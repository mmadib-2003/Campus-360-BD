// apps/web/app/api/universities/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';
import { demoUniversitiesPayload } from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    // Preview deployments still get the full public registry so the signup
    // combobox, filters and domain hints work without any secrets.
    return apiSuccess(demoUniversitiesPayload(), 200, undefined, REGISTRY_NO_STORE);
  }

  const supabase = createSupabaseRouteClient();
  const category = req.nextUrl.searchParams.get('category');
  const q = req.nextUrl.searchParams.get('q')?.trim();

  let query = supabase
    .from('universities')
    .select('*, university_email_domains(domain, is_primary)')
    .eq('is_active', true)
    .order('name_en', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }
  if (q) {
    query = query.or(`name_en.ilike.%${q}%,name_bn.ilike.%${q}%,code.ilike.%${q}%`);
  }

  // `registryRead` = validate/normalize the Supabase endpoint, retry the
  // transient transport faults, log the errno. The outage signature was
  // `message_en: "TypeError: fetch failed"` — that string is undici's wording
  // from *this function's* call to Supabase, not a fault in the URL the browser
  // used to reach this route. See docs/REGISTRY_CONNECTIVITY.md.
  const read = await registryRead<any[]>('universities.fetch', () => query, {
    category: category ?? null,
    q: q ?? null,
  });
  if (!read.ok) return registryFailure(read, 'বিশ্ববিদ্যালয়ের তালিকা লোড করা যায়নি।');

  const data = read.data;
  return apiSuccess(data ?? [], 200, { count: (data ?? []).length }, REGISTRY_NO_STORE);
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
  const body = await req.json();
  const { data, error } = await supabase
    .from('universities')
    .insert({
      code: body.code,
      name_en: body.name_en,
      name_bn: body.name_bn,
      category: body.category,
      city: body.city,
      lat: body.lat,
      lng: body.lng,
    })
    .select('*')
    .single();

  if (error) {
    return apiError('FORBIDDEN_OR_INVALID', error.message, 'শুধুমাত্র সুপার-অ্যাডমিন বিশ্ববিদ্যালয় যোগ করতে পারেন।', 403);
  }
  return apiSuccess(data, 201);
}
