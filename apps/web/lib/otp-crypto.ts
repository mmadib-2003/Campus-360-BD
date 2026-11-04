// apps/web/lib/otp-crypto.ts
// ============================================================================
// Server-only OTP hashing and comparison.
//
// `verification_attempts.otp_hash` stores HMAC-SHA256(`${email}:${code}`)
// keyed by `OTP_PEPPER_SECRET` — never the plaintext code. The pepper means a
// database leak alone cannot be replayed against `/api/auth/verify-otp`:
// an attacker would need the digest *and* the server-side secret.
//
// Imported exclusively by route handlers / server modules (it pulls in
// `node:crypto`), never by a client component.
// ============================================================================

import crypto from 'crypto';
import { OTP_LENGTH } from '@/lib/demo-otp';

/** Shape of a stored digest — anything else (NULL after consumption, a legacy
 *  5-digit demo value, a truncated write) can never verify. */
const OTP_HASH_PATTERN = new RegExp(`^[0-9a-f]{64}$`);

/** Wire format the client and `VerifyOtpSchema` both enforce. */
const OTP_CODE_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

const DEV_PEPPER = 'default-dev-pepper-override-in-prod';

let warnedAboutPepper = false;

/**
 * HMAC key for OTP digests. `OTP_PEPPER_SECRET` is mandatory in production;
 * outside production it falls back to a fixed dev key so local runs work.
 */
export function otpPepper(): string {
  const pepper = process.env.OTP_PEPPER_SECRET?.trim();
  if (pepper) return pepper;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'OTP_PEPPER_SECRET is not set. Refusing to hash OTPs with a default pepper in production.'
    );
  }
  if (!warnedAboutPepper) {
    warnedAboutPepper = true;
    console.warn(
      '[otp] OTP_PEPPER_SECRET is not set — using the development pepper. Do not ship this configuration.'
    );
  }
  return DEV_PEPPER;
}

/**
 * Deployment guard for the auth routes: returns a message when the pepper is
 * missing in production (where hashing would otherwise throw mid-request), or
 * `null` when OTP hashing is safe to run.
 */
export function otpSecurityConfigError(): string | null {
  if (process.env.OTP_PEPPER_SECRET?.trim()) return null;
  if (process.env.NODE_ENV === 'production') {
    return 'OTP_PEPPER_SECRET is not configured on this server.';
  }
  return null;
}

/** Digest of `${email}:${code}` scoped to the address, so a code cannot be
 *  replayed against a different account. */
export function hashOtp(email: string, code: string, pepper: string = otpPepper()): string {
  return crypto.createHmac('sha256', pepper).update(`${email.trim().toLowerCase()}:${code}`).digest('hex');
}

/**
 * Constant-time comparison of the candidate code against the stored digest.
 * Fails closed on malformed input instead of throwing (`timingSafeEqual`
 * throws for mismatched buffer lengths, which a cleared/NULL hash would hit).
 */
export function otpHashMatches(
  storedHash: string | null | undefined,
  email: string,
  candidateCode: string
): boolean {
  if (typeof storedHash !== 'string' || !OTP_HASH_PATTERN.test(storedHash)) return false;
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(candidateCode)) return false;

  const candidate = Buffer.from(hashOtp(email, candidateCode), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

/** Normalize user input before hashing: digits only, exactly 6. */
export function normalizeOtpInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === OTP_LENGTH ? digits : null;
}
