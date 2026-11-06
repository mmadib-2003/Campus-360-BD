// apps/web/lib/otp-account.ts
// ============================================================================
// Account provisioning for a *verified* email address.
//
// The OTP digest has already matched when this module runs, so the mailbox is
// proven. From that point on nothing may turn a correct code into a dead end:
// every Supabase step here is best-effort and reports what it could not do in
// `degraded`, instead of returning an error the user cannot act on.
//
// Fixes the production failure "Your email is verified, but the account could
// not be loaded":
//   • The profile lookup no longer embeds `user_roles`. PostgREST cannot
//     disambiguate that relationship — `user_roles` has TWO foreign keys to
//     `profiles` (`user_id` and `granted_by`) — so the embedded select failed
//     with PGRST201 for *every* address, before any account was created.
//     Roles are now read with an explicit `user_id` query.
//   • A missing profile is upserted (never inserted blind), an existing
//     `auth.users` row is adopted instead of duplicated, and a personal email
//     domain never has to resolve to a university: the selected tenant wins,
//     with Jahangirnagar University as the documented last resort.
// ============================================================================
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ProgramSessionSchema } from '@campus360/shared';
import { authError, authLog } from '@/lib/auth-log';
import { redactEmail } from '@/lib/demo-otp';
import { JU_CANONICAL_UNIVERSITY_ID } from '@/lib/modules/demo-data';
import { displayNameFromEmail, normalizeAccountEmail } from '@/lib/auth-rules';

export { displayNameFromEmail, normalizeAccountEmail };

/** No embedded resources: every column here lives on `profiles` itself. */
export const ACCOUNT_PROFILE_COLUMNS =
  'id, email, university_id, role, hall_id, department_id, program_id, program_session, full_name, student_id, trust_level, onboarding_completed';

const PRIVILEGED_ROLES = ['admin', 'super_admin', 'university_admin', 'governance', 'governing_body'];

const APP_ROLE_BY_ACCOUNT_ROLE: Record<string, string> = {
  student: 'STUDENT',
  faculty: 'FACULTY',
  alumni: 'ALUMNI',
  admin: 'ADMIN',
  governance: 'GOVERNANCE',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccountContext {
  email?: string | null;
  universityId?: string | null;
  role?: string | null;
  hallId?: string | null;
  departmentId?: string | null;
  programId?: string | null;
  programSession?: string | null;
  fullName?: string | null;
  studentId?: string | null;
  purpose?: string | null;
}

export interface ResolvedAccountContext {
  email: string;
  universityId: string;
  role: string;
  hallId: string | null;
  departmentId: string | null;
  programId: string | null;
  programSession: string | null;
  fullName: string;
  studentId: string | null;
  purpose: string;
}

export interface VerifiedAccount {
  userId: string;
  email: string;
  /** Authoritative role: an existing account never loses privileges to a form. */
  role: string;
  universityId: string;
  universityCode: string | null;
  universityName: string | null;
  hallId: string | null;
  departmentId: string | null;
  programId: string | null;
  programSession: string | null;
  fullName: string;
  studentId: string | null;
  isNewUser: boolean;
  needsOnboarding: boolean;
  /** True when the profile row is readable/written in Supabase. */
  persisted: boolean;
  /** True when no real auth id could be resolved and a placeholder is in use. */
  synthetic: boolean;
  /** Machine-readable stage names for logs and the API response. */
  degraded: string[];
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Only students carry a hall; every other role persists NULL. */
export function hallForAccountRole(role: string, hallId: unknown): string | null {
  return role === 'student' && isUuid(hallId) ? hallId : null;
}

export function normalizeAccountRole(value: unknown): string {
  const role = String(value ?? '').trim().toLowerCase();
  return ['student', 'faculty', 'alumni', 'admin', 'governance'].includes(role) ? role : 'student';
}

export function validProgramSession(value: unknown): string | null {
  const parsed = ProgramSessionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Canonical account context. The issued challenge is authoritative; submitted
 * values only fill gaps. A missing/unusable university falls back to JU rather
 * than failing an otherwise verified `@gmail.com` sign-in.
 */
export function resolveAccountContext(
  issued: AccountContext,
  submitted: AccountContext = {}
): ResolvedAccountContext {
  const email = normalizeAccountEmail(issued.email || submitted.email);
  const pick = <T>(a: T | null | undefined, b: T | null | undefined): T | null =>
    a !== undefined && a !== null && a !== '' ? a : b !== undefined && b !== '' ? b : null;

  const role = normalizeAccountRole(pick(issued.role, submitted.role));
  const universityCandidate = pick(issued.universityId, submitted.universityId);
  const programSession = validProgramSession(pick(issued.programSession, submitted.programSession));
  const hallCandidate = role === 'student' ? pick(issued.hallId, submitted.hallId) : null;
  const departmentCandidate = pick(issued.departmentId, submitted.departmentId);
  const programCandidate = pick(issued.programId, submitted.programId);

  return {
    email,
    universityId: isUuid(universityCandidate) ? universityCandidate : JU_CANONICAL_UNIVERSITY_ID,
    role,
    hallId: hallForAccountRole(role, hallCandidate),
    departmentId: isUuid(departmentCandidate) ? departmentCandidate : null,
    programId: isUuid(programCandidate) ? programCandidate : null,
    programSession,
    fullName: String(pick(issued.fullName, submitted.fullName) ?? '').trim() || displayNameFromEmail(email),
    studentId: String(pick(issued.studentId, submitted.studentId) ?? '').trim() || null,
    purpose: String(pick(issued.purpose, submitted.purpose) ?? 'signin'),
  };
}

/**
 * Stable placeholder id for a verified email whose database write has not
 * landed yet. Deterministic so repeated sign-ins keep the same identity until
 * the real `auth.users` id is adopted by the self-healing session read.
 */
export function syntheticProfileId(email: string): string {
  const digest = crypto.createHash('sha256').update(`campus360:verified:${normalizeAccountEmail(email)}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5-ish (name based)
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function alreadyRegistered(error: { code?: string; status?: number; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return true;
  return /already (?:been )?(?:registered|exists)|email_exists/i.test(String(error.message ?? ''));
}

/**
 * Resolve an existing `auth.users` id by email. `generateLink` returns the user
 * object without sending anything; `listUsers` is the bounded fallback for
 * deployments where link generation is restricted.
 */
export async function findAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (!error && data?.user?.id) return String(data.user.id);
  } catch (error) {
    authError('otp-account.locate-user-link-failed', error, { email: redactEmail(email) });
  }
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (!error) {
      const match = (data?.users ?? []).find((user) => normalizeAccountEmail(user.email ?? '') === email);
      if (match?.id) return String(match.id);
    }
  } catch (error) {
    authError('otp-account.locate-user-list-failed', error, { email: redactEmail(email) });
  }
  return null;
}

async function readUniversity(
  admin: SupabaseClient,
  universityId: string
): Promise<{ code: string | null; name_en: string | null }> {
  try {
    const { data, error } = await admin
      .from('universities')
      .select('code, name_en')
      .eq('id', universityId)
      .maybeSingle();
    if (!error && data) return { code: data.code ?? null, name_en: data.name_en ?? null };
  } catch {
    /* cosmetic only — the tenant id is what matters */
  }
  return { code: null, name_en: null };
}

/**
 * Create or complete the account behind a verified email. Never throws and
 * never returns a failure response: unresolved steps are listed in `degraded`
 * and the caller issues a signed verified-session cookie regardless.
 */
export async function ensureVerifiedAccount(
  admin: SupabaseClient,
  context: ResolvedAccountContext
): Promise<VerifiedAccount> {
  const degraded: string[] = [];
  const { email, role: requestedRole, programSession } = context;
  const universityId = context.universityId;

  const result: VerifiedAccount = {
    userId: syntheticProfileId(email),
    email,
    role: requestedRole,
    universityId,
    universityCode: null,
    universityName: null,
    hallId: context.hallId,
    departmentId: context.departmentId,
    programId: context.programId,
    programSession,
    fullName: context.fullName,
    studentId: context.studentId,
    isNewUser: false,
    needsOnboarding: !programSession || (requestedRole === 'student' && !context.hallId),
    persisted: false,
    synthetic: true,
    degraded,
  };

  // --- 1. Existing profile? Plain columns only (no ambiguous embed).
  let existing: Record<string, unknown> | null = null;
  try {
    const { data, error } = await admin
      .from('profiles')
      .select(ACCOUNT_PROFILE_COLUMNS)
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    existing = (data as unknown as Record<string, unknown> | null) ?? null;
  } catch (error) {
    authError('otp-account.profile-lookup-failed', error, { email: redactEmail(email) });
    degraded.push('profile-lookup');
  }

  // --- 2. Authoritative roles, read through the explicit user_id relationship.
  let assignedRoles: string[] = [];
  if (existing?.id) {
    try {
      const { data, error } = await admin.from('user_roles').select('role').eq('user_id', String(existing.id));
      if (error) throw error;
      assignedRoles = (data ?? []).map((row: { role?: unknown }) => String(row.role ?? '').toLowerCase()).filter(Boolean);
    } catch (error) {
      authError('otp-account.role-lookup-failed', error, { email: redactEmail(email) });
      degraded.push('role-lookup');
    }
  }
  const privileged = assignedRoles.some((role) => PRIVILEGED_ROLES.includes(role));
  const authoritativeRole = privileged
    ? 'admin'
    : normalizeAccountRole(assignedRoles[0] ?? existing?.role ?? requestedRole);
  result.role = authoritativeRole;

  const university = await readUniversity(admin, universityId);
  result.universityCode = university.code;
  result.universityName = university.name_en;

  // --- 3. Existing account: complete it, never rewrite its identity.
  if (existing?.id) {
    const userId = String(existing.id);
    result.userId = userId;
    result.synthetic = false;
    result.persisted = true;
    result.universityId = String(existing.university_id ?? universityId);
    result.programSession = programSession ?? validProgramSession(existing.program_session);
    result.hallId = isUuid(existing.hall_id) ? String(existing.hall_id) : context.hallId;
    result.fullName = String(existing.full_name ?? '').trim() || context.fullName;
    result.studentId = String(existing.student_id ?? '').trim() || context.studentId;

    const updates: Record<string, unknown> = { email_verified: true };
    if (programSession && programSession !== existing.program_session) updates.program_session = programSession;
    if (String(existing.trust_level ?? 'UNVERIFIED') === 'UNVERIFIED') updates.trust_level = 'EMAIL_VERIFIED';
    if (!String(existing.full_name ?? '').trim()) updates.full_name = context.fullName;
    if (!String(existing.student_id ?? '').trim() && context.studentId) updates.student_id = context.studentId;
    // Hall/department changes only apply inside the same tenant and when the
    // login selector agrees with the account's authoritative role.
    if (result.universityId === universityId && authoritativeRole === requestedRole) {
      if (requestedRole === 'student' && context.hallId) updates.hall_id = context.hallId;
      if (requestedRole === 'faculty' || requestedRole === 'alumni') updates.hall_id = null;
      if (context.departmentId && !existing.department_id) updates.department_id = context.departmentId;
      if (context.programId && !existing.program_id) updates.program_id = context.programId;
    }
    if (result.programSession && (requestedRole !== 'student' || result.hallId)) updates.onboarding_completed = true;

    try {
      const { error } = await admin.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;
    } catch (error) {
      authError('otp-account.profile-update-failed', error, { email: redactEmail(email) });
      degraded.push('profile-update');
    }
    result.hallId = authoritativeRole === 'student' ? result.hallId : null;
    result.needsOnboarding = !result.programSession || (authoritativeRole === 'student' && !result.hallId);
    authLog('otp-account.existing', { email: redactEmail(email), role: authoritativeRole, degraded });
    return result;
  }

  // --- 4. No profile: create the auth user, or adopt the one that exists.
  let userId: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        university_id: universityId,
        role: requestedRole,
        hall_id: context.hallId,
        department_id: context.departmentId,
        program_id: context.programId,
        program_session: programSession,
        full_name: context.fullName,
        student_id: context.studentId,
        email_verified: true,
      },
    });
    if (error) {
      if (alreadyRegistered(error)) {
        userId = await findAuthUserIdByEmail(admin, email);
      } else {
        throw error;
      }
    } else if (data?.user?.id) {
      userId = String(data.user.id);
      result.isNewUser = true;
    }
  } catch (error) {
    authError('otp-account.user-create-failed', error, { email: redactEmail(email) });
    degraded.push('auth-create');
  }
  if (!userId) {
    userId = await findAuthUserIdByEmail(admin, email);
    if (!userId) degraded.push('auth-lookup');
  }

  // --- 5. Upsert the profile (completes a trigger-created row instead of
  // colliding with it) and assign the app role. Both are best-effort.
  if (userId) {
    result.userId = userId;
    result.synthetic = false;
    const row = {
      id: userId,
      email,
      university_id: universityId,
      role: requestedRole,
      hall_id: context.hallId,
      department_id: context.departmentId,
      program_id: context.programId,
      program_session: programSession,
      full_name: context.fullName,
      student_id: context.studentId,
      trust_level: 'EMAIL_VERIFIED',
      email_verified: true,
      onboarding_completed: Boolean(programSession) && (requestedRole !== 'student' || Boolean(context.hallId)),
    };
    try {
      const { error } = await admin.from('profiles').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      result.persisted = true;
    } catch (error) {
      authError('otp-account.profile-upsert-failed', error, { email: redactEmail(email) });
      degraded.push('profile-upsert');
      // A row may exist under a different id (historical data / unique email).
      try {
        const { data } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
        if (data?.id) {
          result.userId = String(data.id);
          result.persisted = true;
        }
      } catch {
        /* keep the auth id */
      }
    }
    try {
      const { error } = await admin.from('user_roles').upsert(
        {
          user_id: result.userId,
          university_id: universityId,
          role: APP_ROLE_BY_ACCOUNT_ROLE[requestedRole] ?? 'STUDENT',
        },
        { onConflict: 'user_id,university_id,role', ignoreDuplicates: true }
      );
      if (error) throw error;
    } catch (error) {
      authError('otp-account.role-assign-failed', error, { email: redactEmail(email) });
      degraded.push('role-assign');
    }
  }

  result.needsOnboarding = !programSession || (requestedRole === 'student' && !context.hallId);
  authLog('otp-account.provisioned', {
    email: redactEmail(email),
    role: requestedRole,
    persisted: result.persisted,
    synthetic: result.synthetic,
    degraded,
  });
  return result;
}
