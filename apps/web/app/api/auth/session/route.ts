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

export const dynamic = 'force-dynamic';

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
  const demoCookieSession = readSignedDemoSession();
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
      if (!demoCookieSession) {
        return apiError('SESSION_UNAVAILABLE', 'Unable to verify your session. Please retry.', 'সেশন যাচাই করা যায়নি। আবার চেষ্টা করুন।', 503);
      }
      // An independently verified signed quick-demo cookie is still usable.
    }
  }

  // 2. Fallback: read signed `campus360_demo_session` HTTP-only cookie.
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
