// apps/web/app/api/auth/sign-out/route.ts
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { clearDemoSession } from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isSupabaseServerConfigured()) {
    clearDemoSession();
    return apiSuccess({ signedOut: true, demo: true });
  }

  const supabase = createSupabaseRouteClient();
  await supabase.auth.signOut();
  return apiSuccess({ signedOut: true });
}
