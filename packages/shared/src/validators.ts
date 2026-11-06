// packages/shared/src/validators.ts
import { z } from 'zod';

/** Public account choices. Administrative access has its own sign-in flow. */
export const AuthRoleSchema = z.enum(['student', 'faculty', 'alumni']);
export type AuthRole = z.infer<typeof AuthRoleSchema>;

/** Consecutive academic years, including century rollover (1999-00). */
export const ProgramSessionSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'Program session must use YYYY-YY')
  .refine((value) => {
    const [start, end] = value.split('-').map(Number);
    return end === (start + 1) % 100;
  }, 'The second year must immediately follow the first year');

/** Recent choices are suggestions, not a restriction on custom valid sessions. */
export const PROGRAM_SESSION_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const start = 2025 - index;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
});

const OtpEmailSchema = z.string().trim().toLowerCase().pipe(z.string().email().max(254));
// Registry identifiers are opaque to the browser (the offline registry uses slugs).
const NullableIdSchema = z.string().trim().min(1).max(100).nullable().optional();
const SignupPayloadSchema = z.object({
  role: AuthRoleSchema.optional(),
  hallId: NullableIdSchema,
  programSession: ProgramSessionSchema.optional(),
  fullName: z.string().trim().max(160).optional(),
  studentId: z.string().trim().max(80).optional(),
  departmentId: NullableIdSchema,
  programId: NullableIdSchema,
}).passthrough();

const OtpContextSchema = z.object({
  email: OtpEmailSchema,
  universityId: z.string().trim().min(1).max(100).optional(),
  // Optional only for challenges issued before explicit role selection existed.
  role: AuthRoleSchema.optional(),
  hallId: NullableIdSchema,
  programSession: ProgramSessionSchema.optional(),
  purpose: z.enum(['signin', 'signup']).optional(),
  signupPayload: SignupPayloadSchema.optional(),
});

type OtpContext = z.infer<typeof OtpContextSchema>;
function checkRoleRules(context: OtpContext, zod: z.RefinementCtx, requireHall: boolean) {
  const payload = context.signupPayload;
  const role = context.role ?? payload?.role ?? 'student';
  if (context.role && payload?.role && context.role !== payload.role) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['role'], message: 'Role fields must agree' });
  }
  const hallId = context.hallId !== undefined ? context.hallId : payload?.hallId;
  if (context.hallId !== undefined && payload?.hallId !== undefined && context.hallId !== payload.hallId) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['hallId'], message: 'Hall fields must agree' });
  }
  if (role === 'student') {
    if (requireHall && !hallId) {
      zod.addIssue({ code: z.ZodIssueCode.custom, path: ['hallId'], message: 'Students must select a residential hall' });
    }
  } else if (hallId != null) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['hallId'], message: 'Only students may submit a hall' });
  }
  if (context.programSession && payload?.programSession && context.programSession !== payload.programSession) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['programSession'], message: 'Program session fields must agree' });
  }
  if (context.purpose === 'signup' && !(context.programSession ?? payload?.programSession)) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['programSession'], message: 'Program session is required to create an account' });
  }
  // Personal emails cannot infer a tenant; the selected university supplies it.
  // Approved-domain membership for students is checked against the registry.
  if (role !== 'student' && !context.universityId) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['universityId'], message: 'Select your university' });
  }
}

export const RequestOtpSchema = OtpContextSchema.superRefine((context, zod) => checkRoleRules(context, zod, true));
export const VerifyOtpSchema = z.object({
  email: OtpEmailSchema,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  role: AuthRoleSchema.optional(),
  // Retries may omit context and use the signed, issued challenge instead.
  hallId: NullableIdSchema,
  programSession: ProgramSessionSchema.optional(),
  // The browser echoes the selection it stored at request-otp time so the
  // account can be provisioned even when the challenge row is unreadable.
  // The issued challenge stays authoritative: these only fill gaps.
  universityId: z.string().trim().min(1).max(100).optional(),
  departmentId: NullableIdSchema,
  programId: NullableIdSchema,
  fullName: z.string().trim().max(160).optional(),
  studentId: z.string().trim().max(80).optional(),
}).superRefine((context, zod) => {
  if (context.role && context.role !== 'student' && context.hallId != null) {
    zod.addIssue({ code: z.ZodIssueCode.custom, path: ['hallId'], message: 'Only students may submit a hall' });
  }
});

export const CreateComplaintSchema = z.object({
  title: z.string().min(5).max(200),
  category: z.enum([
    'ACADEMIC',
    'HALL_RESIDENCE',
    'HARASSMENT',
    'RAGGING_BULLYING',
    'SEXUAL_HARASSMENT',
    'FINANCIAL',
    'INFRASTRUCTURE',
    'TRANSPORT',
    'HEALTH',
    'DISCRIMINATION',
    'OTHER',
  ]),
  description: z.string().min(20).max(5000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  preferredLanguage: z.enum(['en', 'bn']).default('en'),
  isAnonymous: z.boolean().optional(),
  consentToShareIdentity: z.boolean().default(false),
});

export const CreateReviewSchema = z.object({
  targetType: z.enum([
    'MARKETPLACE',
    'BLOOD_DONOR',
    'ARCHIVE_FILE',
    'EVENT',
    'COMPLAINT_RESOLUTION',
    'TRANSPORTATION',
    'HALL_DINING',
    'LIBRARY',
    'TUTORING',
    'HOUSING',
    'LOST_AND_FOUND',
    'CLUBS',
    'NOTICE_BOARD',
  ]),
  targetId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(5).max(2000),
  photoUrls: z.array(z.string().url()).max(5).default([]),
  tags: z.array(z.string().max(32)).max(8).default([]),
});
