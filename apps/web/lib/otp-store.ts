// apps/web/lib/otp-store.ts
// ============================================================================
// Server-only persistence for OTP challenges in Supabase (`verification_attempts`).
//
// Every write goes through `createSupabaseAdminClient()` (apps/web/lib/supabase-
// server.ts) — the service-role client is required because the table is RLS-
// locked and the request happens before the caller has a session.
//
// Storage rules:
//   • `otp_hash`      — HMAC-SHA256(email:code) digest, never the plaintext code.
//   • `expires_at`    — generation time + 5 minutes (OTP_TTL_MS); verification
//                       refuses any row past this instant.
//   • `verified_at`   — set once the code has been accepted (single use).
//   • `consumed_at`   — set when a challenge is retired (replaced by a newer
//                       code, exhausted attempts, or successful verification),
//                       so stale rows can never be picked up again.
//   • `delivery_status` / `email_message_id` / `email_sent_at` — SMTP
//                       bookkeeping (Nodemailer), so support can answer "the
//                       code never arrived" from the database alone.
//
// The three extended columns ship in migration 0011_email_otp_verification.sql.
// If it has not been applied yet, each write transparently retries with the
// base column set (from migration 0002) instead of failing the sign-up flow —
// `verified_at` alone already guarantees single use.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { hashOtp } from '@/lib/otp-crypto';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  isOtpExpired,
  otpExpiresAt,
  remainingOtpSeconds,
} from '@/lib/demo-otp';

export const OTP_BASE_COLUMNS =
  'id, email, university_id, otp_hash, ip_address, attempt_count, max_attempts, expires_at, verified_at, signup_payload, created_at';

export const OTP_EXTENDED_COLUMNS = `${OTP_BASE_COLUMNS}, consumed_at, delivery_status, email_message_id, email_sent_at, delivery_error`;

export type OtpDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface OtpChallenge {
  id: string;
  email: string;
  university_id: string;
  otp_hash: string | null;
  ip_address: string | null;
  attempt_count: number;
  max_attempts: number;
  expires_at: string;
  verified_at: string | null;
  consumed_at?: string | null;
  signup_payload?: Record<string, unknown> | null;
  delivery_status?: OtpDeliveryStatus;
  /** SMTP Message-ID for the send (see lib/otp-email.ts). */
  email_message_id?: string | null;
  created_at: string;
}

/**
 * Error surface of a database where migration 0011 has not been applied yet:
 *   • 42703 / PGRST204 — `consumed_at`, `delivery_status`, … are unknown columns.
 *   • 23502           — clearing `otp_hash` needs the DROP NOT NULL from 0011.
 * Both mean "fall back to the migration-0002 column set", not "fail sign-up".
 */
function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = String(error.message ?? '');
  return (
    error.code === '42703' ||
    error.code === '23502' ||
    /Could not find the .* column/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /null value in column .* violates not-null/i.test(message)
  );
}

let extendedColumnsAvailable = true;

export function otpUsesExtendedColumns(): boolean {
  return extendedColumnsAvailable;
}

function degradeGracefully(error: { code?: string; message?: string } | null | undefined): boolean {
  if (isMissingColumnError(error)) {
    if (extendedColumnsAvailable) {
      extendedColumnsAvailable = false;
      console.warn(
        '[otp] verification_attempts is missing the migration 0011 columns — continuing with base columns. Run `supabase db push` to enable delivery tracking.'
      );
    }
    return true;
  }
  return false;
}

export interface CreateOtpChallengeInput {
  admin: SupabaseClient;
  email: string;
  universityId: string;
  /** Plaintext code — hashed here, never stored. */
  code: string;
  ipAddress?: string | null;
  signupPayload?: Record<string, unknown> | null;
  ttlMs?: number;
}

export type CreateOtpChallengeResult =
  | { ok: true; id: string; expiresAt: string; secondsRemaining: number }
  | { ok: false; error: string };

/**
 * Retire any outstanding challenge for the address, then insert the new one.
 * Only the newest code is ever verifiable, which is what makes the resend
 * button an actual recovery path instead of "N live codes at once".
 */
export async function createOtpChallenge(input: CreateOtpChallengeInput): Promise<CreateOtpChallengeResult> {
  const { admin, email, code, ipAddress } = input;
  const expiresAt = otpExpiresAt(Date.now(), input.ttlMs ?? OTP_TTL_MS);

  await supersedeOpenChallenges(admin, email);

  const baseRow: Record<string, unknown> = {
    email,
    university_id: input.universityId,
    otp_hash: hashOtp(email, code),
    ip_address: ipAddress ?? '127.0.0.1',
    attempt_count: 0,
    max_attempts: OTP_MAX_ATTEMPTS,
    expires_at: expiresAt,
    signup_payload: input.signupPayload ?? {},
  };

  const insertWith = async (extended: boolean) => {
    const payload: Record<string, unknown> = extended
      ? { ...baseRow, consumed_at: null, delivery_status: 'PENDING' }
      : baseRow;

    return admin
      .from('verification_attempts')
      .insert(payload)
      .select('id, expires_at')
      .single();
  };

  let { data, error } = await insertWith(extendedColumnsAvailable);
  if (error && extendedColumnsAvailable && degradeGracefully(error)) {
    ({ data, error } = await insertWith(false));
  }

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Verification challenge insert failed.' };
  }

  return {
    ok: true,
    id: String(data.id),
    expiresAt: String(data.expires_at ?? expiresAt),
    secondsRemaining: remainingOtpSeconds(String(data.expires_at ?? expiresAt)),
  };
}

/** Mark every not-yet-verified challenge for the address as retired. */
export async function supersedeOpenChallenges(admin: SupabaseClient, email: string): Promise<number> {
  const retire = async (withHash: boolean) =>
    admin
      .from('verification_attempts')
      .update(
        withHash
          ? { consumed_at: new Date().toISOString(), otp_hash: null }
          : { consumed_at: new Date().toISOString() }
      )
      .eq('email', email)
      .is('verified_at', null)
      .is('consumed_at', null);

  let { error } = await retire(true);
  if (error && isMissingColumnError(error)) {
    // Pre-0011 there is no consumed_at, and verified_at must stay reserved for
    // real verifications — so a superseded challenge is simply removed.
    ({ error } = await admin
      .from('verification_attempts')
      .delete()
      .eq('email', email)
      .is('verified_at', null)
      .lt('expires_at', new Date().toISOString()));
  }
  if (error) return 0; // best-effort: the newest row wins on read anyway
  return 1;
}

/** Newest challenge that is still live (not verified, not retired). */
export async function readActiveOtpChallenge(
  admin: SupabaseClient,
  email: string
): Promise<OtpChallenge | null> {
  const query = async (columns: string, liveOnly: boolean) => {
    const builder = admin
      .from('verification_attempts')
      .select(columns)
      .eq('email', email)
      .is('verified_at', null);
    // consumed_at is pushed into the WHERE clause rather than filtered after the
    // fact, so "newest live row" is decided by the index, not by tie-breaking.
    const scoped = liveOnly ? builder.is('consumed_at', null) : builder;
    return scoped.order('created_at', { ascending: false }).limit(1).maybeSingle();
  };

  let { data, error } = await query(OTP_EXTENDED_COLUMNS, extendedColumnsAvailable);

  if (error && isMissingColumnError(error)) {
    extendedColumnsAvailable = false;
    ({ data, error } = await query(OTP_BASE_COLUMNS, false));
  }
  if (error) {
    console.error('[otp] challenge lookup failed', { code: error.code, message: error.message });
    return null;
  }

  // A retired row is not an active challenge even if it was never verified.
  const row = data as unknown as OtpChallenge | null;
  if (!row) return null;
  if (extendedColumnsAvailable && row.consumed_at) return null;
  return row;
}

/**
 * Newest challenge for the address that was *successfully verified* within the
 * last `withinSeconds` (default 120s). Used by verify-otp's idempotency guard:
 * a duplicate/retried submission right after a success must not be answered
 * with "No active OTP challenge found".
 *
 * `verified_at >= since` also excludes NULL rows in PostgREST (NULL comparisons
 * are never true), so unverified challenges can never match. Base columns only:
 * this read must work on the pre-0011 schema too.
 */
export async function readRecentVerifiedOtpChallenge(
  admin: SupabaseClient,
  email: string,
  withinSeconds = 120
): Promise<OtpChallenge | null> {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString();
  const { data, error } = await admin
    .from('verification_attempts')
    .select(OTP_BASE_COLUMNS)
    .eq('email', email)
    .gte('verified_at', since)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[otp] recent-verified lookup failed', { code: error.code, message: error.message });
    return null;
  }
  return (data as unknown as OtpChallenge | null) ?? null;
}

/** True when `seconds` have not elapsed since the last request for the address. */
export async function isOtpRequestInCooldown(
  admin: SupabaseClient,
  email: string,
  seconds: number
): Promise<boolean> {
  const since = new Date(Date.now() - seconds * 1000).toISOString();
  const { data } = await admin
    .from('verification_attempts')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export function isChallengeExpired(challenge: Pick<OtpChallenge, 'expires_at'>): boolean {
  return isOtpExpired(challenge.expires_at);
}

export function hasAttemptsLeft(challenge: OtpChallenge): boolean {
  return Number(challenge.attempt_count ?? 0) < Number(challenge.max_attempts ?? OTP_MAX_ATTEMPTS);
}

export interface ConsumeOtpChallengeOptions {
  /** Persist verified_at as well (successful verification). */
  verified?: boolean;
  /** Wipe the digest so a leaked row cannot be brute-forced offline. */
  clearHash?: boolean;
}

/**
 * Retire a challenge: `verified_at` + `consumed_at` set, `otp_hash` cleared to
 * NULL (step 4 of the email-OTP flow — "clear the OTP from the database").
 */
export async function consumeOtpChallenge(
  admin: SupabaseClient,
  id: string,
  options: ConsumeOtpChallengeOptions = {}
): Promise<void> {
  const { verified = true, clearHash = true } = options;
  const now = new Date().toISOString();

  // Pre-0011 schema has no consumed_at, so a revoked-but-unverified row would
  // still look "active" (verified_at IS NULL) to the next read. Deleting it is
  // the only way to retire it — and an unusable row has no diagnostic value.
  if (!verified && !extendedColumnsAvailable) {
    await admin.from('verification_attempts').delete().eq('id', id);
    return;
  }

  const apply = async (withExtended: boolean) =>
    admin
      .from('verification_attempts')
      .update({
        ...(verified ? { verified_at: now } : {}),
        ...(withExtended ? { consumed_at: now } : {}),
        // otp_hash is nullable only from migration 0011 onwards.
        ...(clearHash && withExtended ? { otp_hash: null } : {}),
      })
      .eq('id', id);

  let { error } = await apply(true);
  if (error && isMissingColumnError(error)) {
    ({ error } = await apply(false));
  }
  if (error) {
    console.error('[otp] failed to retire challenge', { code: error.code, message: error.message });
  }
}

/** Failed guess: burn one of the max_attempts, and retire the code once exhausted. */
export async function recordOtpFailure(admin: SupabaseClient, challenge: OtpChallenge): Promise<void> {
  const attempts = Number(challenge.attempt_count ?? 0) + 1;
  const exhausted = attempts >= Number(challenge.max_attempts ?? OTP_MAX_ATTEMPTS);

  await admin
    .from('verification_attempts')
    .update({ attempt_count: attempts })
    .eq('id', challenge.id);

  // Budget spent: revoke the code outright so guessing cannot continue across
  // the TTL window with a fresh request.
  if (exhausted) await consumeOtpChallenge(admin, challenge.id, { verified: false, clearHash: true });
}

/** Delivery bookkeeping after the SMTP server accepts the message. */
export async function markOtpEmailSent(
  admin: SupabaseClient,
  id: string,
  emailMessageId: string | null
): Promise<void> {
  const { error } = await admin
    .from('verification_attempts')
    .update({
      delivery_status: 'SENT',
      email_sent_at: new Date().toISOString(),
      email_message_id: emailMessageId,
    })
    .eq('id', id);

  if (error && isMissingColumnError(error)) {
    extendedColumnsAvailable = false;
    return;
  }
  if (error) {
    console.warn('[otp] could not record email delivery state', { code: error.code, message: error.message });
  }
}

/** Remove the challenge when delivery failed, so the user can retry instantly. */
export async function deleteOtpChallenge(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.from('verification_attempts').delete().eq('id', id);
  if (error) {
    console.warn('[otp] failed to roll back undelivered challenge', { code: error.code, message: error.message });
  }
}

/** Track B housekeeping — a demo code must never outlive its verification. */
export async function clearProfileDemoOtp(admin: SupabaseClient, email: string): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ demo_otp: null, demo_otp_expires_at: null })
    .eq('email', email);
  if (error && isMissingColumnError(error)) return; // demo columns not deployed
}

/** Persist the Track B plaintext code on the profile (demo panel parity). */
export async function storeProfileDemoOtp(
  admin: SupabaseClient,
  email: string,
  code: string,
  expiresAt: string
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ demo_otp: code, demo_otp_expires_at: expiresAt })
    .eq('email', email);
  if (error && isMissingColumnError(error)) return;
}
