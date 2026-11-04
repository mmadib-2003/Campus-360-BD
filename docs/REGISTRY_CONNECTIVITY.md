# Registry connectivity — the `TypeError: fetch failed` post-mortem

Status: fixed in code (this document records *where* the fault lived, so the next
occurrence is a one-curl diagnosis instead of another redeploy-and-guess cycle).

## Symptom

`https://campus-360-bd.vercel.app/signup` rendered a red box above the **Public
University** combobox:

```
TypeError: fetch failed
```

and `GET /api/universities` answered `200`-shaped JSON with a failing envelope:

```json
{"success":false,"error":{"code":"FETCH_FAILED","message_en":"TypeError: fetch failed","message_bn":"বিশ্ববিদ্যালয়ের তালিকা লোড করা যায়নি।"}}
```

`/api/programs` said the same thing for its own table. Both strings were produced
by *our* code — `registryError`/`apiError` are the only writers of `FETCH_FAILED`
— which is what localised the fault inside the route handler.

## Where it originates

```
browser  ──fetch('/api/universities')──▶  Route Handler        ✅ this hop works
                                            │
                                            ├─ createSupabaseRouteClient()
                                            │     └─ supabase-js ──▶ NEXT_PUBLIC_SUPABASE_URL
                                            │                          ❌ undici: TypeError: fetch failed
                                            └─ apiError('FETCH_FAILED', error.message)  ← the red box
```

Two wording tells, which is the whole diagnosis:

1. **`TypeError: fetch failed` is Node/undici's message.** A browser that cannot
   reach its server says `TypeError: Failed to fetch`. So the string could not
   have come from the page's own `fetch()`.
2. **The new error box only ever displays text produced inside `fetchRegistry` or
   the route.** A URL-level failure in the browser would have surfaced as
   `HTTP <status>` / `Network error` in `fetchRegistry`'s `catch`, not as this
   sentence inside a well-formed 500 envelope.

So the failing network call is the **route's outbound call to Supabase**, whose
error `message` the route had been pasting verbatim into `message_en`.

## The three hypotheses, each checked

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| A relative `fetch()` inside a **Server Component** (needs `NEXT_PUBLIC_APP_URL` / `VERCEL_URL`) | **ruled out** | Every file under `apps/web/{app,lib,components}` containing `fetch(` has `'use client'` as line 1. There is no `pages/` directory and zero `getServerSideProps`/`getStaticProps`. The app never self-fetches. |
| Client code hitting **`localhost:3000`** | **ruled out** | The signup form calls the relative `/api/universities`. `localhost:3000` appears only in `playwright.config.ts`; `NEXT_PUBLIC_APP_URL` is read only by `lib/otp-email.ts` for links inside emails (fallback `https://campus360bd.com`). Nothing in the registry path assembles an absolute URL. |
| **CORS / preflight** block | **ruled out** | Same-origin `GET` with no custom request headers ⇒ no preflight. `grep -rn "Access-Control" apps/web` → no hits, and `next.config.mjs headers()` sets only HSTS, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`; `middleware.ts` adds one internal header. There is no CORS surface to misconfigure. |

Also checked and cleared: the Vercel deployment itself (`dpl_7PwG2SbBVCVQCYv2sGzdFD2KyXBZ`
→ `READY` / `PROMOTED` / production / `nodeVersion 26.x` / `sin1`), and the Supabase
project (`lxdovryeidayxfsqkwbg` → `ACTIVE_HEALTHY`). A `next start` of the same
build served `/api/programs` with `200`, `no-store` and 14 rows, which rules the
client/URL wiring out a second time from the other direction.

## The mechanism

`isSupabaseServerConfigured()` only requires the three variables to be
**non-empty**. Production therefore took the real-database branch, and
`createSupabaseRouteClient()` handed `process.env.NEXT_PUBLIC_SUPABASE_URL`
straight to `createServerClient()` — no trim, no scheme check, no shape check.
Any of these is "non-empty" and any of them dies inside undici with exactly
`TypeError: fetch failed`:

- `lxdovryeidayxfsqkwbg.supabase.co` (no `https://` ⇒ not a valid fetch URL)
- ` https://…supabase.co ` (typed/pasted with whitespace)
- `https://…supabase.co/rest/v1` (client appends `/rest/v1` itself ⇒ `/rest/v1/rest/v1`)
- `https://your-project-ref.supabase.co` — the literal placeholder in
  `.env.example` line 16 (and `apps/web/.env.example` uses `your-project`)

Note also: `NEXT_PUBLIC_API_URL` exists in the Vercel project but is referenced by
**no file in this repository**, so setting or renaming a variable to that name
cannot affect these requests. The only Supabase URL the app reads is
`NEXT_PUBLIC_SUPABASE_URL` (`lib/supabase-server.ts`, `lib/supabase-browser.ts`,
`lib/request-context.ts`).

## What the fix does

`lib/supabase-url.ts` is now the one source of truth for that URL.

| Situation | Before | Now |
| --- | --- | --- |
| missing scheme / `http://` / trailing slash / `…/rest/v1` / padding whitespace | opaque `fetch failed` | repaired, logged once as `[campus360:registry] NEXT_PUBLIC_SUPABASE_URL was normalized (…) → https://<host>` |
| `.env.example` placeholder host, or a `*.supabase.co` host whose ref is not 12–40 lowercase alphanumerics | attempted DNS lookup, then `fetch failed` | `503 SUPABASE_URL_INVALID` naming the variable, the host and the expected shape — before any request is sent |
| transient transport fault (`EAI_AGAIN`, `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`, …) | single failure, no retry | one retry with 250/500 ms backoff |
| permanent transport fault (`ENOTFOUND`) | retried forever by users clicking "Try again" | no retry (a wrong host does not fix itself), and the errno explains it |
| any transport fault | `message_en: "TypeError: fetch failed"` | `message_en: "fetch failed: getaddrinfo ENOTFOUND <host> (ENOTFOUND host=<host>)"` + `details.hint` |
| a token inside an upstream error message | forwarded into `message_en`, i.e. into the page | `scrubRegistrySecrets()` masks `eyJ…` JWT-shaped runs and `user:pass@` URL credentials |

All five registry reads (`universities`, `universities/[id]`, `halls`,
`departments`, `programs`) — plus the `code → id` lookups in `halls`/`departments`,
which used to answer a dead database with **`200 []`** and render as an empty
dropdown — go through `registryRead()` + `registryFailure()`. `Cache-Control:
no-store, max-age=0` and `force-dynamic` are unchanged.

## Confirmed from the deployed runtime

`GET /api/health/registry` on the fixed deployment answered `503` with:

```json
{"success":false,
 "endpoint":{"url":null,"host":"your-project-ref.supabase.co",
   "problem":"NEXT_PUBLIC_SUPABASE_URL still points at the template host \"your-project-ref.supabase.co\" (it contains \"your-project\"). Set it to your project URL, e.g. https://xxxxxxxxxxxxxxxxxxxx.supabase.co"},
 "env":{"supabaseUrlPresent":true,"serverSupabaseConfigured":true,"serviceRolePresent":true,"authMode":"production"},
 "tables":[],"allOk":false}
```

That is the outage in one line: **the variable was present, non-empty, and still
the `.env.example` template**, so `isSupabaseServerConfigured()` said "configured",
`createServerClient()` said "fine", and undici said `fetch failed` after a DNS
lookup for a host that does not exist. `tables: []` is deliberate — with an
unusable endpoint the probe does not bother issuing four doomed queries.

## Remediation (Vercel, not the code)

In Vercel → project `campus-360-bd` → Settings → Environment Variables, production
(and preview, and the Supabase project's own secrets for the edge functions):

| variable | must be |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lxdovryeidayxfsqkwbg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | this project's anon / `sb_publishable_…` key (Settings → API keys) |
| `SUPABASE_SERVICE_ROLE_KEY` | this project's service-role / `sb_secret_…` key — server-side only, never a `NEXT_PUBLIC_` name |
| `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET` | the project's own values, if the routes/crons that read them are in use |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same pair, for `apps/mobile` |

`NEXT_PUBLIC_API_URL` is **not** one of them: no file in this repository reads it.
Redeploy afterwards (an environment change does not rebuild the function, and
`NEXT_PUBLIC_*` values are read into the bundle at build time).

Because a placeholder *key* is the very next failure of the same shape, the probe
also reports `env.anonKey` / `env.serviceRoleKey` as **shape** only —
`present`, `shape` (`missing | placeholder | legacy-jwt | publishable | secret-format | malformed`),
`role`, `ref`, `refMatchesProject`, `problem` — and answers `503` before running any
query when either is the `.env.example` sample, has the wrong `role`, or was minted
for a different project ref. The values themselves are never read into the response.

## Diagnosing it yourself

```bash
curl -s https://campus-360-bd.vercel.app/api/health/registry | jq
```

`app/api/health/registry/route.ts` runs the same `supabaseTarget()` + `registryRead()`
pair the signup page uses and reports, for `universities`, `departments`,
`academic_programs` and `university_halls`: reachability, row count, latency, and
the errno if any. It also prints the endpoint this runtime is configured for
(`url`, `host`, `problem`, `repaired`) and booleans for the credentials it was
given. It returns `200` when every table counts, `503` otherwise, always
`no-store`, and never reads a key into the response — counts and a hostname are
already public for this app (the browser bundle carries the same URL).

Reading the variable's actual value (a value, not a key, is what matters here):

```bash
vercel env ls production | grep NEXT_PUBLIC_SUPABASE_URL
vercel env pull .env.local      # then check NEXT_PUBLIC_SUPABASE_URL
```

It must be exactly `https://lxdovryeidayxfsqkwbg.supabase.co`. After changing it,
redeploy — `NEXT_PUBLIC_*` values are read into the server bundle at build time.

Log lines, on both the probe and the real routes:

```bash
vercel logs https://campus-360-bd.vercel.app --follow | grep campus360:registry
```

## Tests

`apps/web/__tests__/supabase-url.test.ts` — 41 cases: every repair branch, every
rejection branch, the cause-chain walk (`ENOTFOUND` vs `EAI_AGAIN` vs
`ECONNRESET` vs a PostgREST error that must *not* be treated as transport),
retry-count assertions (`registryRead` calls the query twice for a blip and once
for a bad host), the credential scrub, and source guards that keep a
server-side self-fetch, a hardcoded localhost base, and a CORS header from
being reintroduced.
