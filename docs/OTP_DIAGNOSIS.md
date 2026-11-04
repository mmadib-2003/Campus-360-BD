# OTP Failure Diagnosis & Dual-Track Resolution

**Status:** resolved — Track A is now the default path (real-time email OTP via
Nodemailer + Gmail SMTP); Track B survives only as an offline escape hatch.
**Date:** 2026-11-04

## 1. Diagnosis (Supabase Dashboard → Authentication → Logs)

> Note for operators: the Supabase Dashboard is not reachable from the build
> sandbox (it requires an authenticated browser session against the hosted
> project). The steps below are the exact reproduction used to capture the
> failure code; run them against the project before flipping `AUTH_MODE` to
> production.

1. Open **Supabase Dashboard → Authentication → Logs**.
2. Trigger an OTP request against a non-team inbox (e.g. `student.du@du.ac.bd`).
3. The log entry fails with one of two codes:
   - `email_address_not_authorized` — the default email provider only delivers
     to **organization team members**. Arbitrary student inboxes are rejected
     outright.
   - `over_email_send_rate_limit` — the free-tier cap is **2 emails per hour,
     project-wide**. It is a hard cap; it cannot be raised.

This is the authentication deadlock: at class scale (40+ signups), OTP mail is
either refused by address or exhausted within minutes.

## 2. Track A — real-time email OTP via Nodemailer + Gmail SMTP (default)

Any SMTP relay bypasses both the team-inbox restriction and the 2/hour cap, and
the app no longer relies on Supabase's mailer for sign-in at all —
`/api/auth/request-otp` connects to `smtp.gmail.com` through Nodemailer.

**Why Gmail SMTP and not a transactional provider API:** providers such as Resend
refuse to relay to arbitrary addresses until you have verified a custom domain
(SPF/DKIM). Campus360 BD does not have one yet, so every OTP would have been
locked behind a purchase. Gmail's SMTP relay works from a plain `@gmail.com`
address, is free, and reaches any inbox. The trade-off is throughput and sender
reputation — quantified in §6.

| Concern | Implementation |
| --- | --- |
| Code | `generateOtpCode()` — `crypto.getRandomValues` + rejection sampling, 100000–999999 (`apps/web/lib/demo-otp.ts`) |
| Storage | `verification_attempts.otp_hash` = HMAC-SHA256(`email:code`) keyed by `OTP_PEPPER_SECRET`; **the plaintext code is never stored** (`apps/web/lib/otp-store.ts`, `apps/web/lib/otp-crypto.ts`) |
| TTL | `expires_at = generation + 5 minutes` (`OTP_TTL_SECONDS = 300`) |
| Single use | `verified_at` + `consumed_at` set and `otp_hash` cleared to NULL on success (`consumeOtpChallenge`) |
| Newest wins | every new request retires prior open challenges for the address (`supersedeOpenChallenges`) |
| Attempts | 5 per challenge; the 5th failure revokes the code |
| Cooldown | 60s per email, plus 5/10min per address and 10/10min per IP |
| Delivery | `sendOtpEmail()` → Nodemailer (`nodemailer` npm package, `createTransport({ service: 'gmail' })`, `auth` from `GMAIL_USER`/`GMAIL_APP_PASSWORD`), bilingual branded HTML + plain-text part, `Message-ID` seeded from the challenge id (`apps/web/lib/otp-email.ts`) |
| Failure | `classifySmtpError()` sorts hard faults (bad credentials, quota, 5xx recipient refusal) from transient ones (4xx, `ESOCKET`, `ETIMEDOUT`); the challenge is rolled back (row deleted) so the user can retry immediately, and `audit_log.OTP_DELIVERY_FAILED` is written |
| Session | on success the service client mints a magiclink and the SSR client exchanges it for the cookie session |

Configuration:

1. `GMAIL_USER` + `GMAIL_APP_PASSWORD` — server-only (`process.env`, never
   `NEXT_PUBLIC_*`). The password must be a 16-character **app password** from
   <https://myaccount.google.com/apppasswords> (2-Step Verification on); Gmail
   rejects an account password and the app password is revocable on its own.
2. `EMAIL_FROM_ADDRESS` — display name only; Gmail relays as `GMAIL_USER` and
   `otpMailFrom()` substitutes it (with a warning) if the addresses differ.
3. `OTP_PEPPER_SECRET` — required; `request-otp` returns
   `503 AUTH_CONFIG_UNAVAILABLE` in production when it is missing, instead of
   hashing with a default key.
4. `NEXT_PUBLIC_AUTH_MODE=production`.
5. Apply `supabase/migrations/0011_email_otp_verification.sql` (deliberately not
   edited into 0002 — see §5) for `consumed_at`, delivery tracking and the
   active-challenge index. Without it the flow still works: `otp-store.ts`
   detects the missing columns, retries with the migration-0002 column set and
   logs one warning.

Supabase Dashboard → Authentication → SMTP Settings can keep the **same** Gmail
credentials, so password-reset and magic-link mail leave the team inbox too.

Transport defaults: a fresh connection per message (`pool` off) because a frozen
serverless function holding an open SMTP socket is a worse failure mode than the
~200 ms handshake; `SMTP_POOL=1` opts into a cached pooled transporter for
Docker/long-running deployments. `SMTP_TIMEOUT_MS` / `SMTP_SEND_TIMEOUT_MS`
bound the connect and socket phases so a dead relay cannot hang the request.

## 3. Track B — demo fallback (`NEXT_PUBLIC_AUTH_MODE === 'demo'` **and** no SMTP credentials)

Track B is now strictly a fallback: it is only reachable when `GMAIL_USER` /
`GMAIL_APP_PASSWORD` are absent, so a deployment can never silently stop mailing while *appearing*
to be in production. `DemoOtpPanel` also stopped deriving the code client-side —
it renders only when the API actually returned a `demoCode`, so the panel can
never show a code the server would reject.

- Code: `SHA-256(DEMO_OTP_SALT + ':' + email)` → `100000–999999`
  (`apps/web/lib/demo-otp.ts`, `computeDemoOtp`).
- Stored in `profiles.demo_otp` / `profiles.demo_otp_expires_at` (migration
  `0009`) **and** hashed into `verification_attempts`, so verification runs
  through the same code path as production; the profile columns are cleared once
  the code is accepted.
- TTL is shared with Track A (5 minutes), which is also the demo cookie's
  `maxAge` in `apps/web/lib/demo-auth.ts`.
- The plaintext column exists purely so a preview without SMTP can complete
  sign-up; §5 shows how to drop it once every environment can mail.

## 4. Password-based demo accounts (no OTP at all)

`supabase/seed/seed_users_demo_accounts.sql` seeds one **student**, one
**platform admin** and one **governance** account per university (DU, BUET,
SUST, RU, CU) with `crypt('Demo#1234', gen_salt('bf'))`:

| Role      | Example                 | Password   | Lands on               |
| --------- | ----------------------- | ---------- | ---------------------- |
| student   | `student.du@du.ac.bd`   | `Demo#1234`| `/feed`                |
| admin     | `admin.du@du.ac.bd`     | `Demo#1234`| `/admin/panel`         |
| governance| `governance.du@du.ac.bd`| `Demo#1234`| `/governance/dashboard`|

They sign in through the **DevSignInPanel** on `/signin` (demo mode only) or
the roster page `/demo`, using `signInWithPassword` — bypassing the email caps
entirely. Admin accounts carry the `is_platform_admin` JWT claim consumed by
`public.is_platform_admin()` (migration `0010`).

## 5. Schema changes and rollout order

1. Apply the migration: `supabase db push` (hosted) or `pnpm db:reset` (local).
   It adds `consumed_at`, `delivery_status`, `email_sent_at`, `email_message_id`,
   `delivery_error`, makes `otp_hash` nullable (so it can be erased after use),
   indexes the "latest unsettled challenge" lookup, and installs
   `purge_expired_verification_attempts(interval)` for a nightly cron.
2. Set `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `OTP_PEPPER_SECRET` and
   `NEXT_PUBLIC_AUTH_MODE=production`, then restart the web app.
3. Smoke test: request a code on a real inbox, verify it, then re-submit the
   same code — it must return `CHALLENGE_NOT_FOUND`, and
   `select otp_hash, verified_at, consumed_at from verification_attempts order
   by created_at desc limit 1` must show `otp_hash` IS NULL.
4. Optional hardening once no environment needs the fallback: drop
   `profiles.demo_otp` / `profiles.demo_otp_expires_at` (commented block at the
   end of migration 0011) and delete `apps/web/lib/demo-otp.ts`'s Track B
   exports plus `DemoOtpPanel`.

RLS: `verification_attempts` already has RLS enabled with **no** policies for
`anon`/`authenticated` (migration 0005), which is exactly right — the browser
must never read a digest or an expiry. The API writes it with the service-role
client (`apps/web/lib/supabase-server.ts`), which bypasses RLS. No new policies
are required and none should be added.

## 6. Gmail throughput, and when to move off it

Gmail removes the verified-domain requirement, it does not remove sender
limits. On a personal account:

| Constraint | Practical effect |
| --- | --- |
| ~500 recipients/day | roughly 500 sign-ups per day per `GMAIL_USER`; a single university's onboarding wave can exhaust it before lunch |
| ~100 messages/hour (newer accounts, unmeasured but observed) | bursty class-room signups can hit `429`-style `Too many recipients` / `Rate limit exceeded`; `classifySmtpError()` maps that to a **non**-retryable 503 so users are told to contact support instead of hammering |
| Per-message size 50 MB | irrelevant for a 6-digit code |
| Sender reputation | a `@gmail.com` From can land in Promotions/Spam more often than a domain-verified sender, and the inbox is not monitored — the template says "do not reply" and routes `X-Complaints-To` accordingly |
| One account = one blast radius | if Google flags the account, OTP delivery for every university stops at once |

Mitigations already in place: the 60s per-address cooldown, 5 requests/10 min per
address and 10/10 min per IP keep the quota from being burned by retries, and
`delivery_status` / `email_message_id` make "the code never arrived" answerable
from the database.

Escalation ladder, cheapest first:

1. Keep Gmail but use a **Google Workspace** account (2,000 recipients/day) —
   the code does not change, only `GMAIL_USER`/`GMAIL_APP_PASSWORD`.
2. Point `createOtpMailer()` at any other SMTP relay (SES/Mailgun/Postmark SMTP,
   or a university relay) — only the transport options change; the template,
   hashing and TTL logic are untouched. `host`/`port`/`secure` replace `service`.
3. Once a domain is verified, a transactional HTTP API can be reintroduced
   behind the same `sendOtpEmail()` contract — the route handlers and
   `verification_attempts` schema need no edit.

## 7. Field incident 2026-11-04 — "campus list is empty" and "OTP never arrives"

Both reports came from the deployed preview at the same time, and they were the
**same fault**: the production database had no registry rows.

| Checked | Result |
| --- | --- |
| `universities` / `university_email_domains` / `university_halls` | **0 / 0 / 0 rows** |
| `verification_attempts` | 0 rows — so no request ever reached the code-issuing step |
| RLS on the registry tables | already permissive: `universities`, `university_email_domains`, `university_halls` all have an anon+authenticated `SELECT` with `USING (true)`; `set local role anon` saw all rows |
| Migration `0011` | applied — `consumed_at`, `delivery_status`, `email_sent_at`, `email_message_id`, `delivery_error` all present |
| Nodemailer wiring | `service: 'gmail'` + app-password auth, awaited inside the handler, Node.js runtime (no `runtime = 'edge'`) |
| Vercel egress | ports **465 and 587 are open**; only port 25 is blocked (Vercel KB, "Can I use SMTP with Vercel?") |

The sign-in failure was therefore **not** SMTP. `request-otp` verifies the
address against `university_email_domains` before it generates anything, so with
an empty table every student got `403 DOMAIN_NOT_WHITELISTED` and no email was
ever attempted. The empty combobox was the same missing table, one screen earlier.

Fix applied: `supabase/seed/seed.sql` (universities, domains, departments,
governing units, routing) **then** `supabase/seed/seed_university_halls.sql`
(halls + governance demo rows) — 51 universities, 56 domains, 32 halls. Order
matters: both files are `INSERT ... SELECT FROM universities`, so the halls seed
alone inserts nothing against an empty registry.

### Reading the logs next time

```bash
vercel logs https://<deployment>.vercel.app --follow | grep campus360:auth
```

| Log line | What it means | First thing to check |
| --- | --- | --- |
| `smtp.transport-config` | emitted once per cold start: service, sending user, pool, timeouts, `credentialsPresent` | `credentialsPresent: false` → the env vars are not on the **Production** environment |
| `smtp.sent` | Gmail accepted the message (has the `Message-ID`) | look in Spam/Promotions before blaming the app |
| `smtp.send-failed` + `responseCode: 535` | credentials rejected | app password (never the account password); 2-Step Verification must be on for one to exist; on a Workspace account an admin must enable "Public client access / SMTP for Gmail" for that user |
| `smtp.send-failed` + `ETIMEDOUT`/`ESOCKET` | relay unreachable from that region | transient — the API already returned 502 "try again" |
| `smtp.recipient-rejected` | Gmail refused that mailbox | the student's address, not our config |
| `request-otp.registry-lookup-failed` | the whitelist **query** errored (503 `AUTH_REGISTRY_UNAVAILABLE`) | PostgREST/service-role config, not the user's email |
| `request-otp.domain-not-whitelisted` | no active domain row matched | `select * from university_email_domains where domain = '…';` |
| `request-otp.challenge-store-failed` | insert into `verification_attempts` failed | columns present? (re-apply 0011) service role able to write? |

The log lines never contain the OTP or the app password — `lib/auth-log.ts`
drops credential-shaped keys and scrubs the values, and
`apps/web/__tests__/auth-log.test.ts` fails if that ever stops being true.

### Known gap left open deliberately

`.eq('is_active', true)` in the whitelist query filters the **domain** row; the
embedded `universities!inner(...)` selects the parent's `is_active` but does not
filter on it, so deactivating a university does not currently stop its domains
from issuing codes. It is a one-line change
(`.eq('universities.is_active', true)`) that alters who can sign in, so it should
be made against a staging project where the PostgREST filter can be exercised.
