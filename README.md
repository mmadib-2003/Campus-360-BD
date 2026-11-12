<!-- README.md -->
# Campus360 BD — Multi-University Verified Super-App Platform

Campus360 BD is a multi-tenant web and mobile platform serving public universities across Bangladesh with institutional email verification, row-level tenant isolation, and 12+ real-time campus modules.

## Public Surfaces & Interactive Modules

- **Public SSR Entry & Legal Pages:**
  - `/` & `/welcome` — Server-rendered platform overview (4 capability pillars, all 12+ module entry points, live/bundled public university & residential hall showcase, and one-click Quick Demo modal) for guests; authenticated visitors at `/` land directly on the Campus Feed dashboard.
  - `/privacy` & `/terms` — Standalone server-rendered Privacy & Data Retention and Terms of Service summaries.
  - `/signin`, `/signup`, `/verify`, `/demo` — Role-aware institutional/personal email OTP authentication and one-click campus demo switcher.
- **Twelve Real-Time Campus Modules (+ Archive & Reviews):**
  - `/archive` — Virus-scanned 50 MB Academic Archive with 5-minute signed download URLs
  - `/skills` — Skill Hub, Tutoring & Part-Time Jobs
  - `/mentorship` — Peer Learning & Alumni Mentorship
  - `/careers` — Alumni Network & Career Hub
  - `/marketplace` — Campus Economy, Marketplace & Monitored Pickup Points
  - `/lost-found` — Keyword-Matched Lost & Found Board
  - `/events` & `/events/map` — Unified Event Calendar, Clubs & Live Geofenced Campus Map
  - `/dining` — Smart Hall Cafeteria Pre-Orders & Home-Made Food
  - `/sports` — Sports Matchmaking, Venue Booking & Transparent Crowdfunding Ledger
  - `/health` — Smart Blood Bank, Donor Network, Ambulance Helplines & Anonymous Counselling
  - `/housing` — Residential Hall Registries, Off-Campus Mess Seats & Rideshare
  - `/complaints` (`/civic` & `/complaints/track`) — Anonymous Grievance Routing, 999 Crisis Interstitial & Civic Ticket Upvotes
  - `/trust` & `/reviews` — Student ID Verification, Dispute Resolution & Live Polymorphic Service Reviews
  - `/governance/dashboard`, `/admin/console`, `/admin/panel` — Hall Provost & University Administration Portals

See [`docs/modules.md`](docs/modules.md) for module architecture and [`docs/api.md`](docs/api.md) for the complete 32-route REST API specification and environment variable reference.

## Key Capabilities

1. **Verification-First Multi-Tenancy:** Server-enforced university email domain whitelist (`university_email_domains`) for students, role-aware OTP verification (6-digit CSPRNG code, 5-minute TTL, max 5 attempts, 60s resend cooldown), and PostgreSQL Row-Level Security (`university_id = public.current_user_university_id()`).
2. **Academic Archive:** Private Supabase storage bucket (`academic-archive`), 50 MB max per file, server MIME validation, virus-scan status gating, and 5-minute signed download URLs.
3. **Grievance & Complaint Case Management:** Anonymous-by-default harassment/ragging reporting with keyed hash tracking (`ANON_COMPLAINT_PEPPER`), governing-unit SLA routing, two-way case timeline, and `CRITICAL` 999 crisis interstitial.
4. **Live Campus Events & Geofencing:** Live organizer GPS broadcast, server-side Haversine geofence check-in (`/api/events/[id]/check-in`), and cross-campus scope toggle (`My Campus` vs `All Campuses`).
5. **Real-Time Polymorphic Reviews:** Supabase Realtime subscriptions and trigger-maintained `review_aggregates`.

## Quick Demo Login

`/signin` (and the **Try Instant Demo** modal on `/` and `/welcome`) provides four one-click demo identities:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@demo.campus360.bd` | `Demo#1234` |
| Faculty | `faculty@demo.campus360.bd` | `Demo#1234` |
| Admin | `admin@demo.campus360.bd` | `Demo#1234` |
| Alumni | `alumni@demo.campus360.bd` | `Demo#1234` |

Provisioned idempotently by `supabase/seed/seed_quick_demo_accounts.sql` and migration `0021_fix_demo_auth_and_ju_departments.sql` (including `auth.identities` rows required by GoTrue password grants). When Supabase credentials are absent, Quick Demo Login falls back to the signed local demo session so previews remain fully interactive without external secrets.

## Local Development, Testing & Verification

```bash
# Install workspace dependencies (pnpm 9+)
pnpm install --frozen-lockfile

# Typecheck & lint all workspaces (@campus360/shared, ui, web, mobile)
pnpm turbo run lint typecheck

# Run Vitest unit & integration suites
pnpm turbo run test
pnpm test:modules

# Build production Next.js bundle & run Playwright E2E (Desktop Chrome + Pixel 7)
pnpm build
pnpm test:e2e:web

# Start local Supabase stack & run pgTAP RLS isolation tests
supabase start
supabase test db
```

Copy [`.env.example`](.env.example) to `.env.local` for live Supabase + Gmail SMTP configuration; see [`docs/api.md`](docs/api.md#8-runtime-environment-variables-appsweb) for required vs. optional variables.

## Authentic Campus Imagery

Supported public universities use authentic campus photography and institutional crests documented in [`docs/IMAGE_ATTRIBUTION.md`](docs/IMAGE_ATTRIBUTION.md), `supabase/seed/seed.sql`, and bundled static assets under `apps/web/public/campuses` and `apps/web/public/logos`.
