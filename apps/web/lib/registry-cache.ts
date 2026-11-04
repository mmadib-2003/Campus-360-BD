// apps/web/lib/registry-cache.ts
// ============================================================================
// Cache discipline + logging for the public registry endpoints
// (universities, universities/[id], halls, departments, programs).
//
// These responses are *derived from a table an operator can edit at any time*
// — a seeded hall, a renamed department, a university activated in the admin
// panel. They back the signup comboboxes, where a stale answer is not a
// performance problem but a broken onboarding. Two layers:
//
//   1. `export const dynamic = 'force-dynamic'` in each route (already present)
//      opts the route out of Next.js route-cache / ISR, so the function always
//      runs and the response is built from a live query.
//   2. `REGISTRY_NO_STORE` is the HTTP-level half: without it the response also
//      carries Next's default `s-maxage` + `stale-while-revalidate`, which the
//      browser and Vercel's CDN will happily serve for up to a year. That is the
//      mechanism by which a correctly seeded, correctly deployed registry can
//      still look empty on a client that fetched the list before the seed ran.
//
// `registryError` exists because these routes used to return a bare 500 with
// the PostgREST message only in the body; the client swallowed it (`.catch(()
// => undefined)`), so "empty dropdown" had no trace in `vercel logs`. Prefix is
// `[campus360:registry]` to match `[campus360:auth]`.
// ============================================================================

import { redact } from '@/lib/auth-log';

/** Pass as the trailing headers argument of `apiSuccess` / `apiError`. */
export const REGISTRY_NO_STORE: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
};

const PREFIX = '[campus360:registry]';

/** A registry read failed: log the real PostgREST error, then let the caller
 *  decide what the *user* sees. `redact()` keeps credentials out of the line. */
export function registryError(
  stage: string,
  error: unknown,
  fields: Record<string, unknown> = {}
): void {
  console.error(`${PREFIX} ${stage}`, JSON.stringify(redact({ ...fields, error })));
}
