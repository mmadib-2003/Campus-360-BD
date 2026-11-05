// apps/web/app/api/auth/sign-out/route.ts
import { apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { clearDemoSession } from '@/lib/demo-auth';

export async function POST() {
  // Always clear the signed `campus360_demo_session` cookie so demo users can
  // cleanly switch roles or sign out regardless of how their session started.
  clearDemoSession();

  const hasPublicSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  if (!hasPublicSupabase) {
    return apiSuccess({ signedOut: true, demo: !isSupabaseServerConfigured() });
  }

  try {
    const supabase = createSupabaseRouteClient();
    await supabase.auth.signOut();
  } catch {
    /* ignore sign-out transport errors */
  }

  return apiSuccess({ signedOut: true, demo: !isSupabaseServerConfigured() });
}
