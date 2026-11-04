// apps/web/__tests__/auth-log.test.ts
// ============================================================================
// The contract for lib/auth-log.ts is narrow and important: operators must be
// able to see the *real* SMTP/Postgres fault in the runtime log, and the OTP or
// the Gmail app password must never appear there — not even inside a
// provider-authored message or a nested transport-options object.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authError, authLog, authWarn, redact } from '../lib/auth-log';

// The scrubber list is built lazily on the first redact() call, i.e. inside a
// test — so plain env assignment here (which runs before any test body) is
// enough for the password/address rules to be active.
process.env.GMAIL_USER = 'campus360.test@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';

function lines(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
}

describe('auth log redaction', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops credential-shaped keys but keeps the fields that diagnose a fault', () => {
    const redacted = redact({
      auth: { user: 'campus360.test@gmail.com', pass: 'abcd efgh ijkl mnop' },
      OTP_PEPPER_SECRET: 'pepper-value',
      otp: '482913',
      otp_hash: 'digest-value',
      // PostgREST + SMTP diagnostics must survive: they are the reason to read
      // the log at all.
      code: 'PGRST116',
      responseCode: '535',
      command: 'AUTH',
    }) as Record<string, unknown>;

    expect((redacted.auth as Record<string, unknown>).pass).toBe('[redacted-key]');
    expect(redacted.OTP_PEPPER_SECRET).toBe('[redacted-key]');
    expect(redacted.otp).toBe('[redacted-key]');
    expect(redacted.otp_hash).toBe('[redacted-key]');
    expect(redacted.code).toBe('PGRST116');
    expect(redacted.responseCode).toBe('535');
    expect(redacted.command).toBe('AUTH');
  });

  it('scrubs OTP-shaped digits, the app password and the sending address from free text', () => {
    const message =
      redact('Your verification code is 482913. Login failed for abcd efgh ijkl mnop at campus360.test@gmail.com') as string;

    expect(message).not.toContain('482913');
    expect(message).not.toContain('abcd efgh');
    expect(message).not.toContain('campus360.test@gmail.com');
    expect(message).toContain('[redacted]');
    // Non-secret prose is preserved so the line is still diagnosable.
    expect(message).toContain('Your verification code is');
  });

  it('keeps Message-IDs and challenge UUIDs intact while scrubbing bare codes', () => {
    // Correlation keys are the only way to tie a log line to an email, so the
    // digit scrub deliberately ignores runs embedded in hex/UUID tokens.
    const messageId = '<otp-9d2f6a1b-7c1e-4a55-9f3d-1a2b3c4d5e6f@gmail.com>';
    expect(redact(messageId)).toBe(messageId);
    expect(redact('rejected: 123456')).not.toContain('123456');
  });

  it('flattens Errors into the SMTP/Postgres fields, including a nested cause', () => {
    const cause = Object.assign(new Error('socket hang up'), { code: 'ESOCKET' });
    const error = Object.assign(new Error('Invalid login'), {
      code: 'EAUTH',
      responseCode: '535',
      response: '535-5.7.8 Username and Password not accepted',
      command: 'AUTH',
      cause,
    });

    const detail = redact(error) as Record<string, unknown> & { cause?: Record<string, unknown> };
    expect(detail.name).toBe('Error');
    expect(detail.message).toBe('Invalid login');
    expect(detail.responseCode).toBe('535');
    expect(String(detail.response)).toContain('Username and Password not accepted');
    expect(detail.cause?.code).toBe('ESOCKET');
    expect(typeof detail.stack).toBe('string');
  });

  it('does not walk clients, sockets or requests', () => {
    class SupabaseClient {
      // Would be a credential leak if this object were recursed into.
      settings = { auth: { headers: { Authorization: 'Bearer secret.jwt.value' } } };
    }
    const detail = redact({ client: new SupabaseClient() }) as Record<string, unknown>;
    expect(detail.client).toBe('[SupabaseClient]');
    expect(JSON.stringify(detail)).not.toContain('secret.jwt.value');
  });

  it('writes one prefixed line per call and nothing secret', () => {
    authError('smtp.send-failed', new Error('Invalid login 482913'), {
      to: 'stu***@du.ac.bd',
      GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
    });
    authLog('smtp.sent', { messageId: '<x@gmail.com>' });
    authWarn('smtp.unconfigured', { reason: 'missing credentials' });

    const all = `${lines(errorSpy)}\n${lines(logSpy)}\n${lines(warnSpy)}`;
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(all).toContain('[campus360:auth] smtp.send-failed');
    expect(all).toContain('[campus360:auth] smtp.sent');
    expect(all).toContain('[campus360:auth] smtp.unconfigured');
    expect(all).not.toContain('abcd efgh');
    expect(all).not.toContain('482913');
    // The JSON payload — not just the prefix — must be parseable for log drains.
    const payload = String(errorSpy.mock.calls[0][1]);
    expect(() => JSON.parse(payload)).not.toThrow();
  });
});
