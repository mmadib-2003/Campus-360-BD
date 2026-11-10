# Welcome Screen & Navigation — Campus360 BD

Two related changes: a dedicated **one-page Welcome experience** for visitors who
have not signed in yet, and a **de-cluttered navigation shell** for everyone else.
Both are presentation-only: no table, RLS policy, column, query or auth flow
changed.

---

## 1. Welcome screen (`/` for guests, `/welcome` for anyone)

```
apps/web
├── app/page.tsx                     → <WelcomeGate />   (guests → welcome, signed-in → dashboard)
├── app/welcome/page.tsx             → <WelcomeView />   (always-available overview route)
└── components/welcome/
    ├── WelcomeView.tsx              → the three sections
    ├── WelcomeGate.tsx              → session gate + skeleton
    └── pillars.ts                   → the four-pillar map (derived from MODULE_META)
```

The page contains **exactly three sections** — no feeds, no multi-level menus and
no heavy forms on the first view.

### A. Minimal sticky header + hero

| Element | Behaviour |
|---|---|
| Brand mark + wordmark | links to `/` |
| Theme toggle | `next-themes` (already supported) |
| Language toggle | EN ⇄ বাংলা via the existing `NEXT_LOCALE` cookie flow |
| **Enter Platform** | routes to `/signin` (institutional email OTP) |
| **Launch Workspace** | routes to `/signin` |
| **Try Instant Demo** | opens a modal that renders the **existing** `QuickDemoLogin` — the same one-click, role-based demo access used on `/signin` |

### B. Interactive 4-pillar overview (progressive disclosure)

Thirteen flat cards are replaced by four tabs. Hover, focus or tap a pillar and
the preview card swaps to that pillar's sub-modules with a one-sentence
description and a short fade/rise animation.

| Pillar | Sub-modules |
|---|---|
| 🎓 Academic & Career Hub | Academic Archives, Skill Hub, Peer Learning & Mentorship, Alumni Network & Career Hub |
| 🌿 Campus Life & Circular Economy | Campus Economy & Marketplace, Lost & Found, Event Calendar, Club Management, Smart Cafeteria, Sports & Crowdfunding |
| 🩸 Emergency & Health Network | Smart Blood Bank, Live Donor Finder, Emergency Campus Support |
| 🏛️ Hall & Campus Governance | Residential Hall Registries, Verified Grievance/Complaint Tracking, Role-Based Portals |

`components/welcome/pillars.ts` builds the pillars **from `MODULE_META`**, so the
overview can never drift from the real module registry. `apps/web/__tests__/welcome-pillars.test.ts`
asserts that every `MODULE_META` entry is covered exactly once.

### C. Interactive supported-universities showcase

The showcase reads the **existing University Registry** through
`GET /api/universities` — the same endpoint the sign-up combobox and the
dashboard registry use. Live Supabase rows and the demo fallback payload share
the same shape, so nothing is duplicated.

- Category pills: **All**, **General & Autonomous**, **Engineering & Tech**,
  **Science & Tech**, **Agricultural** (the values are the registry's own
  `category` codes).
- Instant search over name, Bengali name, code and city.
- Cards show the acronym, full name, city and the verified institutional
  domain(s).
- Selecting a card opens a detail bar with:
  - **Residential hall count** — read from the Residential Hall Registry
    (`DEMO_UNIVERSITY_HALLS`, the same source `/api/halls` serves),
  - the **verified email domain format** (`name@du.ac.bd`),
  - **“Explore [CODE] Campus”**, which pre-selects that university in the demo
    session (`setDemoSession`) and lands on `/demo`, where the roster highlights
    the selected campus.

---

## 2. Navigation shell

`apps/web/lib/modules/nav.ts` is now the single navigation registry. The desktop
sidebar, the mobile drawer, the ⌘K palette and the dashboard switcher all read
from it, so a route can never be visible in one surface and missing in another.

### Desktop sidebar — four collapsible groups

| Group | Routes |
|---|---|
| Core Workspace | `/`, `/events/map` |
| Academic & Clubs | `/skills`, `/archive`, `/mentorship`, `/careers`, `/events` |
| Community & Commerce | `/marketplace`, `/housing`, `/dining`, `/lost-found`, `/sports`, `/reviews` |
| Safety & Governance | `/civic`, `/health`, `/trust`, `/admin/console` |

Groups can be collapsed; the group containing the active route always stays
expanded, and only the active route is highlighted.

### Mobile — four tabs + “All Modules”

Bottom navigation: **Home**, **Academic** (`/archive`), **Marketplace**,
**Emergency Blood** (`/health`). The fifth slot opens the **All Modules**
drawer: a two-column grid of every module.

### Dashboard module switcher

`components/modules/ModuleSwitcher.tsx` renders an instant “jump to any module”
search at the top of the dashboard. The ⌘K palette now also returns module
results next to the existing complaint, archive and event searches.

---

## 3. Dashboard de-cluttering

- Max **3 cards per row** on desktop (`lg:grid-cols-3`), 1 on mobile.
- Card padding `p-5` / `p-6`, `rounded-2xl`, softer `border-slate-200/80 dark:border-slate-800`.
- Secondary information stays behind progressive disclosure (tabs, drawers,
  expandable rows); empty, loading and error states use the shared skeleton and
  empty-state primitives.

---

## 4. Non-regression

- All 13 modules, every filter, form and flow remain reachable (guarded by
  `apps/web/__tests__/welcome-pillars.test.ts`).
- No table, RLS policy, column name, university scoping or tenant isolation was
  touched.
- Institutional email verification, university/hall selection hooks and the
  one-click role-based demo behave exactly as before — the Welcome screen
  reuses `QuickDemoLogin`, `setDemoSession` and `/api/auth/demo-signin` as-is.
- `pnpm --filter @campus360/web typecheck`, `pnpm test:modules` (459 tests) and
  `pnpm build` all pass with zero errors.
