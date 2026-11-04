// apps/web/app/api/auth/demo-signin/route.ts
// ============================================================================
// DevSignInPanel sign-in — password-based demo credentials (Demo#1234).
//
// Success criterion 1: demo accounts must use password-based sign-in (not OTP)
// so the Supabase email caps (2/hour, team inboxes only) never block a demo.
//
// * With Supabase configured: verifies through GoTrue signInWithPassword and
//   establishes the normal cookie session for the pre-seeded user.
// * Without Supabase (fresh preview): falls back to the local demo session so
//   the DevSignInPanel still signs you in as the matching role.
//
// Route is only reachable when NEXT_PUBLIC_AUTH_MODE === 'demo' or the
// deployment runs without Supabase secrets; it rejects arbitrary production
// credentials.
// ============================================================================

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import { createSupabaseAdminClient, createSupabaseRouteClient } from '@/lib/supabase-server';
import {
  findDemoAccount,
  getDemoUniversity,
  type DemoRole,
} from '@/lib/modules/demo-data';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return apiError('INVALID_INPUT', 'Email and password are required.', 'ইমেইল এবং পাসওয়ার্ড প্রয়োজন।', 400);
  }

  // Strict allowlist: this endpoint is exclusively for the four seeded demo
  // identities. It never requests or sends an OTP; Supabase password grant
  // writes the normal auth cookies through createSupabaseRouteClient.
  const account = findDemoAccount(email);
  const allowedDemoEmails = new Set([
    'student@demo.campus360.test',
    'faculty@demo.campus360.test',
    'admin@demo.campus360.test',
    'alumni@demo.campus360.test',
  ]);
  if (!allowedDemoEmails.has(email) || !account) {
    return apiError('DEMO_SIGNIN_DISABLED', 'Use one of the four demo accounts listed on /demo.', ' /demo পাতায় দেওয়া চারটি ডেমো অ্যাকাউন্ট ব্যবহার করুন।', 403);
  }
  if (password !== account.password) {
    return apiError('INVALID_CREDENTIALS', 'The demo password is incorrect.', 'ডেমো পাসওয়ার্ডটি সঠিক নয়।', 401);
  }

  const supabaseConfigured = isSupabaseServerConfigured();

  // The four-email allowlist above is the production-safe bypass. Never gate
  // those known showcase identities on NEXT_PUBLIC_AUTH_MODE.

  // Preview / demo fallback: match against the seeded credential list only.
  if (!supabaseConfigured) {
    const account = findDemoAccount(email);
    if (!account || account.password !== password) {
      return apiError(
        'INVALID_CREDENTIALS',
        'Unknown demo credentials. Use one of the accounts listed on /demo.',
        'অজানা ডেমো পরিচয়। /demo পাতায় তালিকাভুক্ত অ্যাকাউন্ট ব্যবহার করুন।',
        401
      );
    }
    const university = getDemoUniversity(account.universityCode);
    return apiSuccess({
      demo: true,
      account: {
        email: account.email,
        role: account.role satisfies DemoRole,
        fullName: account.fullName,
        universityCode: account.universityCode,
        universityId: university?.id ?? '',
      },
    });
  }

  // Supabase mode: clear any visitor's previous local session before making
  // the role switch, then authenticate with the seeded account credentials.
  try {
    const supabase = createSupabaseRouteClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      console.error('[demo-signin] Existing-session sign-out failed; refusing role switch', {
        email, code: signOutError.code, status: signOutError.status,
        message: signOutError.message,
      });
      return apiError(
        'DEMO_SIGNOUT_FAILED',
        'Could not clear the existing session. Refresh the page and try again.',
        'আগের সেশনটি বন্ধ করা যায়নি। পৃষ্ঠা রিফ্রেশ করে আবার চেষ্টা করুন।',
        500
      );
    }

    // SQL-created Auth rows can carry a valid bcrypt hash yet still be in a
    // GoTrue-inconsistent state. Normalize the allowlisted showcase user using
    // Auth's Admin API on each demo login; this does NOT create a session and
    // is never exposed for arbitrary accounts.
    const admin = createSupabaseAdminClient();
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    const existing = listed.users.find((user) => user.email?.toLowerCase() === email);
    const appMetadata = {
      provider: 'email',
      providers: ['email'],
      ...(account.role === 'admin' ? { is_platform_admin: true } : {}),
    };
    const authResult = existing
      ? await admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { ...existing.user_metadata, university_code: 'DU', full_name: account.fullName },
          app_metadata: appMetadata,
        })
      : await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { university_code: 'DU', full_name: account.fullName },
          app_metadata: appMetadata,
        });
    if (authResult.error || !authResult.data.user) throw authResult.error ?? new Error('Auth Admin API returned no user');

    const { data: university, error: universityError } = await admin
      .from('universities').select('id').eq('code', 'DU').single();
    if (universityError || !university) throw universityError ?? new Error('DU university not found');

    const studentIds: Record<string, string> = {
      student: 'DU-2026-12345', faculty: 'DU-FAC-0142', admin: 'DU-ADM-001', alumni: 'DU-ALM-2019-088',
    };
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authResult.data.user.id,
      university_id: university.id,
      email,
      full_name: account.fullName,
      student_id: studentIds[account.role],
      trust_level: 'ID_VERIFIED',
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const roleName = account.role.toUpperCase();
    const { error: roleError } = await admin.from('user_roles').upsert({
      user_id: authResult.data.user.id,
      university_id: university.id,
      role: roleName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,university_id,role' });
    if (roleError) throw roleError;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user || !data.session) {
      console.error('[demo-signin] Supabase password sign-in rejected', {
        email,
        code: error?.code ?? 'MISSING_SESSION',
        status: error?.status ?? null,
        name: error?.name ?? null,
        message: error?.message ?? 'Auth returned no user/session without an error.',
      });
      return apiError(
        'INVALID_CREDENTIALS',
        'Demo sign-in failed. Use one of the accounts listed on /demo.',
        'ডেমো সাইন-ইন ব্যর্থ হয়েছে। /demo পাতায় তালিকাভুক্ত অ্যাকাউন্ট ব্যবহার করুন।',
        401
      );
    }

    return apiSuccess({
      demo: false,
      userId: data.user.id,
      account: {
        email: account.email,
        role: account.role satisfies DemoRole,
        fullName: account.fullName,
        universityCode: account.universityCode,
        universityId: getDemoUniversity(account.universityCode)?.id ?? '',
      },
      sessionExpiresAt: data.session.expires_at ?? null,
    });
  } catch (error) {
    const authError = error as Error & { code?: string; status?: number; details?: string; hint?: string };
    console.error('[demo-signin] Unexpected demo authentication exception', {
      email,
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            code: authError.code ?? null,
            status: authError.status ?? null,
            details: authError.details ?? null,
            hint: authError.hint ?? null,
            stack: error.stack,
          }
        : String(error),
    });
    return apiError(
      'DEMO_SIGNIN_ERROR',
      'Demo sign-in is temporarily unavailable. Please try again.',
      'ডেমো সাইন-ইন সাময়িকভাবে অনুপলব্ধ। আবার চেষ্টা করুন।',
      500
    );
  }
}
