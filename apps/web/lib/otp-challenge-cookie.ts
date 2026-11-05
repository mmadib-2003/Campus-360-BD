// apps/web/lib/otp-challenge-cookie.ts
// ============================================================================
// Stateless, HMAC-signed cookie backup for the email-OTP flow.
//
// Vercel serverless functions do not share in-memory state, and the Supabase
// challenge row can be momentarily unreadable (cold start, RLS hiccup, replica
// lag). `request-otp` therefore ALSO seals the challenge digest into an
// HTTP-only signed cookie (`campus360_otp_challenge`), and `verify-otp` can
// validate the submitted code against that cookie when the database lookup
// misses — the code is still only ever stored as an HMAC digest, never plain.
//
// A second short-lived cookie (`campus360_otp_verified`) is a *verification
// receipt*: { email, otpHash, verifiedAt }. It lets a duplicate / retried
// `verify-otp` call (double-click, auto-submit + click, lost first response)
// succeed idempotently within OTP_IDEMPOTENCY_WINDOW_SECONDS instead of
// answering "No active OTP challenge found" after the row was consumed.
//
// Token format matches lib/demo-auth.ts: `<base64url(json)>.<base64url(hmac)>`,
// keyed by getDemoSessionSecret() (CSRF_SIGNING_SECRET → JWT secret → …).
// Server-only: imports node:crypto, never import from a client component.
// ============================================================================

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDemoSessionSecret } from '@/lib/demo-session-edge';
import { OTP_TTL_SECONDS } from '@/lib/demo-otp';
import { otpHashMatches } from '@/lib/otp-crypto';

export const OTP_CHALLENGE_COOKIE = 'campus360_otp_challenge';
export const OTP_VERIFIED_COOKIE = 'campus360_otp_verified';

/** Duplicate verify-otp calls inside this window succeed idempotently. */
export const OTP_IDEMPOTENCY_WINDOW_SECONDS = 120;

export interface OtpChallengeCookiePayload {
  email: string;
  /** HMAC-SHA256(email:code) digest — identical to verification_attempts.otp_hash. */
  otpHash: string;
  /** Per-issuance random nonce; covered by the signature so cookies never collide. */
  salt: string;
  /** ISO deadline (generation + 5 minutes). */
  expiresAt: string;
  universityId: string;
  hallId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  fullName?: string | null;
  studentId?: string | null;
  role?: string | null;
  /** verification_attempts row id, for best-effort consumption on the fallback path. */
  challengeId?: string | null;
  iat: number;
}

export interface OtpVerifiedReceipt {
  email: string;
  otpHash: string;
  verifiedAt: number;
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

function hmacSign(payloadBase64Url: string): string {
  return toBase64Url(
    crypto.createHmac('sha256', getDemoSessionSecret()).update(payloadBase64Url).digest()
  );
}

function seal(payload: unknown): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${hmacSign(encoded)}`;
}

function open<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const payloadPart = raw.slice(0, dot);
  const sigPart = raw.slice(dot + 1);
  if (!payloadPart || !sigPart) return null;

  const expected = hmacSign(payloadPart);
  const sigBuf = Buffer.from(sigPart, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  const bytes = fromBase64Url(payloadPart);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure sign / verify (no request scope) — unit-testable.
// ---------------------------------------------------------------------------

export function signOtpChallengeCookie(payload: OtpChallengeCookiePayload): string {
  return seal(payload);
}

/** Signature + shape + expiry check. Returns null for anything tampered/stale. */
export function verifyOtpChallengeCookie(
  raw: string | null | undefined,
  now: number = Date.now()
): OtpChallengeCookiePayload | null {
  const parsed = open<OtpChallengeCookiePayload>(raw);
  if (!parsed) return null;
  if (typeof parsed.email !== 'string' || !parsed.email.includes('@')) return null;
  if (typeof parsed.otpHash !== 'string' || !/^[0-9a-f]{64}$/.test(parsed.otpHash)) return null;
  if (typeof parsed.universityId !== 'string' || !parsed.universityId) return null;
  if (typeof parsed.salt !== 'string' || !parsed.salt) return null;
  const expiry = Date.parse(parsed.expiresAt);
  if (Number.isNaN(expiry) || now > expiry) return null;
  return parsed;
}

export function signOtpVerifiedReceipt(receipt: OtpVerifiedReceipt): string {
  return seal(receipt);
}

/**
 * True when the receipt proves this exact email + code was verified within the
 * idempotency window. The digest comparison is constant-time (otpHashMatches).
 */
export function otpVerifiedReceiptMatches(
  raw: string | null | undefined,
  email: string,
  otp: string,
  now: number = Date.now()
): boolean {
  const parsed = open<OtpVerifiedReceipt>(raw);
  if (!parsed) return false;
  if (typeof parsed.email !== 'string' || parsed.email !== email.trim().toLowerCase()) return false;
  if (typeof parsed.verifiedAt !== 'number') return false;
  if (now - parsed.verifiedAt > OTP_IDEMPOTENCY_WINDOW_SECONDS * 1000) return false;
  if (parsed.verifiedAt > now + 5_000) return false; // clock-skew guard
  return otpHashMatches(parsed.otpHash, email, otp);
}

// ---------------------------------------------------------------------------
// Request-scoped cookie helpers (route handlers only).
// ---------------------------------------------------------------------------

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function setOtpChallengeCookie(payload: Omit<OtpChallengeCookiePayload, 'salt' | 'iat'>): void {
  try {
    const full: OtpChallengeCookiePayload = {
      ...payload,
      email: payload.email.trim().toLowerCase(),
      salt: crypto.randomBytes(16).toString('hex'),
      iat: Date.now(),
    };
    cookies().set(OTP_CHALLENGE_COOKIE, signOtpChallengeCookie(full), {
      ...COOKIE_BASE,
      maxAge: OTP_TTL_SECONDS,
    });
  } catch {
    /* outside request scope (tests) — the database row remains authoritative */
  }
}

export function readOtpChallengeCookie(): OtpChallengeCookiePayload | null {
  try {
    return verifyOtpChallengeCookie(cookies().get(OTP_CHALLENGE_COOKIE)?.value);
  } catch {
    return null;
  }
}

export function clearOtpChallengeCookie(): void {
  try {
    cookies().set(OTP_CHALLENGE_COOKIE, '', { ...COOKIE_BASE, maxAge: 0 });
  } catch {
    /* ignore outside request scope */
  }
}

export function setOtpVerifiedReceipt(email: string, otpHash: string): void {
  try {
    const receipt: OtpVerifiedReceipt = {
      email: email.trim().toLowerCase(),
      otpHash,
      verifiedAt: Date.now(),
    };
    cookies().set(OTP_VERIFIED_COOKIE, signOtpVerifiedReceipt(receipt), {
      ...COOKIE_BASE,
      maxAge: OTP_IDEMPOTENCY_WINDOW_SECONDS,
    });
  } catch {
    /* ignore outside request scope */
  }
}

export function readOtpVerifiedReceiptRaw(): string | null {
  try {
    return cookies().get(OTP_VERIFIED_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}
