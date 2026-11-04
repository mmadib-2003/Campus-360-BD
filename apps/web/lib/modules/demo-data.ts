// apps/web/lib/modules/demo-data.ts
/**
 * Multi-university demo / offline dataset.
 *
 * The platform always prefers live Supabase data. When a deployment has no
 * `NEXT_PUBLIC_SUPABASE_URL` / anon key (for example a fresh preview), every
 * module stays fully interactive using this local store instead of throwing.
 *
 * The store is campus-scoped: a session selects one university + role, and
 * `demoList` never returns another campus's rows. Writes are persisted in
 * localStorage and broadcast on a BroadcastChannel so two browser tabs (two
 * sessions) see new listings, upvotes, blood requests, matches and RSVPs
 * within a couple of seconds — the same contract as Supabase Realtime.
 */

export type DemoRole = 'student' | 'faculty' | 'alumni' | 'admin' | 'governance';

export interface DemoUniversity {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  city: string;
  category: string;
  domains: string[];
  lat: number;
  lng: number;
}

export interface DemoSession {
  universityId: string;
  role: DemoRole;
  email: string;
  fullName: string;
}

export const DEMO_UNIVERSITIES: DemoUniversity[] = [
  {
    id: 'demo-univ-ju',
    code: 'JU',
    name_en: 'Jahangirnagar University',
    name_bn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়',
    city: 'Savar, Dhaka',
    category: 'GENERAL',
    domains: ['juniv.edu', 'student.juniv.edu'],
    lat: 23.8791,
    lng: 90.2674,
  },
  {
    id: 'demo-univ-du',
    code: 'DU',
    name_en: 'University of Dhaka',
    name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
    city: 'Dhaka',
    category: 'GENERAL',
    domains: ['du.ac.bd', 'students.du.ac.bd'],
    lat: 23.734,
    lng: 90.3928,
  },
  {
    id: 'demo-univ-buet',
    code: 'BUET',
    name_en: 'Bangladesh University of Engineering and Technology',
    name_bn: 'বাংলাদেশ প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    city: 'Dhaka',
    category: 'ENGINEERING',
    domains: ['buet.ac.bd', 'ug.buet.ac.bd'],
    lat: 23.7266,
    lng: 90.3926,
  },
  {
    id: 'demo-univ-sust',
    code: 'SUST',
    name_en: 'Shahjalal University of Science and Technology',
    name_bn: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    city: 'Sylhet',
    category: 'SCIENCE_AND_TECH',
    domains: ['sust.edu', 'student.sust.edu'],
    lat: 24.9172,
    lng: 91.8319,
  },
  {
    id: 'demo-univ-ru',
    code: 'RU',
    name_en: 'University of Rajshahi',
    name_bn: 'রাজশাহী বিশ্ববিদ্যালয়',
    city: 'Rajshahi',
    category: 'GENERAL',
    domains: ['ru.ac.bd'],
    lat: 24.3686,
    lng: 88.6366,
  },
  {
    id: 'demo-univ-cu',
    code: 'CU',
    name_en: 'University of Chittagong',
    name_bn: 'চট্টগ্রাম বিশ্ববিদ্যালয়',
    city: 'Chattogram',
    category: 'GENERAL',
    domains: ['cu.ac.bd', 'std.cu.ac.bd'],
    lat: 22.4706,
    lng: 91.7875,
  },
  {
    id: 'demo-univ-jnu',
    code: 'JNU',
    name_en: 'Jagannath University',
    name_bn: 'জগন্নাথ বিশ্ববিদ্যালয়',
    city: 'Dhaka',
    category: 'GENERAL',
    domains: ['jnu.ac.bd'],
    lat: 23.7087,
    lng: 90.4114,
  },
  {
    id: 'demo-univ-bup',
    code: 'BUP',
    name_en: 'Bangladesh University of Professionals',
    name_bn: 'বাংলাদেশ ইউনিভার্সিটি অব প্রফেশনালস',
    city: 'Mirpur, Dhaka',
    category: 'GENERAL',
    domains: ['bup.ac.bd'],
    lat: 23.8384,
    lng: 90.3578,
  },
  {
    id: 'demo-univ-just',
    code: 'JUST',
    name_en: 'Jashore University of Science and Technology',
    name_bn: 'যশোর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    city: 'Jashore',
    category: 'SCIENCE_AND_TECH',
    domains: ['just.ac.bd'],
    lat: 23.2336,
    lng: 89.1254,
  },
  {
    id: 'demo-univ-kuet',
    code: 'KUET',
    name_en: 'Khulna University of Engineering & Technology',
    name_bn: 'খুলনা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    city: 'Khulna',
    category: 'ENGINEERING',
    domains: ['kuet.ac.bd'],
    lat: 22.9005,
    lng: 89.5024,
  },
  {
    id: 'demo-univ-cuet',
    code: 'CUET',
    name_en: 'Chittagong University of Engineering & Technology',
    name_bn: 'চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    city: 'Raozan, Chattogram',
    category: 'ENGINEERING',
    domains: ['cuet.ac.bd'],
    lat: 22.462,
    lng: 91.9711,
  },
  {
    id: 'demo-univ-bau',
    code: 'BAU',
    name_en: 'Bangladesh Agricultural University',
    name_bn: 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়',
    city: 'Mymensingh',
    category: 'AGRICULTURAL',
    domains: ['bau.ac.bd'],
    lat: 24.7244,
    lng: 90.4366,
  },
];

export const DEMO_UNIVERSITY_ID = 'demo-univ-du';

/**
 * Canonical demo credentials — mirrors supabase/seed/seed_users_demo_accounts.sql.
 * Password-based (Demo#1234) so the DevSignInPanel can use signInWithPassword
 * and bypass the Supabase OTP email limits entirely. One account per role per
 * university for DU, BUET, SUST, RU and CU.
 */
export interface DemoAccount {
  email: string;
  password: string;
  role: Exclude<DemoRole, 'faculty' | 'alumni'>;
  universityCode: string;
  fullName: string;
}

const DEMO_PASSWORD = 'Demo#1234';

function buildDemoAccounts(): DemoAccount[] {
  const accounts: DemoAccount[] = [];
  for (const code of ['DU', 'BUET', 'SUST', 'RU', 'CU']) {
    const university = getDemoUniversity(code);
    if (!university) continue;
    const domain = demoDomainFor(university);
    accounts.push(
      {
        email: `student.${code.toLowerCase()}@${domain}`,
        password: DEMO_PASSWORD,
        role: 'student',
        universityCode: code,
        fullName: `Demo Student (${code})`,
      },
      {
        email: `admin.${code.toLowerCase()}@${domain}`,
        password: DEMO_PASSWORD,
        role: 'admin',
        universityCode: code,
        fullName: `Platform Admin (${code})`,
      },
      {
        email: `governance.${code.toLowerCase()}@${domain}`,
        password: DEMO_PASSWORD,
        role: 'governance',
        universityCode: code,
        fullName: `University Governance (${code})`,
      }
    );
  }
  return accounts;
}

export const DEMO_ACCOUNTS: DemoAccount[] = buildDemoAccounts();

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.email === normalized);
}

/**
 * Residential halls — mirrors supabase/seed/seed_university_halls.sql
 * (real halls for DU, RU, CU, BUET, SUST, plus JU for the campus switcher).
 */
export interface DemoHall {
  id: string;
  universityCode: string;
  name: string;
  name_bn: string;
  type: 'RESIDENTIAL' | 'DAY_SCHOLAR';
}

const DEMO_HALL_ROWS: Array<[string, string, string, 'RESIDENTIAL' | 'DAY_SCHOLAR']> = [
  ['DU', 'Salimullah Muslim Hall', 'সলিমুল্লাহ মুসলিম হল', 'RESIDENTIAL'],
  ['DU', 'Shahidullah Hall', 'শহীদুল্লাহ হল', 'RESIDENTIAL'],
  ['DU', 'Jagannath Hall', 'জগন্নাথ হল', 'RESIDENTIAL'],
  ['DU', 'Fazlul Huq Muslim Hall', 'ফজলুল হক মুসলিম হল', 'RESIDENTIAL'],
  ['DU', 'Sergeant Zahurul Haq Hall', 'সার্জেন্ট জহুরুল হক হল', 'RESIDENTIAL'],
  ['DU', 'Rokeya Hall', 'রোকেয়া হল', 'RESIDENTIAL'],
  ['DU', 'Masterda Surja Sen Hall', 'মাস্টারদা সূর্যসেন হল', 'RESIDENTIAL'],
  ['DU', 'Haji Muhammad Mohsin Hall', 'হাজী মোহাম্মদ মোহসিন হল', 'RESIDENTIAL'],
  ['DU', 'Shamsun Nahar Hall', 'শামসুন নাহার হল', 'RESIDENTIAL'],
  ['RU', 'Shah Makhdum Hall', 'শাহ মখদুম হল', 'RESIDENTIAL'],
  ['RU', 'Nawab Abdul Latif Hall', 'নবাব আবদুল লতিফ হল', 'RESIDENTIAL'],
  ['RU', 'Syed Ameer Ali Hall', 'সৈয়দ আমীর আলী হল', 'RESIDENTIAL'],
  ['RU', 'Shahid Shamsuzzoha Hall', 'শহীদ শামসুজ্জোহা হল', 'RESIDENTIAL'],
  ['RU', 'Shahid Habibur Rahman Hall', 'শহীদ হাবিবুর রহমান হল', 'RESIDENTIAL'],
  ['RU', 'Mother Box Hall', 'মাদার বক্স হল', 'RESIDENTIAL'],
  ['CU', 'Shahid Farhad Hossain Hall', 'শহীদ ফরহাদ হোসেন হল', 'RESIDENTIAL'],
  ['CU', 'Amanat Hall', 'আমানত হল', 'RESIDENTIAL'],
  ['CU', 'Shah Abdur Rab Hall', 'শাহ আবদুর রাব হল', 'RESIDENTIAL'],
  ['CU', 'Shahjalal Hall', 'শাহজালাল হল', 'RESIDENTIAL'],
  ['CU', 'Suhrawardy Hall', 'সোহরাওয়ার্দী হল', 'RESIDENTIAL'],
  ['CU', 'Atish Dipankar Hall', 'আতিশ দীপঙ্কর হল', 'RESIDENTIAL'],
  ['BUET', 'Sherebangla Hall', 'শেরেবাংলা হল', 'RESIDENTIAL'],
  ['BUET', 'Ahsanullah Hall', 'আহসানউল্লাহ হল', 'RESIDENTIAL'],
  ['BUET', 'Titumir Hall', 'তিতুমীর হল', 'RESIDENTIAL'],
  ['BUET', 'Rashid Hall', 'রশীদ হল', 'RESIDENTIAL'],
  ['BUET', 'Nazrul Hall', 'নজরুল হল', 'RESIDENTIAL'],
  ['SUST', 'Shahjalal Hall', 'শাহজালাল হল', 'RESIDENTIAL'],
  ['SUST', 'Academic Building B', 'একাডেমিক ভবন বি (দিবাকালীন শিক্ষার্থী)', 'DAY_SCHOLAR'],
  ['JU', 'Al-Beruni Hall', 'আল বেরুনী হল', 'RESIDENTIAL'],
  ['JU', 'Mir Mosharraf Hossain Hall', 'মীর মশাররফ হোসেন হল', 'RESIDENTIAL'],
  ['JU', 'Nawab Faizunnesa Hall', 'নওয়াব ফয়জুন্নেসা হল', 'RESIDENTIAL'],
  ['JU', 'Jahanara Imam Hall', 'জাহানারা ইমাম হল', 'RESIDENTIAL'],
];

export const DEMO_UNIVERSITY_HALLS: DemoHall[] = DEMO_HALL_ROWS.map(([code, name, name_bn, type]) => ({
  id: `hall-${code.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  universityCode: code,
  name,
  name_bn,
  type,
}));
/**
 * Fallback for /api/programs when a deployment has no database attached
 * (preview builds). Mirrors the rows migration 0012 seeds, keyed by `code`
 * instead of a UUID so a demo signup can be matched without the table.
 */
export interface DemoAcademicProgram {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  cycle: 'UNDERGRADUATE' | 'GRADUATE' | 'DOCTORAL' | 'DIPLOMA';
  duration_years: number;
  sort_order: number;
}

export const DEMO_ACADEMIC_PROGRAMS: DemoAcademicProgram[] = (
  [
  ['HONORS', "Bachelor's (Honors)", 'অনার্স (স্নাতক সম্মান)', 'UNDERGRADUATE', 4],
  ['DEGREE_PASS', "Bachelor's (Degree / Pass)", 'ডিগ্রি (পাস) কোর্স', 'UNDERGRADUATE', 3],
  ['ENGINEERING_BSC', 'B.Sc. in Engineering', 'প্রকৌশলে বিএসসি', 'UNDERGRADUATE', 4],
  ['AGRICULTURE_BSC', 'B.Sc. in Agriculture', 'কৃষিতে বিএসসি', 'UNDERGRADUATE', 4],
  ['ARCHITECTURE_BARCH', 'B. Architecture', 'স্থাপত্যে বি.আর্চ', 'UNDERGRADUATE', 5],
  ['MEDICAL_MBBS', 'M.B.B.S. (Medicine)', 'এমবিবিএস (চিকিৎসা)', 'UNDERGRADUATE', 6],
  ['DENTAL_BDS', 'B.D.S. (Dentistry)', 'বিডিএস (দন্ত)', 'UNDERGRADUATE', 5],
  ['NURSING_BSC', 'B.Sc. in Nursing', 'নার্সিংয়ে বিএসসি', 'UNDERGRADUATE', 4],
  ['PHARMACY', 'Pharmacy (Pharm.D / B.Pharm)', 'ফার্মেসি (ফার্মডি / বিফার্ম)', 'UNDERGRADUATE', 4],
  ['MASTERS', "Master's / MBA / MPA", 'স্নাতকোত্তর / এমবিএ / এমপিএ', 'GRADUATE', 2],
  ['MASTERS_FINAL', "Master's (Final Year)", 'স্নাতকোত্তর (ফাইনাল ইয়ার)', 'GRADUATE', 1],
  ['PG_DIPLOMA', 'Post-Graduate Diploma', 'স্নাতকোত্তর ডিপ্লোমা', 'DIPLOMA', 1],
  ['DIPLOMA', 'Diploma (Post-SSC)', 'ডিপ্লোমা (এসএসসি-োত্তর)', 'DIPLOMA', 4],
  ['PHD', 'Ph.D. / Doctorate', 'পিএইচডি (ডক্টরেট)', 'DOCTORAL', 4],
] as Array<[string, string, string, DemoAcademicProgram['cycle'], number]>
).map(([code, name_en, name_bn, cycle, duration_years], index) => ({
  id: `program-${code.toLowerCase()}`,
  code,
  name_en,
  name_bn,
  cycle,
  duration_years,
  sort_order: (index + 1) * 10,
}));

export const DEFAULT_DEMO_SESSION: DemoSession = {
  universityId: DEMO_UNIVERSITY_ID,
  role: 'student',
  email: 'student@du.ac.bd',
  fullName: 'Nusrat Jahan',
};

export function getDemoUniversity(idOrCode: string | null | undefined): DemoUniversity | undefined {
  if (!idOrCode) return undefined;
  return DEMO_UNIVERSITIES.find(
    (u) => u.id === idOrCode || u.code.toLowerCase() === idOrCode.toLowerCase()
  );
}

export function demoDomainFor(university: DemoUniversity): string {
  return university.domains[0] ?? `${university.code.toLowerCase()}.ac.bd`;
}

const ROLE_NAMES: Record<DemoRole, string> = {
  student: 'Nusrat Jahan',
  faculty: 'Dr. Md. Kamrul Hasan',
  alumni: 'Farhana Rahman',
  admin: 'University Admin',
  governance: 'University Governance',
};

const ROLE_EMAILS: Record<DemoRole, (domain: string) => string> = {
  student: (d) => `student@${d}`,
  faculty: (d) => `faculty@${d}`,
  alumni: (d) => `alumni@${d}`,
  admin: (d) => `admin@${d}`,
  governance: (d) => `governance@${d}`,
};

const ROLE_IDS: Record<DemoRole, (code: string) => string> = {
  student: (code) => `${code}-2026-12345`,
  faculty: (code) => `${code}-FAC-0142`,
  alumni: (code) => `${code}-ALM-2019-088`,
  admin: (code) => `${code}-ADM-001`,
  governance: (code) => `${code}-GOV-001`,
};

const ROLE_ROLES: Record<DemoRole, string[]> = {
  student: ['STUDENT'],
  faculty: ['FACULTY'],
  alumni: ['ALUMNI'],
  admin: ['ADMIN'],
  governance: ['GOVERNANCE'],
};

const ALL_DEMO_ROLES: DemoRole[] = ['student', 'faculty', 'alumni', 'admin', 'governance'];

export function getDemoSession(): DemoSession {
  if (typeof window === 'undefined') return DEFAULT_DEMO_SESSION;
  try {
    const raw = window.localStorage.getItem('campus360.demo.session.v1');
    if (!raw) return DEFAULT_DEMO_SESSION;
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    const university = getDemoUniversity(parsed.universityId) ?? getDemoUniversity(DEFAULT_DEMO_SESSION.universityId)!;
    const role: DemoRole = ALL_DEMO_ROLES.includes(String(parsed.role) as DemoRole)
      ? (parsed.role as DemoRole)
      : 'student';
    return {
      universityId: university.id,
      role,
      email: parsed.email || ROLE_EMAILS[role](demoDomainFor(university)),
      fullName: parsed.fullName || ROLE_NAMES[role],
    };
  } catch {
    return DEFAULT_DEMO_SESSION;
  }
}

export function getActiveDemoUniversity(): DemoUniversity {
  return getDemoUniversity(getDemoSession().universityId) ?? DEMO_UNIVERSITIES[1];
}

export function setDemoSession(patch: Partial<DemoSession>) {
  if (typeof window === 'undefined') return;
  const current = getDemoSession();
  const university = getDemoUniversity(patch.universityId) ?? getDemoUniversity(current.universityId)!;
  const role = patch.role ?? current.role;
  const next: DemoSession = {
    universityId: university.id,
    role,
    email: patch.email ?? ROLE_EMAILS[role](demoDomainFor(university)),
    fullName: patch.fullName ?? ROLE_NAMES[role],
  };
  window.localStorage.setItem('campus360.demo.session.v1', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('campus360:demo-session', { detail: next }));
  try {
    const channel = new BroadcastChannel('campus360:demo-session');
    channel.postMessage(next);
    channel.close();
  } catch {
    /* BroadcastChannel is optional */
  }
  // Refresh every mounted module list so a campus/role switch is immediate.
  broadcastDemoEvent({ type: 'store', table: '*', at: Date.now() });
}

export function subscribeDemoSession(callback: (session: DemoSession) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'campus360.demo.session.v1') callback(getDemoSession());
  };
  const onCustom = () => callback(getDemoSession());
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel('campus360:demo-session');
    channel.onmessage = () => callback(getDemoSession());
  } catch {
    channel = null;
  }
  window.addEventListener('storage', onStorage);
  window.addEventListener('campus360:demo-session', onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('campus360:demo-session', onCustom);
    channel?.close();
  };
}

export function getDemoProfile(session: DemoSession = getDemoSession()) {
  const university = getDemoUniversity(session.universityId) ?? DEMO_UNIVERSITIES[1];
  const role = session.role;
  const hall = DEMO_UNIVERSITY_HALLS.find((h) => h.universityCode === university.code);
  return {
    id: `demo-user-${university.code.toLowerCase()}-${role}`,
    university_id: university.id,
    email: session.email,
    full_name: session.fullName || ROLE_NAMES[role],
    trust_level: role === 'student' ? 'ID_VERIFIED' : 'TRUSTED',
    student_id: ROLE_IDS[role](university.code),
    roles: ROLE_ROLES[role],
    isAdmin: role === 'admin',
    isGovernance: role === 'governance',
    universities: {
      code: university.code,
      name_en: university.name_en,
      name_bn: university.name_bn,
    },
    halls: hall
      ? { name: hall.name, name_en: hall.name, name_bn: hall.name_bn, type: hall.type }
      : { name: `${university.code} Residential Hall`, name_en: `${university.code} Residential Hall`, name_bn: `${university.code} আবাসিক হল` },
    departments: { code: 'CSE', name_en: 'Computer Science and Engineering', name_bn: 'কম্পিউটার সায়েন্স' },
  };
}

/** Backwards-compatible default profile (DU student) for existing imports. */
export const DEMO_PROFILE = getDemoProfile(DEFAULT_DEMO_SESSION);

type Row = Record<string, any>;

const now = Date.now();
const iso = (offsetMinutes: number) => new Date(now + offsetMinutes * 60_000).toISOString();
const dateOnly = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString().slice(0, 10);
const daysAgo = (days: number) => iso(-days * 24 * 60);

interface CampusSeed {
  pickup: Array<[string, string, string, string, string]>;
  market: Array<[string, string, string, string, number, string, string, string, string[]]>;
  skills: Array<[string, string, string, string, number, string, string, string]>;
  civic: Array<[string, string, string, string, string, string, number, number]>;
  lost: Array<[string, string, string, string, string, number]>;
  housing: Array<[string, string, number, string, string, string, number, string]>;
  dining: Array<[string, string, string, string, string]>;
  events: Array<[string, string, string, string, number]>;
  blood: Array<[string, string, string, string, string, string]>;
}

const CAMPUS_SEED: Record<string, CampusSeed> = {
  DU: {
    pickup: [
      ['NILKhet', 'Nilkhet Book Market', 'নিলখেট বুক মার্কেট', 'Nilkhet, beside the DU main gate', 'নিলখেট, ডিইউ প্রধান ফটকের পাশে'],
      ['CURZON', 'Curzon Hall Gate', 'কার্জন হল গেট', 'Curzon Hall, University of Dhaka', 'কার্জন হল, ঢাকা বিশ্ববিদ্যালয়'],
      ['TSC-DU', 'TSC Security Desk', 'টিএসসি সিকিউরিটি ডেস্ক', 'Teacher-Student Center main entrance', 'টিএসসি প্রধান প্রবেশপথ'],
    ],
    market: [
      ['Cormen Algorithms 3rd ed', 'Introduction to Algorithms (CLRS) 3rd edition. Used for one semester, no missing pages. Pickup from Nilkhet book market.', 'Books', 'SELL', 450, 'GOOD', 'NILKhet', 'Nusrat Jahan', ['cormen', 'algorithms', 'clrs', 'cse']],
      ['Casio FX-991EX scientific calculator', 'Battery included, all modes working. Cleared for DU science faculty exams.', 'Electronics', 'SELL', 1200, 'LIKE_NEW', 'TSC-DU', 'Rafid Hasan', ['calculator', 'casio', 'science']],
      ['DU hoodie — 2024 batch', 'Official DU hoodie, size L, washed twice. No stains.', 'Clothing', 'SELL', 600, 'GOOD', 'CURZON', 'Tasnim Chowdhury', ['hoodie', 'du', 'clothing']],
      ['Reading table + desk lamp', 'Sturdy wooden table with a warm desk lamp. Ideal for hall room study.', 'Furniture', 'SELL', 900, 'FAIR', 'TSC-DU', 'Sabbir Ahmed', ['table', 'lamp', 'furniture']],
      ['Rokeya Hall bicycle', 'Single-speed bicycle, new brake pads. For hall-to-department commute.', 'Transport', 'RENT', 3500, 'GOOD', 'CURZON', 'Maliha Akter', ['bicycle', 'cycle', 'commute']],
    ],
    skills: [
      ['Data Structures crash course', 'Final-year CSE student offering 6-week Data Structures prep for DU admission and semester exams. Sunday/Tuesday evenings at TSC.', 'TUTORING', 'TUTORING', 800, 'Data Structures, C++, Algorithms', 'TSC, University of Dhaka', 'Rafid Hasan'],
      ['IELTS speaking practice', 'English department student offering 1-on-1 speaking practice and mock tests. Online or Curzon Hall library.', 'TUTORING', 'TUTORING', 600, 'IELTS, Spoken English', 'Curzon Hall Library', 'Tasnim Chowdhury'],
      ['Freelance graphic design for campus events', 'Design posters, event banners and social creatives. 3 years of experience with DU clubs.', 'FREELANCE', 'FREELANCE', 1500, 'Photoshop, Illustrator, Figma', 'Remote', 'Sabbir Ahmed'],
    ],
    civic: [
      ['Broken streetlight outside Curzon Hall', 'INFRASTRUCTURE', 'HIGH', 'Curzon Hall main road', 'The streetlight between Curzon Hall and the TSC has been dark for 9 days. Students returning from evening classes feel unsafe.', 'IN_REVIEW', 34, 9],
      ['Waterlogging at TSC gate after rain', 'INFRASTRUCTURE', 'MEDIUM', 'TSC main gate', 'The drain outside the TSC gate overflows whenever it rains. Rickshaws cannot pass and students wade through dirty water.', 'ACTION_TAKEN', 51, 14],
      ['Damaged bench in front of Central Library', 'INFRASTRUCTURE', 'LOW', 'Central Library lawn', 'Two benches are broken and the metal edges are sharp. A first-year student cut their hand last week.', 'RESOLVED', 18, 21],
    ],
    lost: [
      ['Lost black backpack at TSC', 'LOST', 'Bags', 'TSC, near the food court', 'Black backpack with a laptop sleeve, a blue water bottle and a Data Structures notebook inside.', 2],
      ['Found Casio calculator in Central Library', 'FOUND', 'Electronics', 'Central Library, 2nd floor reading room', 'Found a Casio FX-991EX under a reading table. The name "Rafid" is written on the back.', 1],
      ['Lost student ID card near Curzon Hall', 'LOST', 'Documents', 'Curzon Hall gate', 'DU student ID card, name Tasnim Chowdhury, Department of English.', 3],
    ],
    housing: [
      ['Salimullah Hall seat vacant', 'MESS_SEAT', 4500, 'Salimullah Hall, DU campus', 'সলিমুল্লাহ হল, ঢাকা বিশ্ববিদ্যালয়', 'Vacant seat in a 4-person room. Mess included. 2nd-year students preferred.', 1, 'MALE'],
      ['Nilkhet girls mess seat', 'MESS_SEAT', 3800, 'Nilkhet, 2 minutes from DU gate', 'নিলখেট, ডিইউ গেট থেকে ২ মিনিট', 'Home-style meals, Wi-Fi, and a quiet study room. Female students only.', 1, 'FEMALE'],
      ['Dhanmondi boys sublet', 'SUBLET', 7000, 'Dhanmondi, near TSC bus stop', 'ধানমন্ডি, টিএসসি বাস স্টপের কাছে', 'Single room with attached bath, 15 minutes by bus to the DU campus.', 1, 'MALE'],
    ],
    dining: [
      ['Salimullah Hall lunch', 'সলিমুল্লাহ হল লাঞ্চ', 'LUNCH', '12:30 - 14:00', 'Rice, Hilsa fish, dal, mixed vegetable|120'],
      ['TSC cafeteria snacks', 'টিএসসি ক্যাফেটেরিয়া সnek', 'SNACKS', '16:00 - 19:00', 'Singara, tea, banana|60'],
      ['Nilkhet home food dinner', 'নিলখেটের ঘরের খাবার', 'DINNER', '19:00 - 21:30', 'Khichuri, beef bhuna, salad|150'],
    ],
    events: [
      ['DU CSE Fest 2026', 'TECH', 'TSC Auditorium', 'Three-day tech fest with hackathons, project showcase and a startup pitch arena.', 6],
      ['Night at Curzon Hall', 'CULTURE', 'Curzon Hall', 'Open-air cultural night with DU music and drama clubs.', 12],
      ['Blood donation camp', 'SOCIAL', 'Central Library lawn', 'Campus-wide blood donation camp with free screening.', 3],
    ],
    blood: [
      ['A+', 'Dhaka Medical College Hospital', 'Zahidul Haque, DU student, needs 2 bags for a road accident.', 'CRITICAL', 'Zahidul Haque', 'Road accident on Mirpur Road, admitted at DMCH.'],
      ['O-', 'Bangabandhu Sheikh Mujib Medical University', 'Rare group needed for a thalassemia patient at BSMMU.', 'URGENT', 'Sumaiya Akter', 'Monthly transfusion, family has no matching donor.'],
      ['B+', 'Dhaka Shishu Hospital', 'Post-surgery support for a 7-year-old patient.', 'URGENT', 'Raihan Islam', 'Paediatric surgery, 1 bag needed within 24 hours.'],
    ],
  },
  BUET: {
    pickup: [
      ['LIB-BUET', 'Central Library Locker', 'কেন্দ্রীয় লাইব্রেরি লকার', 'BUET Central Library, ground floor', 'বুয়েট কেন্দ্রীয় লাইব্রেরি, নিচতলা'],
      ['SHB', 'Sherebangla Hall Gate', 'শেরেবাংলা হল গেট', 'Sherebangla Hall, BUET campus', 'শেরেবাংলা হল, BUET ক্যাম্পাস'],
      ['TSC-BUET', 'BUET TSC Security Desk', 'বুয়েট টিএসসি সিকিউরিটি ডেস্ক', 'Teacher-Student Center, BUET', 'টিএসসি, BUET'],
    ],
    market: [
      ['Casio FX-991EX — cleared for BUET engineering exams', 'Bought in 2024, used for one semester. All modes verified, battery new. Cleared for BUET engineering exam regulations.', 'Electronics', 'SELL', 1450, 'LIKE_NEW', 'LIB-BUET', 'Nusrat Jahan', ['casio', 'calculator', 'engineering', 'buet']],
      ['Engineering drawing board + instruments', 'Wooden drawing board with T-square, set squares and compass. Used for one drawing lab.', 'Books', 'SELL', 1100, 'GOOD', 'SHB', 'Rafid Hasan', ['drawing board', 'engineering', 'drawing']],
      ['Cormen + CLRS algorithm set', 'Introduction to Algorithms 3rd ed and Algorithm Design by Kleinberg-Tardos. Both in good condition.', 'Books', 'SELL', 900, 'GOOD', 'LIB-BUET', 'Tasnim Chowdhury', ['cormen', 'clrs', 'algorithms']],
      ['Lab coat + safety goggles', 'Civil engineering lab coat, size M, with safety goggles. Washable and clean.', 'Clothing', 'SELL', 500, 'GOOD', 'SHB', 'Sabbir Ahmed', ['lab coat', 'goggles', 'civil']],
      ['Hero Sprint bicycle', 'Single-speed commuter bicycle, recently serviced. For BUET campus and Dhanmondi commute.', 'Transport', 'RENT', 900, 'GOOD', 'TSC-BUET', 'Maliha Akter', ['bicycle', 'hero', 'commute']],
    ],
    skills: [
      ['Thermodynamics + fluid mechanics tutoring', 'BUET mechanical engineering student offering weekly problem-solving sessions for EEE/ME students.', 'TUTORING', 'TUTORING', 1000, 'Thermodynamics, Fluid Mechanics', 'BUET Academic Building B', 'Rafid Hasan'],
      ['AutoCAD for civil engineering students', 'Learn AutoCAD 2D drafting, structural drawings and quantity estimation. Laptop required.', 'TUTORING', 'TUTORING', 1200, 'AutoCAD, Civil Engineering', 'BUET Central Library', 'Sabbir Ahmed'],
      ['Python for EEE students', 'Practical Python for data analysis and embedded systems. 4-week evening course.', 'TUTORING', 'TUTORING', 900, 'Python, NumPy, Embedded', 'BUET EEE Building', 'Nusrat Jahan'],
    ],
    civic: [
      ['Broken projector in EEE building', 'INFRASTRUCTURE', 'MEDIUM', 'EEE Building, Room 302', 'The projector in room 302 has no signal. Lectures are being shifted to the corridor.', 'SUBMITTED', 12, 2],
      ['Unsafe staircase at Sherebangla Hall', 'SECURITY', 'HIGH', 'Sherebangla Hall, west staircase', 'The handrail is loose and two steps are broken. Students use it at night.', 'IN_REVIEW', 41, 6],
      ['Streetlight outage near Gate 2', 'INFRASTRUCTURE', 'HIGH', 'BUET Gate 2', 'Three streetlights are out between Gate 2 and the library. The path is completely dark after 8 PM.', 'ACTION_TAKEN', 63, 11],
    ],
    lost: [
      ['Lost Casio calculator at Central Library', 'LOST', 'Electronics', 'Central Library, 3rd floor', 'Casio FX-991EX in a black pouch, name Nusrat written on the back.', 1],
      ['Found drawing board at Academic Building B', 'FOUND', 'Documents', 'Academic Building B, Room 105', 'Drawing board with a T-square left behind after the drawing lab.', 2],
      ['Lost student ID at Sherebangla Hall', 'LOST', 'Documents', 'Sherebangla Hall dining hall', 'BUET student ID card, Rafid Hasan, Department of Civil Engineering.', 4],
    ],
    housing: [
      ['Sherebangla Hall seat', 'MESS_SEAT', 5000, 'Sherebangla Hall, BUET', 'শেরেবাংলা হল, BUET', 'Vacant seat in a 3-person room. Mess and Wi-Fi included.', 1, 'MALE'],
      ['Azimpur boys mess', 'MESS_SEAT', 4200, 'Azimpur, 10 minutes from BUET', 'আজিমপুর, BUET থেকে ১০ মিনিট', 'Home-style mess with 3 meals. Owner is a BUET alumnus.', 2, 'MALE'],
      ['Dhanmondi female sublet', 'SUBLET', 8500, 'Dhanmondi, near BUET bus stop', 'ধানমন্ডি, BUET বাস স্টপের কাছে', 'Single room with attached bath and a shared study room.', 1, 'FEMALE'],
    ],
    dining: [
      ['Sherebangla Hall dinner', 'শেরেবাংলা হল রাতের খাবার', 'DINNER', '19:00 - 21:00', 'Rice, chicken curry, dal, vegetable|130'],
      ['BUET cafeteria lunch', 'BUET ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00', 'Rice, fish, dal, salad|110'],
      ['Azimpur home food', 'আজিমপুরের ঘরের খাবার', 'DINNER', '19:30 - 21:30', 'Khichuri, beef, omelette|160'],
    ],
    events: [
      ['BUET CSE Open Day', 'TECH', 'BUET Central Library', 'Project showcase and open lab tours for first-year students.', 8],
      ['Robotics workshop', 'TECH', 'BUET EEE Building', 'Hands-on Arduino and motor control workshop. Limited seats.', 4],
      ['Inter-hall football final', 'SPORTS', 'BUET Central Field', 'Sherebangla Hall vs Ahsanullah Hall. Free entry with student ID.', 2],
    ],
    blood: [
      ['B+', 'Dhaka Shishu Hospital', 'BUET student needs 1 bag for a bone marrow procedure.', 'URGENT', 'Sabbir Ahmed', 'Admitted at Shishu Hospital, family is searching for a donor.'],
      ['O+', 'Dhaka Medical College Hospital', 'Accident victim from the BUET campus road.', 'CRITICAL', 'Maliha Akter', 'Road accident near Gate 1, 2 bags needed.'],
      ['AB-', 'Bangabandhu Sheikh Mujib Medical University', 'Rare group for a kidney patient.', 'URGENT', 'Rafid Hasan', 'Rare blood group, any donor from BUET campus is welcome.'],
    ],
  },
  SUST: {
    pickup: [
      ['SHJ', 'Shahjalal Hall Gate', 'শাহজালাল হল গেট', 'Shahjalal Hall, SUST campus', 'শাহজালাল হল, SUST ক্যাম্পাস'],
      ['AB-B', 'Academic Building B', 'একাডেমিক বিল্ডিং বি', 'Academic Building B, SUST', 'একাডেমিক বিল্ডিং বি, SUST'],
      ['LIB-SUST', 'SUST Central Library', 'SUST কেন্দ্রীয় লাইব্রেরি', 'Central Library, SUST', 'কেন্দ্রীয় লাইব্রেরি, SUST'],
    ],
    market: [
      ['Hero bicycle at Shahjalal Hall', 'Hero single-speed bicycle, used for one year. New tyres and brake cables. Ideal for Shahjalal Hall to Academic Building B.', 'Transport', 'SELL', 4200, 'GOOD', 'SHJ', 'Rafid Hasan', ['hero', 'bicycle', 'shahjalal hall']],
      ['Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for SUST engineering exams.', 'Electronics', 'SELL', 1300, 'GOOD', 'AB-B', 'Nusrat Jahan', ['casio', 'calculator']],
      ['Lab coat + safety goggles', 'Chemistry lab coat, size L, with goggles. Clean and ready to use.', 'Clothing', 'SELL', 550, 'GOOD', 'AB-B', 'Tasnim Chowdhury', ['lab coat', 'chemistry']],
      ['Hostel reading desk', 'Wooden desk with a drawer, fits a laptop and books. Pickup from Shahjalal Hall.', 'Furniture', 'SELL', 1000, 'FAIR', 'SHJ', 'Sabbir Ahmed', ['desk', 'furniture']],
      ['Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 'SELL', 480, 'GOOD', 'LIB-SUST', 'Maliha Akter', ['cormen', 'algorithms']],
    ],
    skills: [
      ['Chemistry tutoring for SUST admission', 'SUST chemistry student offering admission and semester exam preparation.', 'TUTORING', 'TUTORING', 700, 'Chemistry, Organic Chemistry', 'Academic Building B, SUST', 'Nusrat Jahan'],
      ['Web development with React', 'Build a portfolio website in 4 weeks. For SUST CSE and EEE students.', 'TUTORING', 'TUTORING', 1000, 'React, JavaScript, CSS', 'SUST Central Library', 'Rafid Hasan'],
      ['Math for admission tests', 'Calculus and algebra crash course for SUST and other public university admission tests.', 'TUTORING', 'TUTORING', 800, 'Calculus, Algebra', 'Shahjalal Hall study room', 'Tasnim Chowdhury'],
    ],
    civic: [
      ['Broken water pump at Shahjalal Hall', 'HALL_RESIDENCE', 'HIGH', 'Shahjalal Hall, ground floor', 'The water pump has stopped. Residents are carrying water from the Academic Building B tap.', 'IN_REVIEW', 47, 5],
      ['Unsafe road at Academic Building B', 'INFRASTRUCTURE', 'MEDIUM', 'Academic Building B road', 'The road shoulder has collapsed after rain. Students are walking in the middle of the road.', 'SUBMITTED', 22, 3],
      ['Library AC failure', 'INFRASTRUCTURE', 'MEDIUM', 'SUST Central Library, 2nd floor', 'The AC has been off for a week. Reading rooms are very hot in the afternoon.', 'ACTION_TAKEN', 31, 8],
    ],
    lost: [
      ['Lost Hero bicycle key', 'LOST', 'Keys', 'Shahjalal Hall bicycle stand', 'Hero bicycle key with a red tag, near the Shahjalal Hall stand.', 1],
      ['Found calculator at Academic Building B', 'FOUND', 'Electronics', 'Academic Building B, Room 210', 'Casio calculator found after the physics exam.', 2],
      ['Lost ID at Shahjalal Hall', 'LOST', 'Documents', 'Shahjalal Hall dining hall', 'SUST student ID, Tasnim Chowdhury, Department of Chemistry.', 3],
    ],
    housing: [
      ['Shahjalal Hall seat', 'MESS_SEAT', 4000, 'Shahjalal Hall, SUST', 'শাহজালাল হল, SUST', 'Vacant seat in a 4-person room with mess.', 1, 'FEMALE'],
      ['Sylhet city mess', 'MESS_SEAT', 3500, 'Sylhet city, 10 minutes from SUST', 'সিলেট শহর, SUST থেকে ১০ মিনিট', 'Home-style mess with 3 meals and Wi-Fi.', 2, 'MALE'],
      ['Academic Building B nearby sublet', 'SUBLET', 6000, 'Sylhet, near SUST gate', 'সিলেট, SUST গেটের কাছে', 'Single room with attached bath, quiet study environment.', 1, 'ANY'],
    ],
    dining: [
      ['Shahjalal Hall dinner', 'শাহজালাল হল রাতের খাবার', 'DINNER', '19:00 - 21:00', 'Rice, fish, dal, vegetable|120'],
      ['SUST cafeteria lunch', 'SUST ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00', 'Rice, chicken, dal, salad|115'],
      ['Sylhet home food', 'সিলেটের ঘরের খাবার', 'DINNER', '19:30 - 21:30', 'Khichuri, beef bhuna, salad|150'],
    ],
    events: [
      ['SUST Tech Fest 2026', 'TECH', 'SUST Central Library', 'Hackathon, robotics and a startup pitch competition.', 9],
      ['Cultural night at Shahjalal Hall', 'CULTURE', 'Shahjalal Hall', 'Music, dance and drama by SUST cultural clubs.', 5],
      ['Blood donation camp', 'SOCIAL', 'Academic Building B', 'Free blood group screening and donation camp.', 2],
    ],
    blood: [
      ['A-', 'Sylhet MAG Osmani Medical College Hospital', 'SUST student needs 1 bag for surgery.', 'URGENT', 'Tasnim Chowdhury', 'Admitted at MAG Osmani, surgery scheduled tomorrow.'],
      ['B+', 'Sylhet MAG Osmani Medical College Hospital', 'Post-accident transfusion for a SUST student.', 'CRITICAL', 'Rafid Hasan', 'Road accident near SUST gate, 2 bags needed.'],
      ['O+', 'Sylhet Civil Surgeon Office', 'Thalassemia patient needs monthly transfusion.', 'URGENT', 'Nusrat Jahan', 'Any O+ donor from SUST campus is welcome.'],
    ],
  },
  RU: {
    pickup: [
      ['KAZLA', 'Kazla Gate', 'কাজলা গেট', 'Kazla Gate, University of Rajshahi', 'কাজলা গেট, রাজশাহী বিশ্ববিদ্যালয়'],
      ['BBH', 'Bangabandhu Hall', 'বঙ্গবন্ধু হল', 'Bangabandhu Hall, RU campus', 'বঙ্গবন্ধু হল, RU ক্যাম্পাস'],
      ['LIB-RU', 'RU Central Library', 'RU কেন্দ্রীয় লাইব্রেরি', 'Central Library, University of Rajshahi', 'কেন্দ্রীয় লাইব্রেরি, রাজশাহী বিশ্ববিদ্যালয়'],
    ],
    market: [
      ['Drawing board at Kazla Gate', 'Engineering drawing board with T-square and set squares. Used for one semester, good condition. Pickup at Kazla Gate.', 'Books', 'SELL', 1000, 'GOOD', 'KAZLA', 'Rafid Hasan', ['drawing board', 'engineering', 'kazla']],
      ['Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for RU engineering exams.', 'Electronics', 'SELL', 1250, 'GOOD', 'LIB-RU', 'Nusrat Jahan', ['casio', 'calculator']],
      ['Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 'SELL', 460, 'GOOD', 'LIB-RU', 'Tasnim Chowdhury', ['cormen', 'algorithms']],
      ['Hero bicycle', 'Single-speed bicycle, recently serviced. For Kazla Gate to Bangabandhu Hall commute.', 'Transport', 'SELL', 3800, 'GOOD', 'KAZLA', 'Sabbir Ahmed', ['hero', 'bicycle']],
      ['Desk lamp + reading table', 'Wooden reading table with a warm desk lamp. Pickup from Bangabandhu Hall.', 'Furniture', 'SELL', 950, 'FAIR', 'BBH', 'Maliha Akter', ['table', 'lamp']],
    ],
    skills: [
      ['Physics tutoring for RU admission', 'RU physics student offering admission and semester exam preparation.', 'TUTORING', 'TUTORING', 700, 'Physics, Mechanics', 'RU Central Library', 'Rafid Hasan'],
      ['Graphic design for campus clubs', 'Posters, banners and social media creatives for RU clubs and events.', 'FREELANCE', 'FREELANCE', 1200, 'Photoshop, Illustrator', 'Remote', 'Nusrat Jahan'],
      ['Spoken English practice', 'Weekly conversation practice for students preparing for interviews.', 'TUTORING', 'TUTORING', 600, 'Spoken English, IELTS', 'Bangabandhu Hall study room', 'Tasnim Chowdhury'],
    ],
    civic: [
      ['Broken road at Kazla Gate', 'INFRASTRUCTURE', 'HIGH', 'Kazla Gate, RU', 'The road from Kazla Gate to the main campus has deep potholes. Buses and CNGs are damaging their suspensions.', 'IN_REVIEW', 38, 7],
      ['Streetlight near Bangabandhu Hall', 'INFRASTRUCTURE', 'MEDIUM', 'Bangabandhu Hall road', 'Two streetlights are out. Students walking back from the library at night feel unsafe.', 'SUBMITTED', 19, 2],
      ['Library seat shortage', 'ACADEMIC', 'LOW', 'RU Central Library', 'The reading room is full by 10 AM during exam weeks. More seats are needed.', 'ACTION_TAKEN', 44, 15],
    ],
    lost: [
      ['Lost drawing board at Kazla Gate', 'LOST', 'Documents', 'Kazla Gate, near the bus stop', 'Engineering drawing board with a T-square, left at the Kazla Gate bus stop.', 1],
      ['Found calculator at Bangabandhu Hall', 'FOUND', 'Electronics', 'Bangabandhu Hall dining hall', 'Casio calculator found after dinner. Name "Rafid" on the back.', 2],
      ['Lost ID card near RU library', 'LOST', 'Documents', 'RU Central Library', 'RU student ID, Tasnim Chowdhury, Department of Physics.', 4],
    ],
    housing: [
      ['Bangabandhu Hall seat', 'MESS_SEAT', 3800, 'Bangabandhu Hall, RU', 'বঙ্গবন্ধু হল, RU', 'Vacant seat in a 3-person room with mess.', 1, 'MALE'],
      ['Kazla boys mess', 'MESS_SEAT', 3200, 'Kazla, near RU gate', 'কাজলা, RU গেটের কাছে', 'Home-style mess with 3 meals and a study room.', 2, 'MALE'],
      ['Rajshahi city sublet', 'SUBLET', 6500, 'Rajshahi city, near RU', 'রাজশাহী শহর, RU-এর কাছে', 'Single room with attached bath, 15 minutes to campus.', 1, 'ANY'],
    ],
    dining: [
      ['Bangabandhu Hall lunch', 'বঙ্গবন্ধু হল লাঞ্চ', 'LUNCH', '12:30 - 14:00', 'Rice, fish, dal, vegetable|115'],
      ['RU cafeteria snacks', 'RU ক্যাফেটেরিয়া সnek', 'SNACKS', '16:00 - 19:00', 'Singara, tea, banana|55'],
      ['Kazla home food', 'কাজলার ঘরের খাবার', 'DINNER', '19:00 - 21:30', 'Khichuri, beef, salad|145'],
    ],
    events: [
      ['RU career fair 2026', 'CAREER', 'RU Central Library', 'National and international companies recruiting RU graduates.', 7],
      ['Cultural program at Bangabandhu Hall', 'CULTURE', 'Bangabandhu Hall', 'Music and drama by RU cultural organizations.', 10],
      ['Blood donation camp', 'SOCIAL', 'RU Medical Center', 'Free screening and blood donation camp.', 3],
    ],
    blood: [
      ['A+', 'Rajshahi Medical College Hospital', 'RU student needs 2 bags after an accident.', 'CRITICAL', 'Sabbir Ahmed', 'Road accident near Kazla Gate, admitted at RMCH.'],
      ['B-', 'Rajshahi Medical College Hospital', 'Rare group for a surgery patient.', 'URGENT', 'Maliha Akter', 'Surgery scheduled tomorrow, family has no matching donor.'],
      ['O+', 'Rajshahi Civil Surgeon Office', 'Thalassemia patient needs monthly transfusion.', 'URGENT', 'Rafid Hasan', 'Any O+ donor from RU campus is welcome.'],
    ],
  },
  CU: {
    pickup: [
      ['SUH', 'Suhrawardy Hall', 'সুহরাওয়ার্দি হল', 'Suhrawardy Hall, University of Chittagong', 'সুহরাওয়ার্দি হল, চট্টগ্রাম বিশ্ববিদ্যালয়'],
      ['ZERO', 'Zero Point', 'জিরো পয়েন্ট', 'Zero Point, CU campus main entrance', 'জিরো পয়েন্ট, CU ক্যাম্পাস প্রধান প্রবেশপথ'],
      ['LIB-CU', 'CU Central Library', 'CU কেন্দ্রীয় লাইব্রেরি', 'Central Library, University of Chittagong', 'কেন্দ্রীয় লাইব্রেরি, চট্টগ্রাম বিশ্ববিদ্যালয়'],
    ],
    market: [
      ['Mini refrigerator at Suhrawardy Hall', 'Mini refrigerator, 3.5 cubic feet, working perfectly. Used for one year in Suhrawardy Hall. Pickup from the hall gate.', 'Electronics', 'SELL', 6500, 'GOOD', 'SUH', 'Nusrat Jahan', ['refrigerator', 'mini fridge', 'suhrawardy hall']],
      ['Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 'SELL', 470, 'GOOD', 'LIB-CU', 'Rafid Hasan', ['cormen', 'algorithms']],
      ['Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for CU science exams.', 'Electronics', 'SELL', 1250, 'GOOD', 'ZERO', 'Tasnim Chowdhury', ['casio', 'calculator']],
      ['Hero bicycle', 'Single-speed bicycle, recently serviced. For Zero Point to Suhrawardy Hall commute.', 'Transport', 'SELL', 3900, 'GOOD', 'ZERO', 'Sabbir Ahmed', ['hero', 'bicycle']],
      ['Drawing board + instruments', 'Engineering drawing board with T-square and set squares. Good condition.', 'Books', 'SELL', 1000, 'GOOD', 'LIB-CU', 'Maliha Akter', ['drawing board', 'engineering']],
    ],
    skills: [
      ['Accounting tutoring for CU business students', 'CU accounting student offering financial accounting and cost accounting sessions.', 'TUTORING', 'TUTORING', 700, 'Accounting, Finance', 'CU Central Library', 'Nusrat Jahan'],
      ['Web design for small businesses', 'Portfolio websites and landing pages for Chattogram businesses.', 'FREELANCE', 'FREELANCE', 1500, 'Web Design, WordPress', 'Remote', 'Rafid Hasan'],
      ['IELTS preparation', 'Speaking and writing practice for IELTS with mock tests.', 'TUTORING', 'TUTORING', 800, 'IELTS, English', 'Suhrawardy Hall study room', 'Tasnim Chowdhury'],
    ],
    civic: [
      ['Broken light at Zero Point', 'INFRASTRUCTURE', 'HIGH', 'Zero Point, CU', 'The main light at Zero Point is out. Students crossing at night are at risk.', 'IN_REVIEW', 29, 4],
      ['Water crisis at Suhrawardy Hall', 'HALL_RESIDENCE', 'HIGH', 'Suhrawardy Hall', 'Water supply has been off for two days. Residents are buying bottled water.', 'ACTION_TAKEN', 56, 6],
      ['Unsafe road near CU library', 'INFRASTRUCTURE', 'MEDIUM', 'CU Central Library road', 'The road shoulder is broken and the library entrance is difficult to access.', 'SUBMITTED', 17, 2],
    ],
    lost: [
      ['Lost mini fridge key', 'LOST', 'Keys', 'Suhrawardy Hall, room 214', 'Small key with a blue tag for a mini refrigerator.', 1],
      ['Found calculator at Zero Point', 'FOUND', 'Electronics', 'Zero Point, CU', 'Casio calculator found near the Zero Point bus stop.', 2],
      ['Lost ID at Suhrawardy Hall', 'LOST', 'Documents', 'Suhrawardy Hall dining hall', 'CU student ID, Tasnim Chowdhury, Department of Accounting.', 3],
    ],
    housing: [
      ['Suhrawardy Hall seat', 'MESS_SEAT', 3600, 'Suhrawardy Hall, CU', 'সুহরাওয়ার্দি হল, CU', 'Vacant seat in a 4-person room with mess.', 1, 'FEMALE'],
      ['CU campus mess', 'MESS_SEAT', 3300, 'CU campus, near Zero Point', 'CU ক্যাম্পাস, জিরো পয়েন্টের কাছে', 'Home-style mess with 3 meals and Wi-Fi.', 2, 'MALE'],
      ['Chattogram city sublet', 'SUBLET', 7000, 'Chattogram city, near CU', 'চট্টগ্রাম শহর, CU-এর কাছে', 'Single room with attached bath, 20 minutes to campus.', 1, 'ANY'],
    ],
    dining: [
      ['Suhrawardy Hall dinner', 'সুহরাওয়ার্দি হল রাতের খাবার', 'DINNER', '19:00 - 21:00', 'Rice, fish, dal, vegetable|120'],
      ['CU cafeteria lunch', 'CU ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00', 'Rice, chicken, dal, salad|110'],
      ['Chattogram home food', 'চট্টগ্রামের ঘরের খাবার', 'DINNER', '19:30 - 21:30', 'Khichuri, beef, omelette|150'],
    ],
    events: [
      ['CU cultural fest 2026', 'CULTURE', 'CU Central Library', 'Music, dance and drama performances by CU cultural clubs.', 8],
      ['CU job fair', 'CAREER', 'Zero Point, CU', 'Chattogram companies recruiting CU graduates.', 5],
      ['Blood donation camp', 'SOCIAL', 'Suhrawardy Hall', 'Free blood group screening and donation camp.', 2],
    ],
    blood: [
      ['B+', 'Chattogram Medical College Hospital', 'CU student needs 1 bag for surgery.', 'URGENT', 'Rafid Hasan', 'Admitted at CMC, surgery scheduled tomorrow.'],
      ['A-', 'Chattogram Medical College Hospital', 'Rare group for an accident patient.', 'CRITICAL', 'Nusrat Jahan', 'Road accident near Zero Point, 2 bags needed.'],
      ['AB+', 'Chattogram Civil Surgeon Office', 'Thalassemia patient needs monthly transfusion.', 'URGENT', 'Tasnim Chowdhury', 'Any AB+ donor from CU campus is welcome.'],
    ],
  },
  JU: {
    pickup: [
      ['LIB-JU', 'Central Library Locker A', 'কেন্দ্রীয় লাইব্রেরি লকার এ', 'Ground floor, beside the help desk', 'নিচতলা, হেল্প ডেস্কের পাশে'],
      ['TSC-JU', 'TSC Security Desk', 'টিএসসি সিকিউরিটি ডেস্ক', 'TSC main entrance', 'টিএসসি প্রধান ফটক'],
      ['HALL-C', 'Halls Zone C Gate', 'হল জোন সি গেট', 'Between the residential halls, security post', 'হল এলাকার নিরাপত্তা পোস্ট'],
    ],
    market: [
      ['Casio FX-991EX scientific calculator', 'Used for one semester, like new. Cleared for JU engineering exams.', 'Electronics', 'SELL', 1400, 'LIKE_NEW', 'LIB-JU', 'Nusrat Jahan', ['calculator', 'casio', 'engineering']],
      ['Hero Sprint bicycle — campus commuter', 'Well maintained, new tyres. Ideal for hall-to-department commute.', 'Transport', 'RENT', 800, 'GOOD', 'TSC-JU', 'Rafid Hasan', ['bicycle', 'cycle', 'commute']],
      ['Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 'SELL', 450, 'GOOD', 'LIB-JU', 'Tasnim Chowdhury', ['cormen', 'algorithms']],
    ],
    skills: [
      ['Data Structures tutoring', 'JU CSE student offering weekly Data Structures sessions for first-year students.', 'TUTORING', 'TUTORING', 800, 'Data Structures, C++', 'JU TSC', 'Rafid Hasan'],
      ['Spoken English practice', 'Weekly conversation practice for JU students preparing for interviews.', 'TUTORING', 'TUTORING', 600, 'Spoken English', 'JU Central Library', 'Nusrat Jahan'],
      ['Freelance graphic design', 'Posters and banners for JU clubs and events.', 'FREELANCE', 'FREELANCE', 1200, 'Photoshop, Illustrator', 'Remote', 'Tasnim Chowdhury'],
    ],
    civic: [
      ['Broken streetlight near Al-Beruni Hall', 'INFRASTRUCTURE', 'HIGH', 'Al-Beruni Hall road', 'The streetlight has been out for a week. Students feel unsafe walking back from the library.', 'IN_REVIEW', 27, 5],
      ['Waterlogging at TSC gate', 'INFRASTRUCT', 'MEDIUM', 'TSC main gate', 'The drain overflows after rain and the gate becomes unusable.', 'ACTION_TAKEN', 33, 12],
      ['Damaged bench near Central Library', 'INFRASTRUCTURE', 'LOW', 'Central Library lawn', 'Two benches are broken and the metal edges are sharp.', 'RESOLVED', 12, 20],
    ],
    lost: [
      ['Lost black backpack at TSC', 'LOST', 'Bags', 'TSC, near the food court', 'Black backpack with a laptop sleeve and a blue water bottle.', 2],
      ['Found Casio calculator in library', 'FOUND', 'Electronics', 'Central Library, 2nd floor', 'Casio FX-991EX found under a reading table.', 1],
      ['Lost student ID near Al-Beruni Hall', 'LOST', 'Documents', 'Al-Beruni Hall gate', 'JU student ID card, name Nusrat Jahan.', 3],
    ],
    housing: [
      ['Al-Beruni Hall seat', 'MESS_SEAT', 4200, 'Al-Beruni Hall, JU', 'আল বেরুনী হল, JU', 'Vacant seat in a 4-person room with mess.', 1, 'MALE'],
      ['JU campus mess', 'MESS_SEAT', 3500, 'JU campus, near TSC', 'JU ক্যাম্পাস, টিএসসির কাছে', 'Home-style mess with 3 meals and Wi-Fi.', 2, 'MALE'],
      ['Savar sublet', 'SUBLET', 6000, 'Savar, near JU gate', 'সavar, JU গেটের কাছে', 'Single room with attached bath, 10 minutes to campus.', 1, 'ANY'],
    ],
    dining: [
      ['Al-Beruni Hall lunch', 'আল বেরুনী হল লাঞ্চ', 'LUNCH', '12:30 - 14:00', 'Rice, fish, dal, vegetable|115'],
      ['JU TSC snacks', 'JU টিএসসি সnek', 'SNACKS', '16:00 - 19:00', 'Singara, tea, banana|55'],
      ['Savar home food', 'সavarের ঘরের খাবার', 'DINNER', '19:00 - 21:30', 'Khichuri, beef, salad|145'],
    ],
    events: [
      ['JU CSE Fest', 'TECH', 'JU TSC Auditorium', 'Hackathon and project showcase by JU CSE.', 6],
      ['Cultural night at Al-Beruni Hall', 'CULTURE', 'Al-Beruni Hall', 'Music and drama by JU cultural clubs.', 9],
      ['Blood donation camp', 'SOCIAL', 'JU Central Library', 'Free screening and blood donation camp.', 3],
    ],
    blood: [
      ['A+', 'Savar Upazila Health Complex', 'JU student needs 1 bag after an accident.', 'URGENT', 'Nusrat Jahan', 'Road accident near JU gate, 1 bag needed.'],
      ['B+', 'Dhaka Medical College Hospital', 'Post-surgery support for a JU student.', 'URGENT', 'Rafid Hasan', 'Surgery at DMCH, 1 bag needed within 24 hours.'],
      ['O-', 'Bangabandhu Sheikh Mujib Medical University', 'Rare group for a thalassemia patient.', 'URGENT', 'Tasnim Chowdhury', 'Any O- donor from JU campus is welcome.'],
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Table generation                                                           */
/* -------------------------------------------------------------------------- */

function buildTables(): Record<string, Row[]> {
  const tables: Record<string, Row[]> = {
    universities: [],
    university_email_domains: [],
    university_halls: [],
    profiles: [],
    hall_allocations: [],
    governance_notices: [],
    campus_pickup_points: [],
    marketplace_listings: [],
    skill_postings: [],
    complaints_public: [],
    lost_items: [],
    lost_item_matches: [],
    housing_listings: [],
    cafeteria_menus: [],
    cafeteria_items: [],
    events: [],
    event_rsvps: [],
    blood_requests: [],
    notifications: [],
    disputes: [],
    dispute_messages: [],
    reviews: [],
    mentors: [],
    mentorship_slots: [],
    alumni_profiles: [],
    career_opportunities: [],
    sports_teams: [],
    donation_campaigns: [],
    clubs: [],
    club_members: [],
  };

  for (const university of DEMO_UNIVERSITIES) {
    const code = university.code;
    const uid = university.id;

    // Canonical directory data (mirrors supabase/seed/*.sql).
    for (const hall of DEMO_UNIVERSITY_HALLS.filter((h) => h.universityCode === code)) {
      tables.university_halls.push({
        id: hall.id,
        university_id: uid,
        name: hall.name,
        name_bn: hall.name_bn,
        type: hall.type,
        is_active: true,
        created_at: daysAgo(120),
      });
    }
    for (const account of DEMO_ACCOUNTS.filter((a) => a.universityCode === code)) {
      tables.profiles.push({
        id: `demo-user-${code.toLowerCase()}-${account.role}`,
        university_id: uid,
        email: account.email,
        full_name: account.fullName,
        student_id: ROLE_IDS[account.role](code),
        trust_level: 'ID_VERIFIED',
        roles: ROLE_ROLES[account.role],
        role: account.role,
        onboarding_completed: true,
        created_at: daysAgo(90),
      });
    }
    tables.universities.push({
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
    });
    for (const domain of university.domains) {
      tables.university_email_domains.push({
        id: `domain-${university.code}-${domain}`,
        university_id: university.id,
        domain,
        is_primary: domain === university.domains[0],
        is_active: true,
      });
    }
  }

  for (const [code, seed] of Object.entries(CAMPUS_SEED)) {
    const university = getDemoUniversity(code);
    if (!university) continue;
    const uid = university.id;
    const seller = (name: string) => `demo-user-${code.toLowerCase()}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;

    seed.pickup.forEach(([pcode, nameEn, nameBn, locationEn, locationBn], index) => {
      tables.campus_pickup_points.push({
        id: `pickup-${code}-${index + 1}`,
        university_id: uid,
        code: pcode,
        name_en: nameEn,
        name_bn: nameBn,
        location_en: locationEn,
        location_bn: locationBn,
        is_active: true,
      });
    });

    seed.market.forEach(([title, description, category, kind, price, condition, pickupCode, sellerName, tags], index) => {
      const pickup = tables.campus_pickup_points.find(
        (p) => p.university_id === uid && p.code === pickupCode
      );
      tables.marketplace_listings.push({
        id: `mkt-${code}-${index + 1}`,
        university_id: uid,
        seller_id: seller(sellerName),
        title,
        description,
        category,
        kind,
        price_bdt: price,
        condition,
        images: [],
        status: 'AVAILABLE',
        is_negotiable: index % 2 === 0,
        keyword_tags: tags,
        pickup_point_id: pickup?.id ?? null,
        campus_pickup_points: pickup
          ? { name_en: pickup.name_en, name_bn: pickup.name_bn, location_en: pickup.location_en }
          : null,
        profiles: { full_name: sellerName, trust_level: 'ID_VERIFIED' },
        created_at: iso(-(index + 1) * 37),
      });
    });

    seed.skills.forEach(([title, description, category, type, rate, skills, location, author], index) => {
      tables.skill_postings.push({
        id: `skill-${code}-${index + 1}`,
        university_id: uid,
        author_id: seller(author),
        type,
        title,
        description,
        category,
        skills: skills.split(',').map((s) => s.trim()),
        location_en: location,
        availability: 'FLEXIBLE',
        rate_bdt: rate,
        is_remote: location.toLowerCase().includes('remote'),
        contact_note: 'Message me on Campus360',
        status: 'OPEN',
        applicants_count: index + 1,
        created_at: iso(-(index + 1) * 55),
        profiles: { full_name: author, trust_level: 'ID_VERIFIED' },
      });
    });

    seed.civic.forEach(([title, category, severity, location, description, status, upvotes, days], index) => {
      const createdAt = daysAgo(days);
      const history = buildCivicHistory(status, createdAt, index);
      tables.complaints_public.push({
        id: `civic-${code}-${index + 1}`,
        university_id: uid,
        tracking_code: `${code}-CASE-2026-${482900 + index + 1}`,
        title,
        category,
        severity,
        description,
        status,
        upvotes_count: upvotes,
        is_public_issue: true,
        location_hint: location,
        evidence_urls: [],
        sla_hours: severity === 'HIGH' || severity === 'CRITICAL' ? 24 : 72,
        sla_due_at: new Date(new Date(createdAt).getTime() + (severity === 'HIGH' ? 24 : 72) * 3600_000).toISOString(),
        sla_breached: status !== 'RESOLVED' && days > 3,
        created_at: createdAt,
        last_activity_at: history[history.length - 1]?.at ?? createdAt,
        resolved_at: status === 'RESOLVED' ? history[history.length - 1]?.at ?? null : null,
        resolution_summary: status === 'RESOLVED' ? 'Resolved by the university engineering office.' : null,
        history,
      });
    });

    seed.lost.forEach(([title, kind, category, location, description, days], index) => {
      tables.lost_items.push({
        id: `lost-${code}-${index + 1}`,
        university_id: uid,
        reporter_id: seller('Nusrat Jahan'),
        kind,
        title,
        description,
        category,
        keywords: title.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
        location_en: location,
        occurred_on: dateOnly(-days),
        image_urls: [],
        contact_note: 'Reply on Campus360',
        status: 'OPEN',
        matched_item_id: null,
        created_at: daysAgo(days),
        profiles: { full_name: 'Nusrat Jahan', trust_level: 'ID_VERIFIED' },
      });
    });

    seed.housing.forEach(([title, kind, rent, area, areaBn, description, seats, gender], index) => {
      tables.housing_listings.push({
        id: `house-${code}-${index + 1}`,
        university_id: uid,
        owner_id: seller('Rafid Hasan'),
        kind,
        title,
        description,
        rent_bdt: rent,
        seat_count: seats,
        gender_policy: gender,
        area_en: area,
        area_bn: areaBn,
        distance_km: 1.2 + index,
        amenities: ['Wi-Fi', 'Mess', 'Study room'],
        image_urls: [],
        contact_phone: '+880-1700-000000',
        status: 'AVAILABLE',
        created_at: iso(-(index + 1) * 90),
        profiles: { full_name: 'Rafid Hasan', trust_level: 'TRUSTED' },
      });
    });

    seed.dining.forEach(([nameEn, nameBn, meal, window, items], index) => {
      const menuId = `menu-${code}-${index + 1}`;
      tables.cafeteria_menus.push({
        id: menuId,
        university_id: uid,
        hall_id: null,
        name_en: nameEn,
        name_bn: nameBn,
        serving_date: dateOnly(0),
        meal,
        pickup_window: window,
        is_active: true,
        created_at: iso(-120),
      });
      items.split('|').forEach((item, itemIndex) => {
        const [itemName, price] = item.split(',');
        tables.cafeteria_items.push({
          id: `item-${code}-${index + 1}-${itemIndex + 1}`,
          university_id: uid,
          menu_id: menuId,
          name_en: itemName.trim(),
          name_bn: itemName.trim(),
          price_bdt: Number(price) || 100,
          is_available: true,
          stock: 40,
          is_vegetarian: itemIndex === 2,
          created_at: iso(-120),
        });
      });
    });

    seed.events.forEach(([title, category, venue, description, daysAhead], index) => {
      tables.events.push({
        id: `event-${code}-${index + 1}`,
        university_id: uid,
        organizer_id: seller('Tasnim Chowdhury'),
        host_organization: `${code} Student Union`,
        title_en: title,
        title_bn: title,
        description_en: description,
        description_bn: description,
        category,
        is_public: true,
        starts_at: new Date(now + daysAhead * 86_400_000).toISOString(),
        ends_at: new Date(now + daysAhead * 86_400_000 + 3 * 3600_000).toISOString(),
        venue_name: venue,
        formatted_address: `${venue}, ${university.name_en}`,
        text_directions_en: `Enter from the main gate and follow the campus signs to ${venue}.`,
        text_directions_bn: `প্রধান ফটক থেকে ঢুকুন এবং ${venue} পর্যন্ত ক্যাম্পাসের সাইন অনুসরণ করুন।`,
        lat: university.lat,
        lng: university.lng,
        place_id: `place-${code}-${index + 1}`,
        geofence_radius_m: 150,
        capacity: 200,
        rsvp_required: true,
        rsvp_count: 18 + index * 7,
        checkin_count: 0,
        live_override: 'AUTO',
        created_at: iso(-200),
      });
    });

    seed.blood.forEach(([group, hospital, description, urgency, patient, address], index) => {
      tables.blood_requests.push({
        id: `blood-${code}-${index + 1}`,
        university_id: uid,
        requester_id: seller(patient),
        patient_name: patient,
        blood_group: group,
        bags_needed: 1 + (index % 2),
        hospital_name: hospital,
        hospital_address: address,
        contact_phone: '+880-1800-000000',
        urgency,
        needed_by: new Date(now + (index + 1) * 12 * 3600_000).toISOString(),
        status: 'OPEN',
        created_at: iso(-(index + 1) * 25),
        profiles: { full_name: patient, trust_level: 'ID_VERIFIED' },
      });
    });
  }

  // The exact demo ticket referenced by the acceptance test.
  const juCivic = tables.complaints_public.find((t) => t.id === 'civic-JU-1');
  if (juCivic) {
    juCivic.tracking_code = 'JU-CASE-2026-482913';
    juCivic.title = 'Broken streetlight near Al-Beruni Hall';
    juCivic.category = 'INFRASTRUCTURE';
    juCivic.severity = 'HIGH';
    juCivic.status = 'ACTION_TAKEN';
    juCivic.upvotes_count = 47;
    juCivic.location_hint = 'Al-Beruni Hall road, Jahangirnagar University';
    juCivic.description =
      'The streetlight between Al-Beruni Hall and the TSC has been dark for nine days. Students returning from evening classes feel unsafe.';
    juCivic.sla_hours = 24;
    juCivic.sla_due_at = new Date(now + 6 * 3600_000).toISOString();
    juCivic.sla_breached = false;
    juCivic.created_at = daysAgo(4);
    juCivic.last_activity_at = iso(-95);
    juCivic.history = [
      { status: 'SUBMITTED', at: daysAgo(4), note: 'Ticket created from the civic board.', by: 'Student' },
      { status: 'IN_REVIEW', at: daysAgo(3), note: 'Routed to the Office of the Proctor.', by: 'Admin' },
      { status: 'ACTION_TAKEN', at: iso(-95), note: 'Electrician assigned; replacement pole ordered.', by: 'Admin' },
    ];
  }

  // A confidential grievance with a device-bound secret for the formal flow.
  const du = getDemoUniversity('DU')!;
  tables.complaints_public.push({
    id: 'civic-du-formal',
    university_id: du.id,
    tracking_code: 'DU-CASE-2026-482913',
    title: 'Harassment on the TSC walkway',
    category: 'HARASSMENT',
    severity: 'HIGH',
    description: 'Repeated harassment reported near the TSC walkway. Filed confidentially.',
    status: 'IN_REVIEW',
    upvotes_count: 0,
    is_public_issue: false,
    is_anonymous: true,
    tracking_secret: 'DU-SECRET-482913',
    location_hint: 'TSC walkway, University of Dhaka',
    evidence_urls: [],
    sla_hours: 24,
    sla_due_at: new Date(now + 8 * 3600_000).toISOString(),
    sla_breached: false,
    created_at: daysAgo(1),
    last_activity_at: iso(-60),
    resolved_at: null,
    resolution_summary: null,
    history: [
      { status: 'SUBMITTED', at: daysAgo(1), note: 'Grievance filed confidentially.', by: 'Student' },
      { status: 'IN_REVIEW', at: iso(-60), note: 'Assigned to the Anti-Harassment Cell.', by: 'Admin' },
    ],
  });

  // Governance dashboard backing rows (hall allocation queue + broadcasts).
  for (const [code, rows] of Object.entries({
    DU: [
      ['Rokeya Hall', 'Tasnim Chowdhury', 'tasnim.chowdhury@students.du.ac.bd', 'DU-2026-10231', 'PENDING', 'First-year honours — needs a seat before the hall admission deadline.'],
      ['Salimullah Muslim Hall', 'Rafid Hasan', 'rafid.hasan@students.du.ac.bd', 'DU-2026-10876', 'APPROVED', 'Verified against the hall admission list.'],
    ],
    BUET: [['Ahsanullah Hall', 'Sabbir Ahmed', 'sabbir.ahmed@ug.buet.ac.bd', 'BUET-2026-142', 'PENDING', 'Transfer from Titumir Hall requested.']],
    RU: [['Shah Makhdum Hall', 'Maliha Akter', 'maliha.akter@student.ru.ac.bd', 'RU-2026-20114', 'PENDING', 'Awaiting medical board note.']],
    CU: [['Amanat Hall', 'Nusrat Jahan', 'nusrat.jahan@std.cu.ac.bd', 'CU-2026-30117', 'APPROVED', 'Seat confirmed for the 2026 session.']],
  } as Record<string, string[][]>)) {
    const university = getDemoUniversity(code);
    if (!university) continue;
    rows.forEach(([hallName, studentName, studentEmail, studentId, status, note], index) => {
      const hall = DEMO_UNIVERSITY_HALLS.find((h) => h.universityCode === code && h.name === hallName);
      tables.hall_allocations.push({
        id: `hall-alloc-${code.toLowerCase()}-${index + 1}`,
        university_id: university.id,
        hall_id: hall?.id ?? null,
        hall_name: hallName,
        student_name: studentName,
        student_email: studentEmail,
        student_id: studentId,
        status,
        note,
        decided_at: status === 'APPROVED' ? iso(-120) : null,
        created_at: daysAgo(3),
      });
    });
    tables.governance_notices.push({
      id: `gov-notice-${code.toLowerCase()}-1`,
      university_id: university.id,
      title:
        code === 'DU'
          ? 'Hall seat applications open for the 2026 session'
          : code === 'BUET'
            ? 'Ahsanullah Hall dining schedule updated'
            : 'Campus governance broadcast',
      body:
        code === 'DU'
          ? 'Submit your residential hall application through the Governance Dashboard before the 30th. Approvals are published within 72 hours.'
          : code === 'BUET'
            ? 'The evening meal window moves to 7:30–9:00 PM starting next week. Report issues through the civic board.'
            : 'Generator support will cover the reading hours (8 PM–12 AM) in all residential halls from Sunday.',
      audience: 'STUDENTS',
      created_by: `demo-user-${code.toLowerCase()}-governance`,
      created_at: daysAgo(2),
    });
  }

  return tables;
}

function buildCivicHistory(status: string, createdAt: string, index: number): Array<{ status: string; at: string; note: string; by: string }> {
  const base = new Date(createdAt).getTime();
  const at = (hours: number) => new Date(base + hours * 3600_000).toISOString();
  const history = [
    { status: 'SUBMITTED', at: createdAt, note: 'Ticket created from the civic board.', by: 'Student' },
  ];
  if (status === 'IN_REVIEW' || status === 'ACTION_TAKEN' || status === 'RESOLVED') {
    history.push({ status: 'IN_REVIEW', at: at(5 + index), note: 'Routed to the responsible university office.', by: 'Admin' });
  }
  if (status === 'ACTION_TAKEN' || status === 'RESOLVED') {
    history.push({ status: 'ACTION_TAKEN', at: at(20 + index), note: 'Work order issued and repair scheduled.', by: 'Admin' });
  }
  if (status === 'RESOLVED') {
    history.push({ status: 'RESOLVED', at: at(40 + index), note: 'Resolved and verified by the engineering office.', by: 'Admin' });
  }
  return history;
}

export const DEMO_TABLES: Record<string, Row[]> = buildTables();

/* -------------------------------------------------------------------------- */
/* Store + realtime                                                           */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'campus360.demo.store.v3';
const CHANNEL_NAME = 'campus360:demo-realtime';
const GLOBAL_TABLES = new Set(['universities', 'university_email_domains']);

export interface DemoRealtimeEvent {
  type: 'insert' | 'update' | 'delete' | 'store';
  table: string;
  row?: Row;
  id?: string;
  at: number;
}

function readStore(): Record<string, Row[]> {
  if (typeof window === 'undefined') return DEMO_TABLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Row[]>;
      if (parsed && typeof parsed === 'object') {
        // Backfill tables added after this store version was cached, so new
        // surfaces (profiles, university_halls, governance_*) always have rows.
        const merged: Record<string, Row[]> = { ...DEMO_TABLES };
        for (const [key, value] of Object.entries(parsed)) {
          if (Array.isArray(value)) merged[key] = value;
        }
        return merged;
      }
    }
  } catch {
    /* corrupted store — fall back to the seed */
  }
  return DEMO_TABLES;
}

function writeStore(tables: Record<string, Row[]>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch {
    /* storage full / disabled — keep the in-memory seed */
  }
  broadcastDemoEvent({ type: 'store', table: '*', at: Date.now() });
}

export function broadcastDemoEvent(event: DemoRealtimeEvent) {
  if (typeof window === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(event);
    channel.close();
  } catch {
    /* BroadcastChannel is optional */
  }
}

export function subscribeDemoRealtime(callback: (event: DemoRealtimeEvent) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<DemoRealtimeEvent>) => callback(event.data);
  } catch {
    channel = null;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback({ type: 'store', table: '*', at: Date.now() });
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}

export function demoTable(table: string): Row[] {
  const store = readStore();
  return store[table] ?? [];
}

export function demoList(
  table: string,
  options: {
    filters?: Record<string, string | undefined>;
    search?: string;
    searchColumns?: string[];
    orderBy?: { column: string; ascending: boolean };
    limit?: number;
  } = {}
): Row[] {
  let rows = demoTable(table);
  if (!GLOBAL_TABLES.has(table)) {
    const active = getActiveDemoUniversity();
    rows = rows.filter((row) => row.university_id === active.id);
  }

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === undefined || value === '' || value === 'ALL') continue;
      rows = rows.filter((row) => String(row[key] ?? '') === String(value));
    }
  }

  if (options.search) {
    const needle = options.search.toLowerCase();
    const columns = options.searchColumns?.length
      ? options.searchColumns
      : ['title', 'title_en', 'name_en', 'description', 'description_en', 'tracking_code', 'area_en', 'location_en'];
    rows = rows.filter((row) =>
      columns.some((column) => String(row[column] ?? '').toLowerCase().includes(needle))
    );
  }

  if (options.orderBy) {
    const { column, ascending } = options.orderBy;
    rows = [...rows].sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
    });
  }

  if (options.limit) rows = rows.slice(0, options.limit);
  return rows;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function demoInsert(table: string, row: Row): Row {
  const store = readStore();
  const active = getActiveDemoUniversity();
  const created: Row = {
    ...row,
    id: row.id ?? nextId(table),
    university_id: row.university_id ?? active.id,
    created_at: row.created_at ?? new Date().toISOString(),
  };
  if (!created.profiles) {
    const profile = getDemoProfile();
    created.profiles = { full_name: profile.full_name, trust_level: profile.trust_level };
  }
  store[table] = [created, ...(store[table] ?? [])];
  applyInsertSideEffects(store, table, created);
  writeStore(store);
  broadcastDemoEvent({ type: 'insert', table, row: created, at: Date.now() });
  return created;
}

function applyInsertSideEffects(store: Record<string, Row[]>, table: string, row: Row) {
  if (table === 'complaint_upvotes') {
    const complaintId = row.complaint_id;
    store.complaints_public = (store.complaints_public ?? []).map((ticket) =>
      String(ticket.id) === String(complaintId)
        ? { ...ticket, upvotes_count: Number(ticket.upvotes_count ?? 0) + 1 }
        : ticket
    );
  }

  if (table === 'event_rsvps') {
    store.events = (store.events ?? []).map((event) =>
      String(event.id) === String(row.event_id)
        ? { ...event, rsvp_count: Number(event.rsvp_count ?? 0) + 1 }
        : event
    );
  }

  if (table === 'lost_items' && String(row.kind).toUpperCase() === 'FOUND') {
    const candidates = (store.lost_items ?? []).filter(
      (item) =>
        item.university_id === row.university_id &&
        String(item.kind).toUpperCase() === 'LOST' &&
        String(item.status).toUpperCase() === 'OPEN' &&
        String(item.category) === String(row.category)
    );
    const match = candidates[0];
    if (match) {
      const matchId = nextId('lost-match');
      store.lost_item_matches = [
        { id: matchId, university_id: row.university_id, lost_item_id: match.id, found_item_id: row.id, score: 92, notified: true, created_at: new Date().toISOString() },
        ...(store.lost_item_matches ?? []),
      ];
      store.lost_items = (store.lost_items ?? []).map((item) =>
        String(item.id) === String(match.id)
          ? { ...item, status: 'RESOLVED', matched_item_id: row.id }
          : item
      );
      store.notifications = [
        {
          id: nextId('notif'),
          university_id: row.university_id,
          user_id: match.reporter_id,
          title_en: `Possible match found: ${row.title}`,
          title_bn: `সম্ভাব্য মিল পাওয়া গেছে: ${row.title}`,
          body_en: `A found item matching your lost report was posted at ${row.location_en ?? 'campus'}.`,
          body_bn: `আপনার হারানো রিপোর্টের সাথে মিলে এমন জিনিস পাওয়া গেছে।`,
          action_url: '/lost-found',
          category: 'LOST_FOUND_MATCH',
          created_at: new Date().toISOString(),
        },
        ...(store.notifications ?? []),
      ];
    }
  }
}

export function demoUpdate(table: string, id: string, patch: Row): Row | null {
  const store = readStore();
  const rows = store[table] ?? [];
  let updated: Row | null = null;
  store[table] = rows.map((row) => {
    if (String(row.id) !== String(id)) return row;
    updated = { ...row, ...patch };
    if (table === 'complaints_public' && patch.status) {
      const history = Array.isArray(updated.history) ? [...updated.history] : [];
      history.push({
        status: patch.status,
        at: new Date().toISOString(),
        note: patch.resolution_summary ?? `Status changed to ${patch.status}.`,
        by: 'Admin',
      });
      updated.history = history;
      updated.last_activity_at = new Date().toISOString();
      if (patch.status === 'RESOLVED') updated.resolved_at = new Date().toISOString();
    }
    return updated;
  });
  writeStore(store);
  if (updated) broadcastDemoEvent({ type: 'update', table, row: updated, at: Date.now() });
  return updated;
}

export function demoDelete(table: string, id: string) {
  const store = readStore();
  store[table] = (store[table] ?? []).filter((row) => String(row.id) !== String(id));
  writeStore(store);
  broadcastDemoEvent({ type: 'delete', table, id, at: Date.now() });
}

export function demoProfileNames(): Record<string, { full_name: string; trust_level: string }> {
  const names: Record<string, { full_name: string; trust_level: string }> = {};
  for (const row of demoTable('marketplace_listings')) {
    if (row.profiles?.full_name) names[String(row.seller_id)] = row.profiles;
  }
  for (const row of demoTable('skill_postings')) {
    if (row.profiles?.full_name) names[String(row.author_id)] = row.profiles;
  }
  return names;
}

/** Used by the sign-up API in preview mode to validate a domain. */
export function demoFindUniversityByDomain(domain: string): DemoUniversity | undefined {
  const normalized = domain.toLowerCase().replace(/^@/, '');
  return DEMO_UNIVERSITIES.find((university) => university.domains.includes(normalized));
}

/** Used by the sign-up API in preview mode to find a university by id/code. */
export function demoFindUniversity(idOrCode: string): DemoUniversity | undefined {
  return getDemoUniversity(idOrCode);
}

/** Preview-mode sign-out flag (the demo session is local, so it needs an explicit reset). */
export function isDemoSignedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('campus360.demo.signedOut') === '1';
  } catch {
    return false;
  }
}

export function setDemoSignedOut(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem('campus360.demo.signedOut', '1');
    else window.localStorage.removeItem('campus360.demo.signedOut');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('campus360:demo-session'));
  broadcastDemoEvent({ type: 'store', table: '*', at: Date.now() });
}
