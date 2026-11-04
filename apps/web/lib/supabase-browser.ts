// apps/web/lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseClientUsable, supabaseClientConfig } from './supabase-client-config';

let cached: ReturnType<typeof createBrowserClient> | null = null;

/**
 * True only when the configured URL and anon key can actually reach a project.
 *
 * This used to be a presence check, and presence is not the property that
 * matters: `Boolean('https://your-project-ref.supabase.co')` is true, so a
 * deployment that still carries the `.env.example` template claimed to be live,
 * skipped its demo/offline fallback, and then failed inside the Supabase client
 * at first paint — which is the browser, so the whole page came down as
 * "Application error: a client-side exception has occurred".
 */
export function isSupabaseConfigured() {
  return isSupabaseClientUsable();
}

export function createSupabaseBrowser() {
  const { url, anonKey, problem } = supabaseClientConfig();

  // Fail soft: the platform must render even when environment secrets are not yet
  // provisioned on the host. Pages fall back to their static/demo data in that case.
  if (!url || !anonKey) {
    throw new Error(
      `Supabase is not configured for the browser${problem ? `: ${problem}` : ''}. ` +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
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
