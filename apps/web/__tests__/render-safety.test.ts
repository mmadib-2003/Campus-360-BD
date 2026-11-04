// apps/web/__tests__/render-safety.test.ts
// ============================================================================
// Two separate regressions are pinned here.
//
// 1. `Application error: a client-side exception has occurred` was produced by
//    list views reading through a value PostgREST had handed back as null, as a
//    JSONB string, or not at all (`row.tags.map`, `listing.profiles.full_name`).
//    `lib/render-safe.ts` is the total-function layer every one of those call
//    sites now goes through, so its whole contract -- never throw, never
//    `[object Object]`, never `NaN`, never `Invalid Date` -- is asserted below.
//
// 2. The massive demo seed (supabase/seed/seed_massive_demo_content.sql) is the
//    only thing standing between a freshly-ported campus row and UI text that
//    names *another* campus. Its textual invariants (single transaction, no
//    backslashes for the JSON transport, balanced quotes, idempotency guards,
//    state-transition timestamps left alone) are cheap to check and were each
//    the cause of a real rollback during development.
//
// Environment is node: no DOM, so boundaries are asserted structurally rather
// than by rendering.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { asArray, asDateText, asNum, asRow, asText, hasRows } from '@/lib/render-safe';

// .../apps/web/__tests__/ -> repo root
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * Tiny SQL quoting scanner: skips `--` comments, understands '' doubling inside a
 * literal, quoted "identifiers" and $$dollar-quoted$$ bodies (nested tags included).
 * Reports whether the file is left holding an unterminated construct.
 */
function quoteScan(src: string): { unterminatedString: boolean; unterminatedDollar: boolean; errors: number } {
  let i = 0;
  let inString = false;
  let dollarTag: string | null = null;
  let errors = 0;
  while (i < src.length) {
    const ch = src[i];
    if (dollarTag) {
      const end = src.indexOf(dollarTag, i);
      if (end < 0) {
        errors += 1;
        break;
      }
      i = end + dollarTag.length;
      dollarTag = null;
      continue;
    }
    if (inString) {
      if (ch === "'") {
        if (src[i + 1] === "'") {
          i += 2;
          continue;
        }
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === "'") {
      inString = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) {
        errors += 1;
        break;
      }
      i = end + 1;
      continue;
    }
    if (ch === '-' && src[i + 1] === '-') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(src.slice(i));
      if (tag) {
        dollarTag = tag[0];
        i += tag[0].length;
        continue;
      }
    }
    i += 1;
  }
  return { unterminatedString: inString, unterminatedDollar: dollarTag !== null, errors };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('asArray — the guard in front of every .map()', () => {
  it('renders nothing for every non-array shape PostgREST can return', () => {
    for (const value of [undefined, null, 0, false, true, '', '   ', {}, [], 42, NaN]) {
      expect(asArray(value)).toEqual([]);
    }
  });

  it('passes real arrays through by identity', () => {
    const rows = [{ id: 1 }];
    expect(asArray(rows)).toBe(rows);
  });

  it('unwraps double-encoded JSONB arrays and objects', () => {
    expect(asArray('["WiFi","AC"]')).toEqual(['WiFi', 'AC']);
    expect(asArray('  [1,2]  ')).toEqual([1, 2]);
    expect(asArray('{"a":1}')).toEqual([]); // parsed but not an array -> nothing
  });

  it('never throws on malformed JSON, symbols, functions, Maps or cycles', () => {
    expect(asArray('[1,2')).toEqual([]);
    expect(asArray('not json at all')).toEqual([]);
    expect(asArray(Symbol.iterator as unknown)).toEqual([]);
    expect(asArray(() => 1)).toEqual([]);
    expect(asArray(new Map())).toEqual([]);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(asArray(cyclic)).toEqual([]);
  });

  it('hasRows and the .length === 0 fallback agree', () => {
    expect(hasRows([{ a: 1 }])).toBe(true);
    expect(hasRows([])).toBe(false);
    expect(hasRows(undefined)).toBe(false);
    expect(hasRows('[]')).toBe(false);
  });
});

describe('asText / asNum / asRow / asDateText', () => {
  it('prints strings, never objects, never NaN', () => {
    expect(asText('Rookmarfee Hall')).toBe('Rookmarfee Hall');
    expect(asText('', 'n/a')).toBe('n/a');
    expect(asText(null, 'n/a')).toBe('n/a');
    expect(asText(0)).toBe('0'); // a real zero is not "missing"
    expect(asText(Number.NaN, '—')).toBe('—');
    expect(asText(true)).toBe('yes');
    expect(asText(['a', 'b'])).toBe('a, b');
    expect(asText({ name_en: 'DU' })).toBe('DU');
    expect(asText({ name_bn: 'ঢাকা বিশ্ববিদ্যালয়' })).toBe('ঢাকা বিশ্ববিদ্যালয়');
    expect(asText({ unexpected: true }, '—')).toBe('—'); // no [object Object]
  });

  it('coerces numbers for arithmetic and toLocaleString', () => {
    expect(asNum('12,500')).toBe(12500);
    expect(asNum('৳ 9000')).toBe(0);
    expect(asNum(Infinity, 7)).toBe(7);
    expect(asNum(null, 5)).toBe(5);
    expect(asNum(3.5)).toBe(3.5);
  });

  it('treats a missing embed as an empty row, not as undefined', () => {
    expect(asRow(null)).toEqual({});
    expect(asRow([{ a: 1 }])).toEqual({});
    expect(asRow({ full_name: 'A. Karim' })).toEqual({ full_name: 'A. Karim' });
    expect(asText(asRow(null).full_name, '—')).toBe('—'); // the AppShell chip pattern
  });

  it('formats dates without ever emitting "Invalid Date"', () => {
    expect(asDateText('2026-11-04T09:30:00Z')).not.toMatch(/Invalid/);
    expect(asDateText('garbage')).toBe('—');
    expect(asDateText(null, 'en-GB', 'tbd')).toBe('tbd');
    // A bogus locale must not throw. Node's ICU silently falls back to the
    // default locale, so the ISO branch in asDateText is defensive only -- the
    // contract we actually rely on is "returns a printable string, never a throw".
    for (const bad of ['zz-ZZ', 'x', '!!', 'en-GB-u-nonsense']) {
      expect(() => asDateText('2026-11-04T09:30:00Z', bad)).not.toThrow();
      expect(asDateText('2026-11-04T09:30:00Z', bad)).toMatch(/2026/);
    }
  });
});

describe('no list view reads .data directly again', () => {
  const files = [...walk(path.join(repoRoot, 'apps/web/app')), ...walk(path.join(repoRoot, 'apps/web/components'))];

  it.each(files.map((f) => [path.relative(repoRoot, f).split(path.sep).join('/'), f]))(
    '%s accesses collections only through the safe helpers',
    (_rel, abs) => {
      const src = fs.readFileSync(abs, 'utf8');
      // `x.data.map(` / `.data.filter(` / `.data.length` are exactly the shapes
      // that threw. `asArray(x.data).map(` is the patched form and does not match.
      expect(src).not.toMatch(/\.data\.(map|filter|forEach|reduce|find|some|every|slice|length|at|flatMap)\s*\(/);
      expect(src).not.toMatch(/\.data\.(map|filter|some|every|length)\b(?!)/);
      expect(src).not.toMatch(/\bdata:\s*any\)?\s*\.data\./);
    },
  );
});

describe('the boundary is actually installed', () => {
  it('wraps every Card and the whole layout shell', () => {
    const ui = read('apps/web/components/modules/ui.tsx');
    expect(ui).toMatch(/import \{ SafeSection/i);
    expect(ui).toMatch(/<SafeSection/);
    const layout = read('apps/web/app/layout.tsx');
    expect(layout).toMatch(/<SafeSection/);
    expect(fs.existsSync(path.join(repoRoot, 'apps/web/app/error.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'apps/web/app/global-error.tsx'))).toBe(true);
  });

  it('leaves the public listing pages readable by guests, with a prompt not a wall', () => {
    for (const page of ['skills', 'housing', 'marketplace', 'lost-found', 'dining', 'careers', 'sports', 'trust', 'mentorship', 'events', 'civic']) {
      const src = read(`apps/web/app/${page}/page.tsx`);
      expect(src, page).toMatch(/<SignInPrompt moduleName=/);
      // the wall was `if (!session.authenticated) return <SignInPrompt .../>`
      expect(src, page).not.toMatch(/if \(!session\.authenticated\) return <SignInPrompt/);
    }
  });
});

describe('seed_massive_demo_content.sql keeps the invariants that made it applyable', () => {
  const file = 'supabase/seed/seed_massive_demo_content.sql';
  const sql = read(file);

  it('is one transaction', () => {
    expect(sql.match(/^\s*BEGIN;/gm)).toHaveLength(1);
    expect(sql.match(/^\s*COMMIT;/gm)).toHaveLength(1);
    expect(sql.indexOf('BEGIN;')).toBeLessThan(sql.indexOf('COMMIT;'));
  });

  it('carries no backslashes and quotes cleanly (it travels as JSON)', () => {
    // A literal backslash would have to survive two layers of escaping (SQL
    // string -> JSON transport), which is why the file builds regex metacharacters
    // with chr(92) instead.
    expect(sql).not.toContain('\\');
    // Every apostrophe inside a SQL literal must be doubled, and every dollar-quoted
    // body closed. A single slip here is what turned attempts 8 and 9 into
    // `syntax error at or near "NULL"` on a 40 KB payload that had to be re-sent.
    expect(quoteScan(sql)).toEqual({ unterminatedString: false, unterminatedDollar: false, errors: 0 });
  });

  it('ports every module table it claims, and only through the idempotent guard', () => {
    const tables = [...sql.matchAll(/\(\s*\d+,\s*'([a-z_]+)',\s*\$q\$/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(24);
    for (const t of ['posts', 'skill_postings', 'housing_listings', 'marketplace_listings', 'lost_items', 'events', 'club_notices', 'reviews', 'career_opportunities', 'cafeteria_menus', 'blood_requests', 'health_donors', 'donation_campaigns', 'governance_notices']) {
      expect(tables, t).toContain(t);
    }
    // two child tables are written explicitly, never by the generic rule
    expect(sql).toMatch(/\(11,'mentorship_slots',\s+\$q\$false\$q\$/);
    expect(sql).toMatch(/\(15,'cafeteria_items',\s+\$q\$false\$q\$/);
    // ...and every generic insert is guarded so a second run is a no-op
    expect(sql).toMatch(/AND NOT EXISTS \(SELECT 1 FROM public\.' \|\| quote_ident\(r\.tbl\)/);
    expect(sql).toMatch(/ON CONFLICT DO NOTHING/);
    expect(sql).toMatch(/ON CONFLICT \(tracking_code\) DO NOTHING/);
  });

  it('leaves state-transition timestamps alone (re-dating them would fake resolution)', () => {
    const keep = sql.match(/WHEN c\.name IN \('deleted_at'[\s\S]*?\)/);
    expect(keep).not.toBeNull();
    for (const col of ['deleted_at', 'resolved_at', 'closed_at', 'escalated_at', 'fulfilled_at', 'sent_at', 'read_at']) {
      expect(keep![0], col).toContain(`'${col}'`);
    }
  });

  it('localises four things: hall, area, city and the university itself', () => {
    for (const kind of ['hall', 'area', 'city', 'uni']) {
      // one pattern row per language, one substitution pass per kind
      expect(sql.match(new RegExp(`lang = m\\)\\.filter`, 'g'))).toBeNull();
      expect(sql, kind).toContain(`WHERE kind = '${kind}' AND lang = m`);
      expect((sql.match(new RegExp(`SELECT '${kind}'`, 'g')) ?? []).length).toBeGreaterThanOrEqual(2);
    }
    // missing patterns must resolve to something unmatched, never NULL
    expect(sql).toContain(', chr(1))');
  });

  it('refuses to invent authors: a campus only gets content if it has a live profile', () => {
    expect(sql).toMatch(/p\.deleted_at IS NULL/);
    expect(sql).toMatch(/p\.trust_level IS DISTINCT FROM 'UNVERIFIED'/);
    expect(sql).toMatch(/>= 1;/);
  });

  it('names the same flagship set in the port filter and the imagery update', () => {
    // The port filter writes it as ANY(ARRAY[...]), the imagery UPDATE as IN (...);
    // the two must name the same campuses or a campus gets a cover path with no
    // content behind it.
    const flagships = /'DU',\s*'JU',\s*'BUET',\s*'RU',\s*'CU',\s*'SUST',\s*'JUST',\s*'KU',\s*'IU',\s*'JNU'/g;
    expect((sql.match(flagships) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('campus imagery assets line up with what the database points at', () => {
  const demoData = read('apps/web/lib/modules/demo-data.ts');
  const demoAuth = read('apps/web/lib/demo-auth.ts');

  it('has a monogram for every demo university code', () => {
    // `code:` also appears in nested embeds (departments: { code: 'CSE' }), which
    // are not campuses -- only array-level entries get a crest.
    const codes = [...demoData.matchAll(/\n\s{2,6}code: '([A-Z0-9]+)',/g)].map((m) => m[1].toLowerCase());
    expect(codes.length).toBeGreaterThan(5);
    for (const code of codes) {
      expect(fs.existsSync(path.join(repoRoot, `apps/web/public/logos/${code}.svg`)), `${code}.svg`).toBe(true);
    }
  });

  it('ships the file behind every cover path the demo payload advertises', () => {
    const covers = [...demoAuth.matchAll(/'\/campuses\/[a-z0-9]+\.jpg'/g)].map((m) => m[0].replace(/'/g, ''));
    expect(covers.length).toBeGreaterThanOrEqual(6);
    for (const rel of covers) {
      expect(fs.existsSync(path.join(repoRoot, 'apps/web/public', rel.replace(/^\//, ''))), rel).toBe(true);
    }
    expect(demoAuth).toContain("'/campuses/campus.jpg'"); // the universal fallback
  });

  it('only points cover_image_url at a photo for campuses in the port set', () => {
    const sql = read('supabase/seed/seed_massive_demo_content.sql');
    const update = sql.match(/SET cover_image_url = CASE[\s\S]*?END/);
    expect(update).not.toBeNull();
    expect(update![0]).toContain("'/campuses/' || lower(code) || '.jpg'");
    expect(update![0]).toContain("ELSE '/campuses/campus.jpg'");
  });
});

describe('authentic campus imagery and one-click demo identities', () => {
  const seed = read('supabase/seed/seed.sql');
  const demoAuth = read('apps/web/lib/demo-auth.ts');
  const demoData = read('apps/web/lib/modules/demo-data.ts');
  const quickSeed = read('supabase/seed/seed_quick_demo_accounts.sql');

  it('points the six flagship campuses at real Wikimedia Commons photographs', () => {
    const expected = [
      ['DU', 'Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg'],
      ['JU', 'Shaheed_Minar_of_Jahangirnagar_University.jpg'],
      ['BUET', 'BUET_Campus_(01).jpg'],
      ['SUST', 'Sust_campus_5.JPG'],
      ['CU', 'Campus,_University_of_Chittagong_1.jpg'],
      ['RU', 'Rajshahi_University_Campus.jpg'],
    ] as const;
    for (const [code, file] of expected) {
      expect(seed, `${code} cover`).toContain(file);
      expect(demoAuth, `${code} preview cover`).toContain(file);
    }
    expect(seed).toContain('commons.wikimedia.org/wiki/Special:FilePath');
    expect(demoAuth).toContain('commons.wikimedia.org/wiki/Special:FilePath');
  });

  it('points the six flagship campuses at real institutional logo files', () => {
    expect(seed).toContain('upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg');
    expect(seed).toContain('upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg');
    expect(demoAuth).toContain('upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg');
    expect(demoAuth).toContain('upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg');
  });

  it('provisions the four one-click demo identities with a hardcoded hash', () => {
    for (const email of [
      'student@demo.campus360.test',
      'faculty@demo.campus360.test',
      'admin@demo.campus360.test',
      'alumni@demo.campus360.test',
    ]) {
      expect(quickSeed).toContain(email);
      expect(demoData).toContain(email);
    }
    expect(quickSeed).toContain('$2a$10$QsYfRPv60gPCkvVDIlYO7u8dvdYGUJ4dbuhViCIpcXIJWCw69ZBwu');
    expect(quickSeed).toContain("'ALUMNI'::app_role");
    expect(demoData).toContain("'Demo#1234'");
  });
});

describe('expanded authentic campus imagery (24 universities)', () => {
  const seed = read('supabase/seed/seed.sql');
  const expanded = read('supabase/migrations/0017_university_real_images_expanded.sql');
  const demoAuth = read('apps/web/lib/demo-auth.ts');

  it('points 24 public universities at real Wikimedia files in both seed and migration', () => {
    const expected = [
      ['IU', 'Islamic_University_Lake_with_Central_Mosque_View.jpg'],
      ['KU', 'Khan_Jahan_Ali_Hall.jpg'],
      ['JNU', 'Jagannath_University_Bird_View.jpg'],
      ['COU', 'Comilla_University_campus_building.jpg'],
      ['BRUR', 'Campus_of_Begum_Rokeya_University%2C_Rangpur.jpg'],
      ['BUP', 'BUP_Campus_Aerial_View_2.jpg'],
      ['BU', 'Barishal_University_Campus_Front.jpg'],
      ['JUST', 'Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg'],
      ['BAU', 'Bangladesh_Agricultural_University_%28BAU%29.jpg'],
      ['CUET', 'CUET_GATE.jpg'],
      ['KUET', 'KUET_Central_field.jpg'],
      ['RUET', 'Rajshahi_University_of_Engineering_and_Technology_%28RUET%29_Campus.jpg'],
      ['MBSTU', 'Academic_building_at_Mawlana_Bhashani_Science_and_Technology_University_03.jpg'],
      ['PSTU', 'AdminBuilding.jpg'],
      ['NSTU', 'Academic_building-1%2C_NSTU.jpg'],
      ['PUST', 'PUST_Campus.jpg'],
      ['BSMRAU', 'BSMRAU_Agri_New_Building.jpg'],
      ['SAU', 'Sher-e-Bangla_Agricultural_University.jpg'],
    ] as const;
    for (const [code, file] of expected) {
      expect(seed, `${code} seed cover`).toContain(file);
      expect(expanded, `${code} migration cover`).toContain(file);
    }
    // The offline preview payload must carry the same authentic files for the
    // demo campuses it serves.
    for (const file of [
      'Jagannath_University_Bird_View.jpg',
      'BUP_Campus_Aerial_View_2.jpg',
      'Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg',
      'KUET_Central_field.jpg',
      'CUET_GATE.jpg',
      'Bangladesh_Agricultural_University_%28BAU%29.jpg',
    ]) {
      expect(demoAuth, `demo payload ${file}`).toContain(file);
    }
  });
});
