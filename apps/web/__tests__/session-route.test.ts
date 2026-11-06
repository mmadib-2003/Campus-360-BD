import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionMissingError } from '@supabase/supabase-js';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), demo: null as any, verified: null as any }));
vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => true }));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseRouteClient: () => ({ auth: { getUser: mock.getUser } }),
  createSupabaseAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}));
vi.mock('@/lib/verified-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/verified-session')>();
  return { ...actual, readVerifiedSession: () => mock.verified, issueVerifiedSession: (payload: unknown) => payload };
});
vi.mock('@/lib/demo-auth', () => ({
  readSignedDemoSession: () => mock.demo,
  isDemoEmail: () => false,
  DEMO_ROLE_DEFAULTS: {},
  buildDemoProfileFromSession: () => ({}),
}));
import { GET } from '@/app/api/auth/session/route';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test');
  mock.demo = null;
  mock.verified = null;
  mock.getUser.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe('verified session route', () => {
  it('returns signed out when there is genuinely no auth session', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.authenticated).toBe(false);
  });
  it('does not report signed out when Supabase is unavailable', async () => {
    mock.getUser.mockRejectedValue(new Error('network down'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).success).toBe(false);
  });
  it('also treats returned upstream errors as failures rather than sign-outs', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'unavailable' } });
    expect((await GET()).status).toBe(503);
  });

  it('signs the user in from the verified OTP cookie when Supabase has no session', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    mock.verified = {
      id: 'profile-1',
      email: 'mmadib2001@gmail.com',
      role: 'faculty',
      fullName: 'mmadib2001',
      studentId: null,
      universityId: '08e2b61c-505d-4793-be4d-5ccb6aefc38c',
      universityCode: 'JU',
      universityName: 'Jahangirnagar University',
      hallId: null,
      departmentId: null,
      programId: null,
      programSession: '2010-11',
      emailVerified: true,
      trustLevel: 'EMAIL_VERIFIED',
      persistence: 'supabase',
      needsOnboarding: false,
      isDemo: false,
      iat: Date.now(),
      exp: Date.now() + 60_000,
    };
    const response = await GET();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.authenticated).toBe(true);
    expect(data.verifiedCookie).toBe(true);
    expect(data.profile.email).toBe('mmadib2001@gmail.com');
    expect(data.profile.email_verified).toBe(true);
    expect(data.profile.hall_id).toBeNull();
    expect(data.profile.is_demo).toBe(false);
    expect(data.roles).toEqual([
      { role: 'FACULTY', university_id: '08e2b61c-505d-4793-be4d-5ccb6aefc38c' },
    ]);
  });

  it('keeps the user signed in from the cookie even when Supabase is down', async () => {
    mock.getUser.mockRejectedValue(new Error('network down'));
    mock.verified = {
      id: 'profile-2', email: 'alumni@gmail.com', role: 'alumni', fullName: 'alumni',
      studentId: null, universityId: '08e2b61c-505d-4793-be4d-5ccb6aefc38c', universityCode: null,
      universityName: null, hallId: null, departmentId: null, programId: null, programSession: null,
      emailVerified: true, trustLevel: 'EMAIL_VERIFIED', persistence: 'supabase', needsOnboarding: true,
      isDemo: false, iat: Date.now(), exp: Date.now() + 60_000,
    };
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.authenticated).toBe(true);
  });
});
