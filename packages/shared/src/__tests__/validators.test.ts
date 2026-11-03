// packages/shared/src/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import { VerifyOtpSchema, CreateComplaintSchema } from '../validators';
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
