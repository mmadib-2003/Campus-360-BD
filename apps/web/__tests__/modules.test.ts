// apps/web/__tests__/modules.test.ts
import { describe, expect, it } from 'vitest';
import { MODULES, getModule, MODULE_KEYS } from '../lib/modules/registry';
import { coerceField, normalizeTokenList, randomCode } from '../lib/modules/coerce';
import { fieldLabel, MODULE_META } from '../lib/modules/labels';

describe('module registry', () => {
  it('describes every interactive module surface', () => {
    expect(MODULE_KEYS.length).toBeGreaterThanOrEqual(40);
    for (const key of MODULE_KEYS) {
      const spec = MODULES[key];
      expect(spec.table, `${key} table`).toBeTruthy();
      expect(spec.realtimeTable, `${key} realtime table`).toBeTruthy();
      expect(Array.isArray(spec.fields), `${key} fields`).toBe(true);
    }
  });

  it('exposes the twelve product modules in the navigation map', () => {
    const expected = [
      'marketplace',
      'skills',
      'civic',
      'events',
      'health',
      'mentorship',
      'housing',
      'careers',
      'dining',
      'lostfound',
      'sports',
      'trust',
    ];
    for (const key of expected) {
      expect(MODULE_META[key], `meta for ${key}`).toBeTruthy();
      expect(MODULE_META[key].href.startsWith('/')).toBe(true);
    }
  });

  it('marks owner columns for every user-generated table', () => {
    const ownerScoped = [
      'marketplace',
      'skills',
      'housing',
      'rideshare',
      'sports-teams',
      'lost-found',
      'disputes',
      'donors',
      'mentors',
      'alumni',
    ];
    for (const key of ownerScoped) {
      expect(MODULES[key].ownerColumn, `${key} owner column`).toBeTruthy();
    }
  });

  it('never exposes read-only system columns as writable text', () => {
    const campaignFields = getModule('campaigns')!.fields.map((field) => field.column);
    expect(campaignFields).not.toContain('raised_bdt');
    expect(campaignFields).not.toContain('donors_count');
  });

  it('returns null for unknown modules so routes can 404 safely', () => {
    expect(getModule('does-not-exist')).toBeNull();
  });
});

describe('field coercion', () => {
  it('rejects money values that are negative', () => {
    const result = coerceField({ column: 'price_bdt', type: 'money' }, -5);
    expect(result.error).toBeTruthy();
  });

  it('rounds money to two decimals', () => {
    expect(coerceField({ column: 'price_bdt', type: 'money' }, '12.345').value).toBe(12.35);
  });

  it('normalises comma separated arrays', () => {
    expect(coerceField({ column: 'skills', type: 'array' }, 'python, figma ,,sql').value).toEqual([
      'python',
      'figma',
      'sql',
    ]);
  });

  it('enforces enum vocabularies case-insensitively', () => {
    const ok = coerceField({ column: 'kind', type: 'enum', values: ['SELL', 'RENT'] }, 'sell');
    const bad = coerceField({ column: 'kind', type: 'enum', values: ['SELL', 'RENT'] }, 'trade');
    expect(ok.value).toBe('SELL');
    expect(bad.error).toBeTruthy();
  });

  it('validates uuid columns', () => {
    expect(coerceField({ column: 'listing_id', type: 'uuid' }, 'not-a-uuid').error).toBeTruthy();
    expect(
      coerceField({ column: 'listing_id', type: 'uuid' }, 'd1a00000-0000-4000-8000-000000000001').value
    ).toBe('d1a00000-0000-4000-8000-000000000001');
  });

  it('converts datetimes to ISO strings', () => {
    const { value } = coerceField({ column: 'starts_at', type: 'datetime' }, '2026-11-20T18:30');
    expect(typeof value).toBe('string');
    expect(String(value)).toMatch(/^2026-11-\d{2}T/);
  });

  it('requires values for required fields', () => {
    expect(coerceField({ column: 'title', type: 'text', required: true }, '').error).toBeTruthy();
  });

  it('truncates long values by max length', () => {
    expect(coerceField({ column: 'title', type: 'text', max: 5 }, 'toolongvalue').error).toBeTruthy();
  });

  it('builds human readable labels for every column', () => {
    expect(fieldLabel('price_bdt').label).toBe('Price (BDT)');
    expect(fieldLabel('some_unknown_column').label).toBe('Some Unknown Column');
  });
});

describe('matching helpers', () => {
  it('normalises tokens for lost & found matching', () => {
    const tokens = normalizeTokenList(['Blue Backpack with laptop charger', 'Library']);
    expect(tokens).toContain('blue');
    expect(tokens).toContain('backpack');
    expect(tokens).toContain('library');
    expect(tokens.every((token) => token.length >= 3)).toBe(true);
  });

  it('generates readable reference codes', () => {
    expect(randomCode('ORD')).toMatch(/^ORD-[A-Z0-9]{6}$/);
  });
});
