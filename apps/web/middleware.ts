// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { resolveSupabaseUrl } from '@/lib/supabase-url';
import {
  DEMO_SESSION_COOKIE,
  isDemoEmail,
  verifyDemoSessionTokenEdge,
} from '@/lib/demo-session-edge';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  res.headers.set('X-Campus360-Tenant-Guard', 'enforced');

  const pathname = req.nextUrl.pathname;

  // 1. Verify HMAC-signed `campus360_demo_session` cookie alongside Supabase Auth.
  const rawDemoCookie = req.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const demoSession = await verifyDemoSessionTokenEdge(rawDemoCookie);

  // 2. Refresh Supabase Auth session cookies when configured.
  let supabaseUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
  const url = resolveSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url.url && !url.problem && anonKey) {
    try {
      const supabase = createServerClient(url.url, anonKey, {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: ((cookiesToSet: Parameters<SetAllCookies>[0]) => {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: { headers: req.headers } });
            res.headers.set('X-Campus360-Tenant-Guard', 'enforced');
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          }) as SetAllCookies,
        },
      });

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (user && !error) {
        supabaseUser = user;
      }
    } catch {
      supabaseUser = null;
    }
  }

  const isDemo =
    Boolean(demoSession) ||
    isDemoEmail(supabaseUser?.email) ||
    Boolean(supabaseUser?.user_metadata?.is_demo);

  if (isDemo) {
    const effectiveRole = String(
      demoSession?.role ??
        supabaseUser?.user_metadata?.role ??
        (supabaseUser?.email?.toLowerCase().startsWith('admin@') ? 'admin' : 'student')
    ).toLowerCase();

    // Bypass `/verify-email` and `/onboarding` (and redirect away from `/signin`)
    // for all demo accounts; grant full platform access including `/admin/console`
    // and `/admin/panel` when `role === 'admin'`.
    if (
      pathname === '/verify-email' ||
      pathname === '/onboarding' ||
      pathname === '/signin'
    ) {
      const destination = req.nextUrl.clone();
      destination.pathname = effectiveRole === 'admin' ? '/admin/console' : '/feed';
      destination.search = '';
      const redirect = NextResponse.redirect(destination);
      res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    res.headers.set('x-campus360-demo-session', '1');
    res.headers.set('x-campus360-demo-role', effectiveRole);
    return res;
  }

  if (pathname === '/signin' && supabaseUser) {
    const destination = req.nextUrl.clone();
    destination.pathname = '/feed';
    destination.search = '';
    const redirect = NextResponse.redirect(destination);
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
