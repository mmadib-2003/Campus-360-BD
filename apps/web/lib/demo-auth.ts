import { cookies } from 'next/headers';
import { DEMO_OTP_TTL_MS } from '@/lib/demo-otp';
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
  code?: string;
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
  // Track B — unique deterministic code per email (falls back to the legacy
  // universal demo code when the caller does not supply one).
  const code = input.code?.trim() || DEMO_UNIVERSAL_OTP;
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
    // Same 5-minute window as a real email OTP (DEMO_OTP_TTL_MS).
    maxAge: Math.round(DEMO_OTP_TTL_MS / 1000),
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
    if (Date.now() - parsed.createdAt > DEMO_OTP_TTL_MS) return null;
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
      return '/admin/panel';
    case 'governance':
      return '/governance/dashboard';
    case 'faculty':
      return '/faculty';
    case 'alumni':
      return '/careers';
    default:
      return '/feed';
  }
}

/**
 * Campus cover photography is only produced for the campuses the demo data is
 * rich enough to fill (see supabase/seed/seed_massive_demo_content.sql); every
 * other university falls back to the shared banner so a card never renders a
 * broken image. The live path reads both columns from the database (0014 added
 * `cover_image_url`), and derives `logo_url` from the code the same way.
 */
const DEMO_CAMPUS_COVERS: Record<string, string> = {
  DU: '/campuses/du.jpg',
  JU: '/campuses/ju.jpg',
  BUET: '/campuses/buet.jpg',
  RU: '/campuses/ru.jpg',
  CU: '/campuses/cu.jpg',
  SUST: '/campuses/sust.jpg',
  JUST: '/campuses/just.jpg',
};

/**
 * Authentic Wikimedia Commons photography for the flagship campuses. These
 * are the same URLs the database seed writes (see
 * supabase/seed/seed.sql and migration 0016), so the live registry and the
 * offline preview payload show the same real campus. Attribution:
 * docs/IMAGE_ATTRIBUTION.md.
 */
const DEMO_CAMPUS_PHOTOS: Record<string, string> = {
  DU: 'https://commons.wikimedia.org/wiki/Special:FilePath/Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg?width=1600',
  JU: 'https://commons.wikimedia.org/wiki/Special:FilePath/Shaheed_Minar_of_Jahangirnagar_University.jpg?width=1600',
  BUET: 'https://commons.wikimedia.org/wiki/Special:FilePath/BUET_Campus_(01).jpg?width=1600',
  SUST: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sust_campus_5.JPG?width=1600',
  CU: 'https://commons.wikimedia.org/wiki/Special:FilePath/Campus,_University_of_Chittagong_1.jpg?width=1600',
  RU: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rajshahi_University_Campus.jpg?width=1600',
};

/** Real institutional logo files (Wikipedia/Wikimedia), keyed by code. */
const DEMO_CAMPUS_LOGOS: Record<string, string> = {
  DU: 'https://upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg',
  JU: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Jahangirnagar_University_Logo.svg',
  BUET: 'https://upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg',
  SUST: 'https://upload.wikimedia.org/wikipedia/en/d/d9/Shahjalal_University_of_Science_and_Technology_logo.png',
  CU: 'https://upload.wikimedia.org/wikipedia/en/8/86/University_of_Chittagong_logo.svg',
  RU: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg',
};

export function demoUniversitiesPayload() {
  return DEMO_UNIVERSITIES.map((university) => ({
    id: university.id,
    code: university.code,
    logo_url:
      DEMO_CAMPUS_LOGOS[university.code] ?? `/logos/${university.code.toLowerCase()}.svg`,
    cover_image_url:
      DEMO_CAMPUS_PHOTOS[university.code] ??
      DEMO_CAMPUS_COVERS[university.code] ??
      '/campuses/campus.jpg',
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
