-- supabase/seed/seed_quick_demo_accounts.sql
-- ============================================================================
-- One-click demo identities for the "Quick Demo Login" panel on /signin.
--
-- Four accounts, one per role, on `@demo.campus360.bd` (scoped to JU + IIT):
--
--   student@demo.campus360.bd   -> STUDENT
--   faculty@demo.campus360.bd   -> FACULTY
--   admin@demo.campus360.bd     -> ADMIN + UNIVERSITY_ADMIN + SUPER_ADMIN
--   alumni@demo.campus360.bd    -> ALUMNI
--
-- Every account uses the verified hardcoded bcrypt hash of Demo#1234 (cost 10,
-- $2a$) and explicitly populates GoTrue's non-nullable string token columns
-- plus auth.identities (`provider = 'email'`, `provider_id = user.id::text`).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Verified bcrypt("Demo#1234"), cost 10.
  v_demo_password TEXT := '$2a$10$mU/SOdhpTcfA2Dn8cLJp6.wlPQ6KRQNnQ4qPVPlhPzgbiY9xltN1C';
  v_university_id UUID;
  v_department_id UUID;
  v_hall_id UUID;
  v_user_id UUID;
  v_account RECORD;
  v_app_role app_role;
  v_meta JSONB;
  v_user_meta JSONB;
BEGIN
  SELECT id INTO v_university_id FROM public.universities WHERE code = 'JU';
  IF v_university_id IS NULL THEN
    SELECT id INTO v_university_id FROM public.universities WHERE code = 'DU';
  END IF;
  IF v_university_id IS NULL THEN
    RAISE EXCEPTION 'seed_quick_demo_accounts: JU or DU must be seeded first (supabase/seed/seed.sql)';
  END IF;

  SELECT d.id INTO v_department_id
  FROM public.departments d
  WHERE d.university_id = v_university_id AND d.code IN ('IIT', 'CSE')
  ORDER BY CASE WHEN d.code = 'IIT' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT h.id INTO v_hall_id
  FROM public.university_halls h
  WHERE h.university_id = v_university_id AND h.type = 'RESIDENTIAL'
  ORDER BY h.name
  LIMIT 1;

  FOR v_account IN
    SELECT * FROM (
      VALUES
        ('student', 'student@demo.campus360.bd', 'Demo Student', 'STUDENT'::app_role, 'JU-2026-0101', false),
        ('faculty', 'faculty@demo.campus360.bd', 'Demo Faculty', 'FACULTY'::app_role, 'JU-FAC-0102', false),
        ('admin', 'admin@demo.campus360.bd', 'Demo Admin', 'ADMIN'::app_role, 'JU-ADM-0103', true),
        ('alumni', 'alumni@demo.campus360.bd', 'Demo Alumni', 'ALUMNI'::app_role, 'JU-ALM-0104', false)
    ) AS t(role, email, full_name, app_role, student_id, is_platform_admin)
  LOOP
    v_app_role := v_account.app_role;
    v_meta := jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', v_account.role,
      'is_demo', true,
      'is_platform_admin', v_account.is_platform_admin
    );
    v_user_meta := jsonb_build_object(
      'university_code', 'JU',
      'department_code', 'IIT',
      'full_name', v_account.full_name,
      'name', v_account.full_name,
      'role', v_account.role,
      'email_verified', true,
      'is_demo', true
    );

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_account.email);
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, aud, role,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token,
        email_change_confirm_status, is_sso_user, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_user_id,
        v_account.email,
        v_demo_password,
        now(), now(), now(),
        v_meta,
        v_user_meta || jsonb_build_object('sub', v_user_id::text, 'email', v_account.email),
        'authenticated',
        'authenticated',
        '', '', '', '', '', '', '', '',
        0, false, false
      );
    ELSE
      UPDATE auth.users
      SET instance_id = '00000000-0000-0000-0000-000000000000'::uuid,
          encrypted_password = v_demo_password,
          raw_app_meta_data = v_meta,
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_user_meta,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          confirmation_token = '',
          recovery_token = '',
          email_change_token_new = '',
          email_change = '',
          phone_change = '',
          phone_change_token = '',
          email_change_token_current = '',
          reauthentication_token = '',
          email_change_confirm_status = 0,
          updated_at = now()
      WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (
      id, university_id, department_id, hall_id, email, full_name, student_id,
      batch, trust_level, onboarding_completed
    ) VALUES (
      v_user_id,
      v_university_id,
      v_department_id,
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
          department_id = COALESCE(EXCLUDED.department_id, public.profiles.department_id),
          hall_id = COALESCE(EXCLUDED.hall_id, public.profiles.hall_id),
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          student_id = EXCLUDED.student_id,
          trust_level = EXCLUDED.trust_level,
          onboarding_completed = true,
          updated_at = now();

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (v_user_id, v_university_id, v_app_role)
    ON CONFLICT (user_id, university_id, role) DO NOTHING;

    IF v_account.is_platform_admin THEN
      INSERT INTO public.user_roles (user_id, university_id, role)
      VALUES
        (v_user_id, v_university_id, 'UNIVERSITY_ADMIN'::app_role),
        (v_user_id, v_university_id, 'SUPER_ADMIN'::app_role)
      ON CONFLICT (user_id, university_id, role) DO NOTHING;
    END IF;

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('email', v_account.email, 'email_verified', true, 'sub', v_user_id::text),
      'email',
      now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          identity_data = EXCLUDED.identity_data,
          updated_at = now();
  END LOOP;

  RAISE NOTICE 'Quick demo accounts ready (student/faculty/admin/alumni@demo.campus360.bd) — password Demo#1234';
END $$;

COMMIT;
