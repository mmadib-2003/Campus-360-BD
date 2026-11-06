// packages/shared/src/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import { VerifyOtpSchema, RequestOtpSchema, ProgramSessionSchema, PROGRAM_SESSION_OPTIONS, CreateComplaintSchema } from '../validators';
import { isInsideGeofence } from '../geo';

describe('Campus360 BD Shared Validators & Geofence Math', () => {
  it('rejects 5-digit demo OTP 12345 and accepts valid 6-digit OTP', () => {
    const demoResult = VerifyOtpSchema.safeParse({ email: 'student@juniv.edu', otp: '12345' });
    expect(demoResult.success).toBe(false);

    const validResult = VerifyOtpSchema.safeParse({ email: 'student@juniv.edu', otp: '482910' });
    expect(validResult.success).toBe(true);
  });

  it('computes Haversine geofence check-in accurately at JU Shaheed Minar', () => {
    const venue = { lat: 23.8791, lng: 90.2674 };
    const nearbyStudent = { lat: 23.8795, lng: 90.2676 };
    const distantUser = { lat: 23.7340, lng: 90.3928 }; // DU Dhaka

    expect(isInsideGeofence(nearbyStudent.lat, nearbyStudent.lng, venue.lat, venue.lng, 150).inside).toBe(true);
    expect(isInsideGeofence(distantUser.lat, distantUser.lng, venue.lat, venue.lng, 150).inside).toBe(false);
  });

  it('validates complaint schema with severity and category', () => {
    const parsed = CreateComplaintSchema.safeParse({
      title: 'Ragging incident near Hall gate',
      category: 'RAGGING_BULLYING',
      description: 'Detailed description of the incident with time and witnesses.',
      severity: 'CRITICAL',
      isAnonymous: true,
    });
    expect(parsed.success).toBe(true);
  });
});


describe('role, hall and program-session signup rules', () => {
  const universityId = '9b0f2a6e-0000-4000-8000-000000000001';
  const hallId = '9b0f2a6e-0000-4000-8000-000000000002';
  const base = { universityId, purpose: 'signup', programSession: '2023-24' };

  it.each(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'])(
    'accepts personal %s email for faculty and alumni without a hall',
    (domain) => {
      for (const role of ['faculty', 'alumni']) {
        const parsed = RequestOtpSchema.safeParse({ ...base, role, email: `person@${domain}`, hallId: null });
        expect(parsed.success).toBe(true);
      }
    }
  );

  it('requires a hall for students and rejects halls for non-students', () => {
    expect(RequestOtpSchema.safeParse({ ...base, role: 'student', email: 'student@du.ac.bd' }).success).toBe(false);
    expect(RequestOtpSchema.safeParse({ ...base, role: 'student', email: 'student@du.ac.bd', hallId }).success).toBe(true);
    expect(RequestOtpSchema.safeParse({ ...base, role: 'faculty', email: 'person@gmail.com', hallId }).success).toBe(false);
  });

  it('requires a selected university for personal emails and a session for signup', () => {
    expect(RequestOtpSchema.safeParse({ ...base, universityId: undefined, role: 'alumni', email: 'person@gmail.com' }).success).toBe(false);
    expect(RequestOtpSchema.safeParse({ ...base, programSession: undefined, role: 'faculty', email: 'person@gmail.com' }).success).toBe(false);
  });

  it('does not allow public callers to select administrative roles or conflicting context', () => {
    expect(RequestOtpSchema.safeParse({ ...base, role: 'admin', email: 'admin@du.ac.bd' }).success).toBe(false);
    expect(RequestOtpSchema.safeParse({ ...base, role: 'faculty', email: 'person@gmail.com', signupPayload: { role: 'student' } }).success).toBe(false);
  });

  it('normalizes email and accepts consecutive sessions including custom years and rollover', () => {
    const parsed = RequestOtpSchema.safeParse({ ...base, role: 'faculty', email: ' Person@Gmail.com ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('person@gmail.com');
    for (const session of ['1995-96', '2025-26', '1999-00', '2030-31', ' 2023-24 ']) {
      expect(ProgramSessionSchema.safeParse(session).success).toBe(true);
    }
    expect(PROGRAM_SESSION_OPTIONS).toHaveLength(31);
    expect(PROGRAM_SESSION_OPTIONS[0]).toBe('2025-26');
    expect(PROGRAM_SESSION_OPTIONS.at(-1)).toBe('1995-96');
  });

  it.each(['2023-25', '2023-2024', '23-24', '2023/24', '', 'abcd-ef'])('rejects invalid session %s', (session) => {
    expect(ProgramSessionSchema.safeParse(session).success).toBe(false);
  });

  it('lets verification retries omit context but rejects a non-student hall', () => {
    expect(VerifyOtpSchema.safeParse({ email: 'person@gmail.com', otp: '482913' }).success).toBe(true);
    expect(VerifyOtpSchema.safeParse({ email: 'person@gmail.com', otp: '482913', role: 'faculty', hallId }).success).toBe(false);
  });
});
