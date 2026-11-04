// apps/web/__tests__/email-otp.test.ts
// Real-time email OTP unit coverage: code strength, TTL policy, digest
// comparison, the message shape and SMTP error classification. No network, no
// database, no credentials.
import { describe, expect, it, vi } from 'vitest';
import {
  OTP_CODE_OFFSET,
  OTP_CODE_SPACE,
  OTP_TTL_MS,
  OTP_TTL_SECONDS,
  generateOtpCode,
  isOtpCodeFormat,
  isOtpExpired,
  otpExpiresAt,
  redactEmail,
  remainingOtpSeconds,
} from '../lib/demo-otp';
import { hashOtp, normalizeOtpInput, otpHashMatches } from '../lib/otp-crypto';
import {
  buildOtpEmailHtml,
  buildOtpEmailText,
  classifySmtpError,
  gmailCredentials,
  isSmtpConfigured,
  otpEmailSubject,
  sendOtpEmail,
} from '../lib/otp-email';

const EMAIL = 'student.du@du.ac.bd';

// Deterministic pepper for the digest assertions (never a real secret).
process.env.OTP_PEPPER_SECRET = 'test-pepper-for-unit-runs';

describe('otp code generation', () => {
  it('mints 6-digit codes inside the documented range', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      const numeric = Number(code);
      expect(numeric).toBeGreaterThanOrEqual(OTP_CODE_OFFSET);
      expect(numeric).toBeLessThan(OTP_CODE_OFFSET + OTP_CODE_SPACE);
      seen.add(code);
    }
    // A CSPRNG over 900k values never repeats meaningfully in 3k draws.
    expect(seen.size).toBeGreaterThan(2900);
  });

  it('rejects malformed codes on the wire', () => {
    expect(isOtpCodeFormat('123456')).toBe(true);
    expect(isOtpCodeFormat('12345')).toBe(false);
    expect(isOtpCodeFormat('1234567')).toBe(false);
    expect(isOtpCodeFormat('12 34')).toBe(false);
    expect(isOtpCodeFormat(42)).toBe(false);
  });

  it('normalizes user input to exactly six digits or null', () => {
    expect(normalizeOtpInput(' 482 913 ')).toBe('482913');
    expect(normalizeOtpInput('48291')).toBeNull();
    expect(normalizeOtpInput('abcdef')).toBeNull();
    expect(normalizeOtpInput(undefined)).toBeNull();
  });
});

describe('otp ttl policy', () => {
  it('issues a 5-minute expiry', () => {
    expect(OTP_TTL_SECONDS).toBe(300);
    expect(OTP_TTL_MS).toBe(5 * 60 * 1000);
    const issuedAt = Date.parse('2026-11-04T10:00:00.000Z');
    expect(otpExpiresAt(issuedAt)).toBe('2026-11-04T10:05:00.000Z');
  });

  it('fails closed on missing or unparsable expiries', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isOtpExpired(future)).toBe(false);
    expect(isOtpExpired(new Date(Date.now() - 1).toISOString())).toBe(true);
    expect(isOtpExpired(null)).toBe(true);
    expect(isOtpExpired(undefined)).toBe(true);
    expect(isOtpExpired('not-a-date')).toBe(true);
    expect(remainingOtpSeconds(future)).toBeGreaterThan(50);
    expect(remainingOtpSeconds(null)).toBe(0);
  });
});

describe('otp digest verification', () => {
  it('is deterministic per email but not portable across emails', () => {
    const code = '482913';
    const digest = hashOtp(EMAIL, code);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp(EMAIL, code)).toBe(digest);
    expect(hashOtp('other.du@du.ac.bd', code)).not.toBe(digest);
  });

  it('accepts the matching code and refuses everything else', () => {
    const code = generateOtpCode();
    const digest = hashOtp(EMAIL, code);
    expect(otpHashMatches(digest, EMAIL, code)).toBe(true);
    expect(otpHashMatches(digest, EMAIL, code === '000000' ? '111111' : '000000')).toBe(false);
    expect(otpHashMatches(null, EMAIL, code)).toBe(false);
    expect(otpHashMatches(undefined, EMAIL, code)).toBe(false);
    expect(otpHashMatches('', EMAIL, code)).toBe(false);
    // Cleared / non-hex storage must not throw (timingSafeEqual length guard).
    expect(otpHashMatches('not-hex', EMAIL, code)).toBe(false);
    // A consumed challenge stores NULL — replay must fail.
    expect(otpHashMatches(null, EMAIL, code)).toBe(false);
  });

  it('normalizes case and whitespace before hashing', () => {
    expect(hashOtp(' Student.Du@DU.AC.BD ', '123456')).toBe(hashOtp('student.du@du.ac.bd', '123456'));
  });
});

describe('otp email rendering', () => {
  const input = {
    to: EMAIL,
    code: '482913',
    expiresAt: '2026-11-04T10:05:00.000Z',
    ttlSeconds: OTP_TTL_SECONDS,
    fullName: 'Ayesha Rahman',
    universityName: 'University of Dhaka',
    universityCode: 'DU',
  };

  it('keeps the code out of the subject line', () => {
    const subject = otpEmailSubject(input);
    expect(subject).toContain('verification code');
    expect(subject).not.toContain('482913');
  });

  it('renders each digit as its own tile and a 5-minute deadline', () => {
    const html = buildOtpEmailHtml(input);
    const tiles = html.match(/class="c360-tile"|width="44"/g) ?? [];
    expect(tiles.length).toBe(6);
    for (const digit of '482913') expect(html).toContain(`>${digit}</td>`);
    expect(html).toContain('Expires in 5 minutes');
    expect(html).toContain('৫ মিনিট');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('escapes interpolated database text', () => {
    const html = buildOtpEmailHtml({ ...input, universityName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('provides a plain-text part with the code', () => {
    const text = buildOtpEmailText(input);
    expect(text).toContain('482913');
    expect(text).toContain('expires in 5 minutes');
  });

  it('reports an unconfigured provider instead of throwing', async () => {
    // "This deployment cannot mail" is an operator-visible fact, so it is logged
    // as well as returned — the spy keeps the line out of the report and asserts
    // it is actually emitted (and never carries the recipient in full).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(gmailCredentials()).toBeNull();
      expect(isSmtpConfigured()).toBe(false);
      const result = await sendOtpEmail(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.provider).toBe('unconfigured');
        expect(result.error).toContain('GMAIL_USER');
        expect(result.retryable).toBe(false);
      }
      const line = warn.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
      expect(line).toContain('[campus360:auth] smtp.unconfigured');
      expect(line).not.toContain(input.to);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('smtp failure classification', () => {
  it('separates credential/quota faults from transient socket faults', () => {
    expect(classifySmtpError({ code: 'EAUTH', responseCode: 535, message: 'Invalid login' }).retryable).toBe(false);
    expect(classifySmtpError({ response: 'Daily sending quota exceeded' }).retryable).toBe(false);
    expect(classifySmtpError({ code: 'ESOCKET', message: 'connection reset' }).retryable).toBe(true);
    expect(classifySmtpError({ code: 'ETIMEDOUT', message: 'timeout' }).retryable).toBe(true);
    expect(classifySmtpError({ responseCode: 421, message: 'too many connections' }).retryable).toBe(true);
    expect(classifySmtpError({ responseCode: 550, message: 'Recipient address rejected' }).retryable).toBe(false);
    expect(classifySmtpError(new Error('boom')).retryable).toBe(true);
  });

  it('names the credential problem for operators, not just for logs', () => {
    expect(classifySmtpError({ code: 'EAUTH', message: 'Invalid login: 535-5.7.8' }).message).toContain(
      'GMAIL_APP_PASSWORD'
    );
  });
});

describe('log hygiene', () => {
  it('masks the local part of an address before it reaches a log', () => {
    expect(redactEmail(EMAIL)).toBe('stu***@du.ac.bd');
    expect(redactEmail('a@du.ac.bd')).toBe('a***@du.ac.bd');
    expect(redactEmail('garbage')).toBe('***');
  });
});
