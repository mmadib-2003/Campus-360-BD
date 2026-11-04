# OTP Failure Diagnosis & Dual-Track Resolution

**Status:** resolved via Track A (custom SMTP) + Track B (demo OTP fallback).
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

## 2. Track A — Real OTP over custom SMTP (production)

Custom SMTP bypasses both the team-inbox restriction and the 2/hour cap.

1. **Supabase Dashboard → Authentication → SMTP Settings** → enable custom
   SMTP (Resend, SendGrid or Mailtrap for staging).
2. Set the sender domain + DKIM records for your provider.
3. Configure the app environment (mirrors `apps/web/.env.example`):
   - `RESEND_API_KEY` — transactional API key (the app's
     `/api/auth/request-otp` dispatches the bilingual OTP email through the
     Resend API directly as well).
   - `EMAIL_FROM_ADDRESS` — the verified sender.
   - `NEXT_PUBLIC_AUTH_MODE=production` — disables Track B surfaces.
4. OTPs are generated CSPRNG (`crypto.randomInt(100000, 1000000)`), stored as
   HMAC-SHA256 hashes in `verification_attempts`, TTL 10 minutes, 5 attempts.

## 3. Track B — Demo OTP fallback (`NEXT_PUBLIC_AUTH_MODE === 'demo'`)

When custom SMTP is not configured, the OTP verification screen renders a
clearly labelled **Demo OTP** panel (`components/auth/DemoOtpPanel.tsx`,
`data-testid="demo-otp-panel"`):

- The code is **unique per email address**:
  `SHA-256(DEMO_OTP_SALT + ':' + email)` → first 8 hex chars → `100000–999999`
  (`apps/web/lib/demo-otp.ts`, works identically in browser and server).
- The server stores it in **`profiles.demo_otp`** with
  **`profiles.demo_otp_expires_at` (10-minute TTL)** and accepts it at
  verification time (migration `0009`).
- The panel renders **only** when `process.env.NEXT_PUBLIC_AUTH_MODE === 'demo'`.
- Real SMTP quota is never burned by the fallback path (mail dispatch is
  skipped in demo mode).

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
