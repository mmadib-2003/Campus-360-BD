// apps/web/lib/demo-auth.ts
/**
 * Server-side helpers for Campus360 demo sessions (`campus360_demo_session`)
 * and preview OTP flows (`campus360_demo_otp`).
 *
 * `campus360_demo_session` is HMAC-SHA256 signed (`<base64url>.<sig>`) and
 * HTTP-only so `/api/auth/demo-signin` can always establish a verified session
 * even if Supabase GoTrue or `SUPABASE_SERVICE_ROLE_KEY` is unavailable.
 */

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { DEMO_OTP_TTL_MS } from '@/lib/demo-otp';
import {
  DEMO_UNIVERSITIES,
  DEMO_UNIVERSITY_HALLS,
  JU_CANONICAL_IIT_DEPARTMENT_ID,
  JU_CANONICAL_UNIVERSITY_ID,
  demoFindUniversity,
  demoFindUniversityByDomain,
  getDemoUniversity,
  type DemoRole,
} from '@/lib/modules/demo-data';
import {
  DEMO_SESSION_COOKIE,
  getDemoSessionSecret,
  isDemoEmail,
  type SignedDemoSessionPayload,
} from '@/lib/demo-session-edge';

export { DEMO_SESSION_COOKIE, isDemoEmail };
export type { SignedDemoSessionPayload };

export const DEMO_OTP_COOKIE = 'campus360_demo_otp';
export const DEMO_UNIVERSAL_OTP = '482913';

const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface DemoChallenge {
  email: string;
  universityId: string;
  role: DemoRole;
  fullName: string;
  studentId: string;
  hallId?: string;
  hallName?: string;
  code: string;
  createdAt: number;
}

export interface DemoSessionPayload {
  id?: string;
  universityId: string;
  university_id?: string;
  universityCode?: string;
  department_id?: string | null;
  departmentCode?: string | null;
  role: DemoRole;
  email: string;
  fullName: string;
  name?: string;
  studentId: string;
  email_verified?: boolean;
  is_demo?: boolean;
}

const ROLES: DemoRole[] = ['student', 'faculty', 'alumni', 'admin', 'governance'];

export function normalizeDemoRole(value: unknown): DemoRole {
  return ROLES.includes(value as DemoRole) ? (value as DemoRole) : 'student';
}

export const DEMO_ROLE_DEFAULTS: Record<
  DemoRole,
  { id: string; email: string; name: string; studentId: string; appRoles: string[] }
> = {
  student: {
    id: 'd0000000-0000-4000-8000-000000000101',
    email: 'student@demo.campus360.bd',
    name: 'Demo Student',
    studentId: 'JU-2026-0101',
    appRoles: ['STUDENT'],
  },
  faculty: {
    id: 'd0000000-0000-4000-8000-000000000102',
    email: 'faculty@demo.campus360.bd',
    name: 'Demo Faculty',
    studentId: 'JU-FAC-0102',
    appRoles: ['FACULTY'],
  },
  admin: {
    id: 'd0000000-0000-4000-8000-000000000103',
    email: 'admin@demo.campus360.bd',
    name: 'Demo Admin',
    studentId: 'JU-ADM-0103',
    appRoles: ['ADMIN', 'UNIVERSITY_ADMIN', 'SUPER_ADMIN'],
  },
  alumni: {
    id: 'd0000000-0000-4000-8000-000000000104',
    email: 'alumni@demo.campus360.bd',
    name: 'Demo Alumni',
    studentId: 'JU-ALM-0104',
    appRoles: ['ALUMNI'],
  },
  governance: {
    id: 'd0000000-0000-4000-8000-000000000105',
    email: 'governance.ju@juniv.edu',
    name: 'University Governance',
    studentId: 'JU-GOV-0105',
    appRoles: ['GOVERNANCE'],
  },
};

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function hmacSign(payloadBase64Url: string): string {
  const digest = crypto
    .createHmac('sha256', getDemoSessionSecret())
    .update(payloadBase64Url)
    .digest();
  return toBase64Url(digest);
}

export function signDemoSessionToken(payload: SignedDemoSessionPayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = hmacSign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyDemoSessionToken(
  rawCookie: string | null | undefined
): SignedDemoSessionPayload | null {
  if (!rawCookie) return null;

  const dot = rawCookie.indexOf('.');
  if (dot > 0) {
    const payloadPart = rawCookie.slice(0, dot);
    const sigPart = rawCookie.slice(dot + 1);
    if (!payloadPart || !sigPart) return null;

    const expectedSig = hmacSign(payloadPart);
    const sigBuf = Buffer.from(sigPart, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    try {
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(normalized, 'base64').toString('utf8');
      const parsed = JSON.parse(json) as Partial<SignedDemoSessionPayload>;
      if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.email || !parsed.role) {
        return null;
      }
      if (typeof parsed.exp === 'number' && Date.now() > parsed.exp) {
        return null;
      }
      return parsed as SignedDemoSessionPayload;
    } catch {
      return null;
    }
  }

  // Backwards-compatible fallback for unsigned JSON cookies set by preview OTP verification.
  try {
    const parsed = JSON.parse(rawCookie) as Partial<DemoSessionPayload>;
    if (!parsed || typeof parsed !== 'object' || !parsed.universityId || !parsed.email) {
      return null;
    }
    const univ = demoFindUniversity(parsed.universityId) ?? getDemoUniversity('JU');
    if (!univ) return null;
    const role = normalizeDemoRole(parsed.role);
    const defaults = DEMO_ROLE_DEFAULTS[role] ?? DEMO_ROLE_DEFAULTS.student;
    const now = Date.now();
    return {
      id: parsed.id || defaults.id,
      email: parsed.email,
      role,
      name: parsed.name || parsed.fullName || defaults.name,
      fullName: parsed.fullName || parsed.name || defaults.name,
      studentId: parsed.studentId || defaults.studentId,
      university_id: parsed.university_id || parsed.universityId,
      universityId: parsed.universityId,
      universityCode: parsed.universityCode || univ.code,
      department_id: parsed.department_id ?? JU_CANONICAL_IIT_DEPARTMENT_ID,
      departmentCode: parsed.departmentCode ?? 'IIT',
      email_verified: true,
      is_demo: true,
      iat: now,
      exp: now + DEMO_SESSION_MAX_AGE_SECONDS * 1000,
    };
  } catch {
    return null;
  }
}

export function issueSignedDemoSession(input: {
  id?: string;
  email: string;
  role: DemoRole;
  name?: string;
  studentId?: string;
  university_id?: string;
  universityCode?: string;
  department_id?: string | null;
  departmentCode?: string | null;
  hall_id?: string | null;
  hall_name?: string | null;
  program_session?: string | null;
}): { payload: SignedDemoSessionPayload; token: string } {
  const defaults = DEMO_ROLE_DEFAULTS[input.role] ?? DEMO_ROLE_DEFAULTS.student;
  const now = Date.now();
  const universityCode = (input.universityCode || 'JU').toUpperCase();
  const universityId = input.university_id || JU_CANONICAL_UNIVERSITY_ID;
  const departmentId =
    input.department_id === undefined ? JU_CANONICAL_IIT_DEPARTMENT_ID : input.department_id;
  const name = input.name?.trim() || defaults.name;

  const payload: SignedDemoSessionPayload = {
    id: input.id || defaults.id,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    name,
    fullName: name,
    studentId: input.studentId || defaults.studentId,
    university_id: universityId,
    universityId,
    universityCode,
    department_id: departmentId,
    departmentCode: input.departmentCode === undefined ? 'IIT' : input.departmentCode,
    hall_id: input.hall_id ?? null,
    hall_name: input.hall_name ?? null,
    program_session: input.program_session ?? null,
    email_verified: true,
    is_demo: true,
    iat: now,
    exp: now + DEMO_SESSION_MAX_AGE_SECONDS * 1000,
  };

  const token = signDemoSessionToken(payload);
  cookies().set(DEMO_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });

  return { payload, token };
}

export function readSignedDemoSession(): SignedDemoSessionPayload | null {
  try {
    const raw = cookies().get(DEMO_SESSION_COOKIE)?.value;
    return verifyDemoSessionToken(raw);
  } catch {
    return null;
  }
}

export function buildDemoProfileFromSession(
  session: SignedDemoSessionPayload,
  overrides?: { university_id?: string; department_id?: string | null }
) {
  const university = getDemoUniversity(session.universityCode || session.university_id) ?? DEMO_UNIVERSITIES[0];
  const hall = session.role === 'student'
    ? DEMO_UNIVERSITY_HALLS.find((h) => h.id === session.hall_id && h.universityCode === university.code)
      ?? DEMO_UNIVERSITY_HALLS.find((h) => h.universityCode === university.code)
    : undefined;
  const universityId = overrides?.university_id ?? session.university_id ?? university.id;
  const departmentId =
    overrides?.department_id !== undefined ? overrides.department_id : session.department_id;
  const defaults = DEMO_ROLE_DEFAULTS[session.role] ?? DEMO_ROLE_DEFAULTS.student;

  const profile = {
    id: session.id,
    university_id: universityId,
    department_id: departmentId,
    email: session.email,
    full_name: session.fullName || session.name,
    name: session.name || session.fullName,
    student_id: session.studentId || defaults.studentId,
    batch: session.role === 'alumni' ? '45th Batch' : '51st Batch',
    program_session: session.program_session ?? null,
    role: session.role,
    trust_level: 'ID_VERIFIED',
    onboarding_completed: true,
    email_verified: true,
    is_verified: true,
    is_demo: true,
    universities: {
      code: university.code,
      name_en: university.name_en,
      name_bn: university.name_bn,
    },
    departments: {
      code: session.departmentCode || 'IIT',
      name_en:
        (session.departmentCode || 'IIT') === 'IIT'
          ? 'Institute of Information Technology (IIT)'
          : 'Computer Science and Engineering',
      name_bn:
        (session.departmentCode || 'IIT') === 'IIT'
          ? 'তথ্যপ্রযুক্তি ইনস্টিটিউট (আইআইটি)'
          : 'কম্পিউটার বিজ্ঞান ও প্রকৌশল',
    },
    hall_id: session.hall_id ?? hall?.id ?? null,
    halls: session.role !== 'student' ? null : session.hall_name ? { name: session.hall_name } : hall
      ? { name: hall.name, name_bn: hall.name_bn, type: hall.type }
      : null,
  };

  const roles = defaults.appRoles.map((role) => ({
    role,
    university_id: universityId,
  }));

  return { profile, roles };
}

export function issueDemoChallenge(input: {
  email: string;
  universityId?: string | null;
  role?: unknown;
  fullName?: string;
  studentId?: string;
  hallId?: string;
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
  const selectedHall = input.hallId ? DEMO_UNIVERSITY_HALLS.find((hall) => hall.id === input.hallId && hall.universityCode === byDomain.code) : undefined;
  if (input.hallId && !selectedHall) return { ok: false, error: 'Please select a hall belonging to your university.', errorBn: 'আপনার বিশ্ববিদ্যালয়ের হল নির্বাচন করুন।', status: 400 };
  const role = normalizeDemoRole(input.role);
  const code = input.code?.trim() || DEMO_UNIVERSAL_OTP;
  const challenge: DemoChallenge = {
    email,
    universityId: byDomain.id,
    role,
    fullName: input.fullName?.trim() || 'Demo Student',
    studentId: input.studentId?.trim() || `${byDomain.code}-2026-12345`,
    hallId: selectedHall?.id,
    hallName: selectedHall?.name,
    code,
    createdAt: Date.now(),
  };
  const store = cookies();
  store.set(DEMO_OTP_COOKIE, JSON.stringify(challenge), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
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

export function verifyDemoChallenge(
  email: string,
  otp: string
): { ok: true; session: DemoSessionPayload } | { ok: false; error: string; errorBn: string; status: number } {
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
  const univ = demoFindUniversity(challenge.universityId);
  const { payload } = issueSignedDemoSession({
    email: challenge.email,
    role: challenge.role,
    name: challenge.fullName,
    studentId: challenge.studentId,
    university_id: challenge.universityId,
    universityCode: univ?.code || 'JU',
    hall_id: challenge.hallId,
    hall_name: challenge.hallName,
  });
  cookies().delete(DEMO_OTP_COOKIE);
  return { ok: true, session: payload };
}

export function readDemoSessionPayload(): DemoSessionPayload | null {
  return readSignedDemoSession();
}

export function clearDemoSession() {
  try {
    const store = cookies();
    store.delete(DEMO_SESSION_COOKIE);
    store.delete(DEMO_OTP_COOKIE);
  } catch {
    /* ignore outside request scope */
  }
}

export function demoNextStep(role: DemoRole): string {
  switch (role) {
    case 'admin':
      return '/admin/console';
    case 'governance':
      return '/governance/dashboard';
    default:
      return '/feed';
  }
}

const DEMO_CAMPUS_COVERS: Record<string, string> = {
  DU: '/campuses/du.jpg',
  JU: '/campuses/ju.jpg?v=ju-shaheed-minar',
  // User-supplied authentic photos (2026-11, docs/IMAGE_ATTRIBUTION.md);
  // the query string busts browser/CDN caches of the older covers.
  BUET: '/campuses/buet.jpg?v=buet-gate2-2026',
  RU: '/campuses/ru.jpg?v=ru-admin-2026',
  CU: '/campuses/cu.jpg?v=cu-monument-2026',
  SUST: '/campuses/sust.jpg?v=sust-gate-2026',
  JNU: '/campuses/jnu.jpg?v=jnu-campus-2026',
  BUTEX: '/campuses/butex.jpg',
  RUET: '/campuses/ruet.jpg',
  CUET: '/campuses/cuet.jpg',
  KUET: '/campuses/kuet.webp?v=kuet-landmark-2026',
  BAU: '/campuses/bau.jpg',
  IU: '/campuses/iu.jpg?v=iu-gate-2026',
};

const DEMO_CAMPUS_PHOTOS: Record<string, string> = {
  DU: 'https://commons.wikimedia.org/wiki/Special:FilePath/Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg?width=1600',
  JU: '/campuses/ju.jpg?v=ju-shaheed-minar',
  // CU, SUST and KUET (migration 0024) plus IU, JnU, RU and BUET (migration
  // 0027) use the user-supplied authentic campus photos bundled in
  // /public/campuses instead of the Wikimedia files the seed still records.
  BUET: '/campuses/buet.jpg?v=buet-gate2-2026',
  SUST: '/campuses/sust.jpg?v=sust-gate-2026',
  CU: '/campuses/cu.jpg?v=cu-monument-2026',
  RU: '/campuses/ru.jpg?v=ru-admin-2026',
  JNU: '/campuses/jnu.jpg?v=jnu-campus-2026',
  BUP: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/BUP_Campus_Aerial_View_2.jpg/1920px-BUP_Campus_Aerial_View_2.jpg',
  JUST: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg/1920px-Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg',
  KUET: '/campuses/kuet.webp?v=kuet-landmark-2026',
  CUET: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/CUET_GATE.jpg/1920px-CUET_GATE.jpg',
  BAU: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Bangladesh_Agricultural_University_%28BAU%29.jpg',
  BUTEX: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Butex..jpg',
  RUET: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Ruet_campus_gate.jpg',
  IU: '/campuses/iu.jpg?v=iu-gate-2026',
};

const DEMO_CAMPUS_LOGOS: Record<string, string> = {
  DU: 'https://upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg',
  JU: 'https://upload.wikimedia.org/wikipedia/en/a/a9/Jahangirnagar_University_Logo.svg',
  BUET: 'https://upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg',
  SUST: 'https://upload.wikimedia.org/wikipedia/en/d/d9/Shahjalal_University_of_Science_and_Technology_logo.png',
  CU: 'https://upload.wikimedia.org/wikipedia/en/8/86/University_of_Chittagong_logo.svg',
  RU: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg',
  JNU: 'https://upload.wikimedia.org/wikipedia/en/4/47/Logo_of_Jagannath_University.svg',
  BUP: 'https://upload.wikimedia.org/wikipedia/en/9/95/Bangladesh_University_of_Professionals_%28BUP%29_Logo.svg',
  JUST: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Jashore_University_Of_Science_and_Technology_logo.png',
  KUET: 'https://upload.wikimedia.org/wikipedia/en/7/74/Logo_KUET.svg',
  CUET: 'https://upload.wikimedia.org/wikipedia/en/0/0e/CUET_Vector_Logo.svg',
  BAU: 'https://upload.wikimedia.org/wikipedia/en/a/a2/Bangladesh_Agriculture_University_logo.svg',
  BUTEX: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Bangladesh_University_of_Textiles_logo.svg',
  RUET: 'https://upload.wikimedia.org/wikipedia/en/8/87/RUET_logo.svg',
  IU: 'https://upload.wikimedia.org/wikipedia/en/7/7b/Islamic_University%2C_Bangladesh_logo.svg',
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
