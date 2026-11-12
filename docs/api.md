<!-- docs/api.md -->
# REST API Specification

All Next.js App Router API handlers under `apps/web/app/api/**/route.ts` return a consistent bilingual JSON envelope (`apps/web/lib/api-response.ts`):

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

or on error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message_en": "Human-readable English message.",
    "message_bn": "বাংলা বার্তা।"
  }
}
```

Rate-limited endpoints attach `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Every route handler guards unconfigured preview deployments (`!isSupabaseServerConfigured()`) and unexpected exceptions so clients always receive structured JSON rather than an HTML 500 page.

---

## 1. Authentication & Session (`/api/auth/*`)

- `POST /api/auth/request-otp` — Validates role/email/hall/session rules (`student` requires an approved university email domain from `university_email_domains` and a residential hall; `faculty` and `alumni` allow institutional or personal email), enforces IP + per-email rate limits and a 60-second resend cooldown, stores an HMAC-SHA256 digest (`OTP_PEPPER_SECRET`) in `verification_attempts` (5-minute TTL, max 5 attempts), and delivers the 6-digit OTP via Nodemailer Gmail SMTP (`GMAIL_USER` + `GMAIL_APP_PASSWORD`).
  - Failure codes: `INVALID_OTP_CONTEXT` (400), `DOMAIN_NOT_WHITELISTED` (403), `OTP_COOLDOWN` / `RATE_LIMITED` (429), `AUTH_REGISTRY_UNAVAILABLE` (503), `AUTH_CONFIG_UNAVAILABLE` (503, missing `OTP_PEPPER_SECRET` in production), `EMAIL_PROVIDER_NOT_CONFIGURED` (503), `OTP_DELIVERY_FAILED` (502/503), `OTP_REQUEST_FAILED` (500).
- `POST /api/auth/verify-otp` — Performs timing-safe HMAC verification against `verification_attempts.otp_hash`, enforces expiry and attempt budget, atomically marks `verified_at`/`consumed_at` and clears `otp_hash`, provisions/repairs `auth.users` + `public.profiles` + `public.user_roles`, and issues the Supabase session and/or signed `campus360_verified_session` HTTP-only fallback cookie.
  - Failure codes: `INVALID_OTP` (401, with `attemptsRemaining`), `CHALLENGE_NOT_FOUND` (404), `OTP_EXPIRED` (410), `MAX_ATTEMPTS_EXCEEDED` (429), `PROFILE_LOOKUP_FAILED` (503), `OTP_VERIFY_FAILED` (500).
- `POST /api/auth/demo-signin` — Issues a signed HTTP-only `campus360_demo_session` cookie (and Supabase password session when configured) for the four Quick Demo Login roles (`student`, `faculty`, `admin`, `alumni`).
- `GET /api/auth/session` — Authoritative session endpoint for `SessionProvider` and `AppShell`. Resolves the active Supabase Auth user (self-healing missing `profiles` rows when needed), falling back to verified signed cookies (`campus360_verified_session` or `campus360_demo_session`).
- `POST /api/auth/sign-out` — Clears Supabase Auth cookies and signed Campus360 session/challenge cookies.

All authentication diagnostics log with the `[campus360:auth]` prefix (`apps/web/lib/auth-log.ts`) with OTP codes, SMTP credentials, and sender addresses redacted.

---

## 2. Public Campus Registries

- `GET /api/universities` — Lists active public universities with `university_email_domains(domain, is_primary)`. Supports `?category=` and `?q=` filters; falls back to `demoUniversitiesPayload()` when Supabase is unconfigured.
- `POST /api/universities` — Creates a university record (`SUPER_ADMIN` RLS-enforced).
- `GET /api/universities/[id]` — Returns a single university with domains, departments, and halls.
- `GET /api/halls` — Lists active `university_halls` for `?universityId=` (used by `/signup` and hall registries).
- `GET /api/departments` — Lists `departments` grouped by faculty/institute for `?universityId=` / `?universityCode=`.
- `GET /api/programs` — Lists `academic_programs` (`UNDERGRADUATE`, `GRADUATE`, `DOCTORAL`, `DIPLOMA`).

---

## 3. Unified Real-Time Module CRUD (`/api/modules/[module]`)

- `GET /api/modules/[module]` — Reads rows for any registered module in `apps/web/lib/modules/registry.ts` (`marketplace`, `marketplace-orders`, `pickup-points`, `skills`, `skill-applications`, `civic`, `complaint-upvotes`, `events`, `event-rsvps`, `clubs`, `club-members`, `health-donors`, `blood-requests`, `blood-responses`, `counseling-slots`, `mentors`, `mentorship-bookings`, `housing`, `ride-requests`, `careers`, `career-applications`, `alumni`, `cafeteria-items`, `home-food`, `food-orders`, `lost-found`, `lost-item-matches`, `sports-events`, `venue-bookings`, `donations`, `donation-ledger`, `disputes`, `dispute-messages`, etc.).
  - Enforces `resolveListingAccess`: modules marked `publicRead: true` serve column-restricted `publicSelect` projections to signed-out visitors (matching migration `0013_anon_public_listing_reads.sql`); private modules require authentication.
  - Supports `?scope=my_campus|all_campuses`, `?mine=1`, `?q=`, and field filters.
- `POST /api/modules/[module]` — Authenticated tenant-scoped create (`university_id` bound to caller profile).
- `PATCH /api/modules/[module]` — Authenticated owner/admin update (`?id=`).
- `DELETE /api/modules/[module]` — Authenticated owner/admin delete (`?id=`).

---

## 4. Academic Archive (`/api/archive/*`)

- `GET /api/archive` — Lists `academic_files` (`deleted_at IS NULL`, `dmca_quarantined = false`) with pagination, `?courseCode=`, `?category=`, `?departmentId=`, `?year=`, `?q=`, and `?scope=my_campus|all_campuses`.
- `POST /api/archive` — Registers uploaded file metadata, SHA-256 checksum, and virus-scan queue status (`PENDING`).
- `POST /api/archive/upload-url` — Validates MIME type and 50 MB size ceiling, then mints a signed upload token for the private `academic-archive` bucket.
- `POST /api/archive/[id]/download-url` — Verifies tenant/scan eligibility and mints a 5-minute signed download URL.

---

## 5. Grievances, Civic Tickets & Tracking

- `GET /api/complaints` & `POST /api/complaints` — Category-to-governing-unit SLA routing (`complaint_routing`), anonymous-by-default submission with keyed tracking-secret hashing (`ANON_COMPLAINT_PEPPER`), and `CRITICAL` crisis metadata.
- `POST /api/complaints/track` — Zero-PII status and timeline lookup using `trackingCode` + `trackingSecret`.
- `GET /api/civic/tickets` & `POST /api/civic/tickets` — Campus civic issue board and upvote-prioritized ticket creation.

---

## 6. Live Events, Health, Reviews, Profile & Notifications

- `GET /api/events` & `POST /api/events` — Campus and cross-campus event feeds and organizer creation.
- `POST /api/events/[id]/check-in` — Server-side Haversine geofence attendance verification.
- `POST /api/events/[id]/live-location` — Organizer live GPS coordinate broadcast for `/events/map`.
- `GET /api/health/blood` & `POST /api/health/blood` — Urgent blood requests and donor response matching.
- `GET /api/health/counseling` & `POST /api/health/counseling` — Confidential counselling slot availability and booking.
- `GET /api/health/registry` & `POST /api/health/registry` — Campus donor opt-in registry and emergency helplines.
- `GET /api/reviews` & `POST /api/reviews` — Polymorphic verified service reviews (`reviews` + trigger-maintained `review_aggregates`) with profanity filtering and `scope=my_campus|all_campuses`.
- `GET /api/profile` & `PATCH /api/profile` — Reads/updates caller profile, program session (`YYYY-YY`), residential hall, bio, and crisis callback preferences.
- `POST /api/profile/id-verify` — Private `id-verifications` upload registration with 7-day scheduled retention purge (`ID_VERIFICATION_RETENTION_DAYS`).
- `GET /api/notifications` & `PATCH /api/notifications` — Reads and marks in-app real-time notifications as read.

---

## 7. Governance & Administration

- `GET /api/governance/[resource]`, `POST /api/governance/[resource]`, `PATCH /api/governance/[resource]/[id]`, `DELETE /api/governance/[resource]/[id]` — Hall provost / campus governance endpoints for `hall_allocations` and `governance_notices`.
- `PATCH /api/admin/complaints/[id]/status` — Updates complaint workflow status and appends `complaint_timeline` audit entries (`ADMIN` / `UNIVERSITY_ADMIN` / `SUPER_ADMIN`).
- `GET /api/admin/models/[section]`, `POST /api/admin/models/[section]`, `PATCH /api/admin/models/[section]/[id]`, `DELETE /api/admin/models/[section]/[id]` — Multi-model administration console endpoints (`/admin/panel` and `/admin/console`) for universities, email domains, residential halls, departments, and moderation queues.

---

## 8. Runtime Environment Variables (`apps/web`)

| Variable | Required in Prod | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (`https://<ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key for RLS-enforced client/route queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only admin key (also accepts `SUPABASE_SECRET_KEY` fallback) for OTP challenges and account provisioning. |
| `SUPABASE_JWT_SECRET` | Optional | JWT verification secret for custom token checks. |
| `OTP_PEPPER_SECRET` | Yes | Server-only HMAC-SHA256 secret for `verification_attempts.otp_hash` and signed auth cookies. |
| `ANON_COMPLAINT_PEPPER` | Yes | Server-only HMAC secret for anonymous grievance tracking secrets. |
| `CSRF_SIGNING_SECRET` | Recommended | Signing secret for state-changing request protection. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Yes (email OTP) | Nodemailer Gmail SMTP sender address and 16-character App Password. |
| `EMAIL_FROM_ADDRESS` | Optional | Display sender header matching `GMAIL_USER`. |
| `SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional | Support contact address shown in OTP emails and `/privacy` + `/terms` (`support@campus360bd.com` default). |
| `NEXT_PUBLIC_APP_URL` | Optional | Canonical base URL (`https://campus-360-bd.vercel.app`). |
| `NEXT_PUBLIC_AUTH_MODE` | Optional | Set to `demo` only on non-SMTP preview deployments. |
| `ID_VERIFICATION_RETENTION_DAYS` | Optional | Retention window in days for private ID verification uploads (default `7`). |
