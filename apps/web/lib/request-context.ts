// apps/web/lib/request-context.ts
import { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseAdminClient, createSupabaseRouteClient } from './supabase-server';
import { apiError } from './api-response';
import {
  DEMO_ROLE_DEFAULTS,
  isDemoEmail,
  readSignedDemoSession,
  type SignedDemoSessionPayload,
} from './demo-auth';
import {
  JU_CANONICAL_IIT_DEPARTMENT_ID,
  JU_CANONICAL_UNIVERSITY_ID,
} from './modules/demo-data';
import {
  appRolesForVerifiedRole,
  buildVerifiedProfile,
  readVerifiedSession,
  type VerifiedSessionPayload,
} from './verified-session';

export interface SessionProfile {
  id: string;
  university_id: string;
  email: string;
  full_name: string;
  trust_level: 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'ID_VERIFIED' | 'TRUSTED';
  student_id?: string;
  department_id?: string | null;
  program_session?: string | null;
  hall_id?: string | null;
  halls?:
    | { name?: string; name_en?: string; name_bn?: string; type?: string }
    | { name?: string; name_en?: string; name_bn?: string }[]
    | null;
  universities?: { code: string; name_en: string; name_bn: string } | null;
}

export interface RequestAuth {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  user: User;
  profile: SessionProfile;
  roles: string[];
  isAdmin: boolean;
}

export function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const ADMIN_ROLE_LIST = [
  'ADMIN',
  'UNIVERSITY_ADMIN',
  'SUPER_ADMIN',
  'GOVERNING_BODY',
  'GOVERNANCE',
];

function buildSyntheticUser(session: SignedDemoSessionPayload): User {
  const nowIso = new Date().toISOString();
  return {
    id: session.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: session.email,
    email_confirmed_at: nowIso,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role: session.role,
      is_demo: true,
      is_platform_admin: session.role === 'admin',
    },
    user_metadata: {
      full_name: session.fullName || session.name,
      name: session.name,
      role: session.role,
      university_code: session.universityCode || 'JU',
      department_code: session.departmentCode || 'IIT',
      email_verified: true,
      is_demo: true,
    },
    identities: [],
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/** The `user` object route handlers expect, built from signed verified claims. */
function buildVerifiedUser(session: VerifiedSessionPayload): User {
  const nowIso = new Date().toISOString();
  return {
    id: session.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: session.email,
    email_confirmed_at: nowIso,
    app_metadata: { provider: 'email', providers: ['email'], role: session.role },
    user_metadata: {
      full_name: session.fullName,
      name: session.fullName,
      role: session.role,
      university_id: session.universityId,
      hall_id: session.hallId,
      department_id: session.departmentId,
      program_session: session.programSession,
      email_verified: true,
    },
    identities: [],
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Resolves the authenticated user for a route handler.
 * Reads Supabase Auth cookies first, then the HMAC-signed
 * `campus360_verified_session` cookie minted after a successful OTP, then the
 * `campus360_demo_session` cookie — so a verified user keeps campus access even
 * when GoTrue or the service-role key is unavailable.
 */
export async function requireAuth(): Promise<{ auth?: RequestAuth; response?: Response }> {
  const signedDemoSession = readSignedDemoSession();
  const verifiedSession = readVerifiedSession();
  // Newest session wins: Quick Demo Login keeps working after a real sign-in.
  const demoSession =
    verifiedSession && (!signedDemoSession || verifiedSession.iat > (signedDemoSession.iat ?? 0))
      ? null
      : signedDemoSession;

  if (!isSupabaseServerConfigured()) {
    // Without the service-role key the database is only reachable as anon, but
    // the caller's identity is still proven: public campus reads keep working.
    if (verifiedSession) {
      try {
        const supabase = createSupabaseRouteClient();
        return {
          auth: {
            supabase,
            admin: supabase,
            user: buildVerifiedUser(verifiedSession),
            profile: buildVerifiedProfile(verifiedSession) as unknown as SessionProfile,
            roles: appRolesForVerifiedRole(verifiedSession.role),
            isAdmin: false,
          },
        };
      } catch {
        /* no public credentials either — fall through to the 503 */
      }
    }
    return {
      response: apiError(
        'SUPABASE_NOT_CONFIGURED',
        'Server database credentials are not configured.',
        'সার্ভার ডাটাবেস কনফিগার করা হয়নি।',
        503
      ),
    };
  }

  try {
    const supabase = createSupabaseRouteClient();
    const admin = createSupabaseAdminClient();

    let user: User | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch {
      user = null;
    }

    if (user) {
      const { data: profile } = await admin
        .from('profiles')
        .select(
          'id, university_id, email, full_name, trust_level, student_id, department_id, universities(code, name_en, name_bn), halls:university_halls(name, name_bn)'
        )
        .eq('id', user.id)
        .maybeSingle();

      const userIsDemo =
        Boolean(demoSession) ||
        isDemoEmail(user.email) ||
        Boolean(user.user_metadata?.is_demo);

      let effectiveProfile = profile as unknown as SessionProfile | null;
      if ((!effectiveProfile || !effectiveProfile.university_id) && userIsDemo) {
        effectiveProfile = {
          id: user.id,
          university_id: demoSession?.university_id || JU_CANONICAL_UNIVERSITY_ID,
          email: user.email ?? demoSession?.email ?? 'student@demo.campus360.bd',
          full_name:
            String(user.user_metadata?.full_name ?? '') ||
            demoSession?.name ||
            'Demo Student',
          trust_level: 'ID_VERIFIED',
          student_id: demoSession?.studentId ?? 'JU-2026-0101',
          department_id: demoSession?.department_id ?? JU_CANONICAL_IIT_DEPARTMENT_ID,
          universities: {
            code: 'JU',
            name_en: 'Jahangirnagar University',
            name_bn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়',
          },
        };
      }

      if (!effectiveProfile || !effectiveProfile.university_id) {
        return {
          response: apiError(
            'PROFILE_INCOMPLETE',
            'Complete onboarding before using campus modules.',
            'ক্যাম্পাস মডিউল ব্যবহারের আগে প্রোফাইল সম্পূর্ণ করুন।',
            403
          ),
        };
      }

      const { data: roleRows } = await admin
        .from('user_roles')
        .select('role, university_id')
        .eq('user_id', user.id);

      let roles = (roleRows ?? []).map((r) => String(r.role));
      if (roles.length === 0 && userIsDemo) {
        const roleSlug = demoSession?.role ?? 'student';
        roles = [...(DEMO_ROLE_DEFAULTS[roleSlug]?.appRoles ?? ['STUDENT'])];
      }

      const isAdmin =
        roles.some((r: string) => ADMIN_ROLE_LIST.includes(r)) ||
        demoSession?.role === 'admin';

      return {
        auth: {
          supabase,
          admin,
          user,
          profile: effectiveProfile,
          roles,
          isAdmin,
        },
      };
    }

    // Fallback: the signed `campus360_verified_session` cookie issued after a
    // successful 6-digit OTP. Prefer the database row when it is readable.
    if (verifiedSession) {
      let dbProfile: SessionProfile | null = null;
      let roles: string[] = [];
      try {
        const { data } = await admin
          .from('profiles')
          .select(
            'id, university_id, email, full_name, trust_level, student_id, department_id, program_session, hall_id, universities(code, name_en, name_bn), halls:university_halls(name, name_bn)'
          )
          .eq('email', verifiedSession.email)
          .maybeSingle();
        if (data?.university_id) {
          dbProfile = data as unknown as SessionProfile;
          const { data: roleRows } = await admin
            .from('user_roles')
            .select('role, university_id')
            .eq('user_id', String(data.id));
          roles = (roleRows ?? []).map((row) => String(row.role));
        }
      } catch {
        /* signed claims below */
      }

      if (roles.length === 0) roles = appRolesForVerifiedRole(verifiedSession.role);
      return {
        auth: {
          supabase: admin,
          admin,
          user: buildVerifiedUser(
            dbProfile ? { ...verifiedSession, id: String(dbProfile.id) } : verifiedSession
          ),
          profile: dbProfile ?? (buildVerifiedProfile(verifiedSession) as unknown as SessionProfile),
          roles,
          // Administrative access is never granted by cookie claims alone
          // unless the database confirmed the role when the cookie was minted.
          isAdmin:
            roles.some((role) => ADMIN_ROLE_LIST.includes(role)) ||
            (verifiedSession.role === 'admin' && verifiedSession.persistence === 'supabase'),
        },
      };
    }

    // Fallback: authenticate via HMAC-signed `campus360_demo_session` cookie.
    if (demoSession) {
      let effectiveProfile: SessionProfile | null = null;
      let roles: string[] = [];

      try {
        const [{ data: dbProfile }, { data: dbRoles }] = await Promise.all([
          admin
            .from('profiles')
            .select(
              'id, university_id, email, full_name, trust_level, student_id, department_id, universities(code, name_en, name_bn), halls:university_halls(name, name_bn)'
            )
            .eq('id', demoSession.id)
            .maybeSingle(),
          admin
            .from('user_roles')
            .select('role, university_id')
            .eq('user_id', demoSession.id),
        ]);
        if (dbProfile?.university_id) {
          effectiveProfile = dbProfile as unknown as SessionProfile;
        }
        if (dbRoles && dbRoles.length > 0) {
          roles = dbRoles.map((r) => String(r.role));
        }
      } catch {
        /* use signed cookie claims below */
      }

      if (!effectiveProfile) {
        effectiveProfile = {
          id: demoSession.id,
          university_id: demoSession.university_id || JU_CANONICAL_UNIVERSITY_ID,
          email: demoSession.email,
          full_name: demoSession.fullName || demoSession.name,
          trust_level: 'ID_VERIFIED',
          student_id: demoSession.studentId,
          department_id: demoSession.department_id ?? JU_CANONICAL_IIT_DEPARTMENT_ID,
          universities: {
            code: demoSession.universityCode || 'JU',
            name_en: 'Jahangirnagar University',
            name_bn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়',
          },
        };
      }

      if (roles.length === 0) {
        roles = [...(DEMO_ROLE_DEFAULTS[demoSession.role]?.appRoles ?? ['STUDENT'])];
      }

      const isAdmin =
        demoSession.role === 'admin' ||
        roles.some((r: string) => ADMIN_ROLE_LIST.includes(r));

      return {
        auth: {
          supabase: admin,
          admin,
          user: buildSyntheticUser(demoSession),
          profile: effectiveProfile,
          roles,
          isAdmin,
        },
      };
    }

    return {
      response: apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401),
    };
  } catch (error) {
    return {
      response: apiError(
        'AUTH_RESOLUTION_FAILED',
        error instanceof Error ? error.message : 'Authentication lookup failed.',
        'লগইন যাচাই করা যায়নি।',
        500
      ),
    };
  }
}

export function clientMeta(req: NextRequest) {
  return {
    ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown',
    userAgent: req.headers.get('user-agent') ?? 'unknown',
  };
}
