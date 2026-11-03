// packages/shared/src/validators.ts
import { z } from 'zod';

export const RequestOtpSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  universityId: z.string().uuid().optional(),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
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
