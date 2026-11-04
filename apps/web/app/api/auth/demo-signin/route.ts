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
import { createSupabaseRouteClient } from '@/lib/supabase-server';
import { isDemoAuthMode } from '@/lib/demo-otp';
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

  const supabaseConfigured = isSupabaseServerConfigured();

  if (!isDemoAuthMode() && !supabaseConfigured) {
    return apiError(
      'DEMO_SIGNIN_DISABLED',
      'Demo sign-in is disabled for this deployment.',
      'এই ডিপ্লয়মেন্টে ডেমো সাইন-ইন নিষ্ক্রিয় করা আছে।',
      403
    );
  }

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

  // Supabase mode: real password verification against the pre-seeded users.
  const supabase = createSupabaseRouteClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    return apiError(
      'INVALID_CREDENTIALS',
      'Demo sign-in failed. Use one of the accounts listed on /demo.',
      'ডেমো সাইন-ইন ব্যর্থ হয়েছে। /demo পাতায় তালিকাভুক্ত অ্যাকাউন্ট ব্যবহার করুন।',
      401
    );
  }

  const account = findDemoAccount(email);
  return apiSuccess({
    demo: false,
    userId: data.user.id,
    account: account
      ? {
          email: account.email,
          role: account.role satisfies DemoRole,
          fullName: account.fullName,
          universityCode: account.universityCode,
          universityId: getDemoUniversity(account.universityCode)?.id ?? '',
        }
      : null,
    sessionExpiresAt: data.session?.expires_at ?? null,
  });
}
