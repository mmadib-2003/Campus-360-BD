-- supabase/seed/seed_users_demo_accounts.sql
-- ============================================================================
-- Canonical demo accounts — one student, one platform admin and one governance
-- account per university for DU, BUET, SUST, RU and CU (success criterion 1).
--
-- Every account uses the password-based credential  Demo#1234  (bcrypt via
-- pgcrypto) so the DevSignInPanel on /signin can use signInWithPassword and
-- bypass the Supabase email OTP limits (2 emails/hour, team inboxes only)
-- entirely. Track A (custom SMTP) and Track B (demo OTP) cover OTP flows.
--
-- Emails follow  {role}.{code}@{primary domain}:
--   student.du@du.ac.bd        admin.du@du.ac.bd        governance.du@du.ac.bd
--   student.buet@buet.ac.bd    admin.buet@buet.ac.bd    governance.buet@buet.ac.bd
--   student.sust@sust.edu      admin.sust@sust.edu      governance.sust@sust.edu
--   student.ru@ru.ac.bd        admin.ru@ru.ac.bd        governance.ru@ru.ac.bd
--   student.cu@cu.ac.bd        admin.cu@cu.ac.bd        governance.cu@cu.ac.bd
--
-- Platform admins carry the  is_platform_admin  JWT claim (read by
-- public.is_platform_admin() in migration 0010) so /admin/panel bypasses
-- tenant isolation. Governance accounts are scoped to their own university.
--
-- ⚠️  Never run this against production with a publicly known password.
-- Runs after seed.sql + seed_university_halls.sql. Idempotent.
--
-- Every account also gets an auth.identities row: GoTrue's password grant
-- resolves the email through auth.identities, so auth.users alone is not
-- enough for signInWithPassword to work.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_demo_password TEXT := crypt('Demo#1234', gen_salt('bf'));
  v_univ RECORD;
  v_role TEXT;
  v_email TEXT;
  v_user_id UUID;
  v_hall_id UUID;
  v_full_name TEXT;
  v_student_id TEXT;
  v_meta JSONB;
BEGIN
  FOR v_univ IN
    SELECT id, code FROM public.universities WHERE code IN ('DU', 'BUET', 'SUST', 'RU', 'CU')
  LOOP
    FOR v_role IN SELECT * FROM unnest(ARRAY['student', 'admin', 'governance'])
    LOOP
      v_email := v_role || '.' || lower(v_univ.code) || '@' ||
        (SELECT d.domain FROM public.university_email_domains d
         WHERE d.university_id = v_univ.id AND d.is_primary
         LIMIT 1);

      IF v_email LIKE '%@' THEN
        CONTINUE; -- university domain not seeded
      END IF;

      -- A real residential hall for student profiles.
      SELECT h.id INTO v_hall_id
      FROM public.university_halls h
      WHERE h.university_id = v_univ.id AND h.type = 'RESIDENTIAL'
      ORDER BY h.name
      LIMIT 1;

      v_full_name := CASE v_role
        WHEN 'student'    THEN 'Demo Student (' || v_univ.code || ')'
        WHEN 'admin'      THEN 'Platform Admin (' || v_univ.code || ')'
        ELSE 'University Governance (' || v_univ.code || ')'
      END;
      v_student_id := CASE v_role
        WHEN 'student'    THEN v_univ.code || '-2026-12345'
        WHEN 'admin'      THEN v_univ.code || '-ADM-001'
        ELSE v_univ.code || '-GOV-001'
      END;
      v_meta := CASE v_role
        WHEN 'admin' THEN jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'is_platform_admin', true)
        ELSE jsonb_build_object('provider', 'email', 'providers', ARRAY['email'])
      END;

      SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
      IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
        VALUES (
          v_user_id,
          v_email,
          v_demo_password,
          now(), now(), now(),
          v_meta,
          jsonb_build_object('university_code', v_univ.code, 'full_name', v_full_name),
          'authenticated',
          'authenticated'
        );
      ELSE
        UPDATE auth.users
        SET encrypted_password = v_demo_password,
            raw_app_meta_data = v_meta,
            email_confirmed_at = COALESCE(email_confirmed_at, now())
        WHERE id = v_user_id;
      END IF;

      INSERT INTO public.profiles (
        id, university_id, hall_id, email, full_name, student_id,
        batch, trust_level, onboarding_completed
      )
      VALUES (
        v_user_id,
        v_univ.id,
        CASE WHEN v_role = 'student' THEN v_hall_id ELSE NULL END,
        v_email,
        v_full_name,
        v_student_id,
        '51st Batch',
        'ID_VERIFIED',
        true
      )
      ON CONFLICT (id) DO UPDATE
        SET hall_id = EXCLUDED.hall_id,
            trust_level = EXCLUDED.trust_level,
            onboarding_completed = EXCLUDED.onboarding_completed;

      INSERT INTO public.user_roles (user_id, university_id, role)
      VALUES (
        v_user_id,
        v_univ.id,
        CASE v_role
          WHEN 'student'    THEN 'STUDENT'::app_role
          WHEN 'admin'      THEN 'ADMIN'::app_role
          ELSE 'GOVERNANCE'::app_role
        END
      )
      ON CONFLICT (user_id, university_id, role) DO NOTHING;

      -- GoTrue resolves the email through auth.identities for the password
      -- grant. Without this row signInWithPassword returns "Invalid login
      -- credentials" even though auth.users has the right bcrypt hash.
      INSERT INTO auth.identities (
        user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_user_id,
        v_user_id::text,
        jsonb_build_object('email', v_email, 'email_verified', true, 'sub', v_user_id::text),
        'email',
        now(), now(), now()
      )
      ON CONFLICT (provider_id, provider) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Demo accounts ready — password for all: Demo#1234';
END $$;

COMMIT;
