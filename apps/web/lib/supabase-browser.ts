// apps/web/lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr';

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail soft: the platform must render even when environment secrets are not yet
  // provisioned on the host. Pages fall back to their static/demo data in that case.
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  if (!cached) {
    cached = createBrowserClient(url, anonKey);
  }
  return cached;
}

/**
 * Safe variant used by UI components: returns null instead of throwing so the
 * interface keeps rendering with graceful "offline / demo" states.
 */
export function trySupabaseBrowser() {
  if (!isSupabaseConfigured()) return null;
  try {
    return createSupabaseBrowser();
  } catch {
    return null;
  }
}
