import { cookies } from 'next/headers';
import { DEMO_UNIVERSITIES, demoFindUniversity, demoFindUniversityByDomain, type DemoRole } from '@/lib/modules/demo-data';

export const DEMO_OTP_COOKIE = 'campus360_demo_otp';
export const DEMO_SESSION_COOKIE = 'campus360_demo_session';
export const DEMO_UNIVERSAL_OTP = '482913';

export interface DemoChallenge {
  email: string;
  universityId: string;
  role: DemoRole;
  fullName: string;
  studentId: string;
  code: string;
  createdAt: number;
}

export interface DemoSessionPayload {
  universityId: string;
  role: DemoRole;
  email: string;
  fullName: string;
  studentId: string;
}

const ROLES: DemoRole[] = ['student', 'faculty', 'alumni', 'admin'];

export function normalizeDemoRole(value: unknown): DemoRole {
  return ROLES.includes(value as DemoRole) ? (value as DemoRole) : 'student';
}

export function issueDemoChallenge(input: {
  email: string;
  universityId?: string | null;
  role?: unknown;
  fullName?: string;
  studentId?: string;
}): { ok: true; challenge: DemoChallenge } | { ok: false; error: string; errorBn: string; status: number } {
  const email = String(input.email ?? '').trim().toLowerCase();
  const domain = email.split('@')[1] ?? '';
  const byDomain = demoFindUniversityByDomain(domain);
  if (!byDomain) {
    return {
      ok: false,
      error: `The email domain @${domain} is not on the approved Bangladesh public university registry.`,
      errorBn: `@${domain} ডোমেইনটি অনুমোদিত পাবলিক বিশ্ববিদ্যালয়ের তালিকায় নেই।`,
      status: 403,
    };
  }
  if (input.universityId && input.universityId !== byDomain.id) {
    return {
      ok: false,
      error: 'The selected university does not match the email domain.',
      errorBn: 'নির্বাচিত বিশ্ববিদ্যালয়ের সাথে ইমেইল ডোমেইন মেলে না।',
      status: 403,
    };
  }
  const role = normalizeDemoRole(input.role);
  const code = DEMO_UNIVERSAL_OTP;
  const challenge: DemoChallenge = {
    email,
    universityId: byDomain.id,
    role,
    fullName: input.fullName?.trim() || 'Demo Student',
    studentId: input.studentId?.trim() || `${byDomain.code}-2026-12345`,
    code,
    createdAt: Date.now(),
  };
  const store = cookies();
  store.set(DEMO_OTP_COOKIE, JSON.stringify(challenge), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return { ok: true, challenge };
}

export function readDemoChallenge(): DemoChallenge | null {
  const store = cookies();
  const raw = store.get(DEMO_OTP_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoChallenge;
    if (!parsed?.email || !parsed?.code) return null;
    if (Date.now() - parsed.createdAt > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function verifyDemoChallenge(email: string, otp: string): { ok: true; session: DemoSessionPayload } | { ok: false; error: string; errorBn: string; status: number } {
  const challenge = readDemoChallenge();
  if (!challenge) {
    return {
      ok: false,
      error: 'No active demo verification challenge. Request a new code.',
      errorBn: 'সক্রিয় যাচাইকরণ চ্যালেঞ্জ নেই। নতুন কোড অনুরোধ করুন।',
      status: 404,
    };
  }
  if (challenge.email !== email.trim().toLowerCase()) {
    return {
      ok: false,
      error: 'This code was issued for a different email address.',
      errorBn: 'এই কোডটি অন্য ইমেইলের জন্য জারি করা হয়েছে।',
      status: 400,
    };
  }
  if (otp !== challenge.code && otp !== DEMO_UNIVERSAL_OTP) {
    return {
      ok: false,
      error: 'Invalid OTP code.',
      errorBn: 'ভুল ওটিপি কোড।',
      status: 401,
    };
  }
  const session: DemoSessionPayload = {
    universityId: challenge.universityId,
    role: challenge.role,
    email: challenge.email,
    fullName: challenge.fullName,
    studentId: challenge.studentId,
  };
  const store = cookies();
  store.set(DEMO_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  store.delete(DEMO_OTP_COOKIE);
  return { ok: true, session };
}

export function readDemoSessionPayload(): DemoSessionPayload | null {
  const store = cookies();
  const raw = store.get(DEMO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoSessionPayload;
    if (!parsed?.universityId || !demoFindUniversity(parsed.universityId)) return null;
    return { ...parsed, role: normalizeDemoRole(parsed.role) };
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  const store = cookies();
  store.delete(DEMO_SESSION_COOKIE);
  store.delete(DEMO_OTP_COOKIE);
}

export function demoNextStep(role: DemoRole): string {
  switch (role) {
    case 'admin':
      return '/admin/console';
    case 'faculty':
      return '/faculty';
    case 'alumni':
      return '/careers';
    default:
      return '/feed';
  }
}

export function demoUniversitiesPayload() {
  return DEMO_UNIVERSITIES.map((university) => ({
    id: university.id,
    code: university.code,
    name_en: university.name_en,
    name_bn: university.name_bn,
    category: university.category,
    city: university.city,
    lat: university.lat,
    lng: university.lng,
    is_active: true,
    university_email_domains: university.domains.map((domain, index) => ({
      domain,
      is_primary: index === 0,
      is_active: true,
    })),
  }));
}
