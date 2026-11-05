// apps/web/__tests__/anon-listing-reads.test.ts
// ============================================================================
// Anonymous browsing of the public listing surfaces is a two-part contract:
//
//   * apps/web/lib/modules/registry.ts  -- `publicRead` / `publicSelect`
//   * supabase/migrations/0013_anon_public_listing_reads.sql -- the `anon` SELECT
//     policies and the column grants
//
// Either half on its own fails quietly. A flag without a policy makes PostgREST
// answer 200 with `[]`, which is indistinguishable from "this campus has nothing"
// -- the exact report that started this line of work. A policy without the flag
// leaves the route returning 401 before it ever queries. So the two files are
// compared to each other here, and the withheld columns are asserted by name,
// because "we did not grant contact details" is the promise that makes the row
// policy safe to widen.
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULES, resolveListingAccess } from '@/lib/modules/registry';

const WEB_ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
const MIGRATION = path.join(REPO_ROOT, 'supabase/migrations/0013_anon_public_listing_reads.sql');

const sql = readFileSync(MIGRATION, 'utf8');
const readRepo = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const publicModules = Object.values(MODULES).filter((s) => s.publicRead === true);
const publicTables = new Set(publicModules.map((s) => s.table));

/** Tables the migration created an `anon` SELECT policy for. */
function anonPolicyTables(text: string): Set<string> {
  const out = new Set<string>();
  const re = /CREATE POLICY "Anon read [^"]+"\s*\n\s*ON public\.([a-z_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return out;
}

/** The exact columns `anon` may read per table, from the GRANT SELECT (...) blocks. */
function anonGrants(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /GRANT SELECT \(([\s\S]*?)\)\s*ON public\.([a-z_]+) TO anon;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.set(m[2], m[1].split(',').map((c) => c.trim().replace(/'"/g, '')).filter(Boolean));
  }
  return out;
}

describe('resolveListingAccess', () => {
  it('gives a session the member path, public or not', () => {
    for (const spec of Object.values(MODULES)) {
      expect(resolveListingAccess(spec, { hasSession: true, serverConfigured: true })).toBe('member');
    }
  });

  it('gives a signed-out visitor the public path only when the module says so', () => {
    expect(
      resolveListingAccess({ publicRead: true }, { hasSession: false, serverConfigured: true })
    ).toBe('public');
    expect(
      resolveListingAccess({ publicRead: undefined }, { hasSession: false, serverConfigured: true })
    ).toBe('deny');
    expect(
      resolveListingAccess({ publicRead: true }, { hasSession: false, serverConfigured: false })
    ).toBe('deny');
  });

  it('never treats a missing database as an empty campus', () => {
    // The 503 branch matters more than it looks: without it an unconfigured deploy
    // answers `[]`, and `[]` is what "working, but empty" looks like to a reader.
    for (const spec of publicModules) {
      expect(resolveListingAccess(spec, { hasSession: false, serverConfigured: false })).toBe('deny');
    }
  });

  it('does not open a single private module to anon', () => {
    for (const key of [
      'messages', 'conversations', 'donors', 'blood-requests', 'blood-responses', 'donations',
      'donation-ledger', 'alumni', 'disputes', 'dispute-messages', 'counseling-slots',
      'skill-applications', 'career-applications', 'club-members', 'event-rsvps',
      'venue-bookings', 'mentorship-bookings', 'marketplace-orders', 'marketplace-messages',
      'ride-requests', 'ticket-exchange', 'home-food', 'food-orders', 'skill-alerts',
      'lost-item-matches', 'complaint-upvotes',
    ]) {
      const spec = MODULES[key];
      if (!spec) continue; // key renamed upstream -- the invariant below still holds
      expect(spec.publicRead, `module '${key}' must stay authenticated-only`).not.toBe(true);
    }
  });
});

describe('registry flags vs migration 0013', () => {
  it('every publicRead module has an anon SELECT policy in the database', () => {
    const policyTables = anonPolicyTables(sql);
    for (const table of publicTables) {
      expect(policyTables.has(table), `0013 must create an anon policy for '${table}'`).toBe(true);
    }
  });

  it('creates no anon policy the registry has not opted into', () => {
    for (const table of anonPolicyTables(sql)) {
      expect(publicTables.has(table) || table === 'profiles', `unexpected anon policy on '${table}'`).toBe(true);
    }
  });

  /** Split a PostgREST select list on its TOP-LEVEL commas only, not embed commas. */
  function topLevel(value: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of value) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        parts.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    parts.push(cur.trim());
    return parts.filter(Boolean);
  }

  /** Tables 0013 leaves alone because they were already world-readable. */
  const ALREADY_PUBLIC = new Set(['universities', 'halls', 'university_halls', 'departments',
    'academic_programs', 'university_email_domains']);

  it('grants anon the columns a public read actually selects', () => {
    const grants = anonGrants(sql);
    for (const spec of publicModules) {
      const allowed = grants.get(spec.table);
      expect(allowed, `0013 must grant anon explicit columns on '${spec.table}'`).toBeTruthy();
      const selection = spec.publicSelect ?? spec.select;
      expect(selection, `publicRead module '${spec.key}' must name its columns (never '*')`).toBeTruthy();
      for (const raw of topLevel(selection!)) {
        const head = raw.split(/[.:(]/)[0].trim();
        if (raw.includes('(')) {
          // An embed is a second table the reader must also be allowed to touch. This is
          // the `careers` -> `alumni_profiles` trap: the row is public, the joined
          // directory is not, and PostgREST fails the whole request rather than the join.
          const target = head.replace(/:$/, '');
          const ok = publicTables.has(target) || target === 'profiles' || ALREADY_PUBLIC.has(target);
          expect(ok, `${spec.key}: anon embeds '${target}', which 0013 does not open`).toBe(true);
          continue;
        }
        expect(allowed!.includes(head), `${spec.key}: anon cannot read '${head}' on ${spec.table}`).toBe(true);
      }
    }
  });

  it('every module whose select names a withheld column carries a publicSelect', () => {
    const WITHHELD = ['contact_note', 'contact_phone', 'contact_email', 'alumni_profiles'];
    const grants = anonGrants(sql);
    for (const spec of publicModules) {
      const allowed = grants.get(spec.table) ?? [];
      const selects = [spec.select, spec.publicSelect].filter(Boolean) as string[];
      for (const sel of selects) {
        const heads = sel.split(',').map((c) => c.trim().split(/[.:(]/)[0].trim());
        const leak = heads.filter((h) => WITHHELD.includes(h) && !allowed.includes(h));
        if (leak.length) {
          expect(spec.publicSelect, `${spec.key}: select exposes ${leak.join(', ')} without a publicSelect`).toBeTruthy();
          const pub = spec.publicSelect!.split(',').map((c) => c.trim().split(/[.:(]/)[0].trim());
          for (const bad of leak) {
            expect(pub.includes(bad), `${spec.key}: publicSelect still exposes '${bad}'`).toBe(false);
          }
        }
      }
    }
  });
});

describe('what anon is never granted', () => {
  const NEVER = [
    'email', 'student_id', 'crisis_callback_phone', 'crisis_callback_consent',
    'demo_otp', 'demo_otp_expires_at', 'contact_phone', 'contact_note', 'storage_path',
    'dmca_quarantined',
  ];
  const grants = anonGrants(sql);

  it('withholds identity and contact columns from every public table', () => {
    for (const [table, cols] of grants) {
      for (const bad of NEVER) {
        expect(cols.includes(bad), `anon must not read ${table}.${bad}`).toBe(false);
      }
    }
  });

  it('limits the profiles grant to a name, an avatar and campus context', () => {
    expect(grants.get('profiles')).toEqual([
      'id', 'university_id', 'full_name', 'avatar_url', 'trust_level', 'preferred_language',
    ]);
  });

  it('does not hand anon the alumni directory or the donor list', () => {
    expect(grants.has('alumni_profiles')).toBe(false);
    expect(grants.has('donations')).toBe(false);
    expect(grants.has('donation_ledger')).toBe(false);
    expect(grants.has('health_donors')).toBe(false);
    expect(grants.has('blood_requests')).toBe(false);
    expect(sql).toContain('Deliberately NOT opened');
  });

  it('keeps the member tenant policy on every table it widens', () => {
    // Guards the asymmetry that would be worst to discover later: guests can see a
    // listing that a signed-in student cannot.
    expect(sql).toMatch(/RAISE EXCEPTION '0013: member tenant SELECT policy missing/);
  });
});

describe('module route', () => {
  const route = readRepo('apps/web/app/api/modules/[module]/route.ts');

  it('routes GET through the access decision and the anon client', () => {
    expect(route).toContain('resolveListingAccess(spec');
    expect(route).toContain('createSupabaseRouteClient()');
    expect(route).toContain("access === 'deny'");
    expect(route).toContain('spec.publicSelect ?? spec.select');
  });

  it('scopes the tenant filter and `mine` to members only', () => {
    expect(route).toContain('if (auth && !allCampuses) query = query.eq(');
    expect(route).toContain("if (auth && spec.ownerColumn && sp.get('mine')");
  });

  it('still requires a session for every write', () => {
    const writes = route.slice(route.indexOf('export async function POST'));
    expect(writes.match(/const \{ auth, response \} = await requireAuth\(\);/g)).toHaveLength(3);
    expect(writes).toContain('if (!auth) return response!');
    expect(writes).not.toContain('resolveListingAccess');
  });
});

describe('listing pages', () => {
  /** Every page.tsx under apps/web/app, relative to the web root. */
  function pages(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(WEB_ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...pages(rel));
      else if (entry.name === 'page.tsx') out.push(rel);
    }
    return out;
  }

  /** The options object of a useModuleList('key', { ... }) call. */
  function optionsFor(src: string, at: number): string {
    const brace = src.indexOf('{', at);
    if (brace < 0) return '';
    let depth = 0;
    for (let i = brace; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(brace, i + 1);
      }
    }
    return '';
  }

  // The whole page being members-only (feed, faculty) is a legitimate gate; an auth
  // gate on an individual public list is not, because `enabled: false` is honoured as
  // "never fetch" by the hook -- so re-adding it silently puts the wall back.
  const MEMBERS_ONLY_PAGES = ['feed', 'faculty'];
  const publicKeys = publicModules.map((s) => s.key);

  it.each(publicKeys)('does not gate the %s list on a session', (key) => {
    for (const rel of pages('app')) {
      if (MEMBERS_ONLY_PAGES.some((p) => rel.includes(`/${p}/`))) continue;
      const src = readFileSync(path.join(WEB_ROOT, rel), 'utf8');
      const re = new RegExp(`use(?:Realtime)?ModuleList\\(\\s*'${key}'`, 'g');
      for (const m of src.matchAll(re)) {
        const opts = optionsFor(src, m.index);
        expect(opts.includes('session'), `${rel}: '${key}' is publicRead -- drop the auth gate`).toBe(false);
      }
    }
  });
});

describe('list hook', () => {
  const client = readRepo('apps/web/lib/modules/client.ts');

  it('fetches public modules without a session', () => {
    expect(client).toContain('(session.authenticated || session.demo || spec?.publicRead === true)');
  });

  it('still honours an explicit enabled:false', () => {
    expect(client).toContain('options.enabled !== false &&');
  });
});
