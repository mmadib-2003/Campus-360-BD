# OTP Failure Diagnosis & Dual-Track Resolution

**Status:** resolved — Track A is now the default path (real-time email OTP via
the Resend API); Track B survives only as an offline escape hatch.
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

## 2. Track A — real-time email OTP via the Resend API (default)

Custom SMTP bypasses both the team-inbox restriction and the 2/hour cap, and the
app no longer relies on Supabase's mailer for sign-in at all —
`/api/auth/request-otp` calls Resend directly.

| Concern | Implementation |
| --- | --- |
| Code | `generateOtpCode()` — `crypto.getRandomValues` + rejection sampling, 100000–999999 (`apps/web/lib/demo-otp.ts`) |
| Storage | `verification_attempts.otp_hash` = HMAC-SHA256(`email:code`) keyed by `OTP_PEPPER_SECRET`; **the plaintext code is never stored** (`apps/web/lib/otp-store.ts`, `apps/web/lib/otp-crypto.ts`) |
| TTL | `expires_at = generation + 5 minutes` (`OTP_TTL_SECONDS = 300`) |
| Single use | `verified_at` + `consumed_at` set and `otp_hash` cleared to NULL on success (`consumeOtpChallenge`) |
| Newest wins | every new request retires prior open challenges for the address (`supersedeOpenChallenges`) |
| Attempts | 5 per challenge; the 5th failure revokes the code |
| Cooldown | 60s per email, plus 5/10min per address and 10/10min per IP |
| Delivery | `sendOtpEmail()` → Resend SDK (`resend` npm package, `emails.create`), bilingual branded HTML + plain-text part, `Idempotency-Key` = challenge id (`apps/web/lib/otp-email.ts`) |
| Failure | delivery error rolls the challenge back (row deleted) so the user can retry immediately, and writes `audit_log.OTP_DELIVERY_FAILED` |
| Session | on success the service client mints a magiclink and the SSR client exchanges it for the cookie session |

Configuration:

1. `RESEND_API_KEY` — server-only API key (`process.env`, never `NEXT_PUBLIC_*`).
2. `EMAIL_FROM_ADDRESS` — sender on a **verified** Resend domain (SPF/DKIM).
3. `OTP_PEPPER_SECRET` — required; `request-otp` returns
   `503 AUTH_CONFIG_UNAVAILABLE` in production when it is missing, instead of
   hashing with a default key.
4. `NEXT_PUBLIC_AUTH_MODE=production`.
5. Apply `supabase/migrations/0011_email_otp_verification.sql` (deliberately not
   edited into 0002 — see §5) for `consumed_at`, delivery tracking and the
   active-challenge index. Without it the flow still works: `otp-store.ts`
   detects the missing columns, retries with the migration-0002 column set and
   logs one warning.

Supabase Dashboard → Authentication → SMTP can keep the same Resend
credentials, so password-reset and magic-link mail leave the team inbox too.

## 3. Track B — demo fallback (`NEXT_PUBLIC_AUTH_MODE === 'demo'` **and** no `RESEND_API_KEY`)

Track B is now strictly a fallback: it is only reachable when no Resend key is
configured, so a deployment can never silently stop mailing while *appearing*
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
  sign-up; §5 shows how to drop it once every environment has Resend.

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
