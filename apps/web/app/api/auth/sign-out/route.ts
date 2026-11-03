// apps/web/app/api/auth/sign-out/route.ts
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { apiSuccess } from '@/lib/api-response';

export async function POST() {
  const supabase = createSupabaseRouteClient();
  await supabase.auth.signOut();
  return apiSuccess({ signedOut: true });
}
