// apps/web/lib/auth-log.ts
// ============================================================================
// Structured, redacted logging for the email-OTP path.
//
// Sign-in now depends on two external systems — Postgres (through Supabase) and
// Gmail's SMTP relay — and from the browser both look identical: a generic error
// card. These helpers put the *actual* fault (PostgREST message, SMTP reply code,
// transport settings) into the runtime logs Vercel shows, while guaranteeing
// nothing secret can ride along by accident.
//
// Every value written here passes through `redact()`:
//   • object keys matching /pass|secret|token|digest|hash|otp|code|authorization/i
//     are dropped, so `error.context.options.auth` cannot print an app password;
//   • string values are scrubbed of the configured Gmail app password and of any
//     bare 6-digit run, because SMTP reply text is provider-authored and we do
//     not log OTPs anywhere;
//   • Errors become {name, message, stack} plus the SMTP/PostgREST fields that
//     actually diagnose a fault; Supabase clients, Requests and Sockets are
//     reduced to a type tag instead of being walked.
//
// Prefix every line with `[campus360:auth]` so `vercel logs --follow | grep` or
// the log drain filter picks up exactly this subsystem.
// ============================================================================

/** Fields whose *name* alone marks them as never-loggable. */
const SENSITIVE_KEY = /pass|secret|token|digest|hash|otp|authoriz|cookie|apikey|api_key|pepper|key$/i;

/** Objects we must never recurse into: they hold credentials or unbounded state. */
function opaqueTag(value: unknown): string | null {
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return String(value);
  if (typeof process !== 'undefined' && value && typeof value === 'object') {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name ?? '';
    if (/SupabaseClient|GoTrueClient|Socket|Request|Response|NextRequest|ReadableStream|Agent/i.test(ctor)) {
      return `[${ctor}]`;
    }
  }
  return null;
}

let scrubbers: RegExp[] | null = null;

/**
 * Strings that must never appear in a log line even inside someone else's error
 * message. Built once from the live environment: the Gmail app password, and any
 * 6-digit digit run (an OTP-shaped value).
 */
function secretScrubbers(): RegExp[] {
  if (scrubbers) return scrubbers;
  // An OTP is a *free-standing* 6-digit run. Requiring non-hex characters on both
  // sides keeps challenge UUIDs and Message-IDs intact for correlation.
  const list: RegExp[] = [/(?<![0-9a-fA-F])[0-9]{6}(?![0-9a-fA-F])/g];
  const password = process.env.GMAIL_APP_PASSWORD?.trim();
  if (password && password.length >= 4) {
    // Escape regex metacharacters rather than assume the app password is alnum.
    list.unshift(new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  }
  const user = process.env.GMAIL_USER?.trim();
  if (user && user.includes('@')) {
    list.unshift(new RegExp(user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  }
  scrubbers = list;
  return list;
}

function scrubString(value: string): string {
  let out = value;
  for (const pattern of secretScrubbers()) out = out.replace(pattern, '[redacted]');
  // A stack line is fine to keep, but cap length so one fault cannot flood logs.
  return out.length > 2000 ? `${out.slice(0, 2000)}…[truncated]` : out;
}

/** Recursive redaction. Depth- and breadth-limited on purpose: log lines stay readable. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 4) return '[depth-limit]';

  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  const tag = opaqueTag(value);
  if (tag) return tag;

  if (value instanceof Error) {
    const err = value as Error & Record<string, unknown>;
    const detail: Record<string, unknown> = {
      name: err.name,
      message: scrubString(String(err.message ?? '')),
    };
    // The fields that actually identify an SMTP/PostgREST/net failure.
    for (const key of [
      'code',
      'responseCode',
      'command',
      'response',
      'hostname',
      'port',
      'cause',
      'stack',
    ] as const) {
      const raw = err[key];
      if (raw === undefined) continue;
      detail[key] =
        typeof raw === 'string' ? scrubString(raw) : key === 'cause' ? redact(raw, depth + 1) : redact(raw, depth + 1);
    }
    if (Array.isArray(err.errors)) {
      detail.errors = (err.errors as unknown[]).slice(0, 5).map((e) => redact(e, depth + 1));
    }
    return detail;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 24)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted-key]' : redact(raw, depth + 1);
    }
    return out;
  }

  return scrubString(String(value));
}

const PREFIX = '[campus360:auth]';

/** Informational breadcrumb — normal for a healthy request, one line per stage. */
export function authLog(stage: string, fields: Record<string, unknown> = {}): void {
  console.log(`${PREFIX} ${stage}`, JSON.stringify(redact(fields) as Record<string, unknown>));
}

/** A non-fatal problem worth an operator's attention. */
export function authWarn(stage: string, fields: Record<string, unknown> = {}): void {
  console.warn(`${PREFIX} ${stage}`, JSON.stringify(redact(fields) as Record<string, unknown>));
}

/**
 * The failure path. `error` is logged in full (message, stack, SMTP reply code,
 * PostgREST code) so the Vercel runtime log is enough to diagnose without a
 * repro; the caller decides what the *user* is told.
 */
export function authError(stage: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const detail = { ...fields, error: redact(error) };
  console.error(`${PREFIX} ${stage}`, JSON.stringify(redact(detail)));
}

/**
 * One-time note about how the transport was wired, so "is it even using Gmail?"
 * is answerable from the logs. Never includes credentials — `user` is the sending
 * mailbox (already public in every email header) and the password key is dropped
 * by `redact()` regardless.
 */
export function authLogTransportConfig(config: Record<string, unknown>): void {
  authLog('smtp.transport-config', config);
}
