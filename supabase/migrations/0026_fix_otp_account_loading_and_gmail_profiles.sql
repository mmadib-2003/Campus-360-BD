-- supabase/migrations/0026_fix_otp_account_loading_and_gmail_profiles.sql
-- ============================================================================
-- Verified OTP sign-ins must never dead-end on "your email is verified, but the
-- account could not be loaded".
--
-- Three database-side causes are removed here:
--   1. `handle_new_user()` resolved the tenant from the email domain only, so a
--      personal address (@gmail.com, @yahoo.com, …) could not be attached to a
--      university and the INSERT aborted the whole auth.users creation. It now
--      reads `raw_user_meta_data->>'university_id'` FIRST, falls back to an
--      approved-domain match, then to Jahangirnagar University, and swallows
--      every error so GoTrue can never be blocked by profile plumbing.
--   2. `profiles.student_id` was NOT NULL, which rejected faculty/alumni (and
--      first-time /signin) accounts that have no student id yet. hall_id,
--      department_id, student_id and program_session are all nullable now.
--   3. Any legacy CHECK constraint that rejects non-university email domains or
--      forces a residential hall on faculty/alumni is dropped.
--
-- Idempotent: safe to re-run. No data is rewritten or backfilled.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Nullable profile fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN hall_id DROP NOT NULL,
  ALTER COLUMN department_id DROP NOT NULL,
  ALTER COLUMN student_id DROP NOT NULL,
  ALTER COLUMN program_session DROP NOT NULL;

-- Older databases may predate the boolean verification flags.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.student_id IS
  'Student roll/registration number. NULL for faculty, alumni and accounts that have not completed onboarding yet.';
COMMENT ON COLUMN public.profiles.hall_id IS
  'Residential hall for students; NULL for faculty, alumni and other non-student accounts.';

-- ---------------------------------------------------------------------------
-- 2. Drop domain / hall CHECK constraints that contradict the role rules
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  candidate RECORD;
BEGIN
  FOR candidate IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
  LOOP
    -- A hall must never be mandatory for non-students …
    IF candidate.definition ILIKE '%hall_id%'
       AND candidate.definition ILIKE '%role%'
       AND candidate.definition ILIKE '%NOT NULL%' THEN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', candidate.conname);
      RAISE NOTICE '0026: dropped hall/role constraint %', candidate.conname;
    -- … and an email domain must never be restricted at the row level.
    ELSIF candidate.definition ILIKE '%email%'
          AND (candidate.definition ILIKE '%domain%'
               OR candidate.definition ILIKE '%juniv%'
               OR candidate.definition ILIKE '%ac.bd%'
               OR candidate.definition ILIKE '%.edu%'
               OR candidate.definition ILIKE '%gmail%') THEN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', candidate.conname);
      RAISE NOTICE '0026: dropped email-domain constraint %', candidate.conname;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Exception-safe profile bootstrap on auth.users insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meta              JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  normalized_email  TEXT  := lower(COALESCE(NEW.email, ''));
  email_domain      TEXT  := split_part(normalized_email, '@', 2);
  tenant_id         UUID;
  account_role      TEXT;
  hall              UUID;
  department        UUID;
  program           UUID;
  session_label     TEXT;
  display_name      TEXT;
  student_number    TEXT;
  verified          BOOLEAN;
BEGIN
  -- 3.1 The selected university always wins. A personal email domain can never
  --     infer a tenant, and a malformed metadata id must not raise.
  BEGIN
    tenant_id := NULLIF(meta->>'university_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    tenant_id := NULL;
  END;

  IF tenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.universities WHERE id = tenant_id
  ) THEN
    tenant_id := NULL;
  END IF;

  -- 3.2 Approved institutional domain (students, faculty on campus mail).
  IF tenant_id IS NULL AND email_domain <> '' THEN
    SELECT d.university_id INTO tenant_id
    FROM public.university_email_domains d
    JOIN public.universities u ON u.id = d.university_id
    WHERE lower(d.domain) = email_domain
      AND d.is_active
      AND u.is_active
    ORDER BY d.is_primary DESC, d.created_at
    LIMIT 1;
  END IF;

  -- 3.3 Documented last resort: Jahangirnagar University, then any active campus.
  IF tenant_id IS NULL THEN
    SELECT id INTO tenant_id FROM public.universities WHERE code = 'JU' LIMIT 1;
  END IF;
  IF tenant_id IS NULL THEN
    SELECT id INTO tenant_id FROM public.universities WHERE is_active ORDER BY created_at LIMIT 1;
  END IF;
  IF tenant_id IS NULL THEN
    -- Nothing to attach the profile to; the app provisions it after OTP.
    RETURN NEW;
  END IF;

  account_role := lower(COALESCE(NULLIF(meta->>'role', ''), 'student'));
  IF account_role NOT IN ('student', 'faculty', 'alumni', 'admin', 'governance') THEN
    account_role := 'student';
  END IF;

  BEGIN
    hall := NULLIF(meta->>'hall_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    hall := NULL;
  END;
  IF account_role <> 'student' THEN
    hall := NULL;
  ELSIF hall IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.university_halls WHERE id = hall AND university_id = tenant_id
  ) THEN
    hall := NULL;
  END IF;

  BEGIN
    department := NULLIF(meta->>'department_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    department := NULL;
  END;
  IF department IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.departments WHERE id = department
  ) THEN
    department := NULL;
  END IF;

  BEGIN
    program := NULLIF(meta->>'program_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    program := NULL;
  END;
  IF program IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_programs WHERE id = program
  ) THEN
    program := NULL;
  END IF;

  session_label := NULLIF(meta->>'program_session', '');
  IF session_label IS NOT NULL AND NOT (
    session_label ~ '^[0-9]{4}-[0-9]{2}$'
    AND (substring(session_label FROM 1 FOR 4)::INTEGER + 1) % 100
        = substring(session_label FROM 6 FOR 2)::INTEGER
  ) THEN
    session_label := NULL;
  END IF;

  display_name := COALESCE(
    NULLIF(btrim(meta->>'full_name'), ''),
    NULLIF(split_part(normalized_email, '@', 1), ''),
    'Campus Member'
  );
  student_number := NULLIF(btrim(COALESCE(meta->>'student_id', '')), '');
  verified := COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
              OR COALESCE(meta->>'email_verified', 'false') = 'true';

  -- 3.4 Complete the row if a profile already exists for this auth id.
  BEGIN
    INSERT INTO public.profiles (
      id, university_id, email, full_name, student_id, role,
      hall_id, department_id, program_id, program_session,
      trust_level, email_verified, onboarding_completed
    ) VALUES (
      NEW.id, tenant_id, normalized_email, display_name, student_number, account_role,
      hall, department, program, session_label,
      CASE WHEN verified THEN 'EMAIL_VERIFIED'::public.trust_level ELSE 'UNVERIFIED'::public.trust_level END,
      verified,
      session_label IS NOT NULL AND (account_role <> 'student' OR hall IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
      email             = EXCLUDED.email,
      university_id     = COALESCE(profiles.university_id, EXCLUDED.university_id),
      full_name         = COALESCE(NULLIF(btrim(profiles.full_name), ''), EXCLUDED.full_name),
      student_id        = COALESCE(profiles.student_id, EXCLUDED.student_id),
      role              = COALESCE(profiles.role, EXCLUDED.role),
      hall_id           = COALESCE(profiles.hall_id, EXCLUDED.hall_id),
      department_id     = COALESCE(profiles.department_id, EXCLUDED.department_id),
      program_id        = COALESCE(profiles.program_id, EXCLUDED.program_id),
      program_session   = COALESCE(profiles.program_session, EXCLUDED.program_session),
      email_verified    = profiles.email_verified OR EXCLUDED.email_verified,
      trust_level       = CASE
                            WHEN profiles.trust_level = 'UNVERIFIED'::public.trust_level
                            THEN EXCLUDED.trust_level
                            ELSE profiles.trust_level
                          END,
      updated_at        = now();
  EXCEPTION WHEN OTHERS THEN
    -- auth.users creation must NEVER fail because of profile plumbing.
    RAISE WARNING 'handle_new_user: profile bootstrap skipped (%): %', SQLSTATE, SQLERRM;
    RETURN NEW;
  END;

  -- 3.5 Application role row (idempotent, also non-fatal).
  BEGIN
    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (
      NEW.id, tenant_id,
      CASE account_role
        WHEN 'faculty'    THEN 'FACULTY'::public.app_role
        WHEN 'alumni'     THEN 'ALUMNI'::public.app_role
        WHEN 'admin'      THEN 'ADMIN'::public.app_role
        WHEN 'governance' THEN 'GOVERNANCE'::public.app_role
        ELSE 'STUDENT'::public.app_role
      END
    )
    ON CONFLICT (user_id, university_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: role assignment skipped (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Profile bootstrap for new auth users. Reads university_id from raw_user_meta_data first, then approved email domains, then Jahangirnagar University. Never raises: a profile failure must not abort auth.users creation.';

-- Attach the trigger. Supabase owns auth.users by supabase_auth_admin; if this
-- migration role cannot attach triggers there, the function above is still
-- installed and the OTP routes provision the profile themselves.
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
    RAISE NOTICE '0026: on_auth_user_created attached to auth.users';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE '0026: cannot attach on_auth_user_created (%); OTP routes provision profiles directly', SQLERRM;
  END;
END;
$$;

-- PostgREST must see the nullability change immediately.
NOTIFY pgrst, 'reload_schema';

COMMIT;
