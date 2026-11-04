import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { resolveSupabaseUrl } from '@/lib/supabase-url';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  res.headers.set('X-Campus360-Tenant-Guard', 'enforced');

  // Keep the request's Supabase session refreshed, and keep authenticated users
  // out of the sign-in flow. getUser() validates the token with Auth instead of
  // trusting an unverified cookie/session payload.
  const url = resolveSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url.url && !url.problem && anonKey) {
    const supabase = createServerClient(url.url, anonKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: ((cookiesToSet: Parameters<SetAllCookies>[0]) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: req.headers } });
          res.headers.set('X-Campus360-Tenant-Guard', 'enforced');
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        }) as SetAllCookies,
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (req.nextUrl.pathname === '/signin' && user && !error) {
      const destination = req.nextUrl.clone();
      destination.pathname = '/feed';
      destination.search = '';
      const redirect = NextResponse.redirect(destination);
      res.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
