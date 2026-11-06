// apps/web/__tests__/verify-otp-idempotency.test.ts
// Route-level coverage for the "stuck on /verify-email" fix:
//   • duplicate verify-otp calls succeed idempotently (verified session cookie,
//     or the same code verified within the last 120 seconds),
//   • the signed campus360_otp_challenge cookie backs up a database lookup
//     miss on a cold Vercel instance,
//   • the normal database path still consumes the challenge and redirects.
// No network, no database — everything behind mocks.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.OTP_PEPPER_SECRET = 'test-pepper-for-unit-runs';

const mock = vi.hoisted(() => ({
  supabaseConfigured: true,
  getUser: vi.fn(),
  verifyOtp: vi.fn(),
  generateLink: vi.fn(),
  createUser: vi.fn(),
  demoSession: null as null | { email: string; email_verified?: boolean; role?: string; universityId?: string },
  readActive: vi.fn(),
  readRecent: vi.fn(),
  consume: vi.fn(),
  cookieChallenge: null as null | Record<string, unknown>,
  receiptRaw: null as string | null,
  setReceipt: vi.fn(),
  clearChallenge: vi.fn(),
  profile: null as null | { id: string; university_id: string; program_session?: string | null; role?: string; hall_id?: string | null },
  profileLookupError: null as null | { message: string },
  userRoles: [] as Array<{ role: string }>,
  verifiedSession: null as null | { email: string; emailVerified?: boolean },
  issueVerifiedSession: vi.fn(),
  profileInsert: vi.fn(),
  profileUpsert: vi.fn(),
  profileUpdate: vi.fn(),
  roleInsert: vi.fn(),
  roleUpsert: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => mock.supabaseConfigured }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock('@/lib/auth-log', () => ({ authLog: vi.fn(), authError: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: () => ({ get: vi.fn(() => undefined), set: vi.fn(), delete: vi.fn() }),
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({ auth: { getUser: mock.getUser, verifyOtp: mock.verifyOtp } }),
  createSupabaseAdminClient: () => ({
    from(table: string) {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mock.profile, error: mock.profileLookupError }) }) }),
          update: (payload: Record<string, unknown>) => {
            mock.profileUpdate(payload);
            return { eq: async () => ({ error: null }) };
          },
          insert: mock.profileInsert,
          upsert: mock.profileUpsert,
        };
      }
      if (table === 'user_roles') {
        return {
          // Roles are read through the explicit user_id relationship: embedding
          // them from profiles is ambiguous (user_id AND granted_by).
          select: () => ({ eq: async () => ({ data: mock.userRoles, error: null }) }),
          insert: mock.roleInsert,
          upsert: mock.roleUpsert,
        };
      }
      if (table === 'universities') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { code: 'DU', name_en: 'University of Dhaka' }, error: null }) }) }) };
      }
      return { insert: async () => ({ error: null }) };
    },
    auth: { admin: { generateLink: mock.generateLink, createUser: mock.createUser, listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })) } },
  }),
}));
vi.mock('@/lib/verified-session', () => ({
  readVerifiedSession: () => mock.verifiedSession,
  issueVerifiedSession: mock.issueVerifiedSession,
}));
vi.mock('@/lib/demo-auth', () => ({
  DEMO_OTP_COOKIE: 'campus360_demo_otp',
  demoNextStep: (role: string) => (role === 'admin' ? '/admin/console' : '/feed'),
  normalizeDemoRole: (role: unknown) => role ?? 'student',
  readSignedDemoSession: () => mock.demoSession,
  verifyDemoChallenge: vi.fn(() => ({ ok: false, error: 'no demo challenge', errorBn: '', status: 404 })),
}));
vi.mock('@/lib/otp-store', () => ({
  readActiveOtpChallenge: mock.readActive,
  readRecentVerifiedOtpChallenge: mock.readRecent,
  consumeOtpChallenge: mock.consume,
  clearProfileDemoOtp: vi.fn(async () => undefined),
  hasAttemptsLeft: () => true,
  isChallengeExpired: () => false,
  recordOtpFailure: vi.fn(async () => undefined),
}));
vi.mock('@/lib/otp-challenge-cookie', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/otp-challenge-cookie')>();
  return {
    ...actual,
    readOtpChallengeCookie: () => mock.cookieChallenge,
    readOtpVerifiedReceiptRaw: () => mock.receiptRaw,
    setOtpVerifiedReceipt: mock.setReceipt,
    clearOtpChallengeCookie: mock.clearChallenge,
  };
});

import { POST } from '@/app/api/auth/verify-otp/route';
import { hashOtp } from '@/lib/otp-crypto';
import { signOtpVerifiedReceipt } from '@/lib/otp-challenge-cookie';

const EMAIL = 'student.du@du.ac.bd';
const UNIV = '9b0f2a6e-0000-4000-8000-000000000001';
// Registry ids are UUIDs in production; the provisioning layer validates them
// so a malformed hall/department can never poison the whole profile write.
const HALL = '9b0f2a6e-0000-4000-8000-0000000000a1';
const DEPT = '9b0f2a6e-0000-4000-8000-0000000000b2';
const CODE = '482913';

function post(email: string, otp: string, context: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...context, email, otp }),
  });
}

beforeEach(() => {
  mock.supabaseConfigured = true;
  mock.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  mock.verifyOtp.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: EMAIL } }, error: null });
  mock.generateLink.mockReset().mockResolvedValue({ data: { properties: { hashed_token: 'tok' } }, error: null });
  mock.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'new-1' } }, error: null });
  mock.demoSession = null;
  mock.readActive.mockReset().mockResolvedValue(null);
  mock.readRecent.mockReset().mockResolvedValue(null);
  mock.consume.mockReset().mockResolvedValue(undefined);
  mock.cookieChallenge = null;
  mock.receiptRaw = null;
  mock.setReceipt.mockReset();
  mock.clearChallenge.mockReset();
  mock.profile = { id: 'user-1', university_id: UNIV, program_session: '2023-24' };
  mock.profileLookupError = null;
  mock.userRoles = [];
  mock.verifiedSession = null;
  mock.issueVerifiedSession.mockReset().mockImplementation((input) => input);
  mock.profileInsert.mockReset().mockResolvedValue({ error: null });
  mock.profileUpsert.mockReset().mockResolvedValue({ error: null });
  mock.profileUpdate.mockReset();
  mock.roleInsert.mockReset().mockResolvedValue({ error: null });
  mock.roleUpsert.mockReset().mockResolvedValue({ error: null });
});

describe('verify-otp idempotency — duplicate calls never 404', () => {
  it('returns alreadyVerified when the caller holds a verified session for the email', async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { email: EMAIL, email_confirmed_at: '2026-11-05T00:00:00.000Z' } },
      error: null,
    });
    // The challenge row is already consumed — the old code answered 404 here.
    mock.readActive.mockResolvedValue(null);

    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.alreadyVerified).toBe(true);
    expect(body.data.ok).toBe(true);
    expect(body.data.redirectTo).toBe('/');
    // The consumed challenge is never even looked up.
    expect(mock.readActive).not.toHaveBeenCalled();
  });

  it('returns alreadyVerified for the same code verified within 120s, re-minting the session', async () => {
    mock.receiptRaw = signOtpVerifiedReceipt({ email: EMAIL, otpHash: hashOtp(EMAIL, CODE), verifiedAt: Date.now() - 3_000 });
    mock.readRecent.mockResolvedValue({ id: 'cha-1', verified_at: new Date().toISOString() });

    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.alreadyVerified).toBe(true);
    expect(body.data.redirectTo).toBe('/');
    expect(mock.readRecent).toHaveBeenCalledWith(expect.anything(), EMAIL, 120);
    // No session cookie survived the first response → a fresh one is minted.
    expect(mock.generateLink).toHaveBeenCalled();
    expect(mock.verifyOtp).toHaveBeenCalled();
  });

  it('does not treat a different code as idempotent', async () => {
    mock.receiptRaw = signOtpVerifiedReceipt({ email: EMAIL, otpHash: hashOtp(EMAIL, CODE), verifiedAt: Date.now() });
    const response = await POST(post(EMAIL, '000000'));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('CHALLENGE_NOT_FOUND');
  });

  it('does not treat a receipt older than 120s as idempotent', async () => {
    mock.receiptRaw = signOtpVerifiedReceipt({ email: EMAIL, otpHash: hashOtp(EMAIL, CODE), verifiedAt: Date.now() - 121_000 });
    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(404);
  });

  it('returns alreadyVerified for a duplicate demo-mode call with a signed demo session', async () => {
    mock.supabaseConfigured = false;
    mock.demoSession = { email: EMAIL, email_verified: true, role: 'student', universityId: UNIV };
    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    expect((await response.json()).data.alreadyVerified).toBe(true);
  });
});

describe('verify-otp serverless cookie fallback', () => {
  const cookiePayload = {
    email: EMAIL,
    otpHash: hashOtp(EMAIL, CODE),
    salt: 'nonce',
    expiresAt: new Date(Date.now() + 240_000).toISOString(),
    universityId: UNIV,
    hallId: HALL,
    departmentId: DEPT,
    role: 'student',
    challengeId: 'cha-9',
    iat: Date.now(),
  };

  it('verifies against the signed cookie when the database lookup misses', async () => {
    mock.readActive.mockResolvedValue(null); // cold start / RLS miss
    mock.cookieChallenge = cookiePayload;

    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.viaCookieFallback).toBe(true);
    expect(body.data.redirectTo).toBe('/feed');
    // The database row is retired best-effort, the cookie cleared, receipt sealed.
    expect(mock.consume).toHaveBeenCalledWith(expect.anything(), 'cha-9', { verified: true, clearHash: true });
    expect(mock.clearChallenge).toHaveBeenCalled();
    expect(mock.setReceipt).toHaveBeenCalledWith(EMAIL, hashOtp(EMAIL, CODE));
    expect(mock.verifyOtp).toHaveBeenCalled();
  });

  it('rejects a wrong code against the cookie backup', async () => {
    mock.readActive.mockResolvedValue(null);
    mock.cookieChallenge = cookiePayload;
    const response = await POST(post(EMAIL, '000000'));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('INVALID_OTP');
  });

  it('provisions a brand-new user from the cookie payload and redirects to onboarding', async () => {
    mock.readActive.mockResolvedValue(null);
    mock.cookieChallenge = cookiePayload;
    mock.profile = null; // no profile row yet
    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.redirectTo).toBe('/onboarding');
    expect(mock.createUser).toHaveBeenCalled();
  });
});

describe('verify-otp normal database path', () => {
  const challengeRow = {
    id: 'cha-1',
    email: EMAIL,
    university_id: UNIV,
    otp_hash: hashOtp(EMAIL, CODE),
    attempt_count: 0,
    max_attempts: 5,
    expires_at: new Date(Date.now() + 240_000).toISOString(),
    verified_at: null,
    created_at: new Date().toISOString(),
    signup_payload: { role: 'student', hallId: HALL },
  };

  it('consumes the challenge, seals the receipt and returns redirectTo', async () => {
    mock.readActive.mockResolvedValue(challengeRow);
    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.challengeConsumed).toBe(true);
    expect(body.data.redirectTo).toBe('/feed');
    expect(mock.consume).toHaveBeenCalledWith(expect.anything(), 'cha-1', { verified: true, clearHash: true });
    expect(mock.clearChallenge).toHaveBeenCalled();
    expect(mock.setReceipt).toHaveBeenCalledWith(EMAIL, hashOtp(EMAIL, CODE));
  });

  it('still answers 404 when there is no challenge, no cookie and no session', async () => {
    const response = await POST(post(EMAIL, CODE));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('CHALLENGE_NOT_FOUND');
  });
});


describe('verify-otp authoritative role/session metadata', () => {
  const cookie = {
    email: 'faculty@gmail.com', otpHash: hashOtp('faculty@gmail.com', CODE), salt: 'nonce',
    expiresAt: new Date(Date.now() + 240_000).toISOString(), universityId: UNIV,
    role: 'faculty', hallId: HALL, programSession: '2023-24', purpose: 'signup',
    fullName: 'Faculty Person', studentId: 'DU-FAC-001', challengeId: 'cha-role', iat: Date.now(),
  };

  it('persists faculty session and null hall from the signed challenge, not the request body', async () => {
    mock.profile = null;
    mock.cookieChallenge = cookie;
    const response = await POST(post(cookie.email, CODE, { role: 'faculty', programSession: '2023-24', hallId: null }));
    // The issued challenge has no hall for faculty; a forged hall in the body
    // must not replace it. The request is rejected before provisioning.
    expect(response.status).toBe(409);
    expect(mock.profileUpsert).not.toHaveBeenCalled();

    mock.cookieChallenge = { ...cookie, hallId: null };
    const valid = await POST(post(cookie.email, CODE, { role: 'faculty', programSession: '2023-24', hallId: null }));
    expect(valid.status).toBe(200);
    expect(mock.profileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      role: 'faculty', hall_id: null, program_session: '2023-24', onboarding_completed: true,
    }), { onConflict: 'id' });
    expect(mock.roleUpsert).toHaveBeenCalledWith(expect.objectContaining({ role: 'FACULTY' }),
      { onConflict: 'user_id,university_id,role', ignoreDuplicates: true });
  });

  it('persists student hall and session on the cookie fallback path', async () => {
    mock.profile = null;
    mock.cookieChallenge = { ...cookie, email: EMAIL, otpHash: hashOtp(EMAIL, CODE), role: 'student', hallId: HALL };
    const response = await POST(post(EMAIL, CODE, { role: 'student', programSession: '2023-24', hallId: HALL }));
    expect(response.status).toBe(200);
    expect(mock.profileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      role: 'student', hall_id: HALL, program_session: '2023-24',
    }), { onConflict: 'id' });
  });

  it('rejects role/session changes against an active issued challenge before consuming it', async () => {
    mock.readActive.mockResolvedValue({ id: 'cha-1', email: EMAIL, university_id: UNIV,
      otp_hash: hashOtp(EMAIL, CODE), attempt_count: 0, max_attempts: 5,
      expires_at: new Date(Date.now() + 240_000).toISOString(), verified_at: null,
      created_at: new Date().toISOString(), signup_payload: { role: 'student', hallId: HALL, programSession: '2023-24' } });
    const response = await POST(post(EMAIL, CODE, { role: 'alumni' }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('OTP_CONTEXT_MISMATCH');
    expect(mock.consume).not.toHaveBeenCalled();
    const sessionChange = await POST(post(EMAIL, CODE, { programSession: '2024-25' }));
    expect(sessionChange.status).toBe(409);
  });

  it('refuses account creation when a signup challenge lacks a valid session', async () => {
    mock.profile = null;
    mock.cookieChallenge = { ...cookie, programSession: null };
    const response = await POST(post(cookie.email, CODE));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('PROGRAM_SESSION_REQUIRED');
    expect(mock.createUser).not.toHaveBeenCalled();
  });

  it('never replaces an existing administrative role from a public login selector', async () => {
    mock.profile = { id: 'admin-1', university_id: UNIV, role: 'admin', program_session: '2020-21' };
    mock.userRoles = [{ role: 'ADMIN' }];
    mock.readActive.mockResolvedValue({ id: 'cha-admin', email: EMAIL, university_id: UNIV,
      otp_hash: hashOtp(EMAIL, CODE), attempt_count: 0, max_attempts: 5,
      expires_at: new Date(Date.now() + 240_000).toISOString(), verified_at: null,
      created_at: new Date().toISOString(), signup_payload: { role: 'faculty', hallId: null, programSession: '2023-24' } });
    const response = await POST(post(EMAIL, CODE, { role: 'faculty' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.role).toBe('admin');
    expect(body.data.redirectTo).toBe('/admin/console');
    expect(mock.roleUpsert).not.toHaveBeenCalled();
    expect(mock.profileUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ role: expect.anything() }));
    expect(mock.profileUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ hall_id: expect.anything() }));
  });

  it('still signs the user in when the profile write fails, and reports the degraded step', async () => {
    mock.profile = null;
    mock.cookieChallenge = { ...cookie, hallId: null };
    mock.profileUpsert.mockResolvedValue({ error: { message: 'database unavailable' } });
    const response = await POST(post(cookie.email, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.ok).toBe(true);
    expect(body.data.verified).toBe(true);
    expect(body.data.profilePersisted).toBe(false);
    expect(body.data.degraded).toContain('profile-upsert');
    // The verified identity is sealed into the signed session cookie instead.
    expect(mock.issueVerifiedSession).toHaveBeenCalledWith(expect.objectContaining({
      email: cookie.email, role: 'faculty', persistence: 'pending',
    }));
  });

  it('never fails when the profile lookup itself errors (the production dead end)', async () => {
    mock.profileLookupError = { message: 'Could not embed because more than one relationship was found' };
    mock.profile = null;
    mock.cookieChallenge = { ...cookie, hallId: null };
    const response = await POST(post(cookie.email, CODE));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.verified).toBe(true);
    expect(body.data.degraded).toContain('profile-lookup');
    expect(mock.issueVerifiedSession).toHaveBeenCalled();
  });
});
