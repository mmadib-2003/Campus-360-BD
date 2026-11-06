-- 0025: role-aware signup metadata.
-- Students keep a university hall; faculty/alumni persist NULL. Email-domain
-- and role rules are enforced by the OTP routes against the selected tenant.
-- Existing accounts are preserved: unknown historical sessions stay NULL and
-- are collected during onboarding rather than invented by a backfill.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS program_session TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN hall_id DROP NOT NULL;

COMMENT ON COLUMN public.profiles.program_session IS
  'Academic session in consecutive YYYY-YY format (for example 2023-24). Required for new signup/onboarding; nullable for pre-existing accounts until collected.';
COMMENT ON COLUMN public.profiles.hall_id IS
  'Residential hall for students; NULL for faculty, alumni and other non-student accounts.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_program_session_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_program_session_format CHECK (
        program_session IS NULL OR (
          program_session ~ '^[0-9]{4}-[0-9]{2}$'
          AND (substring(program_session FROM 1 FOR 4)::integer + 1) % 100
              = substring(program_session FROM 6 FOR 2)::integer
        )
      );
  END IF;
END;
$$;

-- Make the additive column immediately visible to PostgREST schema caches.
NOTIFY pgrst, 'reload_schema';

COMMIT;
