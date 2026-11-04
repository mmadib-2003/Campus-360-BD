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

import { apiError } from '@/lib/api-response';
import { redact } from '@/lib/auth-log';
import {
  describeSupabaseFault,
  resolveSupabaseUrl,
  scrubRegistrySecrets,
  type SupabaseFault,
} from '@/lib/supabase-url';

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

// ----------------------------------------------------------------------------
// `registryRead` — the transport half of every registry GET.
//
// The routes used to `await query` and paste `error.message` into the response.
// For a PostgREST fault (missing column, RLS denial) that is a decent message.
// For a *transport* fault it is useless: supabase-js reports the network layer
// as `TypeError: fetch failed`, which reads exactly like "the browser could not
// reach this app", and the real reason — an unresolvable host, a DNS blip, a
// malformed `NEXT_PUBLIC_SUPABASE_URL` — sat in `error.cause` where nobody saw
// it. So this wrapper:
//
//   1. refuses up-front when the configured URL is unusable (a distinct
//      `SUPABASE_URL_INVALID` answer instead of a downstream network error),
//   2. retries once on the transient faults only (EAI_AGAIN, ECONNRESET,
//      connect timeouts — the cold-start and DNS-blip class), never on
//      ENOTFOUND, where a retry just doubles latency on a broken config,
//   3. returns a `fault` carrying the errno + host so routes can put something
//      diagnosable in the API envelope.
// ----------------------------------------------------------------------------

export interface RegistryPostgrestError {
  message?: string;
  cause?: unknown;
  code?: string;
  details?: string;
  hint?: string;
}

export interface RegistryReadOutcome<T = unknown> {
  ok: boolean;
  data: T | null;
  error: RegistryPostgrestError | null;
  fault: SupabaseFault | null;
  attempts: number;
  /** Non-null when the configured URL itself is unusable — nothing was sent. */
  configProblem: string | null;
  host: string | null;
}

const TRANSIENT_RETRY_DELAY_MS = 250;

/**
 * Run one Supabase read, retrying only transient transport faults. `run`
 * returns supabase-js's own `{ data, error }` object (never throws, and a throw
 * is tolerated and treated as a fault).
 */
export async function registryRead<T = any>(
  stage: string,
  // PromiseLike, not Promise: supabase-js hands back a PostgrestBuilder, which
  // is awaitable (it implements `then`) but has no `catch`/`finally`, so typing
  // this as a Promise would force every caller to wrap its own query.
  run: () => PromiseLike<{ data?: T | null; error?: RegistryPostgrestError | null }>,
  fields: Record<string, unknown> = {},
  options: { maxAttempts?: number } = {}
): Promise<RegistryReadOutcome<T>> {
  const target = resolveSupabaseUrl();
  if (target.problem) {
    registryError(`${stage}.config`, new Error(target.problem), { host: target.host });
    return {
      ok: false,
      data: null,
      error: { message: target.problem },
      fault: null,
      attempts: 0,
      configProblem: target.problem,
      host: target.host,
    };
  }

  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  let lastError: RegistryPostgrestError | null = null;
  let lastFault: SupabaseFault | null = null;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attemptsMade = attempt;
    let outcome: { data?: T | null; error?: RegistryPostgrestError | null };
    try {
      outcome = await run();
    } catch (thrown) {
      outcome = { error: { message: (thrown as Error)?.message ?? String(thrown) } };
    }

    const error = outcome.error ?? null;
    if (!error) {
      if (target.repaired && attempt === 1) {
        console.warn(`${PREFIX} ${stage} used the repaired endpoint (${target.repaired})`);
      }
      return {
        ok: true,
        data: outcome.data ?? null,
        error: null,
        fault: null,
        attempts: attempt,
        configProblem: null,
        host: target.host,
      };
    }

    // Null fault => PostgREST answered the query and rejected it. Nothing about
    // the transport is wrong, so there is nothing to retry and no host to name.
    const fault = describeSupabaseFault(error);
    lastError = error;
    lastFault = fault;
    console.warn(
      `${PREFIX} ${stage} attempt ${attempt}/${maxAttempts} failed`,
      JSON.stringify(
        redact({
          ...fields,
          host: fault?.host ?? target.host,
          errno: fault?.code ?? error.code ?? null,
          message: scrubRegistrySecrets(error.message ?? ''),
          hint: fault?.hint ?? null,
        })
      )
    );

    if (!fault?.transient || attempt === maxAttempts) break;
    await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * attempt));
  }

  registryError(stage, lastError, {
    host: lastFault?.host ?? target.host,
    errno: lastFault?.code ?? lastError?.code ?? null,
    summary: lastFault?.summary ?? null,
    ...fields,
  });
  return {
    ok: false,
    data: null,
    error: lastError,
    fault: lastFault,
    attempts: attemptsMade,
    configProblem: null,
    host: target.host,
  };
}

/**
 * Message text for the API envelope: PostgREST messages pass through verbatim
 * (they are already specific), transport faults get the errno and host
 * appended so `fetch failed` stops being the whole story.
 */
export function registryMessage(
  outcome: Pick<RegistryReadOutcome, 'error' | 'fault'>,
  fallback = 'database request failed'
): string {
  const base = scrubRegistrySecrets(outcome.error?.message ?? fallback);
  const code = outcome.fault?.code ?? null;
  if (!code) return base;
  return `${base} (${code}${outcome.fault?.host ? ` host=${outcome.fault.host}` : ''})`;
}

/**
 * The response half of `registryRead`: a config problem is 503 and names the
 * env var, a transport fault is 500 and names the errno + host, anything else
 * (PostgREST) keeps its own message. Same shape for all five registry routes so
 * the signup form always has something worth showing in the red box.
 */
export function registryFailure(read: RegistryReadOutcome, messageBn: string) {
  if (read.configProblem) {
    return apiError(
      'SUPABASE_URL_INVALID',
      read.configProblem,
      messageBn,
      503,
      { host: read.host },
      REGISTRY_NO_STORE
    );
  }
  return apiError(
    'FETCH_FAILED',
    registryMessage(read),
    messageBn,
    500,
    {
      host: read.host,
      errno: read.fault?.code ?? read.error?.code ?? null,
      attempts: read.attempts,
      hint: read.fault?.hint ?? null,
    },
    REGISTRY_NO_STORE
  );
}
