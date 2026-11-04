// apps/web/lib/demo-otp.ts
// ============================================================================
// Track B — Demo OTP (fallback when custom SMTP is not configured).
//
// Supabase's default email provider only delivers to organization team members
// and is capped at 2 emails per hour project-wide, so real inboxes cannot rely
// on it at scale. When `NEXT_PUBLIC_AUTH_MODE === 'demo'` the OTP verification
// screen renders a clearly labelled "Demo OTP" panel showing a unique 6-digit
// code per email address, derived deterministically:
//
//   SHA-256(DEMO_OTP_SALT + ':' + email) → first 8 hex chars → 6 digits
//
// The server stores the code in `profiles.demo_otp` with a 10-minute TTL
// (`profiles.demo_otp_expires_at`) and accepts it at verification time, so the
// flow is complete end-to-end without sending a single email. Track A (custom
// SMTP via Resend/SendGrid/Mailtrap) remains the production path.
//
// The function is pure and isomorphic (Web Crypto), so the demo panel can
// re-derive the same code client-side and the server can verify it.
// ============================================================================

export const DEMO_OTP_TTL_MS = 10 * 60 * 1000;

/** Public in demo mode only — never a secret used for real account security. */
export const DEMO_OTP_SALT = process.env.NEXT_PUBLIC_DEMO_OTP_SALT ?? 'campus360-demo-otp-salt';

export function isDemoAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'demo';
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministic 6-digit code for an email address (100000–999999).
 * Same input ⇒ same code, in the browser and on the server.
 */
export async function computeDemoOtp(email: string, salt: string = DEMO_OTP_SALT): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${normalized}`));
  const value = parseInt(toHex(digest).slice(0, 8), 16) % 900000;
  return String(value + 100000);
}

export function demoOtpExpiresAt(from: number = Date.now()): string {
  return new Date(from + DEMO_OTP_TTL_MS).toISOString();
}
