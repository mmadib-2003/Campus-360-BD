<!-- docs/setup.md -->
# Local Development Setup Guide

1. **Prerequisites:** Node.js 20+, pnpm 9+, Docker Desktop (for local Supabase), Supabase CLI, and Expo CLI.
2. **Clone & Install:**

### Multi-university demo seed

```bash
supabase db reset
psql "$SUPABASE_DB_URL" -f supabase/seed/seed_multiuniverse_demo.sql
```

The seed adds DU, BUET, SUST, RU and CU rows across marketplace, skills,
complaints, lost & found, housing and dining. See `docs/modules.md` for the
campus-by-campus location map.

### Preview mode

Without Supabase environment variables the app runs on a local multi-university
demo store (`apps/web/lib/modules/demo-data.ts`). The identity bar exposes a
preview campus switcher and role switcher; every list is scoped to the selected
campus, and writes are broadcast across tabs with BroadcastChannel so the
two-session realtime test works without a database.
