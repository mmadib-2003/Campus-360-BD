// apps/web/__tests__/verified-session.test.ts
// The signed `campus360_verified_session` cookie and the account context it is
// built from. This is the fallback that keeps a proven mailbox signed in when
// Supabase cannot write the profile or mint its own session.
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  appRolesForVerifiedRole,
  buildVerifiedProfile,
  buildVerifiedSessionPayload,
  normalizeVerifiedRole,
  signVerifiedSessionToken,
  verifyVerifiedSessionToken,
} from '../lib/verified-session';
import { verifyVerifiedSessionTokenEdge } from '../lib/verified-session-edge';
import {
  displayNameFromEmail,
  ensureVerifiedAccount,
  resolveAccountContext,
  syntheticProfileId,
} from '../lib/otp-account';

const EMAIL = 'mmadib2001@gmail.com';
const JU = '08e2b61c-505d-4793-be4d-5ccb6aefc38c';
const HALL = '11111111-2222-4333-8444-555555555555';

function session(overrides: Record<string, unknown> = {}) {
  return buildVerifiedSessionPayload({
    id: 'profile-1',
    email: EMAIL,
    role: 'faculty',
    fullName: 'mmadib2001',
    universityId: JU,
    universityCode: 'JU',
    hallId: HALL,
    programSession: '2010-11',
    persistence: 'supabase',
    ...overrides,
  });
}

afterEach(() => vi.unstubAllEnvs());

describe('verified session token', () => {
  it('round-trips the verified identity and never carries a code', () => {
    const token = signVerifiedSessionToken(session())!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const opened = verifyVerifiedSessionToken(token);
    expect(opened?.email).toBe(EMAIL);
    expect(opened?.role).toBe('faculty');
    expect(opened?.emailVerified).toBe(true);
    expect(opened?.isDemo).toBe(false);
    // Non-students never keep a hall, even if a caller passes one.
    expect(opened?.hallId).toBeNull();
  });

  it('is verifiable by the edge middleware with the same signature', async () => {
    const token = signVerifiedSessionToken(session())!;
    const opened = await verifyVerifiedSessionTokenEdge(token);
    expect(opened?.email).toBe(EMAIL);
    expect(opened?.universityId).toBe(JU);
  });

  it('rejects tampered, unsigned, malformed and expired tokens', async () => {
    const token = signVerifiedSessionToken(session())!;
    const [payload, signature] = token.split('.');
    const flipped = (payload[0] === 'A' ? 'B' : 'A') + payload.slice(1);
    expect(verifyVerifiedSessionToken(`${flipped}.${signature}`)).toBeNull();
    expect(await verifyVerifiedSessionTokenEdge(`${flipped}.${signature}`)).toBeNull();
    expect(verifyVerifiedSessionToken(payload)).toBeNull();
    expect(verifyVerifiedSessionToken('garbage')).toBeNull();
    expect(verifyVerifiedSessionToken(null)).toBeNull();
    expect(verifyVerifiedSessionToken(token, Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('refuses the built-in fallback secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRF_SIGNING_SECRET', '');
    vi.stubEnv('SUPABASE_JWT_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(signVerifiedSessionToken(session())).toBeNull();
    expect(verifyVerifiedSessionToken('anything.anything')).toBeNull();
  });

  it('projects a profile clients can render without a database row', () => {
    const profile = buildVerifiedProfile(session({ role: 'alumni', persistence: 'pending', hallId: HALL }));
    expect(profile).toMatchObject({
      email: EMAIL,
      role: 'alumni',
      university_id: JU,
      hall_id: null,
      email_verified: true,
      is_verified: true,
      is_demo: false,
      trust_level: 'EMAIL_VERIFIED',
      profile_pending: true,
    });
    expect(appRolesForVerifiedRole('alumni')).toEqual(['ALUMNI']);
    expect(normalizeVerifiedRole('ADMIN')).toBe('admin');
    expect(normalizeVerifiedRole('nonsense')).toBe('student');
  });
});

describe('account context resolution', () => {
  it('derives a clean display name from the mailbox', () => {
    expect(displayNameFromEmail(EMAIL)).toBe('mmadib2001');
    expect(displayNameFromEmail('Ayesha.Rahman@juniv.edu')).toBe('Ayesha Rahman');
    expect(displayNameFromEmail('a+b@juniv.edu')).toBe('a');
    expect(displayNameFromEmail('@')).toBe('Campus Member');
  });

  it('keeps the issued challenge authoritative and defaults the tenant to JU', () => {
    const resolved = resolveAccountContext(
      { email: EMAIL, role: 'faculty', universityId: JU, hallId: HALL, programSession: '2010-11' },
      { role: 'student', universityId: 'not-a-uuid', hallId: HALL, programSession: '2024-25' }
    );
    expect(resolved.role).toBe('faculty');
    expect(resolved.hallId).toBeNull();
    expect(resolved.programSession).toBe('2010-11');
    expect(resolved.universityId).toBe(JU);
    expect(resolved.fullName).toBe('mmadib2001');

    const defaulted = resolveAccountContext({ email: EMAIL, role: 'alumni', universityId: 'sluggish-id' });
    expect(defaulted.universityId).toBe(JU);
  });

  it('keeps a student hall and drops malformed identifiers', () => {
    const resolved = resolveAccountContext({
      email: 'student@juniv.edu', role: 'student', universityId: JU, hallId: HALL,
      departmentId: 'dept-1', programSession: '2023-24',
    });
    expect(resolved.hallId).toBe(HALL);
    expect(resolved.departmentId).toBeNull();
    expect(resolved.programSession).toBe('2023-24');
    expect(resolveAccountContext({ email: EMAIL, programSession: '2023-25' }).programSession).toBeNull();
  });

  it('mints a stable placeholder id until the real auth id is known', () => {
    const id = syntheticProfileId(EMAIL);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(syntheticProfileId(' MMADIB2001@gmail.com ')).toBe(id);
    expect(syntheticProfileId('other@gmail.com')).not.toBe(id);
  });

  it('never throws when the admin client is unusable', async () => {
    // The failures are logged for operators on purpose; keep the report clean.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const brokenAdmin = {
      from: () => {
        throw new Error('service role key missing');
      },
      auth: {
        admin: {
          createUser: async () => {
            throw new Error('service role key missing');
          },
          generateLink: async () => {
            throw new Error('service role key missing');
          },
          listUsers: async () => {
            throw new Error('service role key missing');
          },
        },
      },
    };
    const account = await ensureVerifiedAccount(
      brokenAdmin as never,
      resolveAccountContext({ email: EMAIL, role: 'faculty', universityId: JU })
    );
    expect(account.persisted).toBe(false);
    expect(account.synthetic).toBe(true);
    expect(account.userId).toBe(syntheticProfileId(EMAIL));
    expect(account.degraded).toEqual(expect.arrayContaining(['profile-lookup', 'auth-create']));
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('migration 0026', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../supabase/migrations/0026_fix_otp_account_loading_and_gmail_profiles.sql'),
    'utf8'
  );

  it('makes hall, department, student id and session nullable', () => {
    for (const column of ['hall_id', 'department_id', 'student_id', 'program_session']) {
      expect(sql).toContain(`ALTER COLUMN ${column} DROP NOT NULL`);
    }
  });

  it('reads the selected university from metadata before the email domain', () => {
    const metaIndex = sql.indexOf("tenant_id := NULLIF(meta->>'university_id', '')::UUID");
    const domainIndex = sql.indexOf('SELECT d.university_id INTO tenant_id');
    const juIndex = sql.indexOf("WHERE code = 'JU'");
    expect(metaIndex).toBeGreaterThan(-1);
    expect(metaIndex).toBeLessThan(domainIndex);
    expect(domainIndex).toBeLessThan(juIndex);
  });

  it('can never abort auth.users creation', () => {
    expect(sql).toContain('EXCEPTION WHEN OTHERS THEN');
    expect(sql).toContain("RAISE WARNING 'handle_new_user: profile bootstrap skipped");
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE SET');
    expect(sql).toContain('CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });
});
