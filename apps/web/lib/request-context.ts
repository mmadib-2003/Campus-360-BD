// apps/web/lib/request-context.ts
import { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseAdminClient, createSupabaseRouteClient } from './supabase-server';
import { apiError } from './api-response';

export interface SessionProfile {
  id: string;
  university_id: string;
  email: string;
  full_name: string;
  trust_level: 'UNVERIFIED' | 'EMAIL_VERIFIED' | 'ID_VERIFIED' | 'TRUSTED';
  student_id?: string;
  department_id?: string | null;
  halls?: { name?: string; name_en?: string; name_bn?: string; type?: string } | { name?: string; name_en?: string; name_bn?: string }[] | null;
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

/**
 * Resolves the authenticated student for a route handler.
 * Returns an `ApiEnvelope` error response instead of throwing when unauthenticated
 * or when Supabase credentials are missing, so clients always receive JSON.
 */
export async function requireAuth(): Promise<{ auth?: RequestAuth; response?: Response }> {
  if (!isSupabaseServerConfigured()) {
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        response: apiError('UNAUTHORIZED', 'Sign in required.', 'লগইন করা প্রয়োজন।', 401),
      };
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select(
        'id, university_id, email, full_name, trust_level, student_id, department_id, universities(code, name_en, name_bn), halls:university_halls(name, name_bn)'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.university_id) {
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

    const roles = (roleRows ?? []).map((r) => String(r.role));
    const isAdmin = roles.some((r: string) =>
      ['ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN', 'GOVERNING_BODY', 'GOVERNANCE'].includes(r)
    );

    return {
      auth: {
        supabase,
        admin,
        user,
        profile: profile as unknown as SessionProfile,
        roles,
        isAdmin,
      },
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
