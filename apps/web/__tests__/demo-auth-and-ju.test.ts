// apps/web/__tests__/demo-auth-and-ju.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  JU_CANONICAL_IIT_DEPARTMENT_ID,
  JU_CANONICAL_UNIVERSITY_ID,
  JU_OFFICIAL_DEPARTMENTS,
  QUICK_DEMO_ACCOUNTS,
  findDemoAccount,
} from '@/lib/modules/demo-data';
import {
  signDemoSessionToken,
  verifyDemoSessionToken,
} from '@/lib/demo-auth';
import {
  isDemoEmail,
  verifyDemoSessionTokenEdge,
  type SignedDemoSessionPayload,
} from '@/lib/demo-session-edge';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('Task 1 — Demo Sign-In & signed session cookie', () => {
  it('defines the 4 canonical @demo.campus360.bd quick demo identities', () => {
    expect(QUICK_DEMO_ACCOUNTS.map((a) => a.email)).toEqual([
      'student@demo.campus360.bd',
      'faculty@demo.campus360.bd',
      'admin@demo.campus360.bd',
      'alumni@demo.campus360.bd',
    ]);
    for (const email of [
      'student@demo.campus360.bd',
      'faculty@demo.campus360.bd',
      'admin@demo.campus360.bd',
      'alumni@demo.campus360.bd',
      'student@demo.campus360.test',
    ]) {
      expect(isDemoEmail(email)).toBe(true);
      expect(findDemoAccount(email)?.universityCode).toBe('JU');
    }
    expect(isDemoEmail('student@juniv.edu')).toBe(false);
  });

  it('signs and verifies campus360_demo_session across both Node and Edge verifiers', async () => {
    const now = Date.now();
    const payload: SignedDemoSessionPayload = {
      id: 'd0000000-0000-4000-8000-000000000103',
      email: 'admin@demo.campus360.bd',
      role: 'admin',
      name: 'Demo Admin',
      fullName: 'Demo Admin',
      studentId: 'JU-ADM-0103',
      university_id: JU_CANONICAL_UNIVERSITY_ID,
      universityId: JU_CANONICAL_UNIVERSITY_ID,
      universityCode: 'JU',
      department_id: JU_CANONICAL_IIT_DEPARTMENT_ID,
      departmentCode: 'IIT',
      email_verified: true,
      is_demo: true,
      iat: now,
      exp: now + 60_000,
    };

    const token = signDemoSessionToken(payload);
    expect(token).toContain('.');

    const nodeVerified = verifyDemoSessionToken(token);
    expect(nodeVerified).toMatchObject({
      id: payload.id,
      email: 'admin@demo.campus360.bd',
      role: 'admin',
      university_id: JU_CANONICAL_UNIVERSITY_ID,
      department_id: JU_CANONICAL_IIT_DEPARTMENT_ID,
      email_verified: true,
      is_demo: true,
    });

    const edgeVerified = await verifyDemoSessionTokenEdge(token);
    expect(edgeVerified).toMatchObject({
      id: payload.id,
      email: 'admin@demo.campus360.bd',
      role: 'admin',
      email_verified: true,
      is_demo: true,
    });

    // Rejects tampered signatures
    const tampered = `${token.slice(0, -2)}xx`;
    expect(verifyDemoSessionToken(tampered)).toBeNull();
    expect(await verifyDemoSessionTokenEdge(tampered)).toBeNull();

    // Rejects expired tokens
    const expired = signDemoSessionToken({ ...payload, exp: now - 1000 });
    expect(verifyDemoSessionToken(expired)).toBeNull();
    expect(await verifyDemoSessionTokenEdge(expired)).toBeNull();
  });

  it('never returns 500/503 "Demo sign-in is temporarily unavailable" in demo-signin route', () => {
    const routeSrc = read('apps/web/app/api/auth/demo-signin/route.ts');
    expect(routeSrc).not.toContain('Demo sign-in is temporarily unavailable');
    expect(routeSrc).toContain('issueSignedDemoSession');
    expect(routeSrc).toContain("role === 'admin' ? '/admin/console' : '/feed'");
  });
});

describe('Task 2 — Jahangirnagar University 38 official academic units', () => {
  it('ships all 38 official JU academic units (4 Institutes + 34 Departments across 6 Faculties)', () => {
    expect(JU_OFFICIAL_DEPARTMENTS).toHaveLength(38);

    const byFaculty = new Map<string, number>();
    for (const unit of JU_OFFICIAL_DEPARTMENTS) {
      byFaculty.set(unit.faculty_en, (byFaculty.get(unit.faculty_en) ?? 0) + 1);
    }

    expect(Object.fromEntries(byFaculty)).toEqual({
      Institutes: 4,
      'Faculty of Mathematical and Physical Sciences': 7,
      'Faculty of Biological Sciences': 7,
      'Faculty of Social Sciences': 6,
      'Faculty of Arts and Humanities': 9,
      'Faculty of Business Studies': 4,
      'Faculty of Law': 1,
    });
  });

  it('keeps migration 0021 transactional and includes all 4 demo accounts + JU units', () => {
    const sql = read('supabase/migrations/0021_fix_demo_auth_and_ju_departments.sql');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('student@demo.campus360.bd');
    expect(sql).toContain('faculty@demo.campus360.bd');
    expect(sql).toContain('admin@demo.campus360.bd');
    expect(sql).toContain('alumni@demo.campus360.bd');
    expect(sql).toContain('IBA-JU');
    expect(sql).toContain('ICLC');
    expect(sql).toContain('IRS');
    expect(sql).toContain('Statistics and Data Science');
    expect(sql).toContain('Law and Justice');
  });
});

describe('Task 3 — Navbar anchoring, email display, and module labels', () => {
  it('anchors AppShell header at top-0 z-40 (below the z-50 drawer) and avoids truncating demo emails', () => {
    const shell = read('apps/web/components/shell/AppShell.tsx');
    // The mobile slide-over drawer and its backdrop sit at z-50 so they can
    // cover the sticky navbar while open; the navbar itself stays anchored.
    expect(shell).toContain('sticky top-0 inset-x-0 z-40 w-full');

    const quickLogin = read('apps/web/components/auth/QuickDemoLogin.tsx');
    expect(quickLogin).toContain('break-all');
    expect(quickLogin).not.toContain('truncate w-full');
  });

  it('uses the concise Mentorship label and exposes Skill Exchange', () => {
    const en = JSON.parse(read('apps/web/messages/en.json')) as { ui: Record<string, string> };
    const bn = JSON.parse(read('apps/web/messages/bn.json')) as { ui: Record<string, string> };
    expect(en.ui.moduleMentorship).toBe('Mentorship');
    expect(en.ui.moduleSkills).toBe('Skill Exchange');
    expect(bn.ui.moduleMentorship).toBe('মেন্টরশিপ');
    expect(bn.ui.moduleSkills).toBe('স্কিল এক্সচেঞ্জ');
  });
});
