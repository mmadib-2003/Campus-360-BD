-- Repair the four public showcase identities if profiles or role links were
-- lost/mismatched. Safe to re-run; does not modify auth credentials.
DO $$
DECLARE
  v_university_id UUID;
  v_hall_id UUID;
  v_user RECORD;
BEGIN
  SELECT id INTO v_university_id FROM public.universities WHERE code = 'DU';
  IF v_university_id IS NULL THEN
    RAISE EXCEPTION 'DU university row is required to repair demo profiles';
  END IF;

  SELECT h.id INTO v_hall_id
  FROM public.university_halls h
  WHERE h.university_id = v_university_id AND h.type = 'RESIDENTIAL'
  ORDER BY h.name LIMIT 1;

  FOR v_user IN
    SELECT * FROM (VALUES
      ('student@demo.campus360.test', 'Demo Student', 'DU-2026-12345', 'STUDENT'::app_role, true),
      ('faculty@demo.campus360.test', 'Demo Faculty', 'DU-FAC-0142', 'FACULTY'::app_role, false),
      ('admin@demo.campus360.test', 'Demo Admin', 'DU-ADM-001', 'ADMIN'::app_role, false),
      ('alumni@demo.campus360.test', 'Demo Alumni', 'DU-ALM-2019-088', 'ALUMNI'::app_role, false)
    ) AS t(email, full_name, student_id, role, needs_hall)
  LOOP
    -- Users not provisioned in Auth are intentionally skipped; the original
    -- account migration is responsible for inserting those identities.
    PERFORM 1 FROM auth.users WHERE email = v_user.email;
    IF FOUND THEN
      INSERT INTO public.profiles (
        id, university_id, hall_id, email, full_name, student_id,
        batch, trust_level, onboarding_completed
      )
      SELECT u.id, v_university_id,
             CASE WHEN v_user.needs_hall THEN v_hall_id ELSE NULL END,
             v_user.email, v_user.full_name, v_user.student_id,
             '51st Batch', 'ID_VERIFIED', true
      FROM auth.users u WHERE u.email = v_user.email
      ON CONFLICT (id) DO UPDATE SET
        university_id = EXCLUDED.university_id,
        hall_id = EXCLUDED.hall_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        student_id = EXCLUDED.student_id,
        trust_level = EXCLUDED.trust_level,
        onboarding_completed = true,
        updated_at = now();

      DELETE FROM public.user_roles ur
      USING auth.users u
      WHERE u.id = ur.user_id AND u.email = v_user.email
        AND (ur.university_id <> v_university_id OR ur.role <> v_user.role);

      INSERT INTO public.user_roles (user_id, university_id, role)
      SELECT u.id, v_university_id, v_user.role
      FROM auth.users u WHERE u.email = v_user.email
      ON CONFLICT (user_id, university_id, role) DO NOTHING;
    END IF;
  END LOOP;
END $$;
