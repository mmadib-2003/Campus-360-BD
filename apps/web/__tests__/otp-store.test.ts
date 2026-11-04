// apps/web/__tests__/otp-store.test.ts
// verification_attempts persistence semantics, exercised against an in-memory
// PostgREST double: 5-minute TTL, digest-only storage, newest-code-wins,
// single use, attempt budget, and graceful degradation when migration 0011 has
// not been applied.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

process.env.OTP_PEPPER_SECRET = 'test-pepper-for-unit-runs';

const EXTENDED_ONLY = ['consumed_at', 'delivery_status', 'email_sent_at', 'email_message_id', 'delivery_error'];

interface Row {
  id: string;
  created_at: string;
  [key: string]: unknown;
}

interface FakeOptions {
  /** false = schema at migration 0002 (no consumed_at / nullable otp_hash). */
  extendedSchema?: boolean;
}

class FakeQuery {
  private filters: Array<{ field: string; kind: string; value: unknown }> = [];
  private orderField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Record<string, unknown> = {};
  private wantSingle = false;

  constructor(
    private rows: Row[],
    private options: FakeOptions,
    private table: string
  ) {}

  private unknownColumnError(field: string) {
    return {
      code: 'PGRST204',
      message: `Could not find the '${field}' column of '${this.table}' in the schema cache`,
    };
  }

  private usesUnknownColumns(keys: string[]): string | null {
    if (this.options.extendedSchema !== false) return null;
    return keys.find((key) => EXTENDED_ONLY.includes(key)) ?? null;
  }

  insert(value: Record<string, unknown>) {
    this.mode = 'insert';
    this.payload = value;
    return this;
  }

  update(value: Record<string, unknown>) {
    this.mode = 'update';
    this.payload = value;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, kind: 'eq', value });
    return this;
  }

  is(field: string, value: unknown) {
    this.filters.push({ field, kind: 'is', value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, kind: 'gte', value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, kind: 'lte', value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push({ field, kind: 'lt', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every(({ field, kind, value }) => {
      const cell = row[field];
      switch (kind) {
        case 'eq':
          return cell === value;
        case 'is':
          return value === null ? cell === null || cell === undefined : cell === value;
        case 'gte':
          return new Date(String(cell)).getTime() >= new Date(String(value)).getTime();
        case 'lte':
          return new Date(String(cell)).getTime() <= new Date(String(value)).getTime();
        case 'lt':
          return new Date(String(cell)).getTime() < new Date(String(value)).getTime();
        default:
          return false;
      }
    });
  }

  private run(): { data: unknown; error: { code: string; message: string } | null } {
    const usedColumns = [...Object.keys(this.payload), ...this.filters.map((f) => f.field)];
    const unknown = this.usesUnknownColumns(usedColumns);
    if (unknown) return { data: null, error: this.unknownColumnError(unknown) };

    if (this.mode === 'insert') {
      const row: Row = {
        id: `cha-${this.rows.length + 1}`,
        created_at: new Date().toISOString(),
        verified_at: null,
        attempt_count: 0,
        ...this.payload,
      };
      // otp_hash is NOT NULL until migration 0011 drops that constraint.
      if (row.otp_hash === null && this.options.extendedSchema === false) {
        return { data: null, error: { code: '23502', message: 'null value in column "otp_hash" violates not-null constraint' } };
      }
      this.rows.push(row);
      return { data: { ...row }, error: null };
    }

    if (this.mode === 'delete') {
      const before = this.rows.length;
      const kept = this.rows.filter((row) => !this.matches(row));
      const removed = before - kept.length;
      this.rows.length = 0;
      this.rows.push(...kept);
      return { data: { removed }, error: null };
    }

    const targets = this.rows.filter((row) => this.matches(row));
    if (this.mode === 'update') {
      for (const row of targets) Object.assign(row, this.payload);
      return { data: targets.map((row) => ({ ...row })), error: null };
    }

    let selected = targets;
    if (this.orderField) {
      const field = this.orderField;
      selected = [...selected].sort((a, b) => {
        const left = String(a[field] ?? '');
        const right = String(b[field] ?? '');
        return this.orderAsc ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    if (this.limitCount !== null) selected = selected.slice(0, this.limitCount);
    if (this.wantSingle) return { data: selected[0] ? { ...selected[0] } : null, error: null };
    return { data: selected.map((row) => ({ ...row })), error: null };
  }

  then(onFulfilled?: (value: unknown) => unknown) {
    return Promise.resolve(this.run()).then(onFulfilled as (value: unknown) => unknown);
  }
}

function makeClient(options: FakeOptions = {}): { client: SupabaseClient; tables: Record<string, Row[]> } {
  const tables: Record<string, Row[]> = { verification_attempts: [], profiles: [], audit_log: [] };
  const client = {
    from(table: string) {
      tables[table] ??= [];
      return new FakeQuery(tables[table], options, table);
    },
  } as unknown as SupabaseClient;
  return { client, tables };
}

/** Fresh module instance per case, so the schema-drift flag never leaks. */
async function loadStore(options: FakeOptions = {}) {
  vi.resetModules();
  const store = await import('../lib/otp-store');
  const crypto = await import('../lib/otp-crypto');
  const { client, tables } = makeClient(options);
  return { ...store, crypto, admin: client, tables };
}

const EMAIL = 'student.du@du.ac.bd';
const UNIV = '9b0f2a6e-0000-4000-8000-000000000001';

describe('otp challenge store', () => {
  it('stores only a digest and a 5-minute expiry', async () => {
    const store = await loadStore();
    const code = '482913';

    const created = await store.createOtpChallenge({
      admin: store.admin,
      email: EMAIL,
      universityId: UNIV,
      code,
      ipAddress: '203.0.113.7',
      signupPayload: { role: 'student' },
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ttl = new Date(created.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(4 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000);

    const [row] = store.tables.verification_attempts;
    expect(row.otp_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code); // plaintext never persisted
    expect(store.crypto.otpHashMatches(String(row.otp_hash), EMAIL, code)).toBe(true);
    expect(store.crypto.otpHashMatches(String(row.otp_hash), EMAIL, '000000')).toBe(false);
  });

  it('keeps only the newest challenge verifiable and consumes it on success', async () => {
    const store = await loadStore();
    const first = '111111';
    const second = '222222';

    await store.createOtpChallenge({ admin: store.admin, email: EMAIL, universityId: UNIV, code: first });
    const created = await store.createOtpChallenge({ admin: store.admin, email: EMAIL, universityId: UNIV, code: second });
    expect(store.tables.verification_attempts).toHaveLength(2);
    if (!created.ok) throw new Error('challenge not created');

    const active = await store.readActiveOtpChallenge(store.admin, EMAIL);
    expect(active).toBeTruthy();
    expect(store.crypto.otpHashMatches(active!.otp_hash, EMAIL, second)).toBe(true);
    expect(store.crypto.otpHashMatches(active!.otp_hash, EMAIL, first)).toBe(false);

    await store.consumeOtpChallenge(store.admin, active!.id, { verified: true, clearHash: true });
    const [row] = store.tables.verification_attempts.filter((entry) => entry.id === active!.id);
    expect(row.otp_hash).toBeNull(); // OTP cleared from the database
    expect(row.verified_at).toBeTruthy();
    expect(row.consumed_at).toBeTruthy();
    expect(await store.readActiveOtpChallenge(store.admin, EMAIL)).toBeNull(); // replay refused
  });

  it('refuses an expired code and revokes it', async () => {
    const store = await loadStore();
    const created = await store.createOtpChallenge({
      admin: store.admin,
      email: EMAIL,
      universityId: UNIV,
      code: '333333',
      ttlMs: -1000, // already past its deadline
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const active = await store.readActiveOtpChallenge(store.admin, EMAIL);
    expect(active && store.isChallengeExpired(active)).toBe(true);

    await store.consumeOtpChallenge(store.admin, active!.id, { verified: false, clearHash: true });
    expect(await store.readActiveOtpChallenge(store.admin, EMAIL)).toBeNull();
  });

  it('burns attempts and revokes the code once the budget is spent', async () => {
    const store = await loadStore();
    await store.createOtpChallenge({ admin: store.admin, email: EMAIL, universityId: UNIV, code: '444444' });
    let active = await store.readActiveOtpChallenge(store.admin, EMAIL);
    expect(store.hasAttemptsLeft(active!)).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      await store.recordOtpFailure(store.admin, active!);
      active = await store.readActiveOtpChallenge(store.admin, EMAIL);
    }

    // 5 wrong guesses: revoked, so nothing is verifiable any more.
    expect(active).toBeNull();
    const [row] = store.tables.verification_attempts;
    expect(Number(row.attempt_count)).toBe(5);
  });

  it('reports a cooldown while a recent request exists', async () => {
    const store = await loadStore();
    await store.createOtpChallenge({ admin: store.admin, email: EMAIL, universityId: UNIV, code: '555555' });
    expect(await store.isOtpRequestInCooldown(store.admin, EMAIL, 60)).toBe(true);
    expect(await store.isOtpRequestInCooldown(store.admin, 'nobody.du@du.ac.bd', 60)).toBe(false);
  });

  it('degrades to the pre-0011 schema instead of failing sign-up', async () => {
    const store = await loadStore({ extendedSchema: false });
    const code = '666666';

    const created = await store.createOtpChallenge({
      admin: store.admin,
      email: EMAIL,
      universityId: UNIV,
      code,
    });
    expect(created.ok).toBe(true);
    expect(store.otpUsesExtendedColumns()).toBe(false);

    const active = await store.readActiveOtpChallenge(store.admin, EMAIL);
    expect(active).toBeTruthy();
    expect(store.crypto.otpHashMatches(active!.otp_hash, EMAIL, code)).toBe(true);

    // No consumed_at + otp_hash NOT NULL → retirement is verified_at only.
    await store.consumeOtpChallenge(store.admin, active!.id, { verified: true, clearHash: true });
    const [row] = store.tables.verification_attempts;
    expect(row.otp_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.verified_at).toBeTruthy();
    expect(await store.readActiveOtpChallenge(store.admin, EMAIL)).toBeNull();
  });
});
