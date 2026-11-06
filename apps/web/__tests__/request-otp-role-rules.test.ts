import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.OTP_PEPPER_SECRET = 'test-pepper-for-unit-runs';
process.env.NEXT_PUBLIC_AUTH_MODE = 'live';

const mock = vi.hoisted(() => ({
  configured: true,
  smtp: true,
  domainError: null as null | { message: string },
  universityError: null as null | { message: string },
  hallError: null as null | { message: string },
  createChallenge: vi.fn(),
  sendOtp: vi.fn(),
  setCookie: vi.fn(),
  issueDemo: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({ isSupabaseServerConfigured: () => mock.configured }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, headers: {} }) }));
vi.mock('@/lib/auth-log', () => ({ authLog: vi.fn(), authError: vi.fn() }));
vi.mock('@/lib/demo-auth', () => ({ issueDemoChallenge: mock.issueDemo }));
vi.mock('@/lib/otp-email', () => ({ isSmtpConfigured: () => mock.smtp, sendOtpEmail: mock.sendOtp }));
vi.mock('@/lib/otp-challenge-cookie', () => ({ setOtpChallengeCookie: mock.setCookie, clearOtpChallengeCookie: vi.fn() }));
vi.mock('@/lib/otp-store', () => ({
  createOtpChallenge: mock.createChallenge,
  deleteOtpChallenge: vi.fn(async () => undefined),
  isOtpRequestInCooldown: vi.fn(async () => false),
  markOtpEmailSent: vi.fn(async () => undefined),
  storeProfileDemoOtp: vi.fn(async () => undefined),
}));
vi.mock('@/lib/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
        insert: async () => ({ error: null }),
        maybeSingle: async () => {
          if (table === 'university_email_domains') {
            if (mock.domainError) return { data: null, error: mock.domainError };
            return { data: filters.domain === 'du.ac.bd' ? {
              university_id: UNIV, domain: 'du.ac.bd', universities: { code: 'DU', name_en: 'University of Dhaka' },
            } : null, error: null };
          }
          if (table === 'universities') {
            if (mock.universityError) return { data: null, error: mock.universityError };
            return { data: filters.id === UNIV ? { id: UNIV, code: 'DU', name_en: 'University of Dhaka' } : null, error: null };
          }
          if (table === 'university_halls') {
            if (mock.hallError) return { data: null, error: mock.hallError };
            return { data: filters.id === HALL && filters.university_id === UNIV ? { id: HALL } : null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  }),
}));

import { POST } from '@/app/api/auth/request-otp/route';
import { DEMO_UNIVERSITY_HALLS } from '@/lib/modules/demo-data';

const UNIV = '9b0f2a6e-0000-4000-8000-000000000001';
const HALL = '9b0f2a6e-0000-4000-8000-000000000002';
function post(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/request-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const signup = { universityId: UNIV, purpose: 'signup', programSession: '2023-24',
  signupPayload: { fullName: 'Test Person', studentId: 'DU-2023-001' } };

beforeEach(() => {
  mock.configured = true; mock.smtp = true;
  mock.domainError = null; mock.universityError = null; mock.hallError = null;
  mock.createChallenge.mockReset().mockResolvedValue({ ok: true, id: 'challenge-1',
    expiresAt: new Date(Date.now() + 300_000).toISOString(), secondsRemaining: 300 });
  mock.sendOtp.mockReset().mockResolvedValue({ ok: true, provider: 'gmail', messageId: 'msg-1' });
  mock.setCookie.mockReset(); mock.issueDemo.mockReset();
});

describe('request-otp role and email rules', () => {
  it.each(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'])(
    'sends a real 6-digit OTP to faculty %s addresses and binds a null hall/session', async (domain) => {
      const email = `faculty@${domain}`;
      const response = await POST(post({ ...signup, email, role: 'faculty', hallId: null }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.delivery).toBe('email');
      expect(body.data.demoCode).toBeUndefined();
      expect(mock.sendOtp).toHaveBeenCalledWith(expect.objectContaining({ to: email, code: expect.stringMatching(/^\d{6}$/) }));
      expect(mock.createChallenge).toHaveBeenCalledWith(expect.objectContaining({
        universityId: UNIV, signupPayload: expect.objectContaining({ role: 'faculty', hallId: null, programSession: '2023-24' }),
      }));
      expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ role: 'faculty', hallId: null, programSession: '2023-24', purpose: 'signup' }));
    }
  );

  it('accepts alumni personal email without a hall', async () => {
    const response = await POST(post({ ...signup, email: 'alumni@hotmail.com', role: 'alumni', hallId: null }));
    expect(response.status).toBe(200);
    expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ role: 'alumni', hallId: null }));
  });

  it('still rejects student Gmail and requires an active hall at the selected university', async () => {
    const gmail = await POST(post({ ...signup, email: 'student@gmail.com', role: 'student', hallId: HALL }));
    expect(gmail.status).toBe(403);
    expect((await gmail.json()).error.code).toBe('DOMAIN_NOT_WHITELISTED');
    const missing = await POST(post({ ...signup, email: 'student@du.ac.bd', role: 'student' }));
    expect(missing.status).toBe(400);
    const valid = await POST(post({ ...signup, email: 'student@du.ac.bd', role: 'student', hallId: HALL }));
    expect(valid.status).toBe(200);
    expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ role: 'student', hallId: HALL }));
  });

  it('rejects a hall for faculty, missing signup session, and malformed sessions before issuing a code', async () => {
    for (const body of [
      { ...signup, email: 'faculty@gmail.com', role: 'faculty', hallId: HALL },
      { ...signup, programSession: undefined, email: 'faculty@gmail.com', role: 'faculty' },
      { ...signup, programSession: '2023-25', email: 'faculty@gmail.com', role: 'faculty' },
    ]) {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
    }
    expect(mock.createChallenge).not.toHaveBeenCalled();
    expect(mock.sendOtp).not.toHaveBeenCalled();
  });

  it('keeps the separate institutional admin login compatible', async () => {
    const response = await POST(post({ email: 'admin@du.ac.bd', universityId: UNIV, role: 'admin', signupPayload: { role: 'admin', fullName: 'Admin' } }));
    expect(response.status).toBe(200);
    expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', hallId: null }));
  });

  it('supports personal-email OTP in local preview without changing quick-demo login', async () => {
    mock.configured = false;
    const response = await POST(post({ ...signup, universityId: 'demo-univ-du', email: 'faculty@gmail.com', role: 'faculty', hallId: null }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.demo).toBe(true);
    expect(body.data.demoCode).toMatch(/^\d{6}$/);
    expect(mock.issueDemo).not.toHaveBeenCalled();
    expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ role: 'faculty', hallId: null, programSession: '2023-24' }));
  });

  it('keeps student preview halls mandatory and scoped to the campus', async () => {
    mock.configured = false;
    const hall = DEMO_UNIVERSITY_HALLS.find((entry) => entry.universityCode === 'DU')!;
    const response = await POST(post({ ...signup, universityId: 'demo-univ-du', email: 'student@du.ac.bd', role: 'student', hallId: hall.id }));
    expect(response.status).toBe(200);
    expect(mock.setCookie).toHaveBeenCalledWith(expect.objectContaining({ hallId: hall.id }));
  });
});
