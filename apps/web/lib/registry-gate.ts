// apps/web/lib/registry-gate.ts
// ============================================================================
// The one way a registry route gets its Supabase client.
//
// Background: `requireUrl()` in lib/supabase-server.ts deliberately throws when
// `NEXT_PUBLIC_SUPABASE_URL` is unusable — a wrong endpoint must not be
// silently queried. But a route that calls `createSupabaseRouteClient()` on its
// own line lets that throw escape, and Next answers with an *HTML* 500. The
// signup form then has no envelope to read and renders `HTTP 500`, which is
// exactly the opaque-failure shape this whole exercise was meant to end: after
// PR #7 the placeholder URL produced `HTTP 500` instead of the intended
// "this variable still holds the .env.example template" sentence.
//
// So the config check happens *before* construction, and construction itself is
// guarded: every failure mode of "we cannot even build a client" becomes a
// structured 503 with a message the browser can show, and the operator-visible
// detail goes to [campus360:registry].
//
// A module of its own because lib/registry-cache.ts must stay free of
// `next/headers` (it is imported by pure helpers and unit-tested as such), while
// building a request-bound client inherently needs it.
// ============================================================================
import { apiError } from '@/lib/api-response';
import { REGISTRY_NO_STORE } from '@/lib/registry-cache';
import { createSupabaseRouteClient, supabaseTarget } from '@/lib/supabase-server';
import { scrubRegistrySecrets } from '@/lib/supabase-url';

export type RegistryGateResult =
  | { ok: true; client: ReturnType<typeof createSupabaseRouteClient>; repaired: string | null }
  | { ok: false; response: ReturnType<typeof apiError>; reason: string };

/**
 * @param stage    log prefix segment, e.g. `universities`
 * @param messageBn the localized sentence shown to the visitor
 * @param factory  override for tests / admin-client callers
 */
export function registryGate(
  stage: string,
  messageBn: string,
  factory: () => ReturnType<typeof createSupabaseRouteClient> = createSupabaseRouteClient
): RegistryGateResult {
  const target = supabaseTarget();

  if (target.problem) {
    // Nothing was sent, so say precisely which variable is wrong and to what.
    console.error(`[campus360:registry] ${stage}.gate`, target.problem);
    return {
      ok: false,
      reason: target.problem,
      response: apiError('SUPABASE_URL_INVALID', target.problem, messageBn, 503, { host: target.host }, REGISTRY_NO_STORE),
    };
  }

  try {
    const client = factory();
    return { ok: true, client, repaired: target.repaired };
  } catch (error) {
    // Missing key, `cookies()` outside a request, a client library that refuses
    // the value — none of these should reach the browser as a stack trace.
    const reason = scrubRegistrySecrets(
      error instanceof Error ? error.message : String(error ?? 'client construction failed')
    );
    console.error(`[campus360:registry] ${stage}.gate`, reason);
    return {
      ok: false,
      reason,
      response: apiError(
        'SUPABASE_NOT_CONFIGURED',
        `${reason} — see /api/health/registry for the exact variable`,
        messageBn,
        503,
        { host: target.host },
        REGISTRY_NO_STORE
      ),
    };
  }
}
