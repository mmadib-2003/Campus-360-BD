-- supabase/migrations/0011_email_otp_verification.sql
-- ============================================================================
-- Real-time email OTP verification (Nodemailer / Gmail SMTP) — schema changes
--
-- The application flow (apps/web/app/api/auth/request-otp + verify-otp, backed
-- by apps/web/lib/otp-store.ts) works without this file, but these columns are
-- what turn it into an auditable, single-use, diagnosable flow:
--
--   1. consumed_at      — a challenge is retired when it is replaced by a
--                         newer code, when its attempts are exhausted, or when
--                         it is verified. Only the newest live row per email is
--                         ever verifiable.
--   2. otp_hash nullable — the digest is erased (set to NULL) the moment an
--                         OTP is accepted or revoked, so the table holds no
--                         verifiable secret for a settled challenge.
--   3. delivery_status / email_sent_at / email_message_id / delivery_error —
--                         SMTP bookkeeping, so "the code never arrived" can be
--                         answered from the database alone. email_message_id is
--                         the SMTP Message-ID of the delivered message.
--   4. partial index     — the hot lookup is "latest unsettled challenge for
--                         this email"; the index skips every settled row.
--   5. purge function    — keeps the table from growing one row per sign-up.
--
-- RLS: verification_attempts already has RLS enabled (migration 0005) and no
-- SELECT/INSERT policies, i.e. the anon and authenticated roles cannot read or
-- write it at all. The API uses the service-role client, which bypasses RLS by
-- design. No new policies are required — and none should be added: a readable
-- otp_hash/expires_at from the browser would defeat the flow.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 + 2. Challenge lifecycle columns + nullable digest
-- ---------------------------------------------------------------------------
ALTER TABLE public.verification_attempts
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'SENT', 'FAILED')),
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT;

-- Set only at request time / cleared at settle time, so a settled challenge
-- never carries a replayable digest.
ALTER TABLE public.verification_attempts ALTER COLUMN otp_hash DROP NOT NULL;

-- A retired challenge is also flagged verified_at-free only when it truly was
-- verified; consume-only rows keep verified_at NULL. Settle anything already
-- verified or past its 5-minute deadline, so no code that is still live is
-- invalidated by the upgrade.
UPDATE public.verification_attempts
   SET consumed_at = COALESCE(verified_at, expires_at)
 WHERE consumed_at IS NULL
   AND (verified_at IS NOT NULL OR expires_at < now());

COMMENT ON COLUMN public.verification_attempts.otp_hash IS
  'HMAC-SHA256(email:code) using OTP_PEPPER_SECRET. NULL once the challenge is verified or revoked. The plaintext code is never stored.';
COMMENT ON COLUMN public.verification_attempts.expires_at IS
  'Absolute deadline for the code — issued as generation time + 5 minutes (OTP_TTL_MS in apps/web/lib/demo-otp.ts).';
COMMENT ON COLUMN public.verification_attempts.consumed_at IS
  'Set when the challenge stops being usable: replaced by a newer code, attempts exhausted, or verified.';
COMMENT ON COLUMN public.verification_attempts.delivery_status IS
  'Delivery state: PENDING (inserted, not yet mailed), SENT (SMTP server accepted), FAILED (rolled back).';
COMMENT ON COLUMN public.verification_attempts.email_message_id IS
  'Message-ID used for the send (seeded from this row id) — join key for mail-server log lookups.';

-- ---------------------------------------------------------------------------
-- 3. Hot-path index: newest unsettled challenge per email
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_verification_attempts_active
  ON public.verification_attempts (email, created_at DESC)
  WHERE verified_at IS NULL AND consumed_at IS NULL;

-- Support tooling filters by university + delivery outcome when triaging
-- "I never got the code" reports.
CREATE INDEX IF NOT EXISTS idx_verification_attempts_delivery
  ON public.verification_attempts (delivery_status, created_at DESC)
  WHERE delivery_status <> 'SENT';

-- ---------------------------------------------------------------------------
-- 4. Housekeeping: one row per OTP request is a lot of dead weight
--    Schedule from a daily job, e.g.
--    SELECT cron.schedule('purge-verification-attempts', '15 3 * * *',
--      $$SELECT public.purge_expired_verification_attempts(interval '7 days')$$);
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_verification_attempts(
  retain_for interval DEFAULT interval '7 days'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed bigint;
BEGIN
  DELETE FROM public.verification_attempts
   WHERE created_at < now() - retain_for;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;

REVOKE ALL ON FUNCTION public.purge_expired_verification_attempts(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_verification_attempts(interval) TO service_role;

COMMENT ON FUNCTION public.purge_expired_verification_attempts(interval) IS
  'Deletes verification_attempts rows older than retain_for. Safe at any time: a row is useless once its code expires (5 minutes).';

-- ---------------------------------------------------------------------------
-- 5. Retiring the Track B demo path (OPTIONAL — run by hand once every
--    deployment sends real email and no preview relies on the demo panel).
--    profiles.demo_otp stores a plaintext code, so it is worth removing.
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.profiles
--   DROP COLUMN IF EXISTS demo_otp,
--   DROP COLUMN IF EXISTS demo_otp_expires_at;

COMMIT;
