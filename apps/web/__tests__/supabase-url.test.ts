// apps/web/__tests__/supabase-url.test.ts
// ============================================================================
// Guards for the production `TypeError: fetch failed` outage on /signup.
//
// Two layers, deliberately:
//   • behavioural tests of `resolveSupabaseUrl` / `describeSupabaseFault` /
//     `registryRead`, because the fix is a *decision* (repair vs. reject vs.
//     retry) and a decision needs cases, and
//   • source assertions on the routes, because the regression that caused the
//     outage was information being dropped at a boundary — the route knew the
//     upstream was unreachable and reported only `fetch failed`, and the form
//     rendered that as a red box with no host and no errno.
//
// The three hypotheses this repo explicitly rejects (relative fetch in a Server
// Component, a hardcoded localhost:3000 base, CORS) are pinned by the last
// block, so a future "fix" cannot quietly reintroduce a server-side self-fetch.
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeRegistryError,
  describeSupabaseFault,
  resolveSupabaseUrl,
} from '@/lib/supabase-url';
import { registryMessage, registryRead } from '@/lib/registry-cache';

const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(path.join(WEB_ROOT, rel), 'utf8');

const PROD_URL = 'https://lxdovryeidayxfsqkwbg.supabase.co';
const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

let saved: Record<string, string | undefined> = {};

/** The registry helpers read the real env, so tests own it for their duration. */
function setEnv(url: string | undefined) {
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
}

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

describe('resolveSupabaseUrl — repairing a hand-typed value', () => {
  it('accepts a well-formed project URL untouched', () => {
    const target = resolveSupabaseUrl(PROD_URL);
    expect(target.problem).toBeNull();
    expect(target.url).toBe(PROD_URL);
    expect(target.host).toBe('lxdovryeidayxfsqkwbg.supabase.co');
    expect(target.repaired).toBeNull();
    expect(target.looksLikeProject).toBe(true);
  });

  it('adds the scheme, which is what undici actually needs', () => {
    const target = resolveSupabaseUrl('lxdovryeidayxfsqkwbg.supabase.co');
    expect(target.problem).toBeNull();
    expect(target.url).toBe(PROD_URL);
    expect(target.repaired).toMatch(/https:\/\/ scheme/);
  });

  it('upgrades a plain http:// target', () => {
    const target = resolveSupabaseUrl('http://lxdovryeidayxfsqkwbg.supabase.co');
    expect(target.url).toBe(PROD_URL);
    expect(target.repaired).toMatch(/upgraded http/);
  });

  it('trims whitespace, drops a trailing slash and a duplicated /rest/v1', () => {
    expect(resolveSupabaseUrl(`  ${PROD_URL}  `).repaired).toMatch(/whitespace/);
    expect(resolveSupabaseUrl(`${PROD_URL}/`).url).toBe(PROD_URL);
    const rest = resolveSupabaseUrl(`${PROD_URL}/rest/v1/`);
    expect(rest.problem).toBeNull();
    expect(rest.url).toBe(PROD_URL);
    expect(rest.repaired).toMatch(/\/rest\/v1/);
  });

  it('drops a stray path instead of double-prefixing /rest/v1', () => {
    const target = resolveSupabaseUrl(`${PROD_URL}/project/xyz`);
    expect(target.url).toBe(PROD_URL);
    expect(target.repaired).toMatch(/ignored the "\/project\/xyz" path/);
  });
});

describe('resolveSupabaseUrl — naming a value that cannot work', () => {
  it('reports a missing variable as a missing variable', () => {
    setEnv(undefined);
    const target = resolveSupabaseUrl();
    expect(target.url).toBeNull();
    expect(target.problem).toContain('NEXT_PUBLIC_SUPABASE_URL is not set');
  });

  it('refuses the .env.example placeholder instead of attempting a DNS lookup', () => {
    for (const placeholder of [
      'https://your-project-ref.supabase.co',
      'https://your-project.supabase.co',
      'https://replace-with-your-host.example.com',
    ]) {
      const target = resolveSupabaseUrl(placeholder);
      expect(target.problem, placeholder).toContain('template host');
      expect(target.problem, placeholder).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(target.url, placeholder).toBeNull();
    }
  });

  it('refuses a Supabase host whose project ref is not a project ref', () => {
    const target = resolveSupabaseUrl('https://ab.supabase.co');
    expect(target.problem).toMatch(/does not look like a Supabase project ref/);
    expect(target.url).toBeNull();
  });

  it('refuses a value with no hostname, and still allows a docker-compose service host', () => {
    expect(resolveSupabaseUrl('https://').problem).toMatch(/no hostname|not a parseable URL/);
    // `supabase start` / docker-compose put the stack on a dot-less host, which
    // is legitimate, so it is normalized rather than rejected.
    expect(resolveSupabaseUrl('http://supabase:8000').url).toBe('https://supabase:8000');
  });

  it('leaves a self-hosted / custom-domain target alone', () => {
    const target = resolveSupabaseUrl('https://db.internal.example.org');
    expect(target.problem).toBeNull();
    expect(target.url).toBe('https://db.internal.example.org');
    expect(target.looksLikeProject).toBe(false);
  });
});

/** The fault is nullable by contract (null = "not a network fault"), so tests
 *  that expect one assert-then-narrow instead of sprinkling `!` everywhere. */
function faultOf(error: unknown) {
  const fault = describeSupabaseFault(error);
  if (!fault) throw new Error('expected a transport fault, got none');
  return fault;
}

describe('describeSupabaseFault — reading the cause chain', () => {
  /** Build the exact shape Node/undici produce for `fetch failed`. */
  const undici = (code: string, hostname: string) => {
    const inner = Object.assign(new Error(`getaddrinfo ${code} ${hostname}`), { code, hostname });
    return Object.assign(new TypeError('fetch failed'), { cause: inner });
  };

  it('classifies ENOTFOUND as a permanent misconfiguration, not a retryable blip', () => {
    const fault = faultOf(undici('ENOTFOUND', 'nope.invalid'));
    expect(fault.code).toBe('ENOTFOUND');
    expect(fault.transient).toBe(false);
    expect(fault.summary).toContain('getaddrinfo ENOTFOUND');
    expect(fault.hint).toMatch(/does not resolve/);
    expect(fault.hint).toContain(PROD_URL.replace('https://', ''));
  });

  it('classifies a DNS blip and a socket reset as transient', () => {
    expect(faultOf(undici('EAI_AGAIN', 'x.supabase.co')).transient).toBe(true);
    expect(faultOf(undici('ECONNRESET', 'x.supabase.co')).transient).toBe(true);
    expect(faultOf(undici('UND_ERR_CONNECT_TIMEOUT', 'x.supabase.co')).transient).toBe(true);
  });

  it('reads through two levels of wrapping, which is how supabase-js nests it', () => {
    const wrapped = Object.assign(new Error('fetch failed'), {
      cause: Object.assign(new Error('read ECONNRESET'), { cause: { code: 'ECONNRESET' } }),
    });
    const fault = faultOf(wrapped);
    expect(fault.code).toBe('ECONNRESET');
    expect(fault.transient).toBe(true);
  });

  it('reports no fault at all for a PostgREST error (there is no network story)', () => {
    expect(describeSupabaseFault({ message: 'column universities.deleted does not exist', code: '42703', hint: '' })).toBeNull();
    expect(describeSupabaseFault({ message: 'relation "x" does not exist', code: '42P01' })).toBeNull();
    expect(describeSupabaseFault({ message: 'JWT expired', code: 'PGRST301' })).toBeNull();
  });

  it('flags the malformed-URL case as a configuration problem', () => {
    const fault = faultOf(new Error('Failed to parse URL from //supabase.co/rest/v1/x'));
    expect(fault.transient).toBe(false);
    expect(fault.hint).toMatch(/malformed/);
  });

  it('never puts a credential in the fault text', () => {
    const secret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super-secret-signature';
    const wrapped = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error(`invalid api key in header: ${secret}`), { code: 'ERR_HTTP_INVALID_HEADER_VALUE' }),
    });
    const fault = faultOf(wrapped);
    expect(fault.summary).not.toContain(secret);
    expect(fault.summary).toContain('[redacted-token]');
    expect(fault.hint).not.toContain(secret);
    expect(describeRegistryError({ message: `upstream said ${secret}` }, null)).not.toContain(secret);
  });
});

describe('describeRegistryError', () => {
  it('passes a PostgREST message through verbatim', () => {
    expect(describeRegistryError({ message: 'relation "academic_programs" does not exist' }, null)).toBe(
      'relation "academic_programs" does not exist'
    );
  });

  it('appends the errno and host for transport faults', () => {
    const fault = faultOf(
      Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' }) })
    );
    const message = describeRegistryError({ message: 'fetch failed' }, fault);
    expect(message).toContain('ENOTFOUND');
    expect(message).toContain('host=lxdovryeidayxfsqkwbg.supabase.co');
  });
});

describe('registryRead — retry policy', () => {
  const undici = (code: string) =>
    Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error(`getaddrinfo ${code} host`), { code }),
    });

  it('returns rows untouched on success and calls the query once', async () => {
    const run = vi.fn(async () => ({ data: [{ id: 1 }], error: null }));
    const outcome = await registryRead('test.fetch', run);
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(outcome.data).toEqual([{ id: 1 }]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retries a transient fault exactly once, then succeeds', async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return { data: null, error: undici('EAI_AGAIN') };
      return { data: ['late'], error: null };
    });
    const outcome = await registryRead<string[]>('test.fetch', run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual(['late']);
  });

  it('does NOT retry ENOTFOUND — a wrong host will not fix itself', async () => {
    const run = vi.fn(async () => ({ data: null, error: undici('ENOTFOUND') }));
    const outcome = await registryRead('test.fetch', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
    expect(outcome.fault?.code).toBe('ENOTFOUND');
    expect(outcome.attempts).toBe(1);
  });

  it('does NOT retry a schema error', async () => {
    const run = vi.fn(async () => ({ data: null, error: { message: 'column does not exist', code: '42703' } }));
    const outcome = await registryRead('test.fetch', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.fault).toBeNull();
    expect(registryMessage(outcome)).toBe('column does not exist');
  });

  it('refuses to send anything when the URL is unusable', async () => {
    setEnv('https://your-project-ref.supabase.co');
    const run = vi.fn(async () => ({ data: [], error: null }));
    const outcome = await registryRead('test.fetch', run);
    expect(run).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(false);
    expect(outcome.configProblem).toContain('template host');
    expect(outcome.host).toBe('your-project-ref.supabase.co');
  });

  it('treats a thrown error as a fault instead of letting it 500 the route', async () => {
    const run = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const outcome = await registryRead('test.fetch', run);
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.message).toContain('socket hang up');
  });

  it('logs the host and errno under the registry prefix', async () => {
    const warn = vi.mocked(console.warn);
    await registryRead('test.fetch', async () => ({ data: null, error: undici('ENOTFOUND') }));
    const line = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(line).toContain('[campus360:registry] test.fetch attempt 1');
    expect(line).toContain('ENOTFOUND');
    expect(line).toContain('lxdovryeidayxfsqkwbg.supabase.co');
  });

  it('never lets a credential reach the log line', async () => {
    const warn = vi.mocked(console.warn);
    const secret = 'eyJhbGciOiJIUzI1NiJ9.secret-payload.signature';
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
    await registryRead('test.fetch', async () => ({ data: null, error: { message: `bad key ${secret}`, code: '401' } }), {
      serviceRoleKey: secret,
    });
    const line = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(line).not.toContain(secret);
  });
});

describe('registry route wiring', () => {
  const ROUTES = [
    'app/api/universities/route.ts',
    'app/api/universities/[id]/route.ts',
    'app/api/halls/route.ts',
    'app/api/departments/route.ts',
    'app/api/programs/route.ts',
  ];

  it.each(ROUTES)('%s reads through registryRead and answers with registryFailure', (rel) => {
    const src = read(rel);
    expect(src, `${rel} must route its Supabase read through registryRead`).toContain('registryRead');
    expect(src, `${rel} must answer failures with registryFailure`).toContain('registryFailure(');
    expect(src).toContain("from '@/lib/registry-cache'");
    // A raw `error.message` in the envelope is how "fetch failed" got here.
    expect(src).not.toMatch(/'FETCH_FAILED',\s*\n?\s*error\.message/);
  });

  it('keeps the code -> id lookups honest (a dead DB is not an empty list)', () => {
    for (const rel of ['app/api/halls/route.ts', 'app/api/departments/route.ts']) {
      const src = read(rel);
      // The lookup goes through registryRead and its failure answers with the
      // same loud envelope; it must not `if (!university) return apiSuccess([])`.
      expect(src, `${rel} must route the lookup through registryRead`).toMatch(/registryRead<\{ id: string \} \| null>/);
      expect(src, `${rel} must fail its university lookup loudly`).toContain('registryFailure(lookup');
    }
  });

  it('still sends no-store on every registry response', () => {
    for (const rel of ROUTES) {
      expect(read(rel)).toContain('REGISTRY_NO_STORE');
    }
  });
});

describe('supabase client construction', () => {
  it('builds both server clients from the validated URL, not the raw env', () => {
    const src = read('lib/supabase-server.ts');
    expect(src).toContain('createServerClient(requireUrl()');
    expect(src).toContain('createClient(requireUrl()');
    expect(src).not.toMatch(/createClient\(url,/);
    expect(src).toContain('resolveSupabaseUrl');
  });

  it('keeps the browser client pointed at the same variable', () => {
    const src = read('lib/supabase-browser.ts');
    expect(src).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });
});

describe('health probe', () => {
  const src = read('app/api/health/registry/route.ts');

  it('is never cached', () => {
    expect(src).toContain("export const dynamic = 'force-dynamic'");
    expect(src).toContain('REGISTRY_NO_STORE');
  });

  it('reports counts and a host, and nothing secret', () => {
    expect(src).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    // The service-role variable may only be tested for presence, never read out.
    expect(src).toMatch(/Boolean\(process\.env\.SUPABASE_SERVICE_ROLE_KEY\)/);
    expect(src).not.toMatch(/=\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).toContain("count: 'exact'");
  });
});

describe('what the outage was NOT', () => {
  it('has no server-side self-fetch of /api/* anywhere in the app tree', () => {
    // Hypothesis 1: a relative `fetch()` inside a Server Component, which would
    // need NEXT_PUBLIC_APP_URL / VERCEL_URL to work at all. Still false.
    const offenders = [
      'app/signup/page.tsx',
      'app/(public)/page.tsx',
      'app/verify-email/page.tsx',
    ].filter((rel) => {
      try {
        const src = read(rel);
        return src.includes('fetch(') && !src.includes("'use client'");
      } catch {
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });

  it('hardcodes no localhost base in the registry path', () => {
    for (const rel of ['app/signup/page.tsx', 'lib/registry-cache.ts', 'lib/supabase-url.ts', 'lib/supabase-server.ts']) {
      expect(read(rel), rel).not.toContain('localhost:3000');
    }
  });

  it('relies on same-origin requests, so no CORS surface exists to misconfigure', () => {
    const config = read('next.config.mjs');
    expect(config).not.toContain('Access-Control-Allow-Origin');
    expect(read('app/signup/page.tsx')).toMatch(/fetch\(url, \{ cache: 'no-store' \}\)/);
  });

  it('retries a FETCH_FAILED from the form exactly once, then shows the reason', () => {
    const src = read('app/signup/page.tsx');
    expect(src).toContain("err?.code === 'FETCH_FAILED'");
    expect(src).toContain('const second = await fetchRegistryOnce');
    expect(src.match(/await fetchRegistryOnce/g)).toHaveLength(2);
  });
});
