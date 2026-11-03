# Campus360 BD — Interactive Modules (Real-Time Feature Set)

This document describes the twelve interactive modules added on top of the original
verification-first platform. **Nothing in the existing UI/UX was redesigned**: the hero,
university registry, grievance system, archive, live events map, review feed and the
persistent identity bar are untouched. Navigation entries that previously pointed at
`/?module=…` (which rendered the home page) now point at real, working routes.

| # | Module | Route | API surface | Realtime channel(s) |
|---|--------|-------|-------------|---------------------|
| 1 | Campus Economy & Marketplace | `/marketplace` | `/api/modules/marketplace`, `-pickup-points`, `-orders`, `-messages` | `marketplace_listings`, `marketplace_orders`, `marketplace_messages` |
| 2 | Skill Hub, Tutoring & Jobs | `/skills` | `/api/modules/skills`, `skill-applications`, `skill-alerts` | `skill_postings`, `skill_applications` |
| 3 | Civic Ticketing & Complaints | `/civic` | `/api/civic/tickets`, `/api/modules/complaint-upvotes` | `complaints`, `complaint_upvotes` |
| 4 | Events & Club Connect | `/events` | `/api/events`, `/api/modules/clubs`, `club-members`, `club-notices`, `event-rsvps` | `events`, `event_rsvps`, `clubs`, `club_notices` |
| 5 | Emergency & Health | `/health` | `/api/health/blood`, `/api/health/counseling`, `/api/modules/blood-requests`, `donors`, `health-contacts`, `counseling-slots` | `blood_requests`, `health_donors`, `counseling_slots` |
| 6 | Archive & Mentorship | `/mentorship` (+ existing `/archive`) | `/api/archive*`, `/api/modules/mentors`, `mentorship-slots`, `mentorship-bookings` | `mentor_profiles`, `mentorship_slots`, `mentorship_bookings` |
| 7 | Housing & Commute | `/housing` | `/api/modules/housing`, `rideshare`, `ride-requests`, `ticket-exchange` | `housing_listings`, `rideshare_offers`, `rideshare_requests` |
| 8 | Alumni & Career Hub | `/careers` | `/api/modules/alumni`, `careers`, `career-applications`, `conversations`, `messages` | `career_opportunities`, `direct_messages` |
| 9 | Smart Cafeteria & Home Food | `/dining` | `/api/modules/cafeteria-menus`, `cafeteria-items`, `home-food`, `food-orders` | `cafeteria_menus`, `home_food_listings`, `food_orders` |
| 10 | Lost & Found | `/lost-found` | `/api/modules/lost-found`, `lost-item-matches` | `lost_items`, `lost_item_matches` |
| 11 | Sports & Crowdfunding | `/sports` | `/api/modules/sports-teams`, `sports-challenges`, `sports-venues`, `venue-bookings`, `campaigns`, `donations`, `donation-ledger` | `sports_teams`, `sports_venues`, `donation_campaigns`, `donations` |
| 12 | Trust & Verification | `/trust` (+ `/admin/console`) | `/api/modules/disputes`, `dispute-messages`, `/api/profile/id-verify` | `disputes`, `dispute_messages`, `reviews` |

---

## Architecture

```
apps/web
├── app/
│   ├── marketplace | skills | civic | events | health | mentorship
│   ├── housing | careers | dining | lost-found | sports | trust
│   ├── admin/console            ← civic queue + dispute moderation
│   └── api/
│       ├── modules/[module]     ← registry-driven, tenant-isolated CRUD
│       ├── civic/tickets        ← public-safe civic board + submission
│       └── health/{blood,counseling}
├── components/modules/
│   ├── ui.tsx                   ← design-system primitives (same emerald/teal + slate)
│   ├── ModuleForm.tsx           ← schema-driven form renderer
│   ├── ModuleHub.tsx            ← 12-module hub on the campus feed
│   ├── previews/                ← code-split home widgets
│   └── notifications/           ← realtime bell + live toasts
└── lib/modules/
    ├── registry.ts              ← single source of truth (tables, fields, filters)
    ├── client.ts                ← session, list/mutation hooks, realtime helpers
    ├── side-effects.ts          ← notifications, donor fan-out, match engine
    ├── demo-data.ts             ← preview dataset (used only when no secrets exist)
    └── coerce.ts                ← server-side validation & normalisation
```

### Why a registry?

Every module shares one hardened route handler (`/api/modules/[module]`):

* a **write allow-list** — only columns declared in `registry.ts` can be written,
* **owner injection** — `seller_id`, `author_id`, `cook_id`, … always come from the session, never the body,
* **tenant scoping** — every query is filtered by `university_id = <session university>`,
* **RLS enforcement** — the route uses the caller's JWT client, so database policies are the final authority,
* **validation** — enums, uuids, money, dates and array fields are normalised before touching PostgreSQL.

Adding a module therefore means adding a registry entry, not a new route.

### Real-time strategy

* All status-bearing tables are added to the `supabase_realtime` publication
  (`supabase/migrations/0007_module_expansion.sql`).
* Client hooks (`useRealtimeModuleList`, `useRealtimeTable`) subscribe per table and patch
  the local cache on `INSERT` / `UPDATE` / `DELETE` — counts, statuses and chats update
  without a refresh.
* Server-side side effects (`lib/modules/side-effects.ts`) fan out notifications:
  blood-donor broadcasts, skill-match alerts, lost & found match scoring, marketplace orders,
  rideshare matches, donation ledger entries and direct messages.
* The header bell subscribes to `notifications` for the signed-in user and shows live toasts.

### Privacy & safety guarantees

| Requirement | Implementation |
|-------------|----------------|
| Anonymous counselling | `counseling_bookings` stores `user_id = NULL`, an alias and an HMAC of a one-time retrieval token; reads are counselor/admin only (`/api/health/counseling`). |
| Blood donor privacy | `/api/health/blood` never returns phone numbers; contact is exchanged only after a donor responds. |
| Civic vs. grievance separation | Civic tickets are public maintenance reports; harassment/ragging stay inside the confidential, SLA-tracked grievance system, and `/api/civic/tickets` filters them out server-side. |
| Safe handovers | Every marketplace reservation requires a monitored `campus_pickup_points` entry. |
| Tenant isolation | RLS policy `university_id = public.current_user_university_id()` on all 42 new tables. |

### Preview / demo mode

When a deployment has no `NEXT_PUBLIC_SUPABASE_URL` / anon key (a fresh Vercel preview, for
example), the client falls back to `lib/modules/demo-data.ts`:

* every module remains **fully interactive** (post, RSVP, upvote, chat, book, donate),
* writes are persisted in `sessionStorage` and shared across tabs,
* the UI shows a `● PREVIEW DATA` badge plus a signed-in demo student,
* API routes return a structured `SUPABASE_NOT_CONFIGURED` (`503`) envelope instead of throwing,
* the production build no longer fails on prerender (all route handlers are `force-dynamic`).

Connecting a Supabase project switches every surface to live, tenant-scoped data with no code
changes — the badge disappears automatically.

---

## Database

`supabase/migrations/0007_module_expansion.sql` (additive, idempotent):

* 6 new enums (`listing_kind`, `skill_posting_type`, `housing_kind`, `ride_mode`, `lost_item_kind`, `career_opportunity_kind`),
* 42 new tables spanning the twelve modules, each with `university_id UUID NOT NULL`,
* RLS enabled on every table with tenant-read, verified-write, owner-update and admin-manage policies,
* counters maintained by triggers: complaint upvotes, skill applicants, club members, counselling and
  mentorship capacity, donation totals,
* `user_trust_summary` view for the verification panel,
* storage bucket `campus-media` for listing/found-item photos,
* realtime publication additions for 48 tables.

Reference data lives in `supabase/seed/seed_modules.sql` (helplines, locker points, venues, clubs) and
optional demo activity in `supabase/seed/seed_demo_activity.sql`.

```bash
supabase db reset                 # migrations + seed.sql
psql "$SUPABASE_DB_URL" -f supabase/seed/seed_modules.sql
psql "$SUPABASE_DB_URL" -f supabase/seed/seed_demo_activity.sql   # local only
```

---

## Testing

```bash
pnpm test:modules        # registry, coercion and matching unit tests (vitest)
pnpm test               # all unit tests (shared + web)
pnpm --filter @campus360/web typecheck
pnpm --filter @campus360/web build
pnpm --filter @campus360/web test:e2e   # Playwright, boots the dev server automatically
```

The Playwright suite (`apps/web/e2e/modules.spec.ts`) asserts that all sixteen routes render,
hydrate without console errors, and keep their key interactions (marketplace reserve,
civic upvote, lost & found filter, health tabs, notification bell). It runs on desktop
Chromium **and** an emulated Pixel 7 to guard mobile responsiveness.

---

## Vercel deployment

`vercel.json` at the repository root configures the monorepo build:

```json
{
  "buildCommand": "pnpm --filter @campus360/web build",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "regions": ["sin1"]
}
```

Environment variables to set in Vercel (Project → Settings → Environment Variables):

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes (for live data) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (for live data) | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (server) | Admin client for notifications/fan-out |
| `ANON_COMPLAINT_PEPPER` | recommended | HMAC pepper for anonymous tokens |
| `NEXT_PUBLIC_APP_URL` | recommended | Canonical URL for links |

Without the Supabase pair the deployment still builds, deploys and runs in preview mode.
After adding the secrets, run the migrations (`supabase db push`) and the modules switch to
live real-time data.

### Post-deploy checklist

1. `https://<deployment>/` → module hub renders, sidebar lists 12 modules.
2. `/marketplace` → create a listing; open a second browser tab and confirm it appears instantly.
3. `/civic` → submit a ticket; an admin console session sees it and the student's board updates on status change.
4. `/health` → post a blood request; matching donors receive a notification toast and a bell entry.
5. `/lost-found` → post a matching found item; the original reporter receives an instant match alert.
6. `/admin/console` → resolve a ticket; the student board reflects `RESOLVED` without a refresh.
