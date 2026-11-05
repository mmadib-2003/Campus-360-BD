// apps/web/app/api/auth/demo-signin/route.ts
// ============================================================================
// Password-based demo login endpoint for the Quick Demo Login buttons on
// `/signin` and `/demo` (`student`, `faculty`, `admin`, `alumni`).
//
// Resilient two-tier strategy:
//   1. Attempt Supabase Auth (`signInWithPassword`) when configured; if the
//      auth row needs self-healing and `SUPABASE_SERVICE_ROLE_KEY` is present,
//      repair via the admin API and retry once.
//   2. ALWAYS issue an HMAC-signed HTTP-only `campus360_demo_session` cookie
//      carrying `{ id, email, role, name, university_id, department_id,
//      email_verified: true, is_demo: true }`. If Supabase Auth fails or
//      `SUPABASE_SERVICE_ROLE_KEY` is missing, this route never returns a
//      500/503 error — the signed session cookie authenticates the demo
//      session across middleware, `/api/auth/session`, and server API routes.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import {
  DEMO_PASSWORD,
  JU_CANONICAL_IIT_DEPARTMENT_ID,
  JU_CANONICAL_UNIVERSITY_ID,
  QUICK_DEMO_ACCOUNTS,
  findDemoAccount,
  getDemoUniversity,
  type DemoRole,
} from '@/lib/modules/demo-data';
import {
  DEMO_ROLE_DEFAULTS,
  isDemoEmail,
  issueSignedDemoSession,
} from '@/lib/demo-auth';

export const dynamic = 'force-dynamic';

const ROLE_TO_APP_ROLES: Record<DemoRole, string[]> = {
  student: ['STUDENT'],
  faculty: ['FACULTY'],
  admin: ['ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN'],
  alumni: ['ALUMNI'],
  governance: ['GOVERNANCE'],
};

function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function resolveRequestedDemoIdentity(body: {
  email?: string;
  password?: string;
  role?: string;
}):
  | {
      ok: true;
      email: string;
      role: DemoRole;
      name: string;
      universityCode: string;
    }
  | { ok: false; response: NextResponse } {
  const rawEmail = (body.email ?? '').trim().toLowerCase();
  const rawRole = (body.role ?? '').trim().toLowerCase() as DemoRole;
  const hasPasswordField = typeof body.password === 'string' && body.password.length > 0;

  if (hasPasswordField && body.password !== DEMO_PASSWORD) {
    return {
      ok: false,
      response: apiError(
        'INVALID_CREDENTIALS',
        'Invalid demo credentials.',
        'ভুল ডেমো ইমেইল বা পাসওয়ার্ড।',
        401
      ),
    };
  }

  if (rawEmail) {
    const matched = findDemoAccount(rawEmail);
    if (matched) {
      // Normalize legacy @demo.campus360.test quick-demo addresses to @demo.campus360.bd
      const canonicalEmail = rawEmail.endsWith('@demo.campus360.test')
        ? rawEmail.replace(/@demo\.campus360\.test$/, '@demo.campus360.bd')
        : matched.email;
      return {
        ok: true,
        email: canonicalEmail,
        role: matched.role,
        name: matched.fullName,
        universityCode: matched.universityCode || 'JU',
      };
    }

    if (isDemoEmail(rawEmail)) {
      const localPart = rawEmail.split('@')[0];
      const quickMatch = QUICK_DEMO_ACCOUNTS.find((q) => q.role === localPart);
      if (quickMatch) {
        return {
          ok: true,
          email: quickMatch.email,
          role: quickMatch.role,
          name: quickMatch.fullName,
          universityCode: 'JU',
        };
      }
    }

    return {
      ok: false,
      response: apiError(
        'NOT_DEMO_ACCOUNT',
        'Only provisioned demo accounts may use /api/auth/demo-signin.',
        'শুধুমাত্র ডেমো অ্যাকাউন্ট এখানে লগইন করতে পারবে।',
        403
      ),
    };
  }

  if (rawRole && rawRole in DEMO_ROLE_DEFAULTS) {
    const defaults = DEMO_ROLE_DEFAULTS[rawRole];
    return {
      ok: true,
      email: defaults.email,
      role: rawRole,
      name: defaults.name,
      universityCode: 'JU',
    };
  }

  return {
    ok: false,
    response: apiError(
      'MISSING_CREDENTIALS',
      'Demo email or role is required.',
      'ডেমো ইমেইল অথবা রোল আবশ্যক।',
      400
    ),
  };
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; role?: string } = {};
  try {
    body = (await req.json()) as { email?: string; password?: string; role?: string };
  } catch {
    body = {};
  }

  const resolved = resolveRequestedDemoIdentity(body);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { email, role, name, universityCode } = resolved;
  const defaults = DEMO_ROLE_DEFAULTS[role] ?? DEMO_ROLE_DEFAULTS.student;
  const demoUniv = getDemoUniversity(universityCode) ?? getDemoUniversity('JU')!;

  let userId = defaults.id;
  let universityId =
    universityCode === 'JU'
      ? JU_CANONICAL_UNIVERSITY_ID
      : demoUniv.id;
  let departmentId: string | null =
    universityCode === 'JU' ? JU_CANONICAL_IIT_DEPARTMENT_ID : null;
  let supabaseAuthenticated = false;

  // 1. Attempt live Supabase Auth first when public credentials exist.
  if (hasPublicSupabaseEnv()) {
    try {
      const supabase = createSupabaseRouteClient();
      const firstSignIn = await supabase.auth.signInWithPassword({
        email,
        password: DEMO_PASSWORD,
      });

      if (!firstSignIn.error && firstSignIn.data?.user) {
        supabaseAuthenticated = true;
        userId = firstSignIn.data.user.id;
      } else if (isSupabaseServerConfigured()) {
        // Opportunistic self-healing via service-role client if GoTrue rejected
        // or the demo account was not yet provisioned on this project.
        try {
          const admin = createSupabaseAdminClient();
          const { data: uniRow } = await admin
            .from('universities')
            .select('id')
            .eq('code', universityCode)
            .maybeSingle();
          if (uniRow?.id) {
            universityId = uniRow.id;
          }

          const { data: deptRow } = await admin
            .from('departments')
            .select('id')
            .eq('university_id', universityId)
            .in('code', ['IIT', 'CSE'])
            .limit(1)
            .maybeSingle();
          if (deptRow?.id) {
            departmentId = deptRow.id;
          }

          const { data: existingProfile } = await admin
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle();

          let targetUserId = existingProfile?.id ?? null;

          if (!targetUserId) {
            const created = await admin.auth.admin.createUser({
              email,
              password: DEMO_PASSWORD,
              email_confirm: true,
              user_metadata: {
                full_name: name,
                name,
                role,
                university_code: universityCode,
                department_code: 'IIT',
                email_verified: true,
                is_demo: true,
              },
              app_metadata: {
                role,
                is_demo: true,
                is_platform_admin: role === 'admin',
              },
            });
            targetUserId = created.data?.user?.id ?? null;
          } else {
            await admin.auth.admin.updateUserById(targetUserId, {
              password: DEMO_PASSWORD,
              email_confirm: true,
              user_metadata: {
                full_name: name,
                name,
                role,
                university_code: universityCode,
                department_code: 'IIT',
                email_verified: true,
                is_demo: true,
              },
              app_metadata: {
                role,
                is_demo: true,
                is_platform_admin: role === 'admin',
              },
            });
          }

          if (targetUserId) {
            userId = targetUserId;
            await admin.from('profiles').upsert(
              {
                id: targetUserId,
                university_id: universityId,
                department_id: departmentId,
                email,
                full_name: name,
                student_id: defaults.studentId,
                batch: role === 'alumni' ? '45th Batch' : '51st Batch',
                trust_level: 'ID_VERIFIED',
                onboarding_completed: true,
              },
              { onConflict: 'id' }
            );

            for (const appRole of ROLE_TO_APP_ROLES[role] ?? ['STUDENT']) {
              await admin.from('user_roles').upsert(
                {
                  user_id: targetUserId,
                  university_id: universityId,
                  role: appRole,
                },
                { onConflict: 'user_id,university_id,role' }
              );
            }

            const retrySignIn = await supabase.auth.signInWithPassword({
              email,
              password: DEMO_PASSWORD,
            });
            if (!retrySignIn.error && retrySignIn.data?.user) {
              supabaseAuthenticated = true;
              userId = retrySignIn.data.user.id;
            }
          }
        } catch (healErr) {
          console.warn('[demo-signin] self-heal skipped, using signed cookie session:', healErr);
        }
      }

      // Enrich university_id / department_id from profiles if Supabase is reachable.
      if (supabaseAuthenticated && isSupabaseServerConfigured()) {
        try {
          const admin = createSupabaseAdminClient();
          const { data: prof } = await admin
            .from('profiles')
            .select('university_id, department_id')
            .eq('id', userId)
            .maybeSingle();
          if (prof?.university_id) universityId = prof.university_id;
          if (prof?.department_id) departmentId = prof.department_id;
        } catch {
          /* keep canonical JU + IIT IDs */
        }
      }
    } catch (authErr) {
      console.warn('[demo-signin] Supabase signInWithPassword failed, using signed cookie session:', authErr);
    }
  }

  // 2. Always issue the HMAC-signed HTTP-only `campus360_demo_session` cookie.
  const { payload: signedSession } = issueSignedDemoSession({
    id: userId,
    email,
    role,
    name,
    studentId: defaults.studentId,
    university_id: universityId,
    universityCode,
    department_id: departmentId,
    departmentCode: universityCode === 'JU' ? 'IIT' : 'CSE',
  });

  const user = {
    id: signedSession.id,
    email: signedSession.email,
    role: signedSession.role,
    name: signedSession.name,
    university_id: signedSession.university_id,
    department_id: signedSession.department_id,
    email_verified: true as const,
    is_demo: true as const,
  };

  const redirectTo = role === 'admin' ? '/admin/console' : '/feed';
  const isOfflineDemo = !isSupabaseServerConfigured();

  return NextResponse.json(
    {
      ok: true,
      success: true,
      user,
      redirectTo,
      data: {
        ok: true,
        demo: isOfflineDemo,
        supabaseAuthenticated,
        userId: user.id,
        user,
        redirectTo,
        account: {
          email: user.email,
          role: user.role,
          fullName: user.name,
          universityCode,
          universityId: isOfflineDemo ? demoUniv.id : user.university_id,
        },
      },
    },
    { status: 200 }
  );
}
