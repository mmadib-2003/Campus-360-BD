// apps/web/lib/verified-session-edge.ts
// ============================================================================
// Edge-Runtime-safe verification of `campus360_verified_session`.
//
// Why a second session cookie exists
// ----------------------------------
// A 6-digit OTP proves control of the mailbox. That proof must survive even
// when the *account plumbing* behind it is having a bad day: a missing/rotated
// service-role key, an RLS hiccup, a GoTrue outage or a database constraint can
// all prevent Supabase from minting its own session cookies. Previously that
// turned a correct code into "your email is verified, but the account could not
// be loaded" and a dead end.
//
// `verify-otp` therefore seals the verified identity into this HMAC-signed,
// HTTP-only cookie as well. It is issued ONLY after the code digest matched, so
// it carries the same trust as the Supabase session it stands in for.
//
// This module is Web-Crypto only so `middleware.ts` (edge) and Node route
// handlers verify the exact same token format: `<b64url(json)>.<b64url(hmac)>`.
// The Node-side issuer lives in lib/verified-session.ts.
// ============================================================================

export const VERIFIED_SESSION_COOKIE = 'campus360_verified_session';

/** Seven days, matching the Supabase/demo session lifetime. */
export const VERIFIED_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type VerifiedSessionRole = 'student' | 'faculty' | 'alumni' | 'admin' | 'governance';

export interface VerifiedSessionPayload {
  /** auth.users/profiles id, or a deterministic placeholder when unwritten. */
  id: string;
  email: string;
  role: VerifiedSessionRole;
  fullName: string;
  studentId: string | null;
  universityId: string;
  universityCode: string | null;
  universityName: string | null;
  hallId: string | null;
  departmentId: string | null;
  programId: string | null;
  programSession: string | null;
  emailVerified: true;
  trustLevel: 'EMAIL_VERIFIED';
  /**
   * `supabase` — the profile row is persisted and authoritative.
   * `pending`  — cookie-only identity; the next session read retries the write.
   */
  persistence: 'supabase' | 'pending';
  needsOnboarding: boolean;
  isDemo: false;
  iat: number;
  exp: number;
}

/**
 * Signing key for real (non-demo) sessions. Unlike the demo cookie, a verified
 * session grants a real identity, so production refuses the built-in demo
 * fallback secret rather than shipping a forgeable token.
 */
export function verifiedSessionSecret(): string | null {
  const secret =
    process.env.CSRF_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';
  if (secret) return secret;
  return process.env.NODE_ENV === 'production' ? null : 'campus360-bd-demo-session-secret-v1';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Shape + signature + expiry. Anything tampered, stale or unsigned is null. */
export async function verifyVerifiedSessionTokenEdge(
  rawCookie: string | null | undefined,
  now: number = Date.now()
): Promise<VerifiedSessionPayload | null> {
  if (!rawCookie) return null;
  const secret = verifiedSessionSecret();
  if (!secret) return null;

  const dot = rawCookie.indexOf('.');
  if (dot <= 0) return null;
  const payloadPart = rawCookie.slice(0, dot);
  const sigPart = rawCookie.slice(dot + 1);
  if (!payloadPart || !sigPart) return null;

  try {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(payloadPart));
    if (!constantTimeEqual(sigPart, bytesToBase64Url(new Uint8Array(signature)))) return null;

    const bytes = base64UrlToBytes(payloadPart);
    if (!bytes) return null;
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<VerifiedSessionPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.id !== 'string' || !parsed.id) return null;
    if (typeof parsed.email !== 'string' || !parsed.email.includes('@')) return null;
    if (typeof parsed.universityId !== 'string' || !parsed.universityId) return null;
    if (!['student', 'faculty', 'alumni', 'admin', 'governance'].includes(String(parsed.role))) return null;
    if (parsed.emailVerified !== true) return null;
    if (typeof parsed.exp !== 'number' || now > parsed.exp) return null;
    return parsed as VerifiedSessionPayload;
  } catch {
    return null;
  }
}
