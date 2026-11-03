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
