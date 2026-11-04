-- supabase/seed/seed_quick_demo_accounts.sql
-- ============================================================================
-- One-click demo identities for the "Quick Demo Login" panel on /signin.
--
-- Four accounts, one per role, on the reserved (never-deliverable) domain
-- `demo.campus360.test`:
--
--   student@demo.campus360.test   → STUDENT
--   faculty@demo.campus360.test   → FACULTY
--   admin@demo.campus360.test     → ADMIN (+ is_platform_admin claim)
--   alumni@demo.campus360.test    → ALUMNI
--
-- Every account uses the SAME hardcoded bcrypt hash, which is the hash of the
-- known password  Demo#1234  (cost 10, $2a$). It is hardcoded on purpose so a
-- fresh preview does not need to compute a hash at seed time and so the
-- /signin buttons can document the password. This is demo data only — never
-- run this seed against a production project with real users.
--
-- IMPORTANT: the seed also inserts an `auth.identities` row for every account.
-- GoTrue's password grant resolves the email through auth.identities; a user
-- that exists only in auth.users gets "Invalid login credentials" even with a
-- correct password. The identity row is what makes the one-click login work.
--
-- Idempotent: re-running updates the password/profile and keeps the same
-- auth.users id. Requires migration 0015 (ALUMNI enum value) and seed.sql (DU).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- bcrypt("Demo#1234"), cost 10. Verified with bcryptjs compareSync.
  v_demo_password TEXT := '$2a$10$QsYfRPv60gPCkvVDIlYO7u8dvdYGUJ4dbuhViCIpcXIJWCw69ZBwu';
  v_university_id UUID;
  v_hall_id UUID;
  v_user_id UUID;
  v_account RECORD;
  v_app_role app_role;
  v_meta JSONB;
BEGIN
  SELECT id INTO v_university_id FROM public.universities WHERE code = 'DU';
  IF v_university_id IS NULL THEN
    RAISE EXCEPTION 'seed_quick_demo_accounts: DU must be seeded first (supabase/seed/seed.sql)';
  END IF;

  SELECT h.id INTO v_hall_id
  FROM public.university_halls h
  WHERE h.university_id = v_university_id AND h.type = 'RESIDENTIAL'
  ORDER BY h.name
  LIMIT 1;

  FOR v_account IN
    SELECT * FROM (
      VALUES
        ('student', 'student@demo.campus360.test', 'Demo Student', 'STUDENT'::app_role, 'DU-2026-12345', false),
        ('faculty', 'faculty@demo.campus360.test', 'Demo Faculty', 'FACULTY'::app_role, 'DU-FAC-0142', false),
        ('admin', 'admin@demo.campus360.test', 'Demo Admin', 'ADMIN'::app_role, 'DU-ADM-001', true),
        ('alumni', 'alumni@demo.campus360.test', 'Demo Alumni', 'ALUMNI'::app_role, 'DU-ALM-2019-088', false)
    ) AS t(role, email, full_name, app_role, student_id, is_platform_admin)
  LOOP
    v_app_role := v_account.app_role;
    v_meta := CASE
      WHEN v_account.is_platform_admin
        THEN jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'is_platform_admin', true)
      ELSE jsonb_build_object('provider', 'email', 'providers', ARRAY['email'])
    END;

    SELECT id INTO v_user_id FROM auth.users WHERE email = v_account.email;
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, aud, role
      ) VALUES (
        v_user_id,
        v_account.email,
        v_demo_password,
        now(), now(), now(),
        v_meta,
        jsonb_build_object('university_code', 'DU', 'full_name', v_account.full_name),
        'authenticated',
        'authenticated'
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = v_demo_password,
          raw_app_meta_data = v_meta,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (
      id, university_id, hall_id, email, full_name, student_id,
      batch, trust_level, onboarding_completed
    ) VALUES (
      v_user_id,
      v_university_id,
      CASE WHEN v_account.role = 'student' THEN v_hall_id ELSE NULL END,
      v_account.email,
      v_account.full_name,
      v_account.student_id,
      '51st Batch',
      'ID_VERIFIED',
      true
    )
    ON CONFLICT (id) DO UPDATE
      SET university_id = EXCLUDED.university_id,
          hall_id = EXCLUDED.hall_id,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          student_id = EXCLUDED.student_id,
          trust_level = EXCLUDED.trust_level,
          onboarding_completed = true,
          updated_at = now();

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (v_user_id, v_university_id, v_app_role)
    ON CONFLICT (user_id, university_id, role) DO NOTHING;

    -- GoTrue's password grant looks the user up through auth.identities.
    -- A row in auth.users alone is NOT enough: signInWithPassword returns
    -- "Invalid login credentials" for a user with no email identity. This
    -- insert is what makes the one-click buttons work on a fresh project.
    INSERT INTO auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id,
      v_user_id::text,
      jsonb_build_object('email', v_account.email, 'email_verified', true, 'sub', v_user_id::text),
      'email',
      now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Quick demo accounts ready (student/faculty/admin/alumni@demo.campus360.test) — password Demo#1234';
END $$;

COMMIT;
