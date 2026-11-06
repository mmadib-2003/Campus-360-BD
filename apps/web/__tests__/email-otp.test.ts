// apps/web/__tests__/email-otp.test.ts
// Real-time email OTP unit coverage: code strength, TTL policy, digest
// comparison, the message shape and SMTP error classification. No network, no
// database, no credentials.
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// ---------------------------------------------------------------------------
// Serverless-safe signed cookie backup (campus360_otp_challenge) and the
// 120-second verification receipt (campus360_otp_verified) that makes
// duplicate verify-otp calls idempotent across Vercel instances.
// ---------------------------------------------------------------------------
import {
  OTP_IDEMPOTENCY_WINDOW_SECONDS,
  otpVerifiedReceiptMatches,
  signOtpChallengeCookie,
  signOtpVerifiedReceipt,
  verifyOtpChallengeCookie,
  type OtpChallengeCookiePayload,
} from '../lib/otp-challenge-cookie';

function challengePayload(overrides: Partial<OtpChallengeCookiePayload> = {}): OtpChallengeCookiePayload {
  return {
    email: EMAIL,
    otpHash: hashOtp(EMAIL, '482913'),
    salt: 'nonce-abc123',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    universityId: '9b0f2a6e-0000-4000-8000-000000000001',
    hallId: 'hall-1',
    departmentId: 'dept-1',
    challengeId: 'cha-1',
    iat: Date.now(),
    ...overrides,
  };
}

describe('otp challenge cookie (serverless backup)', () => {
  it('seals and reopens the digest-only payload', () => {
    const payload = challengePayload();
    const token = signOtpChallengeCookie(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    // The plaintext code is never inside the cookie.
    expect(token).not.toContain('482913');
    const opened = verifyOtpChallengeCookie(token);
    expect(opened).toBeTruthy();
    expect(opened!.email).toBe(EMAIL);
    expect(opened!.otpHash).toBe(payload.otpHash);
    expect(opened!.universityId).toBe(payload.universityId);
    expect(otpHashMatches(opened!.otpHash, EMAIL, '482913')).toBe(true);
  });

  it('rejects tampered payloads and signatures', () => {
    const token = signOtpChallengeCookie(challengePayload());
    const [payloadPart, sigPart] = token.split('.');
    // Flip a character in the payload (signature no longer matches).
    const tamperedPayload = (payloadPart[0] === 'A' ? 'B' : 'A') + payloadPart.slice(1);
    expect(verifyOtpChallengeCookie(`${tamperedPayload}.${sigPart}`)).toBeNull();
    // Flip a character in the signature.
    const tamperedSig = (sigPart[0] === 'A' ? 'B' : 'A') + sigPart.slice(1);
    expect(verifyOtpChallengeCookie(`${payloadPart}.${tamperedSig}`)).toBeNull();
    expect(verifyOtpChallengeCookie('garbage')).toBeNull();
    expect(verifyOtpChallengeCookie(null)).toBeNull();
    expect(verifyOtpChallengeCookie('')).toBeNull();
  });

  it('refuses an expired challenge cookie', () => {
    const token = signOtpChallengeCookie(challengePayload({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(verifyOtpChallengeCookie(token)).toBeNull();
  });

  it('refuses malformed payloads (missing salt, bad digest, no university)', () => {
    expect(verifyOtpChallengeCookie(signOtpChallengeCookie(challengePayload({ salt: '' })))).toBeNull();
    expect(verifyOtpChallengeCookie(signOtpChallengeCookie(challengePayload({ otpHash: 'not-hex' })))).toBeNull();
    expect(verifyOtpChallengeCookie(signOtpChallengeCookie(challengePayload({ universityId: '' })))).toBeNull();
  });
});

describe('otp verification receipt (idempotent duplicate calls)', () => {
  const code = '482913';
  const receipt = (verifiedAt: number) =>
    signOtpVerifiedReceipt({ email: EMAIL, otpHash: hashOtp(EMAIL, code), verifiedAt });

  it('accepts the same email + code inside the 120s window', () => {
    expect(OTP_IDEMPOTENCY_WINDOW_SECONDS).toBe(120);
    expect(otpVerifiedReceiptMatches(receipt(Date.now() - 5_000), EMAIL, code)).toBe(true);
    // Case/whitespace-insensitive email, like the rest of the flow.
    expect(otpVerifiedReceiptMatches(receipt(Date.now()), ' Student.Du@DU.AC.BD ', code)).toBe(true);
  });

  it('rejects a different code, a different email, and a stale receipt', () => {
    const fresh = receipt(Date.now());
    expect(otpVerifiedReceiptMatches(fresh, EMAIL, '000000')).toBe(false);
    expect(otpVerifiedReceiptMatches(fresh, 'other.du@du.ac.bd', code)).toBe(false);
    expect(otpVerifiedReceiptMatches(receipt(Date.now() - 121_000), EMAIL, code)).toBe(false);
    expect(otpVerifiedReceiptMatches(null, EMAIL, code)).toBe(false);
    expect(otpVerifiedReceiptMatches('garbage', EMAIL, code)).toBe(false);
  });

  it('rejects a tampered receipt', () => {
    const token = receipt(Date.now());
    const [payloadPart, sigPart] = token.split('.');
    const tamperedSig = (sigPart[0] === 'A' ? 'B' : 'A') + sigPart.slice(1);
    expect(otpVerifiedReceiptMatches(`${payloadPart}.${tamperedSig}`, EMAIL, code)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Account loading after a valid code (the "account could not be loaded" fix).
//
// These are route-level tests: POST /api/auth/verify-otp against an in-memory
// Supabase double. vi.mock factories are hoisted above the imports by Vitest,
// so they only affect the module graph the route pulls in — the pure-function
// suites above keep exercising the real implementations.
// ---------------------------------------------------------------------------
const db = vi.hoisted(() => ({
  configured: true,
  profiles: new Map<string, Record<string, unknown>>(),
  authUsers: new Map<string, string>(),
  profileLookupError: null as null | { message: string },
  profileUpsertError: null as null | { message: string },
  createUserError: null as null | { message: string; code?: string },
  generateLinkFails: false,
  sessionExchangeFails: false,
  challenge: null as null | Record<string, unknown>,
  cookieChallenge: null as null | Record<string, unknown>,
  profileWrites: [] as Array<Record<string, unknown>>,
  roleWrites: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<Record<string, unknown>>,
  createdUsers: [] as Array<Record<string, unknown>>,
  roleRows: [] as Array<{ role: string }>,
  reset() {
    this.configured = true;
    this.profiles.clear();
    this.authUsers.clear();
    this.profileLookupError = null;
    this.profileUpsertError = null;
    this.createUserError = null;
    this.generateLinkFails = false;
    this.sessionExchangeFails = false;
    this.challenge = null;
    this.cookieChallenge = null;
    this.profileWrites = [];
    this.roleWrites = [];
    this.sessions = [];
    this.createdUsers = [];
    this.roleRows = [];
  },
}));

vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => db.configured }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock('next/headers', () => ({
  cookies: () => ({ get: vi.fn(() => undefined), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      verifyOtp: async () =>
        db.sessionExchangeFails
          ? { data: { user: null }, error: { message: 'GoTrue unavailable' } }
          : { data: { user: { id: 'auth-id', email: 'verified@example.com' } }, error: null },
    },
  }),
  createSupabaseAdminClient: () => ({
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () =>
                db.profileLookupError
                  ? { data: null, error: db.profileLookupError }
                  : { data: db.profiles.get(String(value).toLowerCase()) ?? null, error: null },
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              db.profileWrites.push(payload);
              return { error: null };
            },
          }),
          upsert: async (row: Record<string, unknown>) => {
            if (db.profileUpsertError) return { error: db.profileUpsertError };
            db.profileWrites.push(row);
            db.profiles.set(String(row.email).toLowerCase(), row);
            return { error: null };
          },
        };
      }
      if (table === 'user_roles') {
        return {
          select: () => ({ eq: async () => ({ data: db.roleRows, error: null }) }),
          upsert: async (row: Record<string, unknown>) => {
            db.roleWrites.push(row);
            return { error: null };
          },
        };
      }
      if (table === 'universities') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { code: 'JU', name_en: 'Jahangirnagar University' }, error: null }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) };
    },
    auth: {
      admin: {
        createUser: async (attributes: Record<string, unknown>) => {
          db.createdUsers.push(attributes);
          if (db.createUserError) return { data: { user: null }, error: db.createUserError };
          const email = String(attributes.email).toLowerCase();
          if (db.authUsers.has(email)) {
            return { data: { user: null }, error: { code: 'email_exists', message: 'User already registered' } };
          }
          const id = `auth-${db.authUsers.size + 1}`;
          db.authUsers.set(email, id);
          return { data: { user: { id, email } }, error: null };
        },
        generateLink: async ({ email }: { email: string }) => {
          if (db.generateLinkFails) return { data: { properties: null, user: null }, error: { message: 'link generation blocked' } };
          const id = db.authUsers.get(String(email).toLowerCase());
          return {
            data: { properties: { hashed_token: 'token' }, user: id ? { id, email } : null },
            error: null,
          };
        },
        listUsers: async () => ({
          data: { users: [...db.authUsers.entries()].map(([email, id]) => ({ id, email })) },
          error: null,
        }),
      },
    },
  }),
}));
vi.mock('@/lib/demo-auth', () => ({
  DEMO_OTP_COOKIE: 'campus360_demo_otp',
  demoNextStep: (role: string) => (role === 'admin' ? '/admin/console' : '/feed'),
  normalizeDemoRole: (role: unknown) => role ?? 'student',
  readSignedDemoSession: () => null,
  verifyDemoChallenge: () => ({ ok: false, error: 'no demo challenge', errorBn: '', status: 404 }),
  issueSignedDemoSession: vi.fn(),
}));
vi.mock('@/lib/otp-store', () => ({
  readActiveOtpChallenge: async () => db.challenge,
  readRecentVerifiedOtpChallenge: async () => null,
  consumeOtpChallenge: vi.fn(async () => undefined),
  clearProfileDemoOtp: vi.fn(async () => undefined),
  hasAttemptsLeft: () => true,
  isChallengeExpired: () => false,
  recordOtpFailure: vi.fn(async () => undefined),
}));
vi.mock('@/lib/otp-challenge-cookie', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/otp-challenge-cookie')>();
  return {
    ...actual,
    readOtpChallengeCookie: () => db.cookieChallenge,
    readOtpVerifiedReceiptRaw: () => null,
    setOtpVerifiedReceipt: vi.fn(),
    clearOtpChallengeCookie: vi.fn(),
  };
});
vi.mock('@/lib/verified-session', () => ({
  readVerifiedSession: () => null,
  issueVerifiedSession: (payload: Record<string, unknown>) => {
    db.sessions.push(payload);
    return payload;
  },
}));

const { POST: verifyOtpPost } = await import('@/app/api/auth/verify-otp/route');
const { NextRequest: RouteRequest } = await import('next/server');

const JU = '08e2b61c-505d-4793-be4d-5ccb6aefc38c';
const JU_HALL = '11111111-2222-4333-8444-555555555555';
const JU_DEPT = '7c5d40c4-2742-4d27-b169-465ae259a7ab';
const OTP = '482913';

function issuedChallenge(email: string, payload: Record<string, unknown>) {
  return {
    id: 'challenge-1',
    email,
    university_id: JU,
    otp_hash: hashOtp(email, OTP),
    attempt_count: 0,
    max_attempts: 5,
    expires_at: new Date(Date.now() + 240_000).toISOString(),
    verified_at: null,
    created_at: new Date().toISOString(),
    signup_payload: { email, universityId: JU, ...payload },
  };
}

function verifyRequest(email: string, code: string, context: Record<string, unknown> = {}) {
  return new RouteRequest('http://localhost:3000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: code, ...context }),
  });
}

describe('verify-otp loads the account after a valid code', () => {
  beforeEach(() => db.reset());

  it('provisions a first-time /signin faculty account on @gmail.com with no hall', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.challenge = issuedChallenge(email, { role: 'faculty', hallId: null, purpose: 'signin' });

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'faculty', universityId: JU }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.ok).toBe(true);
    expect(body.data.verified).toBe(true);
    expect(body.data.profilePersisted).toBe(true);
    expect(body.data.user.email).toBe(email);
    expect(body.data.role).toBe('faculty');
    // The selected tenant is used verbatim — no @gmail.com domain lookup.
    expect(db.profileWrites[0]).toMatchObject({
      email,
      university_id: JU,
      role: 'faculty',
      hall_id: null,
      email_verified: true,
      full_name: 'mmadib2001',
    });
    expect(db.roleWrites[0]).toMatchObject({ role: 'FACULTY', university_id: JU });
    expect(db.createdUsers[0]).toMatchObject({
      email,
      email_confirm: true,
      user_metadata: expect.objectContaining({ university_id: JU, role: 'faculty', email_verified: true }),
    });
    expect(db.sessions[0]).toMatchObject({ email, role: 'faculty', persistence: 'supabase', hallId: null });
  });

  it('provisions a first-time alumni account with a personal email and a program session', async () => {
    db.reset();
    const email = 'mmadib2001@yahoo.com';
    db.challenge = issuedChallenge(email, {
      role: 'alumni', hallId: null, programSession: '2010-11', purpose: 'signin', departmentId: JU_DEPT,
    });

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'alumni', programSession: '2010-11' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.profilePersisted).toBe(true);
    // A brand-new account still walks through onboarding once; it is no longer
    // an error page, and the profile it lands on is already complete.
    expect(body.data.redirectTo).toBe('/onboarding');
    expect(db.profileWrites[0]).toMatchObject({
      role: 'alumni', hall_id: null, program_session: '2010-11', department_id: JU_DEPT, onboarding_completed: true,
    });
    expect(db.roleWrites[0]).toMatchObject({ role: 'ALUMNI' });
  });

  it('provisions a first-time student account with its residential hall', async () => {
    db.reset();
    const email = 'student.ju@juniv.edu';
    db.challenge = issuedChallenge(email, {
      role: 'student', hallId: JU_HALL, programSession: '2023-24', purpose: 'signup',
      fullName: 'Ayesha Rahman', studentId: 'JU-2023-01',
    });

    const response = await verifyOtpPost(verifyRequest(email, OTP, {
      role: 'student', hallId: JU_HALL, programSession: '2023-24',
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.ok).toBe(true);
    expect(body.data.profilePersisted).toBe(true);
    expect(db.profileWrites[0]).toMatchObject({
      role: 'student', hall_id: JU_HALL, program_session: '2023-24',
      full_name: 'Ayesha Rahman', student_id: 'JU-2023-01', university_id: JU,
    });
    expect(db.roleWrites[0]).toMatchObject({ role: 'STUDENT' });
    expect(db.sessions[0]).toMatchObject({ hallId: JU_HALL, persistence: 'supabase' });
  });

  it('adopts an existing auth.users row that has no profile instead of failing', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.authUsers.set(email, 'existing-auth-id');
    db.challenge = issuedChallenge(email, { role: 'faculty', hallId: null, purpose: 'signin' });

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'faculty' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.userId).toBe('existing-auth-id');
    expect(body.data.profilePersisted).toBe(true);
    expect(db.profileWrites[0]).toMatchObject({ id: 'existing-auth-id', email, hall_id: null });
  });

  it('returns 200 with a signed session when every Supabase write fails', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.challenge = issuedChallenge(email, { role: 'alumni', hallId: null, purpose: 'signin' });
    db.profileLookupError = { message: 'permission denied for table profiles' };
    db.profileUpsertError = { message: 'row-level security policy violated' };
    db.createUserError = { message: 'service role key is missing' };
    db.generateLinkFails = true;

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'alumni' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.ok).toBe(true);
    expect(body.data.verified).toBe(true);
    expect(body.data.profilePersisted).toBe(false);
    expect(body.data.sessionMode).toBe('signed-cookie');
    expect(body.data.degraded).toEqual(expect.arrayContaining(['profile-lookup', 'auth-create', 'auth-lookup']));
    expect(db.sessions[0]).toMatchObject({ email, role: 'alumni', persistence: 'pending', universityId: JU });
    // The message the bug report quoted is gone for good.
    expect(JSON.stringify(body)).not.toContain('could not be loaded');
  });

  it('stays signed in when the GoTrue session exchange fails', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.challenge = issuedChallenge(email, { role: 'faculty', hallId: null, purpose: 'signin' });
    db.sessionExchangeFails = true;

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'faculty' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.sessionMode).toBe('signed-cookie');
    expect(body.data.profilePersisted).toBe(true);
    expect(db.sessions[0]).toMatchObject({ email, persistence: 'supabase' });
  });

  it('defaults the tenant to Jahangirnagar University when the challenge lost it', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.challenge = { ...issuedChallenge(email, { role: 'faculty', hallId: null }), university_id: '' };

    const response = await verifyOtpPost(verifyRequest(email, OTP, { role: 'faculty' }));
    expect(response.status).toBe(200);
    expect(db.profileWrites[0]).toMatchObject({ university_id: JU, email });
  });

  it('still refuses a wrong code and never provisions an account', async () => {
    db.reset();
    const email = 'mmadib2001@gmail.com';
    db.challenge = issuedChallenge(email, { role: 'faculty', hallId: null });

    const response = await verifyOtpPost(verifyRequest(email, '000000', { role: 'faculty' }));
    expect(response.status).toBe(401);
    expect(db.createdUsers).toHaveLength(0);
    expect(db.profileWrites).toHaveLength(0);
    expect(db.sessions).toHaveLength(0);
  });
});
