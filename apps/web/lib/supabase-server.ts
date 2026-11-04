// apps/web/lib/supabase-server.ts
// ============================================================================
// Supabase clients for the server tier.
//
//   • createSupabaseRouteClient()  — anon key + request cookies. Owns the
//     session (sign-in, sign-out, the magiclink exchange in /api/auth/verify-otp).
//   • createSupabaseAdminClient()  — service role, RLS-bypassing. This is the
//     client the OTP flow persists through (lib/otp-store.ts): a challenge row
//     has to be written and read *before* the visitor has any session, and the
//     stored digest must never be reachable from the browser-side anon client.
//
// Keep the admin client out of any module imported by a client component.
//
// Both factories take their URL from `resolveSupabaseUrl()` instead of reading
// `process.env.NEXT_PUBLIC_SUPABASE_URL` raw. That is the whole difference: the
// value in Vercel is typed by hand, and a scheme-less / whitespace-padded /
// `/rest/v1`-suffixed / still-placeholder URL previously went straight into
// supabase-js and came back as an opaque `TypeError: fetch failed` in whichever
// route happened to need it. Now repairable values are repaired (and logged),
// unusable ones are named. No key material is read or logged here.
// ============================================================================
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseUrl, type ResolvedSupabaseUrl } from '@/lib/supabase-url';

/** The validated REST endpoint this runtime is configured to talk to. */
export function supabaseTarget(): ResolvedSupabaseUrl {
  return resolveSupabaseUrl();
}

function requireUrl(): string {
  const target = supabaseTarget();
  if (target.problem || !target.url) {
    throw new Error(target.problem ?? 'NEXT_PUBLIC_SUPABASE_URL is unusable');
  }
  if (target.repaired) {
    console.warn(
      `[campus360:registry] NEXT_PUBLIC_SUPABASE_URL was normalized (${target.repaired}) -> ${target.url}`
    );
  }
  return target.url;
}

export function createSupabaseRouteClient() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !anonKey) {
    throw new Error(
      'Supabase server environment variables are missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  const cookieStore = cookies();
  return createServerClient(requireUrl(), anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component render pass — safe to ignore.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Called from a Server Component render pass — safe to ignore.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey) {
    throw new Error(
      'Supabase service credentials are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createClient(requireUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
