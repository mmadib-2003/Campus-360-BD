// apps/web/lib/verified-session.ts
// ============================================================================
// Node-side issuer/reader for `campus360_verified_session` (see the edge module
// for the why). Server-only: imports node:crypto and next/headers.
//
// Contract:
//   • Issued ONLY after a 6-digit OTP digest matched (or a Supabase session was
//     already verified) — never from form input alone.
//   • HTTP-only, SameSite=Lax, Secure in production, path '/'.
//   • `persistence: 'pending'` marks a cookie-only identity whose profile write
//     failed; `/api/auth/session` retries the write and re-mints the cookie.
// ============================================================================
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import {
  VERIFIED_SESSION_COOKIE,
  VERIFIED_SESSION_MAX_AGE_SECONDS,
  verifiedSessionSecret,
  type VerifiedSessionPayload,
  type VerifiedSessionRole,
} from '@/lib/verified-session-edge';

export {
  VERIFIED_SESSION_COOKIE,
  VERIFIED_SESSION_MAX_AGE_SECONDS,
  type VerifiedSessionPayload,
  type VerifiedSessionRole,
};

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hmacSign(payloadBase64Url: string, secret: string): string {
  return toBase64Url(crypto.createHmac('sha256', secret).update(payloadBase64Url).digest());
}

/** Pure signer — unit-testable without a request scope. */
export function signVerifiedSessionToken(payload: VerifiedSessionPayload): string | null {
  const secret = verifiedSessionSecret();
  if (!secret) return null;
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${hmacSign(encoded, secret)}`;
}

export interface IssueVerifiedSessionInput {
  id: string;
  email: string;
  role: string;
  fullName: string;
  studentId?: string | null;
  universityId: string;
  universityCode?: string | null;
  universityName?: string | null;
  hallId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  programSession?: string | null;
  persistence?: 'supabase' | 'pending';
  needsOnboarding?: boolean;
}

export function normalizeVerifiedRole(value: unknown): VerifiedSessionRole {
  const role = String(value ?? '').trim().toLowerCase();
  if (role === 'faculty' || role === 'alumni' || role === 'admin' || role === 'governance') return role;
  return 'student';
}

/** Build the signed payload (no cookie write) so callers can inspect it. */
export function buildVerifiedSessionPayload(input: IssueVerifiedSessionInput): VerifiedSessionPayload {
  const now = Date.now();
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    role: normalizeVerifiedRole(input.role),
    fullName: input.fullName?.trim() || input.email.split('@')[0],
    studentId: input.studentId || null,
    universityId: input.universityId,
    universityCode: input.universityCode || null,
    universityName: input.universityName || null,
    hallId: normalizeVerifiedRole(input.role) === 'student' ? input.hallId || null : null,
    departmentId: input.departmentId || null,
    programId: input.programId || null,
    programSession: input.programSession || null,
    emailVerified: true,
    trustLevel: 'EMAIL_VERIFIED',
    persistence: input.persistence ?? 'supabase',
    needsOnboarding: Boolean(input.needsOnboarding),
    isDemo: false,
    iat: now,
    exp: now + VERIFIED_SESSION_MAX_AGE_SECONDS * 1000,
  };
}

/**
 * Seal the payload and write the cookie. Returns the payload even when the
 * cookie write is unavailable (unit tests / Server Component render pass) so
 * the caller can still describe the session it established.
 */
export function issueVerifiedSession(input: IssueVerifiedSessionInput): VerifiedSessionPayload {
  const payload = buildVerifiedSessionPayload(input);
  const token = signVerifiedSessionToken(payload);
  if (token) {
    try {
      cookies().set(VERIFIED_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: VERIFIED_SESSION_MAX_AGE_SECONDS,
      });
    } catch {
      /* outside request scope — the Supabase session remains authoritative */
    }
  }
  return payload;
}

/** Synchronous counterpart of verifyVerifiedSessionTokenEdge (same format). */
export function verifyVerifiedSessionToken(
  rawCookie: string | null | undefined,
  now: number = Date.now()
): VerifiedSessionPayload | null {
  if (!rawCookie) return null;
  const secret = verifiedSessionSecret();
  if (!secret) return null;
  const dot = rawCookie.indexOf('.');
  if (dot <= 0) return null;
  const payloadPart = rawCookie.slice(0, dot);
  const sigPart = rawCookie.slice(dot + 1);
  if (!payloadPart || !sigPart) return null;

  const expected = hmacSign(payloadPart, secret);
  const sigBuf = Buffer.from(sigPart, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as Partial<VerifiedSessionPayload>;
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

export function readVerifiedSessionRaw(): string | null {
  try {
    return cookies().get(VERIFIED_SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export function readVerifiedSession(): VerifiedSessionPayload | null {
  return verifyVerifiedSessionToken(readVerifiedSessionRaw());
}

export function clearVerifiedSession(): void {
  try {
    cookies().set(VERIFIED_SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  } catch {
    /* ignore outside request scope */
  }
}

/** App role rows implied by a verified account role (DB rows win when readable). */
export function appRolesForVerifiedRole(role: string): string[] {
  switch (normalizeVerifiedRole(role)) {
    case 'faculty':
      return ['FACULTY'];
    case 'alumni':
      return ['ALUMNI'];
    case 'admin':
      return ['ADMIN'];
    case 'governance':
      return ['GOVERNANCE'];
    default:
      return ['STUDENT'];
  }
}

/**
 * The profile projection clients render, built from signed claims. Used when
 * the database row is missing/unreadable so a verified user is never bounced
 * back to the OTP form with a null profile.
 */
export function buildVerifiedProfile(session: VerifiedSessionPayload) {
  return {
    id: session.id,
    email: session.email,
    full_name: session.fullName,
    name: session.fullName,
    role: session.role,
    university_id: session.universityId,
    department_id: session.departmentId,
    program_id: session.programId,
    program_session: session.programSession,
    hall_id: session.role === 'student' ? session.hallId : null,
    student_id: session.studentId,
    trust_level: session.trustLevel,
    email_verified: true,
    is_verified: true,
    is_demo: false,
    onboarding_completed: !session.needsOnboarding,
    universities: session.universityCode
      ? {
          code: session.universityCode,
          name_en: session.universityName ?? session.universityCode,
          name_bn: session.universityName ?? session.universityCode,
        }
      : null,
    halls: null,
    /** Operators/clients can see the account is waiting on its database write. */
    profile_pending: session.persistence === 'pending',
  };
}
