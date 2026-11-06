// apps/web/app/api/auth/session/route.ts
import { apiError, apiSuccess } from '@/lib/api-response';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import {
  DEMO_ROLE_DEFAULTS,
  buildDemoProfileFromSession,
  isDemoEmail,
  readSignedDemoSession,
  type SignedDemoSessionPayload,
} from '@/lib/demo-auth';
import {
  JU_CANONICAL_IIT_DEPARTMENT_ID,
  JU_CANONICAL_UNIVERSITY_ID,
  type DemoRole,
} from '@/lib/modules/demo-data';
import {
  appRolesForVerifiedRole,
  buildVerifiedProfile,
  issueVerifiedSession,
  normalizeVerifiedRole,
  readVerifiedSession,
  type VerifiedSessionPayload,
} from '@/lib/verified-session';
import { ensureVerifiedAccount, normalizeAccountEmail, resolveAccountContext } from '@/lib/otp-account';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PROFILE_PROJECTION =
  '*, universities(code, name_en, name_bn), departments(code, name_bn, name_en), halls:university_halls(name, name_bn, type)';

/**
 * Complete the account behind a verified session and return the database
 * projection when it is readable. This is the self-healing half of the OTP
 * fix: a sign-in whose profile write failed (RLS, constraint, missing key)
 * finishes on the next session read instead of stranding the user.
 */
async function repairVerifiedAccount(
  admin: SupabaseClient,
  session: VerifiedSessionPayload,
  user?: User | null
) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const context = resolveAccountContext({
    email: user?.email ?? session.email,
    universityId: session.universityId ?? (meta.university_id as string | null),
    role: session.role ?? (meta.role as string | null),
    hallId: session.hallId ?? (meta.hall_id as string | null),
    departmentId: session.departmentId ?? (meta.department_id as string | null),
    programId: session.programId ?? (meta.program_id as string | null),
    programSession: session.programSession ?? (meta.program_session as string | null),
    fullName: session.fullName ?? (meta.full_name as string | null),
    studentId: session.studentId ?? (meta.student_id as string | null),
  });
  const account = await ensureVerifiedAccount(admin, context);
  const refreshed = issueVerifiedSession({
    id: user?.id ?? account.userId,
    email: context.email,
    role: account.role,
    fullName: account.fullName,
    studentId: account.studentId,
    universityId: account.universityId,
    universityCode: account.universityCode,
    universityName: account.universityName,
    hallId: account.hallId,
    departmentId: account.departmentId,
    programId: account.programId,
    programSession: account.programSession,
    persistence: account.persisted ? 'supabase' : 'pending',
    needsOnboarding: account.needsOnboarding,
  });

  let profile: Record<string, unknown> | null = null;
  let roles: Array<{ role: string; university_id: string }> = [];
  try {
    const [{ data: dbProfile }, { data: dbRoles }] = await Promise.all([
      admin.from('profiles').select(PROFILE_PROJECTION).eq('id', refreshed.id).maybeSingle(),
      admin.from('user_roles').select('role, university_id').eq('user_id', refreshed.id),
    ]);
    profile = (dbProfile as Record<string, unknown> | null) ?? null;
    roles = (dbRoles ?? []) as Array<{ role: string; university_id: string }>;
  } catch {
    /* signed claims below are the fallback */
  }
  return { session: refreshed, profile, roles };
}

/** Session claims for a Supabase user that has no verified cookie yet. */
function issueVerifiedSessionFromUser(user: User): VerifiedSessionPayload {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = normalizeAccountEmail(user.email ?? '');
  return {
    id: user.id,
    email,
    role: normalizeVerifiedRole(meta.role),
    fullName: String(meta.full_name ?? '') || email.split('@')[0],
    studentId: (meta.student_id as string | null) ?? null,
    universityId: String(meta.university_id ?? JU_CANONICAL_UNIVERSITY_ID),
    universityCode: null,
    universityName: null,
    hallId: (meta.hall_id as string | null) ?? null,
    departmentId: (meta.department_id as string | null) ?? null,
    programId: (meta.program_id as string | null) ?? null,
    programSession: (meta.program_session as string | null) ?? null,
    emailVerified: true,
    trustLevel: 'EMAIL_VERIFIED',
    persistence: 'pending',
    needsOnboarding: !meta.program_session,
    isDemo: false,
    iat: Date.now(),
    exp: Date.now() + 60_000,
  };
}

/** Signed-cookie answer used whenever the database projection is unavailable. */
function verifiedCookieResponse(session: VerifiedSessionPayload, extra: Record<string, unknown> = {}) {
  return apiSuccess({
    authenticated: true,
    demo: false,
    verifiedCookie: true,
    user: { id: session.id, email: session.email },
    profile: buildVerifiedProfile(session),
    roles: appRolesForVerifiedRole(session.role).map((role) => ({
      role,
      university_id: session.universityId,
    })),
    ...extra,
  });
}

function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function inferDemoRole(email?: string | null, metaRole?: unknown): DemoRole {
  const m = String(metaRole ?? '').toLowerCase();
  if (m === 'student' || m === 'faculty' || m === 'admin' || m === 'alumni' || m === 'governance') {
    return m;
  }
  const local = (email ?? '').trim().toLowerCase().split('@')[0];
  if (local === 'faculty' || local.startsWith('faculty.')) return 'faculty';
  if (local === 'admin' || local.startsWith('admin.')) return 'admin';
  if (local === 'alumni' || local.startsWith('alumni.')) return 'alumni';
  if (local === 'governance' || local.startsWith('governance.')) return 'governance';
  return 'student';
}

export async function GET() {
  const signedDemoSession = readSignedDemoSession();
  const verifiedSession = readVerifiedSession();
  // Quick Demo Login is untouched: whichever session was minted last wins, so
  // demo accounts keep working even after a real OTP sign-in on the same browser.
  const demoCookieSession =
    verifiedSession && (!signedDemoSession || verifiedSession.iat > (signedDemoSession.iat ?? 0))
      ? null
      : signedDemoSession;
  const serverConfigured = isSupabaseServerConfigured();

  // 1. Check Supabase Auth session first when public credentials exist.
  if (hasPublicSupabaseEnv()) {
    try {
      const supabase = createSupabaseRouteClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      // No session or a rejected token is a real sign-out. A network or
      // upstream outage is not: the header must retain its last known user.
      if (authError && !isAuthSessionMissingError(authError) && authError.status !== 401 && authError.status !== 403) {
        throw authError;
      }

      if (user) {
        const dbClient = serverConfigured ? createSupabaseAdminClient() : supabase;
        const [{ data: profile }, { data: roles }] = await Promise.all([
          dbClient
            .from('profiles')
            .select(
              '*, universities(code, name_en, name_bn), departments(code, name_bn, name_en), halls:university_halls(name, name_bn, type)'
            )
            .eq('id', user.id)
            .maybeSingle(),
          dbClient.from('user_roles').select('role, university_id').eq('user_id', user.id),
        ]);

        const userIsDemo =
          Boolean(demoCookieSession) ||
          isDemoEmail(user.email) ||
          Boolean(user.user_metadata?.is_demo);

        if (profile) {
          // The database row landed after a degraded sign-in: promote the
          // cookie so later reads stop retrying the write.
          if (
            verifiedSession &&
            verifiedSession.persistence === 'pending' &&
            normalizeAccountEmail(verifiedSession.email) === normalizeAccountEmail(user.email)
          ) {
            issueVerifiedSession({
              ...verifiedSession,
              id: user.id,
              universityId: String(profile.university_id ?? verifiedSession.universityId),
              persistence: 'supabase',
            });
          }
          // Real OTP accounts carry trust_level (EMAIL_VERIFIED and up) rather
          // than an email_verified column; surface a uniform boolean so clients
          // can redirect verified users away from /verify-email and /signin.
          const trustVerified = ['EMAIL_VERIFIED', 'ID_VERIFIED', 'TRUSTED'].includes(
            String(profile.trust_level ?? '')
          );
          const emailVerified = Boolean(user.email_confirmed_at) || trustVerified;
          const enrichedProfile = userIsDemo
            ? {
                ...profile,
                trust_level: profile.trust_level || 'ID_VERIFIED',
                onboarding_completed: true,
                email_verified: true,
                is_verified: true,
                is_demo: true,
              }
            : {
                ...profile,
                email_verified: emailVerified,
                is_verified: emailVerified,
              };

          let effectiveRoles = roles ?? [];
          if (userIsDemo && effectiveRoles.length === 0) {
            const roleSlug = demoCookieSession?.role ?? inferDemoRole(user.email, user.user_metadata?.role);
            effectiveRoles = DEMO_ROLE_DEFAULTS[roleSlug].appRoles.map((r) => ({
              role: r,
              university_id: profile.university_id,
            }));
          }

          return apiSuccess({
            authenticated: true,
            demo: false,
            user: { id: user.id, email: user.email },
            profile: enrichedProfile,
            roles: effectiveRoles,
          });
        }

        // Demo user in Supabase Auth whose profile row was missing: synthesize verified JU + IIT profile.
        if (userIsDemo) {
          const roleSlug = demoCookieSession?.role ?? inferDemoRole(user.email, user.user_metadata?.role);
          const defaults = DEMO_ROLE_DEFAULTS[roleSlug];
          const now = Date.now();
          const syntheticSession: SignedDemoSessionPayload = demoCookieSession ?? {
            id: user.id,
            email: user.email ?? defaults.email,
            role: roleSlug,
            name: String(user.user_metadata?.full_name ?? defaults.name),
            fullName: String(user.user_metadata?.full_name ?? defaults.name),
            studentId: defaults.studentId,
            university_id: JU_CANONICAL_UNIVERSITY_ID,
            universityId: JU_CANONICAL_UNIVERSITY_ID,
            universityCode: 'JU',
            department_id: JU_CANONICAL_IIT_DEPARTMENT_ID,
            departmentCode: 'IIT',
            email_verified: true,
            is_demo: true,
            iat: now,
            exp: now + 86_400_000,
          };
          const built = buildDemoProfileFromSession(syntheticSession);
          return apiSuccess({
            authenticated: true,
            demo: !serverConfigured,
            user: { id: user.id, email: user.email },
            profile: built.profile,
            roles: built.roles,
          });
        }

        // A verified account whose profile row is missing/incomplete must not
        // answer with `profile: null` — clients read that as "not signed in"
        // and bounce straight back to the OTP form. Complete it instead.
        if (serverConfigured && user.email) {
          try {
            const admin = createSupabaseAdminClient();
            const repaired = await repairVerifiedAccount(
              admin,
              verifiedSession && normalizeAccountEmail(verifiedSession.email) === normalizeAccountEmail(user.email)
                ? verifiedSession
                : issueVerifiedSessionFromUser(user),
              user
            );
            if (repaired.profile) {
              return apiSuccess({
                authenticated: true,
                demo: false,
                profileRepaired: true,
                user: { id: user.id, email: user.email },
                profile: {
                  ...repaired.profile,
                  email_verified: true,
                  is_verified: true,
                },
                roles: repaired.roles,
              });
            }
            return verifiedCookieResponse(repaired.session, { profileRepaired: true });
          } catch {
            /* fall through to the signed-cookie / null-profile answers */
          }
        }
        if (verifiedSession && normalizeAccountEmail(verifiedSession.email) === normalizeAccountEmail(user.email)) {
          return verifiedCookieResponse(verifiedSession);
        }

        return apiSuccess({
          authenticated: true,
          demo: false,
          user: { id: user.id, email: user.email },
          profile: null,
          email_verified: Boolean(user.email_confirmed_at),
          roles: roles ?? [],
        });
      }
    } catch {
      if (!demoCookieSession && !verifiedSession) {
        return apiError('SESSION_UNAVAILABLE', 'Unable to verify your session. Please retry.', 'সেশন যাচাই করা যায়নি। আবার চেষ্টা করুন।', 503);
      }
      // An independently verified signed cookie (OTP or quick demo) is still
      // usable while GoTrue is unreachable.
    }
  }

  // 2. Fallback: the signed `campus360_verified_session` cookie. The OTP was
  // validated when it was issued, so this is a real sign-in even when GoTrue
  // or the profile write is unavailable.
  if (verifiedSession) {
    if (serverConfigured && verifiedSession.persistence === 'pending') {
      try {
        const repaired = await repairVerifiedAccount(createSupabaseAdminClient(), verifiedSession);
        if (repaired.profile) {
          return apiSuccess({
            authenticated: true,
            demo: false,
            verifiedCookie: true,
            profileRepaired: true,
            user: { id: repaired.session.id, email: repaired.session.email },
            profile: { ...repaired.profile, email_verified: true, is_verified: true },
            roles: repaired.roles,
          });
        }
        return verifiedCookieResponse(repaired.session);
      } catch {
        /* signed claims still sign the user in */
      }
    }
    return verifiedCookieResponse(verifiedSession, { cookieFallback: true });
  }

  // 3. Fallback: read signed `campus360_demo_session` HTTP-only cookie.
  if (demoCookieSession) {
    if (serverConfigured) {
      try {
        const admin = createSupabaseAdminClient();
        const { data: dbProfile } = await admin
          .from('profiles')
          .select(
            '*, universities(code, name_en, name_bn), departments(code, name_bn, name_en), halls:university_halls(name, name_bn, type)'
          )
          .eq('id', demoCookieSession.id)
          .maybeSingle();

        const { data: dbRoles } = await admin
          .from('user_roles')
          .select('role, university_id')
          .eq('user_id', demoCookieSession.id);

        if (dbProfile) {
          const defaults = DEMO_ROLE_DEFAULTS[demoCookieSession.role] ?? DEMO_ROLE_DEFAULTS.student;
          return apiSuccess({
            authenticated: true,
            demo: false,
            cookieFallback: true,
            user: { id: dbProfile.id, email: dbProfile.email },
            profile: {
              ...dbProfile,
              trust_level: dbProfile.trust_level || 'ID_VERIFIED',
              onboarding_completed: true,
              email_verified: true,
              is_verified: true,
              is_demo: true,
            },
            roles:
              dbRoles && dbRoles.length > 0
                ? dbRoles
                : defaults.appRoles.map((role) => ({
                    role,
                    university_id: dbProfile.university_id,
                  })),
          });
        }
      } catch {
        /* Fall back to signed cookie payload below */
      }
    }

    const built = buildDemoProfileFromSession(demoCookieSession);
    return apiSuccess({
      authenticated: true,
      demo: !serverConfigured,
      cookieFallback: true,
      user: { id: demoCookieSession.id, email: demoCookieSession.email },
      profile: built.profile,
      roles: built.roles,
    });
  }

  return apiSuccess({
    authenticated: false,
    demo: !serverConfigured,
    profile: null,
    roles: [],
  });
}
