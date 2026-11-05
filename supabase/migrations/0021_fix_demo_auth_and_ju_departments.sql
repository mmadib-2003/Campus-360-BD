-- supabase/migrations/0021_fix_demo_auth_and_ju_departments.sql
-- ============================================================================
-- End-to-end production repair for:
--   1. Quick Demo Login (@demo.campus360.bd) across student, faculty, admin,
--      and alumni roles (GoTrue NULL-token scan repair, verified bcrypt hash,
--      auth.identities email provider rows, verified JU + IIT profiles & roles).
--   2. Jahangirnagar University (JU) official 38 academic units (4 Institutes
--      + 34 Departments across 6 Faculties) and degree programs.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Ensure compatibility columns exist on public.profiles
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE public.profiles
SET email_verified = TRUE,
    is_verified = TRUE
WHERE trust_level IN ('EMAIL_VERIFIED', 'ID_VERIFIED')
  AND (email_verified = FALSE OR is_verified = FALSE);

-- ----------------------------------------------------------------------------
-- 2. Repair ALL existing auth.users rows against GoTrue NULL-column scan panics
--    and replace any corrupted placeholder password hash from migration 0018.
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET instance_id                 = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'::uuid),
    aud                         = COALESCE(NULLIF(aud, ''), 'authenticated'),
    role                        = COALESCE(NULLIF(role, ''), 'authenticated'),
    confirmation_token          = COALESCE(confirmation_token, ''),
    recovery_token              = COALESCE(recovery_token, ''),
    email_change_token_new      = COALESCE(email_change_token_new, ''),
    email_change                = COALESCE(email_change, ''),
    phone_change                = COALESCE(phone_change, ''),
    phone_change_token          = COALESCE(phone_change_token, ''),
    email_change_token_current  = COALESCE(email_change_token_current, ''),
    reauthentication_token      = COALESCE(reauthentication_token, ''),
    email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
    encrypted_password          = CASE
      WHEN encrypted_password = '$2a$10$f7yA90743Q3nB3T79E57B.mJ2kL7i568D9Q72P87G87U12n7I2O2e'
        THEN '$2a$10$mU/SOdhpTcfA2Dn8cLJp6.wlPQ6KRQNnQ4qPVPlhPzgbiY9xltN1C'
      ELSE encrypted_password
    END;

-- ----------------------------------------------------------------------------
-- 3. Ensure JU-relevant degree programs exist in public.academic_programs
-- ----------------------------------------------------------------------------
INSERT INTO public.academic_programs (code, name_en, name_bn, cycle, duration_years, sort_order) VALUES
  ('HONORS',             'Bachelor''s (Honors — B.Sc. / B.A. / B.S.S.)', 'অনার্স (বিএসসি / বিএ / বিএসএস সম্মান)',         'UNDERGRADUATE', 4, 10),
  ('BBA',                'Bachelor of Business Administration (B.B.A.)', 'ব্যাচেলর অব বিজনেস অ্যাডমিনিস্ট্রেশন (বিবিএ)', 'UNDERGRADUATE', 4, 15),
  ('LLB_HONORS',         'Bachelor of Laws — LL.B. (Honors)',            'আইন স্নাতক — এলএলবি (সম্মান)',                'UNDERGRADUATE', 4, 18),
  ('ENGINEERING_BSC',    'B.Sc. in Engineering',                         'প্রকৌশলে বিএসসি',                             'UNDERGRADUATE', 4, 30),
  ('PHARMACY',           'Bachelor of Pharmacy (B.Pharm Honors)',        'ফার্মেসি স্নাতক (বি.ফার্ম সম্মান)',            'UNDERGRADUATE', 4, 90),
  ('MASTERS',            'Master''s (M.Sc. / M.A. / M.S.S.)',            'স্নাতকোত্তর (এমএসসি / এমএ / এমএসএস)',         'GRADUATE',      1, 100),
  ('MBA',                'M.B.A. / E.M.B.A. / M.P.A.',                   'এমবিএ / ইএমবিএ / এমপিএ',                      'GRADUATE',      2, 105),
  ('LLM',                'Master of Laws (LL.M.)',                       'আইন স্নাতকোত্তর (এলএলএম)',                    'GRADUATE',      1, 108),
  ('MPHIL',              'Master of Philosophy (M.Phil.)',               'এম.ফিল. (গবেষণা)',                             'GRADUATE',      2, 115),
  ('PG_DIPLOMA',         'Post-Graduate Diploma (PGDIT / PGD)',          'স্নাতকোত্তর ডিপ্লোমা (পিজিডিআইটি / পিজিডি)',  'DIPLOMA',       1, 120),
  ('PHD',                'Ph.D. / Doctorate',                            'পিএইচডি (ডক্টরেট)',                           'DOCTORAL',      4, 140)
ON CONFLICT (code) DO UPDATE
  SET name_en        = EXCLUDED.name_en,
      name_bn        = EXCLUDED.name_bn,
      cycle          = EXCLUDED.cycle,
      duration_years = EXCLUDED.duration_years,
      sort_order     = EXCLUDED.sort_order;

-- ----------------------------------------------------------------------------
-- 4. Upsert the exact 38 official academic units of Jahangirnagar University
--    (4 Institutes + 34 Departments across 6 Faculties) and prune non-official
--    JU departments safely after re-pointing foreign keys.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_ju_id  UUID;
  v_iit_id UUID;
BEGIN
  SELECT id INTO v_ju_id FROM public.universities WHERE code = 'JU';
  IF v_ju_id IS NULL THEN
    INSERT INTO public.universities (code, name_en, name_bn, category, city, lat, lng, is_active)
    VALUES ('JU', 'Jahangirnagar University', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'GENERAL', 'Savar, Dhaka', 23.8791, 90.2674, TRUE)
    RETURNING id INTO v_ju_id;
  END IF;

  INSERT INTO public.departments (university_id, code, name_en, name_bn, faculty_en, faculty_bn)
  VALUES
    -- Institutes (4)
    (v_ju_id, 'IIT',    'Institute of Information Technology (IIT)',          'তথ্যপ্রযুক্তি ইনস্টিটিউট (আইআইটি)',                  'Institutes',                                      'ইনস্টিটিউটসমূহ'),
    (v_ju_id, 'IBA-JU', 'Institute of Business Administration (IBA-JU)',      'ব্যবসায় প্রশাসন ইনস্টিটিউট (আইবিএ-জাবি)',            'Institutes',                                      'ইনস্টিটিউটসমূহ'),
    (v_ju_id, 'ICLC',   'Institute of Comparative Literature and Culture',    'তুলনামূলক সাহিত্য ও সংস্কৃতি ইনস্টিটিউট',             'Institutes',                                      'ইনস্টিটিউটসমূহ'),
    (v_ju_id, 'IRS',    'Institute of Remote Sensing and GIS',                'রিমোট সেন্সিং ও জিআইএস ইনস্টিটিউট',                  'Institutes',                                      'ইনস্টিটিউটসমূহ'),

    -- Faculty of Mathematical and Physical Sciences (7)
    (v_ju_id, 'CSE',    'Computer Science and Engineering',                   'কম্পিউটার বিজ্ঞান ও প্রকৌশল',                        'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'MATH',   'Mathematics',                                        'গণিত',                                               'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'PHY',    'Physics',                                            'পদার্থবিজ্ঞান',                                       'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'CHEM',   'Chemistry',                                          'রসায়ন',                                             'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'STAT',   'Statistics and Data Science',                        'পরিসংখ্যান ও উপাত্ত বিজ্ঞান',                         'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'ENV',    'Environmental Sciences',                             'পরিবেশ বিজ্ঞান',                                      'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    (v_ju_id, 'GEOL',   'Geological Sciences',                                'ভূতাত্ত্বিক বিজ্ঞান',                                 'Faculty of Mathematical and Physical Sciences',   'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),

    -- Faculty of Biological Sciences (7)
    (v_ju_id, 'BOT',    'Botany',                                             'উদ্ভিদবিজ্ঞান',                                       'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'ZOO',    'Zoology',                                            'প্রাণিবিদ্যা',                                        'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'BMB',    'Biochemistry and Molecular Biology',                 'প্রাণরসায়ন ও অনুপ্রাণ বিজ্ঞান',                      'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'PHARM',  'Pharmacy',                                           'ফার্মেসি',                                            'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'MIB',    'Microbiology',                                       'মাইক্রোবায়োলজি',                                      'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'BGE',    'Biotechnology and Genetic Engineering',              'বায়োটেকনোলজি অ্যান্ড জেনেটিক ইঞ্জিনিয়ারিং',          'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),
    (v_ju_id, 'PHI',    'Public Health and Informatics',                      'পাবলিক হেলথ অ্যান্ড ইনফরমেটিক্স',                    'Faculty of Biological Sciences',                  'জীববিজ্ঞান অনুষদ'),

    -- Faculty of Social Sciences (6)
    (v_ju_id, 'ECON',   'Economics',                                          'অর্থনীতি',                                           'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),
    (v_ju_id, 'GEOG',   'Geography and Environment',                          'ভূগোল ও পরিবেশ',                                     'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),
    (v_ju_id, 'GOVP',   'Government and Politics',                            'সরকার ও রাজনীতি',                                    'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),
    (v_ju_id, 'ANTH',   'Anthropology',                                       'নৃবিজ্ঞান',                                          'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),
    (v_ju_id, 'URP',    'Urban and Regional Planning',                        'নগর ও অঞ্চল পরিকল্পনা',                               'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),
    (v_ju_id, 'PAD',    'Public Administration',                              'লোকপ্রশাসন',                                         'Faculty of Social Sciences',                      'সমাজবিজ্ঞান অনুষদ'),

    -- Faculty of Arts and Humanities (9)
    (v_ju_id, 'BAN',    'Bangla',                                             'বাংলা',                                              'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'ENG',    'English',                                            'ইংরেজি',                                             'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'HIST',   'History',                                            'ইতিহাস',                                             'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'PHIL',   'Philosophy',                                         'দর্শন',                                              'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'DRAMA',  'Drama and Dramatics',                                'নাটক ও নাট্যতত্ত্ব',                                  'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'ARCH',   'Archaeology',                                        'প্রত্নতত্ত্ব',                                        'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'IR',     'International Relations',                            'আন্তর্জাতিক সম্পর্ক',                                 'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'JMS',    'Journalism and Media Studies',                       'জার্নালিজম অ্যান্ড মিডিয়া স্টাডিজ',                  'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),
    (v_ju_id, 'FA',     'Fine Arts',                                          'চারুকলা',                                            'Faculty of Arts and Humanities',                  'কলা ও মানবিকী অনুষদ'),

    -- Faculty of Business Studies (4)
    (v_ju_id, 'FIN',    'Finance and Banking',                                'ফিন্যান্স অ্যান্ড ব্যাংকিং',                          'Faculty of Business Studies',                     'বিজনেস স্টাডিজ অনুষদ'),
    (v_ju_id, 'MKT',    'Marketing',                                          'মার্কেটিং',                                           'Faculty of Business Studies',                     'বিজনেস স্টাডিজ অনুষদ'),
    (v_ju_id, 'AIS',    'Accounting and Information Systems',                 'অ্যাকাউন্টিং অ্যান্ড ইনফরমেশন সিস্টেমস',              'Faculty of Business Studies',                     'বিজনেস স্টাডিজ অনুষদ'),
    (v_ju_id, 'MGT',    'Management Studies',                                 'ম্যানেজমেন্ট স্টাডিজ',                                'Faculty of Business Studies',                     'বিজনেস স্টাডিজ অনুষদ'),

    -- Faculty of Law (1)
    (v_ju_id, 'LAW',    'Law and Justice',                                    'আইন ও বিচার',                                        'Faculty of Law',                                  'আইন অনুষদ')
  ON CONFLICT (university_id, code) DO UPDATE
    SET name_en    = EXCLUDED.name_en,
        name_bn    = EXCLUDED.name_bn,
        faculty_en = EXCLUDED.faculty_en,
        faculty_bn = EXCLUDED.faculty_bn,
        updated_at = now();

  SELECT id INTO v_iit_id
  FROM public.departments
  WHERE university_id = v_ju_id AND code = 'IIT';

  -- Re-point any JU academic_files (ON DELETE RESTRICT) and JU profiles on
  -- non-official JU departments to IIT before deleting obsolete JU rows.
  UPDATE public.academic_files af
  SET department_id = v_iit_id
  WHERE af.university_id = v_ju_id
    AND af.department_id IN (
      SELECT d.id
      FROM public.departments d
      WHERE d.university_id = v_ju_id
        AND d.code NOT IN (
          'IIT', 'IBA-JU', 'ICLC', 'IRS',
          'CSE', 'MATH', 'PHY', 'CHEM', 'STAT', 'ENV', 'GEOL',
          'BOT', 'ZOO', 'BMB', 'PHARM', 'MIB', 'BGE', 'PHI',
          'ECON', 'GEOG', 'GOVP', 'ANTH', 'URP', 'PAD',
          'BAN', 'ENG', 'HIST', 'PHIL', 'DRAMA', 'ARCH', 'IR', 'JMS', 'FA',
          'FIN', 'MKT', 'AIS', 'MGT',
          'LAW'
        )
    );

  UPDATE public.profiles p
  SET department_id = v_iit_id
  WHERE p.department_id IN (
    SELECT d.id
    FROM public.departments d
    WHERE d.university_id = v_ju_id
      AND d.code NOT IN (
        'IIT', 'IBA-JU', 'ICLC', 'IRS',
        'CSE', 'MATH', 'PHY', 'CHEM', 'STAT', 'ENV', 'GEOL',
        'BOT', 'ZOO', 'BMB', 'PHARM', 'MIB', 'BGE', 'PHI',
        'ECON', 'GEOG', 'GOVP', 'ANTH', 'URP', 'PAD',
        'BAN', 'ENG', 'HIST', 'PHIL', 'DRAMA', 'ARCH', 'IR', 'JMS', 'FA',
        'FIN', 'MKT', 'AIS', 'MGT',
        'LAW'
      )
  );

  DELETE FROM public.departments
  WHERE university_id = v_ju_id
    AND code NOT IN (
      'IIT', 'IBA-JU', 'ICLC', 'IRS',
      'CSE', 'MATH', 'PHY', 'CHEM', 'STAT', 'ENV', 'GEOL',
      'BOT', 'ZOO', 'BMB', 'PHARM', 'MIB', 'BGE', 'PHI',
      'ECON', 'GEOG', 'GOVP', 'ANTH', 'URP', 'PAD',
      'BAN', 'ENG', 'HIST', 'PHIL', 'DRAMA', 'ARCH', 'IR', 'JMS', 'FA',
      'FIN', 'MKT', 'AIS', 'MGT',
      'LAW'
    );
END $$;

-- ----------------------------------------------------------------------------
-- 5. Provision & repair the 4 Quick Demo Login accounts (@demo.campus360.bd)
--    plus keep @demo.campus360.test aliases aligned to JU + IIT.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_pw_hash CONSTANT TEXT := '$2a$10$mU/SOdhpTcfA2Dn8cLJp6.wlPQ6KRQNnQ4qPVPlhPzgbiY9xltN1C';
  v_ju_id     UUID;
  v_iit_id    UUID;
  v_hall_id   UUID;
  v_uid       UUID;
  v_app_meta  JSONB;
  v_user_meta JSONB;
  v_row       RECORD;
BEGIN
  SELECT id INTO v_ju_id FROM public.universities WHERE code = 'JU';
  SELECT id INTO v_iit_id FROM public.departments WHERE university_id = v_ju_id AND code = 'IIT';
  SELECT id INTO v_hall_id
  FROM public.university_halls
  WHERE university_id = v_ju_id AND is_active = TRUE
  ORDER BY name
  LIMIT 1;

  FOR v_row IN
    SELECT * FROM (
      VALUES
        ('d0000000-0000-4000-8000-000000000101'::uuid, 'student@demo.campus360.bd',   'Demo Student', 'student', 'STUDENT'::app_role, 'JU-2026-0101', FALSE),
        ('d0000000-0000-4000-8000-000000000102'::uuid, 'faculty@demo.campus360.bd',   'Demo Faculty', 'faculty', 'FACULTY'::app_role, 'JU-FAC-0102',  FALSE),
        ('d0000000-0000-4000-8000-000000000103'::uuid, 'admin@demo.campus360.bd',     'Demo Admin',   'admin',   'ADMIN'::app_role,   'JU-ADM-0103',  TRUE),
        ('d0000000-0000-4000-8000-000000000104'::uuid, 'alumni@demo.campus360.bd',    'Demo Alumni',  'alumni',  'ALUMNI'::app_role,  'JU-ALM-0104',  FALSE),
        ('d0000000-0000-4000-8000-000000000001'::uuid, 'student@demo.campus360.test', 'Demo Student', 'student', 'STUDENT'::app_role, 'JU-2026-0001', FALSE),
        ('d0000000-0000-4000-8000-000000000002'::uuid, 'faculty@demo.campus360.test', 'Demo Faculty', 'faculty', 'FACULTY'::app_role, 'JU-FAC-0002',  FALSE),
        ('d0000000-0000-4000-8000-000000000003'::uuid, 'admin@demo.campus360.test',   'Demo Admin',   'admin',   'ADMIN'::app_role,   'JU-ADM-0003',  TRUE),
        ('d0000000-0000-4000-8000-000000000004'::uuid, 'alumni@demo.campus360.test',  'Demo Alumni',  'alumni',  'ALUMNI'::app_role,  'JU-ALM-0004',  FALSE)
    ) AS t(default_id, email, full_name, role_slug, app_role, student_id, is_admin)
  LOOP
    v_app_meta := jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', v_row.role_slug,
      'is_demo', TRUE,
      'is_platform_admin', v_row.is_admin
    );

    v_user_meta := jsonb_build_object(
      'sub', v_row.default_id::text,
      'email', v_row.email,
      'full_name', v_row.full_name,
      'name', v_row.full_name,
      'role', v_row.role_slug,
      'university_code', 'JU',
      'department_code', 'IIT',
      'email_verified', TRUE,
      'phone_verified', FALSE,
      'is_demo', TRUE
    );

    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_row.email) LIMIT 1;

    IF v_uid IS NULL THEN
      v_uid := v_row.default_id;
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        phone_change,
        phone_change_token,
        email_change_token_current,
        reauthentication_token,
        email_change_confirm_status,
        is_sso_user,
        is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_uid,
        'authenticated',
        'authenticated',
        v_row.email,
        v_pw_hash,
        now(),
        v_app_meta,
        v_user_meta || jsonb_build_object('sub', v_uid::text),
        FALSE,
        now(),
        now(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        0,
        FALSE,
        FALSE
      );
    ELSE
      UPDATE auth.users
      SET instance_id                 = '00000000-0000-0000-0000-000000000000'::uuid,
          aud                         = 'authenticated',
          role                        = 'authenticated',
          encrypted_password          = v_pw_hash,
          email_confirmed_at          = COALESCE(email_confirmed_at, now()),
          raw_app_meta_data           = COALESCE(raw_app_meta_data, '{}'::jsonb) || v_app_meta,
          raw_user_meta_data          = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_user_meta || jsonb_build_object('sub', v_uid::text),
          confirmation_token          = '',
          recovery_token              = '',
          email_change_token_new      = '',
          email_change                = '',
          phone_change                = '',
          phone_change_token          = '',
          email_change_token_current  = '',
          reauthentication_token      = '',
          email_change_confirm_status = 0,
          is_sso_user                 = FALSE,
          is_anonymous                = FALSE,
          deleted_at                  = NULL,
          banned_until                = NULL,
          updated_at                  = now()
      WHERE id = v_uid;
    END IF;

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      v_uid::text,
      jsonb_build_object(
        'sub', v_uid::text,
        'email', v_row.email,
        'email_verified', TRUE,
        'phone_verified', FALSE
      ),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE
      SET user_id         = EXCLUDED.user_id,
          identity_data   = EXCLUDED.identity_data,
          last_sign_in_at = now(),
          updated_at      = now();

    INSERT INTO public.profiles (
      id,
      university_id,
      department_id,
      hall_id,
      email,
      full_name,
      student_id,
      batch,
      trust_level,
      onboarding_completed,
      email_verified,
      is_verified,
      is_demo,
      role
    ) VALUES (
      v_uid,
      v_ju_id,
      v_iit_id,
      CASE WHEN v_row.role_slug = 'student' THEN v_hall_id ELSE NULL END,
      v_row.email,
      v_row.full_name,
      v_row.student_id,
      CASE WHEN v_row.role_slug = 'alumni' THEN '45th Batch' ELSE '51st Batch' END,
      'ID_VERIFIED',
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      v_row.role_slug
    )
    ON CONFLICT (id) DO UPDATE
      SET university_id        = EXCLUDED.university_id,
          department_id        = EXCLUDED.department_id,
          hall_id              = COALESCE(EXCLUDED.hall_id, public.profiles.hall_id),
          email                = EXCLUDED.email,
          full_name            = EXCLUDED.full_name,
          student_id           = EXCLUDED.student_id,
          batch                = EXCLUDED.batch,
          trust_level          = 'ID_VERIFIED',
          onboarding_completed = TRUE,
          email_verified       = TRUE,
          is_verified          = TRUE,
          is_demo              = TRUE,
          role                 = EXCLUDED.role,
          updated_at           = now();

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (v_uid, v_ju_id, v_row.app_role)
    ON CONFLICT (user_id, university_id, role) DO NOTHING;

    IF v_row.is_admin THEN
      INSERT INTO public.user_roles (user_id, university_id, role)
      VALUES
        (v_uid, v_ju_id, 'UNIVERSITY_ADMIN'::app_role),
        (v_uid, v_ju_id, 'SUPER_ADMIN'::app_role)
      ON CONFLICT (user_id, university_id, role) DO NOTHING;
    END IF;
  END LOOP;
END $$;

COMMIT;
