// apps/web/app/api/universities/[id]/route.ts
import { NextRequest } from 'next/server';
import { registryGate } from '@/lib/registry-gate';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { REGISTRY_NO_STORE, registryFailure, registryRead } from '@/lib/registry-cache';
import { demoUniversitiesPayload } from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured()) {
    // Same static fallback as the list route: the demo payload carries the
    // versioned local covers (CU monument, SUST gate, KUET landmark —
    // migration 0024), so a secret-less preview shows the same photos.
    const key = params.id.trim().toLowerCase();
    const university = demoUniversitiesPayload().find(
      (candidate) => candidate.id.toLowerCase() === key || candidate.code.toLowerCase() === key
    );
    if (!university) {
      return apiError('NOT_FOUND', 'University not found.', 'বিশ্ববিদ্যালয়টি পাওয়া যায়নি।', 404, undefined, REGISTRY_NO_STORE);
    }
    return apiSuccess(university, 200, undefined, REGISTRY_NO_STORE);
  }

  // The gate is what keeps a broken `NEXT_PUBLIC_SUPABASE_URL` from escaping as
  // an unhandled HTML 500 (which the form can only render as `HTTP 500`): the
  // config check runs before the client is built, and construction is guarded.
  const gate = registryGate('university', 'বিশ্ববিদ্যালয়টি পাওয়া যায়নি।');
  if (!gate.ok) return gate.response;
  const supabase = gate.client;
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
