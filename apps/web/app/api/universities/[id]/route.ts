// apps/web/app/api/universities/[id]/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured()) {
    return apiError(
      'SUPABASE_NOT_CONFIGURED',
      'Server database credentials are not configured for this deployment.',
      'এই ডিপ্লয়মেন্টে সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
      503,
      undefined,
      REGISTRY_NO_STORE
    );
  }

  const supabase = createSupabaseRouteClient();
  const read = await registryRead<any>('university.fetch', () =>
    supabase
      .from('universities')
    .select(`
      *,
      university_email_domains(*),
      departments(*),
      halls(*),
      governing_units(*)
    `)
      .eq('id', params.id)
      .single(),
    { id: params.id }
  );
  // A transport/config fault must not masquerade as "not found", which is how
  // this route used to answer every failure.
  if (!read.ok) return registryFailure(read, 'বিশ্ববিদ্যালয়টি পাওয়া যায়নি।');
  if (!read.data) {
    return apiError('NOT_FOUND', 'University not found.', 'বিশ্ববিদ্যালয়টি পাওয়া যায়নি।', 404, undefined, REGISTRY_NO_STORE);
  }
  return apiSuccess(read.data, 200, undefined, REGISTRY_NO_STORE);
}
