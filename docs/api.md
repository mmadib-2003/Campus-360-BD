<!-- docs/api.md -->
# REST API Specification

All endpoints return a consistent JSON envelope:
`{ "success": boolean, "data"?: T, "error"?: { "code": string, "message_en": string, "message_bn": string }, "meta"?: object }`
and include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

- `POST /api/auth/request-otp` — Server-side domain whitelist check, then a CSPRNG 6-digit OTP is hashed into `verification_attempts` (5-minute TTL, 5 attempts, 60s cooldown) and mailed in real time over Gmail SMTP — Nodemailer `createTransport({ service: 'gmail' })` authenticated with `GMAIL_USER` + `GMAIL_APP_PASSWORD` — using a branded bilingual HTML template (no verified domain required). Response: `{ email, universityId, expiresAt, secondsRemaining, cooldownSeconds, ttlSeconds, delivery: 'email', messageId }` — never the code. `meta.delivery` is `gmail` (or `demo` on the Track B path), and `messageId` is also stored on `verification_attempts.email_message_id`.
- `POST /api/auth/verify-otp` — Timing-safe HMAC comparison against the stored digest, expiry + attempt-budget checks, then `verified_at`/`consumed_at` are set and `otp_hash` is cleared before the Supabase user is provisioned and the session cookie is issued. Error codes: `CHALLENGE_NOT_FOUND` (404), `OTP_EXPIRED` (410), `INVALID_OTP` (401, `details.attemptsRemaining`), `MAX_ATTEMPTS_EXCEEDED` (429).
- Failure modes of `request-otp`: `EMAIL_PROVIDER_NOT_CONFIGURED` (503, no `GMAIL_USER`/`GMAIL_APP_PASSWORD` and demo mode off), `AUTH_CONFIG_UNAVAILABLE` (503, no `OTP_PEPPER_SECRET` in production), `OTP_DELIVERY_FAILED` (502 for transient relay/socket faults, 503 for credential/quota/recipient faults — the challenge row is deleted either way so a retry is immediate), `OTP_COOLDOWN` (429).
- `POST /api/archive/upload-url` & `POST /api/archive/:id/download-url` — 5-minute signed URLs with quota and same-university verification checks.
- `POST /api/complaints` & `POST /api/complaints/track` — SLA routing, anonymous secret hashing, and zero-PII status tracking.
- `POST /api/events/:id/check-in` — Server-side Haversine geofence verification.
