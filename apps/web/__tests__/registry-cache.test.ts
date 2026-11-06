// apps/web/__tests__/registry-cache.test.ts
// ============================================================================
// Guard for the registry contract: five read endpoints that the signup form and
// the admin panel depend on. These are static-source assertions on purpose —
// the failure being defended against ("the dropdowns are empty in production")
// is invisible to a unit test that mocks Supabase, because the cause lives in
// the route's cache headers, in a swallowed 500, or in a seed that filters on a
// column the table does not have.
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');

const read = (rel: string) => readFileSync(path.join(WEB_ROOT, rel), 'utf8');
const readRepo = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

/** Every route that answers a registry read. */
const REGISTRY_ROUTES = [
  'app/api/universities/route.ts',
  'app/api/universities/[id]/route.ts',
  'app/api/halls/route.ts',
  'app/api/departments/route.ts',
  'app/api/programs/route.ts',
];

/** Text of a route's GET handler, i.e. the responses that may be cached. */
function GETBody(src: string): string {
  const start = src.indexOf('export async function GET');
  expect(start, 'route must export a GET handler').toBeGreaterThanOrEqual(0);
  const rest = src.slice(start);
  const next = rest.search(/\nexport /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('registry route caching', () => {
  it.each(REGISTRY_ROUTES)('%s opts out of the Next.js route cache exactly once', (rel) => {
    const src = read(rel);
    expect(src.match(/export const dynamic = 'force-dynamic';?/g) ?? []).toHaveLength(1);
    expect(src).not.toMatch(/^\s*export const revalidate/m);
  });

  it.each(REGISTRY_ROUTES)('%s returns no-store on every GET response', (rel) => {
    const body = GETBody(read(rel));
    const returns = [...body.matchAll(/return api(?:Success|Error)\(([\s\S]*?)\);/g)];
    expect(returns.length, `${rel} should answer with apiSuccess/apiError`).toBeGreaterThan(0);
    for (const [, args] of returns) {
      expect(args, `${rel}: a GET response without REGISTRY_NO_STORE can be served from CDN`).toContain(
        'REGISTRY_NO_STORE'
      );
    }
  });

  it('documents the two-layer contract next to the helper', () => {
    const src = read('lib/registry-cache.ts');
    expect(src).toContain("'Cache-Control': 'no-store, max-age=0'");
    expect(src).toContain('[campus360:registry]');
  });
});

describe('registry failure visibility', () => {
  it.each(REGISTRY_ROUTES)('%s logs the PostgREST fault on its FETCH_FAILED path', (rel) => {
    const src = read(rel);
    if (!src.includes('FETCH_FAILED')) return; // routes that never surface one
    expect(src).toContain('registryError(');
  });

  it('the signup form does not swallow registry errors any more', () => {
    const src = read('app/signup/page.tsx');
    expect(src).not.match(/^\s*\.catch\(\(\) => undefined\)/m); // only in prose, never in code
    expect(src).toContain('cache: \'no-store\'');
    expect(src).toContain('Try again');
  });
});

describe('registry schema assumptions the routes and seeds rely on', () => {
  it('departments is not filtered by a column it does not have', () => {
    const migration = readRepo('supabase/migrations/0002_core_tenancy_and_auth.sql');
    const deptTable = migration.slice(migration.indexOf('CREATE TABLE departments'));
    expect(deptTable.slice(0, 900)).not.toContain('is_active');
    expect(read('app/api/departments/route.ts')).not.toContain(".eq('is_active'");
  });

  it('0012 ships the program registry, the profile link and its read policy', () => {
    const sql = readRepo('supabase/migrations/0012_academic_programs.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.academic_programs');
    expect(sql).toContain('code TEXT NOT NULL UNIQUE');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS program_id UUID');
    expect(sql).toContain('REFERENCES public.academic_programs(id) ON DELETE SET NULL');
    expect(sql).toContain('Public read academic programs');
    // Signup needs the list before a session exists, so the policy must be SELECT-only
    // and the reference data must ship inside the migration.
    expect(sql).toContain('FOR SELECT');
    expect(sql).toContain("ON CONFLICT (code) DO NOTHING");
    for (const cycle of ['UNDERGRADUATE', 'GRADUATE', 'DOCTORAL', 'DIPLOMA']) {
      expect(sql).toContain(cycle);
    }
  });

  it('signup persists program_id through verify-otp and profile updates allow it', () => {
    // Provisioning moved into lib/otp-account.ts so /api/auth/session can reuse
    // it to repair an account whose first write failed.
    expect(read('app/api/auth/verify-otp/route.ts')).toContain('ensureVerifiedAccount');
    expect(read('lib/otp-account.ts')).toContain('program_id: context.programId');
    expect(read('app/api/profile/route.ts')).toContain('allowedUpdates.program_id = body.program_id');
  });
});

describe('seed data hygiene', () => {
  const seeds = [
    'supabase/seed/seed_university_halls.sql',
    'supabase/seed/seed_departments_by_faculty.sql',
  ];

  it.each(seeds)('%s is idempotent and transactional', (rel) => {
    const sql = readRepo(rel);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    // Idempotent either way: halls/departments upsert the canonical spelling,
    // the demo blocks skip rows that already exist.
    expect(sql).toMatch(/ON CONFLICT[\s\S]*DO (NOTHING|UPDATE)/);
  });

  // A Bengali string typed with the wrong keyboard layout is the one
  // corruption class that is invisible in review and glaring in the UI: the
  // Devanagari block shares no letters with Bengali, so any hit is a typo.
  it.each(seeds)('%s keeps Bengali strings out of other Indic scripts', (rel) => {
    const sql = readRepo(rel);
    expect(sql).toMatch(/[\u0980-\u09FF]/); // the seed really is bilingual
    expect(sql.match(/[\u0900-\u097F]/g), `Devanagari characters slipped into ${rel}`).toBeNull();
  });

  it('halls cover the six documented campuses and keep the demo allocations resolvable', () => {
    const sql = readRepo('supabase/seed/seed_university_halls.sql');
    for (const hall of [
      'Salimullah Muslim Hall',
      'Begum Fazilatunnesa Mujib Hall',
      'Al Beruni Hall',
      'Sher-e-Bangla Fazlul Haque Hall',
      'Shahjalal Hall',
      'Shah Amanat Hall',
      'Titumir Hall',
      'Shah Paran Hall',
    ]) {
      expect(sql, `missing hall in the seed: ${hall}`).toContain(hall);
    }
    // hall_allocations references halls by (university code, name) — a renamed
    // hall must be renamed there too or the seed aborts on the FK.
    const allocNames = [...sql.matchAll(/'([A-Z]+)',\s+'([^']*(?:Hall|Hostel|Chhatrabas))'/g)].map((m) => `${m[1]}/${m[2]}`);
    expect(allocNames.length).toBeGreaterThan(0);
    for (const entry of allocNames) {
      const [, name] = entry.split('/');
      expect(sql, `demo row points at a hall that is not inserted: ${name}`).toContain(`'${name}',`);
    }
  });
});
