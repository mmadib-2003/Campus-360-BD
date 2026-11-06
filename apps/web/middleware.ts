// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { resolveSupabaseUrl } from '@/lib/supabase-url';
import {
  DEMO_SESSION_COOKIE,
  isDemoEmail,
  verifyDemoSessionTokenEdge,
} from '@/lib/demo-session-edge';
import {
  VERIFIED_SESSION_COOKIE,
  verifyVerifiedSessionTokenEdge,
} from '@/lib/verified-session-edge';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  res.headers.set('X-Campus360-Tenant-Guard', 'enforced');

  const pathname = req.nextUrl.pathname;

  // 1. Verify HMAC-signed `campus360_demo_session` cookie alongside Supabase Auth.
  const rawDemoCookie = req.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const demoSession = await verifyDemoSessionTokenEdge(rawDemoCookie);
  // Signed identity minted after a successful 6-digit OTP. It survives a
  // GoTrue/profile outage, so the middleware must honour it too.
  const verifiedSession = await verifyVerifiedSessionTokenEdge(
    req.cookies.get(VERIFIED_SESSION_COOKIE)?.value
  );
  // Newest session wins so Quick Demo Login still switches roles freely.
  const demoPreferred =
    Boolean(demoSession) && (!verifiedSession || (demoSession?.iat ?? 0) >= verifiedSession.iat);

  // 2. Refresh Supabase Auth session cookies when configured.
  let supabaseUser: {
    email?: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null = null;
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
    demoPreferred ||
    isDemoEmail(supabaseUser?.email) ||
    Boolean(supabaseUser?.user_metadata?.is_demo);

  if (isDemo) {
    const effectiveRole = String(
      demoSession?.role ??
        supabaseUser?.user_metadata?.role ??
        (supabaseUser?.email?.toLowerCase().startsWith('admin@') ? 'admin' : 'student')
    ).toLowerCase();

    // A demo session is verified by construction (email_verified: true): it must
    // never sit on /verify-email or /signin — redirect straight to the dashboard.
    if (pathname === '/verify-email' || pathname === '/signin') {
      const redirect = NextResponse.redirect(new URL('/', req.url));
      res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    // Bypass `/onboarding` for demo accounts; grant full platform access
    // including `/admin/console` and `/admin/panel` when `role === 'admin'`.
    if (pathname === '/onboarding') {
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

  // A verified OTP session is a real sign-in: keep it off the OTP form and the
  // sign-in page, but unlike a demo session it still goes through /onboarding
  // when the profile needs a program session or a student hall.
  if (verifiedSession) {
    if (pathname === '/verify-email' || pathname === '/signin') {
      const redirect = NextResponse.redirect(new URL('/', req.url));
      res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
    res.headers.set('x-campus360-verified-session', '1');
    res.headers.set('x-campus360-verified-role', verifiedSession.role);
    return res;
  }

  // Verified Supabase sessions must never be sent back to the OTP form or the
  // sign-in page. Accounts are provisioned with email_confirm: true, so a valid
  // session carries email_confirmed_at; honor the explicit metadata flags too.
  // (Any signed-in user is also kept off /signin, matching the previous rule.)
  const sessionEmailVerified =
    Boolean(supabaseUser?.email_confirmed_at) ||
    supabaseUser?.user_metadata?.email_verified === true ||
    supabaseUser?.user_metadata?.is_verified === true;

  if (
    supabaseUser &&
    (pathname === '/verify-email' || pathname === '/signin') &&
    (sessionEmailVerified || pathname === '/signin')
  ) {
    const redirect = NextResponse.redirect(new URL('/', req.url));
    res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
