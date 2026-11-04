<!-- README.md -->
# Campus360 BD — Multi-University Verified Super-App Platform

Campus360 BD transforms the single-university JU pilot prototype into a production-grade, strictly multi-tenant web and mobile platform serving all 50+ public universities in Bangladesh.

## Interactive Modules (Real-Time)

Twelve fully interactive modules run on top of the verification-first core, each backed by
Supabase Realtime: marketplace + campus lockers, skill hub with match alerts, civic ticketing with
upvotes and an admin resolution console, events & club connect, smart blood bank + anonymous
counselling, mentorship booking, housing & rideshare matching, alumni career hub with live chat,
cafeteria pre-orders + home-made food, lost & found match engine, sports hub + transparent donation
ledger, and the trust/dispute panel.

See [`docs/modules.md`](docs/modules.md) for the architecture, database migration, tests and the
Vercel deployment checklist. Module routes: `/marketplace`, `/skills`, `/civic`, `/events`,
`/health`, `/mentorship`, `/housing`, `/careers`, `/dining`, `/lost-found`, `/sports`, `/trust`,
plus `/admin/console` for staff.

## Key Capabilities
1. **Verification-First Multi-Tenancy:** Server-enforced university email domain whitelist (`university_email_domains`), CSPRNG 6-digit email OTP (10m TTL, max 5 attempts, 60s cooldown), and row-level security (`university_id = public.current_user_university_id()`).
2. **Academic Archive:** Private Supabase storage bucket (`academic-archive`), 50 MB max, server MIME sniffing, ClamAV virus-scan webhook, version history, and 5-minute signed download URLs.
3. **Grievance & Complaint Case Management:** Anonymous-by-default for harassment/ragging with cryptographic `tracking_code` + device-bound secret, category-to-governing-unit SLA routing, automatic escalation cron, two-way messaging, and CRITICAL 999 crisis interstitial.
4. **Live Campus Events & Google Maps Geofencing:** Places Autocomplete, live organizer GPS broadcast, Haversine geofence check-in, and accessible text directions.
5. **Real-Time Polymorphic Reviews:** Instant Supabase Realtime channel updates and database trigger-maintained `review_aggregates`.

## Quick Demo Login

`/signin` has a **Quick Demo Login** panel with four one-click identities — Student, Faculty,
Admin and Alumni. No OTP email is needed:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@demo.campus360.test` | `Demo#1234` |
| Faculty | `faculty@demo.campus360.test` | `Demo#1234` |
| Admin | `admin@demo.campus360.test` | `Demo#1234` |
| Alumni | `alumni@demo.campus360.test` | `Demo#1234` |

They are provisioned by `supabase/seed/seed_quick_demo_accounts.sql` (hardcoded bcrypt hash,
idempotent) and are included in `supabase db reset` via `supabase/config.toml`. The seed also
creates an `auth.identities` row per account — GoTrue's password grant resolves the email
through `auth.identities`, so `auth.users` alone is not enough. With Supabase configured the
buttons use `signInWithPassword`; without it they fall back to the offline demo store, so a
fresh preview is always explorable.

## Authentic campus imagery

24 public universities use real Wikimedia Commons campus photographs and real institutional
logos: DU (Curzon Hall), JU (Shaheed Minar), BUET, SUST, CU, RU, IU, KU, JNU, COU, BRUR, BUP,
BU, JUST, BAU, CUET, KUET, RUET, MBSTU, PSTU, NSTU, PUST, BSMRAU and SAU. The URLs live in
`supabase/seed/seed.sql`, migrations `0016_university_real_images.sql` and
`0017_university_real_images_expanded.sql`, and the offline demo payload in
`apps/web/lib/demo-auth.ts`. Attribution and licences are in
[`docs/IMAGE_ATTRIBUTION.md`](docs/IMAGE_ATTRIBUTION.md).
