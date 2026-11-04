/**
 * apps/web/lib/supabase-url.ts
 *
 * The single place where the Supabase REST endpoint used by server code is
 * turned into something fetchable.
 *
 * Why this exists: on Vercel production the registry routes returned
 * `TypeError: fetch failed`, which is undici's wording for "the URL I was
 * handed could not be reached". That string came out of the *route's* call to
 * Supabase — not from the browser — but nothing in the response said which host
 * it had tried, so an unusable `NEXT_PUBLIC_SUPABASE_URL` (a leftover
 * `.env.example` placeholder, a value without a scheme, a trailing `/rest/v1`,
 * stray whitespace) looked exactly like a broken client-side fetch URL.
 *
 * So: normalize what can be safely normalized, name the problem when it cannot
 * be, and describe transport faults with their real errno. Never returns or logs
 * keys — the URL and its host are public values (the browser bundle carries the
 * same pair); anything that looks like a token gets scrubbed on the way out.
 */

/** Values that mean "nobody replaced the template". */
const PLACEHOLDER_MARKERS = [
  'your-project',
  'your-project-ref',
  'project-ref',
  'replace-with',
  'changeme',
  'change-me',
  'example.com',
  'localhost',
  '127.0.0.1',
  '<',
  '>',
  '${',
  'process.env',
];

export interface ResolvedSupabaseUrl {
  /** The 20-char project ref taken from a `*.supabase.co` host, else null. */
  projectRef?: string | null;
  /** Absolute, scheme-corrected, no trailing slash. Null when unusable. */
  url: string | null;
  /** Bare hostname, for logs and error messages. */
  host: string | null;
  /** Non-null when the value cannot be used, with the reason and the fix. */
  problem: string | null;
  /** Set when the value was repaired rather than rejected. */
  repaired: string | null;
  /** True when the target is a `*.supabase.co|supabase.in` host with a real ref. */
  looksLikeProject: boolean;
}

function repairNote(notes: string[]): string | null {
  return notes.length ? notes.join('; ') : null;
}

/**
 * Read and sanitize `NEXT_PUBLIC_SUPABASE_URL` (or an explicitly passed value,
 * which is how the tests exercise every branch).
 */
export function resolveSupabaseUrl(raw?: string | null): ResolvedSupabaseUrl {
  const notes: string[] = [];
  const fromEnv = raw === undefined;
  const source = fromEnv
    ? String(typeof process === 'undefined' ? '' : process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    : String(raw ?? '');
  const original = source.trim();

  if (!original) {
    return {
      url: null,
      host: null,
      problem: fromEnv
        ? 'NEXT_PUBLIC_SUPABASE_URL is not set in this runtime'
        : 'NEXT_PUBLIC_SUPABASE_URL is empty',
      repaired: null,
      looksLikeProject: false,
    };
  }

  if (original !== source) {
    notes.push('trimmed surrounding whitespace');
  }

  let candidate = original.replace(/\s+/g, '');

  // A scheme is what actually breaks undici: "lxdovry...supabase.co" or
  // "//host" is not a fetchable URL, and Vercel env values are typed by hand.
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
    notes.push('added the missing https:// scheme');
  } else if (/^http:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^http:/i, 'https:');
    notes.push('upgraded http:// to https://');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      url: null,
      host: null,
      problem: `NEXT_PUBLIC_SUPABASE_URL ("${original}") is not a parseable URL`,
      repaired: repairNote(notes),
      looksLikeProject: false,
    };
  }

  // A trailing "/rest/v1" is the other classic hand-typed mistake: the client
  // appends /rest/v1 itself, so the request goes to /rest/v1/rest/v1 and dies.
  // The Supabase REST base never carries a path, so any path is dropped.
  const trailingPath = parsed.pathname.replace(/\/+$/, '');
  if (/\/rest\/v1$/i.test(trailingPath)) {
    notes.push('stripped the duplicated /rest/v1 suffix');
  } else if (trailingPath && trailingPath !== '/') {
    notes.push(`ignored the "${trailingPath}" path (the client appends /rest/v1 itself)`);
  }

  const host = parsed.hostname;
  if (!host) {
    return {
      url: null,
      host: null,
      problem: `NEXT_PUBLIC_SUPABASE_URL ("${original}") has no hostname`,
      repaired: repairNote(notes),
      looksLikeProject: false,
    };
  }

  const lowered = host.toLowerCase();
  const placeholder = PLACEHOLDER_MARKERS.find((marker) => lowered.includes(marker));
  if (placeholder) {
    return {
      url: null,
      host,
      problem:
        `NEXT_PUBLIC_SUPABASE_URL still points at the template host "${host}" ` +
        `(it contains "${placeholder}"). Set it to your project URL, e.g. ` +
        'https://xxxxxxxxxxxxxxxxxxxx.supabase.co',
      repaired: repairNote(notes),
      looksLikeProject: false,
    };
  }

  const ref = lowered.split('.')[0] ?? '';
  const looksLikeProject =
    lowered === 'supabase.co' || lowered.endsWith('.supabase.co') || lowered.endsWith('.supabase.in');
  if (looksLikeProject && !/^[a-z0-9]{12,40}$/.test(ref)) {
    return {
      url: null,
      host,
      problem:
        `NEXT_PUBLIC_SUPABASE_URL host "${host}" does not look like a Supabase project ref ` +
        '(the ref should be 12-40 lowercase alphanumeric characters, e.g. https://lxdovryeidayxfsqkwbg.supabase.co)',
      repaired: repairNote(notes),
      looksLikeProject: false,
    };
  }

  const url = `${parsed.protocol}//${parsed.host}`;
  return {
    url,
    host,
    projectRef: looksLikeProject ? ref : null,
    problem: null,
    repaired: repairNote(notes),
    looksLikeProject,
  };
}

export interface SupabaseFault {
  /** Short human sentence, e.g. "fetch failed: getaddrinfo ENOTFOUND x.supabase.co". */
  summary: string;
  /** Node/undici errno when one was attached (ENOTFOUND, EAI_AGAIN, ...). */
  code: string | null;
  /** Host the socket was aimed at, when it can be determined. */
  host: string | null;
  /** Worth retrying: DNS blips, socket resets, cold-start timeouts. */
  transient: boolean;
  /** One actionable sentence for whoever reads the log or the red box. */
  hint: string;
}

const TRANSIENT_CODES = new Set([
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'SOCKET_HANG_UP',
]);

const TRANSPORT_CODES = new Set([
  ...TRANSIENT_CODES,
  'ENOTFOUND',
  'ERR_INVALID_URL',
  'ERR_INVALID_ARG_TYPE',
  'ERR_HTTP_INVALID_HEADER_VALUE',
  'UND_ERR_INVALID_ARG',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
]);

const TRANSPORT_MESSAGE =
  /fetch failed|failed to fetch|network|socket|ECONN|ETIMEDOUT|EAI_|ENOTFOUND|invalid url|failed to parse url|certificate|self[- ]signed/i;

/**
 * Distinguish "the request never reached Postgres" from "Postgres answered and
 * disliked the query". Only the former produces a fault: a `cause` chain (undici
 * nests the errno there), a transport errno, or a network-shaped message. A
 * PostgREST error keeps its own message, which is already specific.
 */
export function isTransportFault(error: any): boolean {
  if (!error) return false;
  if (error.cause || error.originalError) return true;
  const code = typeof error.code === 'string' ? error.code : null;
  if (code && TRANSPORT_CODES.has(code)) return true;
  return TRANSPORT_MESSAGE.test(String(error.message ?? ''));
}

/**
 * Mask anything JWT-shaped before it reaches a log line or an API response body.
 * Upstream auth errors echo the bearer token back verbatim, and `message_en` is
 * rendered into the page — a leaked service-role key in a browser-visible string
 * would be a worse outage than the one these helpers exist to explain.
 */
export function scrubRegistrySecrets(text: unknown): string {
  let out = String(text ?? '');
  // A full three-part JWT, and also the truncated/2-part forms upstream error
  // messages produce when they echo only `header.payload` of the key they were
  // given. `eyJhbGciOi` is base64url for `{"alg":"` — i.e. the start of every
  // Supabase key — so anything carrying it is masked whatever follows it.
  out = out.replace(/\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{4,}){1,}\b/g, '[redacted-token]');
  out = out.replace(/\beyJhbGciOi[A-Za-z0-9_./-]*\b/g, '[redacted-token]');
  out = out.replace(/\beyJ[A-Za-z0-9_-]{24,}\b/g, '[redacted-token]');
  out = out.replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]*:[^/@\s]*)@/gi, '$1[redacted-credentials]@');
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._-]{20,}/gi, '$1[redacted-token]');
  return out;
}

/**
 * Shape check for a Supabase credential, safe to call from a public endpoint:
 * it reports *what kind* of value is configured and never the value itself.
 *
 * The registry outage proved up that `Boolean(process.env.X)` is a useless check
 * — `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-anon` from `.env.example` is
 * truthy, and every code path that trusts "truthy" then dies somewhere else with
 * a message about the wrong layer. So: a legacy key must decode to a JSON payload
 * carrying `role`, and if the project ref is known the payload's `ref` must agree
 * with it. The newer `sb_publishable_…` / `sb_secret_…` format is not a JWT, so it
 * is accepted on its prefix instead.
 */
export type KeyShape =
  | 'missing'
  | 'placeholder'
  | 'legacy-jwt'
  | 'publishable'
  | 'secret-format'
  | 'malformed';

export interface KeyReport {
  present: boolean;
  shape: KeyShape;
  /** `anon` / `service_role` for a decodable legacy JWT, else null. */
  role: string | null;
  /** The `ref` inside a legacy JWT, else null — public information. */
  ref: string | null;
  /** True when a legacy JWT's ref matches the configured project's host ref. */
  refMatchesProject: boolean | null;
  /** Actionable text, safe to show: never contains the value. */
  problem: string | null;
}

// Deliberately specific: a real key is high-entropy base64url, and a loose
// marker like `xxx` would false-positive on one run of random characters and
// hand back a "placeholder" verdict on a working deployment.
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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** @param value the raw env value; @param expectedRef project ref from the URL, if any */
export function describeSupabaseKey(
  value: string | undefined,
  expected?: { role?: 'anon' | 'service_role'; projectRef?: string | null }
): KeyReport {
  const raw = String(value ?? '').trim();
  const empty: KeyReport = {
    present: false,
    shape: 'missing',
    role: null,
    ref: null,
    refMatchesProject: null,
    problem: `${expected?.role === 'service_role' ? 'SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY'} is not set in this runtime`,
  };
  if (!raw) return empty;

  const placeholder = PLACEHOLDER_RUN.test(raw)
    ? 'a run of x characters'
    : PLACEHOLDER_KEY_MARKERS.find((marker) => raw.toLowerCase().includes(marker));
  if (placeholder) {
    return {
      present: true,
      shape: 'placeholder',
      role: null,
      ref: null,
      refMatchesProject: null,
      problem: `still contains the .env.example placeholder fragment "${placeholder}"`,
    };
  }

  if (raw.startsWith('sb_publishable_')) {
    return { present: true, shape: 'publishable', role: 'anon', ref: null, refMatchesProject: null, problem: null };
  }
  if (raw.startsWith('sb_secret_')) {
    return { present: true, shape: 'secret-format', role: 'service_role', ref: null, refMatchesProject: null, problem: null };
  }

  const payload = decodeJwtPayload(raw);
  if (!payload) {
    return {
      present: true,
      shape: 'malformed',
      role: null,
      ref: null,
      refMatchesProject: null,
      problem: 'is neither an sb_publishable_/sb_secret_ key nor a decodable JWT',
    };
  }

  const role = typeof payload.role === 'string' ? payload.role : null;
  const ref = typeof payload.ref === 'string' ? payload.ref : null;
  const projectRef = expected?.projectRef ?? null;
  const refMatchesProject = projectRef && ref ? ref === projectRef : null;

  let problem: string | null = null;
  if (expected?.role && role !== expected.role) {
    problem = `carries role "${role ?? 'unknown'}" but this runtime needs "${expected.role}" — the two clients are not interchangeable`;
  } else if (refMatchesProject === false) {
    problem = `was issued for project "${ref}" while NEXT_PUBLIC_SUPABASE_URL points at "${projectRef}" — a key from a different project`;
  }

  return { present: true, shape: 'legacy-jwt', role, ref, refMatchesProject, problem };
}

/**
 * Turn a transport failure into a diagnosis. The errno that matters is buried in
 * `error.cause.cause...`, so the walk is bounded but deep, and the deepest entry
 * carrying a transport code supplies the summary text.
 */
export function describeSupabaseFault(error: unknown): SupabaseFault | null {
  if (!isTransportFault(error)) return null;

  const chain: any[] = [];
  let cursor: any = error;
  for (let depth = 0; cursor && depth < 5; depth += 1) {
    chain.push(cursor);
    cursor = cursor.cause ?? cursor.originalError ?? null;
  }

  const host = resolveSupabaseUrl().host;
  let code: string | null = null;
  let deepest: any = null;
  for (const entry of chain) {
    const entryCode = typeof entry?.code === 'string' ? entry.code : null;
    if (entryCode && TRANSPORT_CODES.has(entryCode)) {
      code = entryCode;
      deepest = entry;
    }
  }

  const message = scrubRegistrySecrets(
    typeof (error as any)?.message === 'string' ? (error as any).message : String(error ?? 'network error')
  );
  const detail = deepest && deepest !== error ? scrubRegistrySecrets(deepest.message ?? '') : '';
  const summary = detail && !message.includes(detail) ? `${message}: ${detail}` : message || 'network error';

  const resolvedCode =
    code ?? /(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_[A-Z_]+)/.exec(summary)?.[1] ?? null;

  const transient = resolvedCode
    ? TRANSIENT_CODES.has(resolvedCode)
    : /EAI_|reset|timed out|timeout|socket hang up/i.test(summary);

  let hint = 'the request never completed — see the [campus360:registry] log line for the host and errno';
  if (resolvedCode === 'ENOTFOUND') {
    hint = `the DNS name "${host ?? '(unknown)'}" does not resolve: NEXT_PUBLIC_SUPABASE_URL is pointing at a host that does not exist`;
  } else if (resolvedCode === 'EAI_AGAIN') {
    hint = 'DNS blip — this is retryable, and the route already retried it';
  } else if (resolvedCode === 'ECONNREFUSED') {
    hint = `nothing is listening on "${host ?? '(unknown)'}:443" — the project may be paused or the host is wrong`;
  } else if (/invalid url|parse url/i.test(summary)) {
    hint = 'NEXT_PUBLIC_SUPABASE_URL is malformed; it must be https://<project-ref>.supabase.co';
  } else if (/certificate|self[- ]signed/i.test(summary)) {
    hint = 'the runtime rejected the TLS certificate, which usually means an egress proxy in front of the function';
  }

  return { summary, code: resolvedCode, host, transient, hint };
}

/**
 * Message text for the API error envelope. PostgREST errors (missing column, RLS
 * denial) are already meaningful and are passed through; transport faults get the
 * errno and host appended, because `fetch failed` on its own has cost hours.
 */
export function describeRegistryError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  fault: SupabaseFault | null
): string {
  const base = scrubRegistrySecrets(error?.message ?? 'unknown error');
  if (!fault || !fault.code) return base;
  return `${base} (${fault.code}${fault.host ? ` host=${fault.host}` : ''})`;
}
