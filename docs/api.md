<!-- docs/api.md -->
# REST API Specification

All endpoints return a consistent JSON envelope:
`{ "success": boolean, "data"?: T, "error"?: { "code": string, "message_en": string, "message_bn": string }, "meta"?: object }`
and include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

- `POST /api/auth/request-otp` — Server-side domain whitelist check + 6-digit OTP email dispatch.
- `POST /api/auth/verify-otp` — Timing-safe HMAC verification + session issuance.
- `POST /api/archive/upload-url` & `POST /api/archive/:id/download-url` — 5-minute signed URLs with quota and same-university verification checks.
- `POST /api/complaints` & `POST /api/complaints/track` — SLA routing, anonymous secret hashing, and zero-PII status tracking.
- `POST /api/events/:id/check-in` — Server-side Haversine geofence verification.
