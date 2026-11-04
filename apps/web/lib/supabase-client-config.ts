/**
 * apps/web/lib/supabase-client-config.ts
 *
 * Browser-safe mirror of the server-side registry gate (`lib/registry-gate.ts`).
 *
 * Why this exists: `isSupabaseConfigured()` used to be `Boolean(process.env.X)`,
 * which cannot tell a real credential from the `.env.example` template. On a
 * deployment whose `NEXT_PUBLIC_SUPABASE_URL` is still `https://your-project-ref.supabase.co`
 * that single line decided that the app was "live", so every module hook skipped
 * its demo/offline fallback and instead handed `@supabase/ssr` a host that does
 * not resolve plus an anon key that is not a key. The visible symptom was a
 * client-side exception (and a permanently dead list) rather than the honest
 * "not configured yet" state the rest of the app already knows how to render.
 *
 * The URL rules are imported from `lib/supabase-url.ts` so the browser and the
 * server can never drift apart on what counts as a usable project. The key check
 * is re-implemented here with `atob` instead of `Buffer`, because this module is
 * part of the client bundle and `Buffer` is not — a validator that throws
 * `Buffer is not defined` in the browser would be worse than no validator.
 */

import { resolveSupabaseUrl } from './supabase-url';

export type ClientKeyShape = 'missing' | 'placeholder' | 'legacy-jwt' | 'publishable' | 'malformed';

export interface SupabaseClientConfig {
  /** True only when BOTH the project URL and the anon key are usable. */
  usable: boolean;
  /** The validated, absolute project URL, or null. */
  url: string | null;
  /** The anon key exactly as configured (already public: it ships in the bundle). */
  anonKey: string;
  /** What is wrong, phrased for a console line or an offline banner. Never the key. */
  problem: string | null;
  keyShape: ClientKeyShape;
}

/** Same fragments `.env.example` ships, so a value copied from it is never trusted. */
const PLACEHOLDER_KEY_MARKERS = [
  'example-anon',
  'example-service-role',
  'your-key',
  'your-',
  'replace-with',
  'change-me',
  'changeme',
  'placeholder',
  'sample',
];
const PLACEHOLDER_RUN = /x{6,}/i;

function decodeJwtPayloadBase64Url(segment: string): Record<string, unknown> | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
    const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(padded))) : '';
    if (!json) return null;
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Shape check for the publishable/anon key, safe to run in the browser.
 * A real legacy key is a JWT whose payload carries `role`; the newer
 * `sb_publishable_…` format is not a JWT and is accepted on its prefix.
 */
export function describeClientKey(value: string | undefined | null): { shape: ClientKeyShape; problem: string | null } {
  const raw = String(value ?? '').trim();
  if (!raw) return { shape: 'missing', problem: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in this runtime' };

  const placeholder = PLACEHOLDER_RUN.test(raw)
    ? 'a run of x characters'
    : PLACEHOLDER_KEY_MARKERS.find((marker) => raw.toLowerCase().includes(marker));
  if (placeholder) {
    return { shape: 'placeholder', problem: `still contains the .env.example placeholder fragment "${placeholder}"` };
  }

  if (raw.startsWith('sb_publishable_')) return { shape: 'publishable', problem: null };
  // A secret key never belongs in a browser bundle; treat it as unusable so the
  // misconfiguration is reported instead of silently leaking further.
  if (raw.startsWith('sb_secret_')) {
    return {
      shape: 'malformed',
      problem: 'the browser is configured with an sb_secret_ key — use the publishable anon key for NEXT_PUBLIC_SUPABASE_ANON_KEY',
    };
  }

  const payload = decodeJwtPayloadBase64Url(raw.split('.')[1] ?? '');
  if (!payload) {
    return { shape: 'malformed', problem: 'is neither an sb_publishable_ key nor a decodable JWT' };
  }
  if (typeof payload.role !== 'string') {
    return { shape: 'malformed', problem: 'decodes as a JWT but carries no "role" claim' };
  }
  if (payload.role !== 'anon') {
    return {
      shape: 'legacy-jwt',
      problem: `carries role "${payload.role}" but the browser needs "anon" — a service_role key must never reach the client`,
    };
  }
  return { shape: 'legacy-jwt', problem: null };
}

let cached: SupabaseClientConfig | null = null;

/** Resolved once per page load: these values are inlined at build time anyway. */
export function supabaseClientConfig(): SupabaseClientConfig {
  if (cached) return cached;

  const resolved = resolveSupabaseUrl();
  const key = describeClientKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const problems = [resolved.problem, key.problem].filter(Boolean) as string[];

  cached = {
    usable: !resolved.problem && !key.problem,
    url: resolved.url,
    anonKey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    problem: problems.length ? problems.join('; ') : null,
    keyShape: key.shape,
  };
  return cached;
}

/**
 * The single question every browser-side caller should ask before building a
 * client: can this configuration actually reach a Supabase project?
 */
export function isSupabaseClientUsable(): boolean {
  return supabaseClientConfig().usable;
}
