// apps/web/app/api/universities/[id]/route.ts
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseRouteClient();
  const { data, error } = await supabase
    .from('universities')
    .select(`
      *,
      university_email_domains(*),
      departments(*),
      halls(*),
      governing_units(*)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return apiError('NOT_FOUND', 'University not found.', 'বিশ্ববিদ্যালয়টি পাওয়া যায়নি।', 404);
  }
  return apiSuccess(data);
}
