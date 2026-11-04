-- supabase/seed/seed_multiuniverse_demo.sql
-- ============================================================================
-- Campus360 BD — realistic multi-university demo seed
--
-- Universities: DU, BUET, SUST, RU, CU (plus the existing JU seed).
-- Modules: marketplace_listings, skill_postings, complaints,
--          lost_items, housing_listings, cafeteria_menus (+ cafeteria_items).
--
-- Every row carries the correct university_id and a real campus pickup point
-- / hall / location. The file is idempotent: re-running it will not duplicate
-- rows. Run after supabase/seed/seed.sql and supabase/seed/seed_modules.sql:
--
--   psql "$SUPABASE_DB_URL" -f supabase/seed/seed_multiuniverse_demo.sql
--
-- ⚠️ Demo only. Never run against production.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_du UUID;
  v_buet UUID;
  v_sust UUID;
  v_ru UUID;
  v_cu UUID;
  v_du_prof UUID := '11111111-1111-4111-8111-111111111111';
  v_buet_prof UUID := '22222222-2222-4222-8222-222222222222';
  v_sust_prof UUID := '33333333-3333-4333-8333-333333333333';
  v_ru_prof UUID := '44444444-4444-4444-8444-444444444444';
  v_cu_prof UUID := '55555555-5555-4555-8555-555555555555';
  v_demo_password TEXT := '$2a$10$demodemodemodemodemodemoabcdefghijklmnopqrstuvwxyz0';
BEGIN
  SELECT id INTO v_du FROM public.universities WHERE code = 'DU';
  SELECT id INTO v_buet FROM public.universities WHERE code = 'BUET';
  SELECT id INTO v_sust FROM public.universities WHERE code = 'SUST';
  SELECT id INTO v_ru FROM public.universities WHERE code = 'RU';
  SELECT id INTO v_cu FROM public.universities WHERE code = 'CU';

  IF v_du IS NULL OR v_buet IS NULL OR v_sust IS NULL OR v_ru IS NULL OR v_cu IS NULL THEN
    RAISE NOTICE 'Seed universities missing — run supabase/seed/seed.sql first.';
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- Demo auth users + verified profiles (one per campus)
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  (v_du_prof, 'demo.student@du.ac.bd', v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_buet_prof, 'demo.student@buet.ac.bd', v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_sust_prof, 'demo.student@sust.edu', v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_ru_prof, 'demo.student@ru.ac.bd', v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_cu_prof, 'demo.student@cu.ac.bd', v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, university_id, email, full_name, student_id, batch, trust_level, onboarding_completed)
VALUES
  (v_du_prof, v_du, 'demo.student@du.ac.bd', 'Nusrat Jahan', 'DU-2026-12345', '51st Batch', 'ID_VERIFIED', true),
  (v_buet_prof, v_buet, 'demo.student@buet.ac.bd', 'Rafid Hasan', 'BUET-2026-12345', '51st Batch', 'ID_VERIFIED', true),
  (v_sust_prof, v_sust, 'demo.student@sust.edu', 'Tasnim Chowdhury', 'SUST-2026-12345', '51st Batch', 'ID_VERIFIED', true),
  (v_ru_prof, v_ru, 'demo.student@ru.ac.bd', 'Sabbir Ahmed', 'RU-2026-12345', '51st Batch', 'ID_VERIFIED', true),
  (v_cu_prof, v_cu, 'demo.student@cu.ac.bd', 'Maliha Akter', 'CU-2026-12345', '51st Batch', 'ID_VERIFIED', true)
ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, university_id, role)
VALUES
  (v_du_prof, v_du, 'STUDENT'),
  (v_buet_prof, v_buet, 'STUDENT'),
  (v_sust_prof, v_sust, 'STUDENT'),
  (v_ru_prof, v_ru, 'STUDENT'),
  (v_cu_prof, v_cu, 'STUDENT')
ON CONFLICT (user_id, university_id, role) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Monitored campus pickup points (real locations)
  -- -------------------------------------------------------------------------
  INSERT INTO public.campus_pickup_points (university_id, code, name_en, name_bn, location_en, location_bn)
VALUES
  (v_du, 'NILKhet', 'Nilkhet Book Market', 'নিলখেট বুক মার্কেট', 'Nilkhet, beside the DU main gate', 'নিলখেট, ডিইউ প্রধান ফটকের পাশে'),
  (v_du, 'CURZON', 'Curzon Hall Gate', 'কার্জন হল গেট', 'Curzon Hall, University of Dhaka', 'কার্জন হল, ঢাকা বিশ্ববিদ্যালয়'),
  (v_du, 'TSC-DU', 'TSC Security Desk', 'টিএসসি সিকিউরিটি ডেস্ক', 'Teacher-Student Center main entrance', 'টিএসসি প্রধান প্রবেশপথ'),
  (v_buet, 'LIB-BUET', 'Central Library Locker', 'কেন্দ্রীয় লাইব্রেরি লকার', 'BUET Central Library, ground floor', 'বুয়েট কেন্দ্রীয় লাইব্রেরি, নিচতলা'),
  (v_buet, 'SHB', 'Sherebangla Hall Gate', 'শেরেবাংলা হল গেট', 'Sherebangla Hall, BUET campus', 'শেরেবাংলা হল, BUET ক্যাম্পাস'),
  (v_buet, 'TSC-BUET', 'BUET TSC Security Desk', 'বুয়েট টিএসসি সিকিউরিটি ডেস্ক', 'Teacher-Student Center, BUET', 'টিএসসি, BUET'),
  (v_sust, 'SHJ', 'Shahjalal Hall Gate', 'শাহজালাল হল গেট', 'Shahjalal Hall, SUST campus', 'শাহজালাল হল, SUST ক্যাম্পাস'),
  (v_sust, 'AB-B', 'Academic Building B', 'একাডেমিক বিল্ডিং বি', 'Academic Building B, SUST', 'একাডেমিক বিল্ডিং বি, SUST'),
  (v_sust, 'LIB-SUST', 'SUST Central Library', 'SUST কেন্দ্রীয় লাইব্রেরি', 'Central Library, SUST', 'কেন্দ্রীয় লাইব্রেরি, SUST'),
  (v_ru, 'KAZLA', 'Kazla Gate', 'কাজলা গেট', 'Kazla Gate, University of Rajshahi', 'কাজলা গেট, রাজশাহী বিশ্ববিদ্যালয়'),
  (v_ru, 'BBH', 'Bangabandhu Hall', 'বঙ্গবন্ধু হল', 'Bangabandhu Hall, RU campus', 'বঙ্গবন্ধু হল, RU ক্যাম্পাস'),
  (v_ru, 'LIB-RU', 'RU Central Library', 'RU কেন্দ্রীয় লাইব্রেরি', 'Central Library, University of Rajshahi', 'কেন্দ্রীয় লাইব্রেরি, রাজশাহী বিশ্ববিদ্যালয়'),
  (v_cu, 'SUH', 'Suhrawardy Hall', 'সুহরাওয়ার্দি হল', 'Suhrawardy Hall, University of Chittagong', 'সুহরাওয়ার্দি হল, চট্টগ্রাম বিশ্ববিদ্যালয়'),
  (v_cu, 'ZERO', 'Zero Point', 'জিরো পয়েন্ট', 'Zero Point, CU campus main entrance', 'জিরো পয়েন্ট, CU ক্যাম্পাস প্রধান প্রবেশপথ'),
  (v_cu, 'LIB-CU', 'CU Central Library', 'CU কেন্দ্রীয় লাইব্রেরি', 'Central Library, University of Chittagong', 'কেন্দ্রীয় লাইব্রেরি, চট্টগ্রাম বিশ্ববিদ্যালয়')
ON CONFLICT (university_id, code) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Marketplace — 5 realistic listings per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.marketplace_listings
    (university_id, seller_id, title, description, category, price_bdt, condition, kind, pickup_point_id, keyword_tags, status)
  SELECT u.id, p.id, v.title, v.description, v.category, v.price, v.condition, v.kind::listing_kind, pp.id, v.tags, 'AVAILABLE'
  FROM (VALUES
    ('DU', 'Cormen Algorithms 3rd ed', 'Introduction to Algorithms (CLRS) 3rd edition. Used for one semester, no missing pages. Pickup from Nilkhet book market.', 'Books', 450.00, 'GOOD', 'SELL', 'NILKhet', ARRAY['cormen','algorithms','clrs','cse']),
    ('DU', 'Casio FX-991EX scientific calculator', 'Battery included, all modes working. Cleared for DU science faculty exams.', 'Electronics', 1200.00, 'LIKE_NEW', 'SELL', 'TSC-DU', ARRAY['calculator','casio','science']),
    ('DU', 'DU hoodie — 2024 batch', 'Official DU hoodie, size L, washed twice. No stains.', 'Clothing', 600.00, 'GOOD', 'SELL', 'CURZON', ARRAY['hoodie','du','clothing']),
    ('DU', 'Reading table + desk lamp', 'Sturdy wooden table with a warm desk lamp. Ideal for hall room study.', 'Furniture', 900.00, 'FAIR', 'SELL', 'TSC-DU', ARRAY['table','lamp','furniture']),
    ('DU', 'Rokeya Hall bicycle', 'Single-speed bicycle, new brake pads. For hall-to-department commute.', 'Transport', 3500.00, 'GOOD', 'RENT', 'CURZON', ARRAY['bicycle','cycle','commute']),
    ('BUET', 'Casio FX-991EX — cleared for BUET engineering exams', 'Bought in 2024, used for one semester. All modes verified, battery new. Cleared for BUET engineering exam regulations.', 'Electronics', 1450.00, 'LIKE_NEW', 'SELL', 'LIB-BUET', ARRAY['casio','calculator','engineering','buet']),
    ('BUET', 'Engineering drawing board + instruments', 'Wooden drawing board with T-square, set squares and compass. Used for one drawing lab.', 'Books', 1100.00, 'GOOD', 'SELL', 'SHB', ARRAY['drawing board','engineering','drawing']),
    ('BUET', 'Cormen + CLRS algorithm set', 'Introduction to Algorithms 3rd ed and Algorithm Design by Kleinberg-Tardos. Both in good condition.', 'Books', 900.00, 'GOOD', 'SELL', 'LIB-BUET', ARRAY['cormen','clrs','algorithms']),
    ('BUET', 'Lab coat + safety goggles', 'Civil engineering lab coat, size M, with safety goggles. Washable and clean.', 'Clothing', 500.00, 'GOOD', 'SELL', 'SHB', ARRAY['lab coat','goggles','civil']),
    ('BUET', 'Hero Sprint bicycle', 'Single-speed commuter bicycle, recently serviced. For BUET campus and Dhanmondi commute.', 'Transport', 900.00, 'GOOD', 'RENT', 'TSC-BUET', ARRAY['bicycle','hero','commute']),
    ('SUST', 'Hero bicycle at Shahjalal Hall', 'Hero single-speed bicycle, used for one year. New tyres and brake cables. Ideal for Shahjalal Hall to Academic Building B.', 'Transport', 4200.00, 'GOOD', 'SELL', 'SHJ', ARRAY['hero','bicycle','shahjalal hall']),
    ('SUST', 'Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for SUST engineering exams.', 'Electronics', 1300.00, 'GOOD', 'SELL', 'AB-B', ARRAY['casio','calculator']),
    ('SUST', 'Lab coat + safety goggles', 'Chemistry lab coat, size L, with goggles. Clean and ready to use.', 'Clothing', 550.00, 'GOOD', 'SELL', 'AB-B', ARRAY['lab coat','chemistry']),
    ('SUST', 'Hostel reading desk', 'Wooden desk with a drawer, fits a laptop and books. Pickup from Shahjalal Hall.', 'Furniture', 1000.00, 'FAIR', 'SELL', 'SHJ', ARRAY['desk','furniture']),
    ('SUST', 'Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 480.00, 'GOOD', 'SELL', 'LIB-SUST', ARRAY['cormen','algorithms']),
    ('RU', 'Drawing board at Kazla Gate', 'Engineering drawing board with T-square and set squares. Used for one semester, good condition. Pickup at Kazla Gate.', 'Books', 1000.00, 'GOOD', 'SELL', 'KAZLA', ARRAY['drawing board','engineering','kazla']),
    ('RU', 'Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for RU engineering exams.', 'Electronics', 1250.00, 'GOOD', 'SELL', 'LIB-RU', ARRAY['casio','calculator']),
    ('RU', 'Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 460.00, 'GOOD', 'SELL', 'LIB-RU', ARRAY['cormen','algorithms']),
    ('RU', 'Hero bicycle', 'Single-speed bicycle, recently serviced. For Kazla Gate to Bangabandhu Hall commute.', 'Transport', 3800.00, 'GOOD', 'SELL', 'KAZLA', ARRAY['hero','bicycle']),
    ('RU', 'Desk lamp + reading table', 'Wooden reading table with a warm desk lamp. Pickup from Bangabandhu Hall.', 'Furniture', 950.00, 'FAIR', 'SELL', 'BBH', ARRAY['table','lamp']),
    ('CU', 'Mini refrigerator at Suhrawardy Hall', 'Mini refrigerator, 3.5 cubic feet, working perfectly. Used for one year in Suhrawardy Hall. Pickup from the hall gate.', 'Electronics', 6500.00, 'GOOD', 'SELL', 'SUH', ARRAY['refrigerator','mini fridge','suhrawardy hall']),
    ('CU', 'Cormen Algorithms 3rd ed', 'Introduction to Algorithms, 3rd edition. Used, no missing pages.', 'Books', 470.00, 'GOOD', 'SELL', 'LIB-CU', ARRAY['cormen','algorithms']),
    ('CU', 'Casio FX-991EX calculator', 'Scientific calculator, all modes working. Used for CU science exams.', 'Electronics', 1250.00, 'GOOD', 'SELL', 'ZERO', ARRAY['casio','calculator']),
    ('CU', 'Hero bicycle', 'Single-speed bicycle, recently serviced. For Zero Point to Suhrawardy Hall commute.', 'Transport', 3900.00, 'GOOD', 'SELL', 'ZERO', ARRAY['hero','bicycle']),
    ('CU', 'Drawing board + instruments', 'Engineering drawing board with T-square and set squares. Good condition.', 'Books', 1000.00, 'GOOD', 'SELL', 'LIB-CU', ARRAY['drawing board','engineering'])
  ) AS v(code, title, description, category, price, condition, kind, pickup_code, tags)
  JOIN public.universities u ON u.code = v.code
  JOIN public.profiles p ON p.university_id = u.id AND p.trust_level = 'ID_VERIFIED'
  LEFT JOIN public.campus_pickup_points pp ON pp.university_id = u.id AND pp.code = v.pickup_code
  WHERE NOT EXISTS (
    SELECT 1 FROM public.marketplace_listings m
    WHERE m.university_id = u.id AND m.title = v.title
  );

  -- -------------------------------------------------------------------------
  -- Skill Hub — 3 postings per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.skill_postings
    (university_id, author_id, type, title, description, category, skills, location_en, availability, rate_bdt, is_remote, contact_note, status)
  SELECT u.id, p.id, v.type::skill_posting_type, v.title, v.description, v.category, v.skills, v.location, 'FLEXIBLE', v.rate, v.is_remote, 'Message me on Campus360', 'OPEN'
  FROM (VALUES
    ('DU', 'TUTORING', 'Data Structures crash course', 'Final-year CSE student offering 6-week Data Structures prep for DU admission and semester exams. Sunday/Tuesday evenings at TSC.', 'TUTORING', ARRAY['Data Structures','C++','Algorithms'], 'TSC, University of Dhaka', 800.00, false),
    ('DU', 'TUTORING', 'IELTS speaking practice', 'English department student offering 1-on-1 speaking practice and mock tests. Online or Curzon Hall library.', 'TUTORING', ARRAY['IELTS','Spoken English'], 'Curzon Hall Library', 600.00, true),
    ('DU', 'FREELANCE', 'Freelance graphic design for campus events', 'Design posters, event banners and social creatives. 3 years of experience with DU clubs.', 'FREELANCE', ARRAY['Photoshop','Illustrator','Figma'], 'Remote', 1500.00, true),
    ('BUET', 'TUTORING', 'Thermodynamics + fluid mechanics tutoring', 'BUET mechanical engineering student offering weekly problem-solving sessions for EEE/ME students.', 'TUTORING', ARRAY['Thermodynamics','Fluid Mechanics'], 'BUET Academic Building B', 1000.00, false),
    ('BUET', 'TUTORING', 'AutoCAD for civil engineering students', 'Learn AutoCAD 2D drafting, structural drawings and quantity estimation. Laptop required.', 'TUTORING', ARRAY['AutoCAD','Civil Engineering'], 'BUET Central Library', 1200.00, false),
    ('BUET', 'TUTORING', 'Python for EEE students', 'Practical Python for data analysis and embedded systems. 4-week evening course.', 'TUTORING', ARRAY['Python','NumPy','Embedded'], 'BUET EEE Building', 900.00, false),
    ('SUST', 'TUTORING', 'Chemistry tutoring for SUST admission', 'SUST chemistry student offering admission and semester exam preparation.', 'TUTORING', ARRAY['Chemistry','Organic Chemistry'], 'Academic Building B, SUST', 700.00, false),
    ('SUST', 'TUTORING', 'Web development with React', 'Build a portfolio website in 4 weeks. For SUST CSE and EEE students.', 'TUTORING', ARRAY['React','JavaScript','CSS'], 'SUST Central Library', 1000.00, false),
    ('SUST', 'TUTORING', 'Math for admission tests', 'Calculus and algebra crash course for SUST and other public university admission tests.', 'TUTORING', ARRAY['Calculus','Algebra'], 'Shahjalal Hall study room', 800.00, false),
    ('RU', 'TUTORING', 'Physics tutoring for RU admission', 'RU physics student offering admission and semester exam preparation.', 'TUTORING', ARRAY['Physics','Mechanics'], 'RU Central Library', 700.00, false),
    ('RU', 'FREELANCE', 'Graphic design for campus clubs', 'Posters, banners and social media creatives for RU clubs and events.', 'FREELANCE', ARRAY['Photoshop','Illustrator'], 'Remote', 1200.00, true),
    ('RU', 'TUTORING', 'Spoken English practice', 'Weekly conversation practice for students preparing for interviews.', 'TUTORING', ARRAY['Spoken English','IELTS'], 'Bangabandhu Hall study room', 600.00, false),
    ('CU', 'TUTORING', 'Accounting tutoring for CU business students', 'CU accounting student offering financial accounting and cost accounting sessions.', 'TUTORING', ARRAY['Accounting','Finance'], 'CU Central Library', 700.00, false),
    ('CU', 'FREELANCE', 'Web design for small businesses', 'Portfolio websites and landing pages for Chattogram businesses.', 'FREELANCE', ARRAY['Web Design','WordPress'], 'Remote', 1500.00, true),
    ('CU', 'TUTORING', 'IELTS preparation', 'Speaking and writing practice for IELTS with mock tests.', 'TUTORING', ARRAY['IELTS','English'], 'Suhrawardy Hall study room', 800.00, false)
  ) AS v(code, type, title, description, category, skills, location, rate, is_remote)
  JOIN public.universities u ON u.code = v.code
  JOIN public.profiles p ON p.university_id = u.id AND p.trust_level = 'ID_VERIFIED'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.skill_postings s
    WHERE s.university_id = u.id AND s.title = v.title
  );

  -- -------------------------------------------------------------------------
  -- Civic complaints — 3 public tickets per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.complaints
    (university_id, tracking_code, student_id, is_anonymous, title, category, description, severity, status,
     assigned_unit_id, sla_hours, sla_due_at, is_public_issue, location_hint, created_at, last_activity_at)
  SELECT u.id, v.tracking_code, p.id, false, v.title, v.category::complaint_category, v.description,
         v.severity::complaint_severity, v.status::complaint_status, gu.id, v.sla_hours,
         now() + (v.sla_hours || ' hours')::interval, true, v.location, now() - (v.days_ago || ' days')::interval,
         now() - (v.days_ago || ' days')::interval
  FROM (VALUES
    ('DU', 'DU-CASE-2026-482901', 'Broken streetlight outside Curzon Hall', 'INFRASTRUCTURE', 'The streetlight between Curzon Hall and the TSC has been dark for 9 days. Students returning from evening classes feel unsafe.', 'HIGH', 'IN_REVIEW', 24, 9, 'Curzon Hall main road'),
    ('DU', 'DU-CASE-2026-482902', 'Waterlogging at TSC gate after rain', 'INFRASTRUCTURE', 'The drain outside the TSC gate overflows whenever it rains. Rickshaws cannot pass and students wade through dirty water.', 'MEDIUM', 'ACTION_TAKEN', 72, 14, 'TSC main gate'),
    ('DU', 'DU-CASE-2026-482903', 'Damaged bench in front of Central Library', 'INFRASTRUCTURE', 'Two benches are broken and the metal edges are sharp. A first-year student cut their hand last week.', 'LOW', 'RESOLVED', 72, 21, 'Central Library lawn'),
    ('BUET', 'BUET-CASE-2026-482901', 'Broken projector in EEE building', 'INFRASTRUCTURE', 'The projector in room 302 has no signal. Lectures are being shifted to the corridor.', 'MEDIUM', 'SUBMITTED', 72, 2, 'EEE Building, Room 302'),
    ('BUET', 'BUET-CASE-2026-482902', 'Unsafe staircase at Sherebangla Hall', 'INFRASTRUCTURE', 'The handrail is loose and two steps are broken. Students use it at night.', 'HIGH', 'IN_REVIEW', 24, 6, 'Sherebangla Hall, west staircase'),
    ('BUET', 'BUET-CASE-2026-482903', 'Streetlight outage near Gate 2', 'INFRASTRUCTURE', 'Three streetlights are out between Gate 2 and the library. The path is completely dark after 8 PM.', 'HIGH', 'ACTION_TAKEN', 24, 11, 'BUET Gate 2'),
    ('SUST', 'SUST-CASE-2026-482901', 'Broken water pump at Shahjalal Hall', 'HALL_RESIDENCE', 'The water pump has stopped. Residents are carrying water from the Academic Building B tap.', 'HIGH', 'IN_REVIEW', 24, 5, 'Shahjalal Hall, ground floor'),
    ('SUST', 'SUST-CASE-2026-482902', 'Unsafe road at Academic Building B', 'INFRASTRUCTURE', 'The road shoulder has collapsed after rain. Students are walking in the middle of the road.', 'MEDIUM', 'SUBMITTED', 72, 3, 'Academic Building B road'),
    ('SUST', 'SUST-CASE-2026-482903', 'Library AC failure', 'INFRASTRUCTURE', 'The AC has been off for a week. Reading rooms are very hot in the afternoon.', 'MEDIUM', 'ACTION_TAKEN', 72, 8, 'SUST Central Library, 2nd floor'),
    ('RU', 'RU-CASE-2026-482901', 'Broken road at Kazla Gate', 'INFRASTRUCTURE', 'The road from Kazla Gate to the main campus has deep potholes. Buses and CNGs are damaging their suspensions.', 'HIGH', 'IN_REVIEW', 24, 7, 'Kazla Gate, RU'),
    ('RU', 'RU-CASE-2026-482902', 'Streetlight near Bangabandhu Hall', 'INFRASTRUCTURE', 'Two streetlights are out. Students walking back from the library at night feel unsafe.', 'MEDIUM', 'SUBMITTED', 72, 2, 'Bangabandhu Hall road'),
    ('RU', 'RU-CASE-2026-482903', 'Library seat shortage', 'ACADEMIC', 'The reading room is full by 10 AM during exam weeks. More seats are needed.', 'LOW', 'ACTION_TAKEN', 72, 15, 'RU Central Library'),
    ('CU', 'CU-CASE-2026-482901', 'Broken light at Zero Point', 'INFRASTRUCTURE', 'The main light at Zero Point is out. Students crossing at night are at risk.', 'HIGH', 'IN_REVIEW', 24, 4, 'Zero Point, CU'),
    ('CU', 'CU-CASE-2026-482902', 'Water crisis at Suhrawardy Hall', 'HALL_RESIDENCE', 'Water supply has been off for two days. Residents are buying bottled water.', 'HIGH', 'ACTION_TAKEN', 24, 6, 'Suhrawardy Hall'),
    ('CU', 'CU-CASE-2026-482903', 'Unsafe road near CU library', 'INFRASTRUCTURE', 'The road shoulder is broken and the library entrance is difficult to access.', 'MEDIUM', 'SUBMITTED', 72, 2, 'CU Central Library road')
  ) AS v(code, tracking_code, title, category, description, severity, status, sla_hours, days_ago, location)
  JOIN public.universities u ON u.code = v.code
  JOIN public.profiles p ON p.university_id = u.id AND p.trust_level = 'ID_VERIFIED'
  LEFT JOIN public.governing_units gu ON gu.university_id = u.id AND gu.unit_code = 'PROCTOR'
  ON CONFLICT (tracking_code) DO NOTHING;

  -- Status history for the seeded civic tickets
  INSERT INTO public.complaint_status_history (complaint_id, university_id, from_status, to_status, changed_by, reason, created_at)
  SELECT c.id, c.university_id, NULL, 'SUBMITTED', c.student_id, 'Ticket created from the civic board.', c.created_at
  FROM public.complaints c
  WHERE c.tracking_code LIKE 'DU-CASE-2026-4829%' OR c.tracking_code LIKE 'BUET-CASE-2026-4829%'
     OR c.tracking_code LIKE 'SUST-CASE-2026-4829%' OR c.tracking_code LIKE 'RU-CASE-2026-4829%'
     OR c.tracking_code LIKE 'CU-CASE-2026-4829%'
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Lost & Found — 3 items per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.lost_items
    (university_id, reporter_id, kind, title, description, category, keywords, location_en, occurred_on, status)
  SELECT u.id, p.id, v.kind::lost_item_kind, v.title, v.description, v.category, v.keywords, v.location,
         CURRENT_DATE - v.days_ago, 'OPEN'
  FROM (VALUES
    ('DU', 'LOST', 'Lost black backpack at TSC', 'Black backpack with a laptop sleeve, a blue water bottle and a Data Structures notebook inside.', 'Bags', ARRAY['backpack','black','laptop'], 'TSC, near the food court', 2),
    ('DU', 'FOUND', 'Found Casio calculator in Central Library', 'Found a Casio FX-991EX under a reading table. The name "Rafid" is written on the back.', 'Electronics', ARRAY['casio','calculator'], 'Central Library, 2nd floor reading room', 1),
    ('DU', 'LOST', 'Lost student ID card near Curzon Hall', 'DU student ID card, name Tasnim Chowdhury, Department of English.', 'Documents', ARRAY['id card','curzon'], 'Curzon Hall gate', 3),
    ('BUET', 'LOST', 'Lost Casio calculator at Central Library', 'Casio FX-991EX in a black pouch, name Nusrat written on the back.', 'Electronics', ARRAY['casio','calculator'], 'Central Library, 3rd floor', 1),
    ('BUET', 'FOUND', 'Found drawing board at Academic Building B', 'Drawing board with a T-square left behind after the drawing lab.', 'Documents', ARRAY['drawing board','t-square'], 'Academic Building B, Room 105', 2),
    ('BUET', 'LOST', 'Lost student ID at Sherebangla Hall', 'BUET student ID card, Rafid Hasan, Department of Civil Engineering.', 'Documents', ARRAY['id card','sherebangla'], 'Sherebangla Hall dining hall', 4),
    ('SUST', 'LOST', 'Lost Hero bicycle key', 'Hero bicycle key with a red tag, near the Shahjalal Hall stand.', 'Keys', ARRAY['bicycle','key','hero'], 'Shahjalal Hall bicycle stand', 1),
    ('SUST', 'FOUND', 'Found calculator at Academic Building B', 'Casio calculator found after the physics exam.', 'Electronics', ARRAY['calculator','casio'], 'Academic Building B, Room 210', 2),
    ('SUST', 'LOST', 'Lost ID at Shahjalal Hall', 'SUST student ID, Tasnim Chowdhury, Department of Chemistry.', 'Documents', ARRAY['id card','shahjalal'], 'Shahjalal Hall dining hall', 3),
    ('RU', 'LOST', 'Lost drawing board at Kazla Gate', 'Engineering drawing board with a T-square, left at the Kazla Gate bus stop.', 'Documents', ARRAY['drawing board','kazla'], 'Kazla Gate, near the bus stop', 1),
    ('RU', 'FOUND', 'Found calculator at Bangabandhu Hall', 'Casio calculator found after dinner. Name "Rafid" on the back.', 'Electronics', ARRAY['calculator','casio'], 'Bangabandhu Hall dining hall', 2),
    ('RU', 'LOST', 'Lost ID card near RU library', 'RU student ID, Tasnim Chowdhury, Department of Physics.', 'Documents', ARRAY['id card','library'], 'RU Central Library', 4),
    ('CU', 'LOST', 'Lost mini fridge key', 'Small key with a blue tag for a mini refrigerator.', 'Keys', ARRAY['fridge','key'], 'Suhrawardy Hall, room 214', 1),
    ('CU', 'FOUND', 'Found calculator at Zero Point', 'Casio calculator found near the Zero Point bus stop.', 'Electronics', ARRAY['calculator','casio'], 'Zero Point, CU', 2),
    ('CU', 'LOST', 'Lost ID at Suhrawardy Hall', 'CU student ID, Tasnim Chowdhury, Department of Accounting.', 'Documents', ARRAY['id card','suhrawardy'], 'Suhrawardy Hall dining hall', 3)
  ) AS v(code, kind, title, description, category, keywords, location, days_ago)
  JOIN public.universities u ON u.code = v.code
  JOIN public.profiles p ON p.university_id = u.id AND p.trust_level = 'ID_VERIFIED'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lost_items l
    WHERE l.university_id = u.id AND l.title = v.title
  );

  -- -------------------------------------------------------------------------
  -- Housing — 3 listings per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.housing_listings
    (university_id, owner_id, kind, title, description, rent_bdt, seat_count, gender_policy, area_en, area_bn, distance_km, amenities, status)
  SELECT u.id, p.id, v.kind::housing_kind, v.title, v.description, v.rent, v.seats, v.gender, v.area, v.area_bn, v.distance, v.amenities, 'AVAILABLE'
  FROM (VALUES
    ('DU', 'MESS_SEAT', 'Salimullah Hall seat vacant', 'Vacant seat in a 4-person room. Mess included. 2nd-year students preferred.', 4500.00, 1, 'MALE', 'Salimullah Hall, DU campus', 'সলিমুল্লাহ হল, ঢাকা বিশ্ববিদ্যালয়', 0.4, ARRAY['Wi-Fi','Mess','Study room']),
    ('DU', 'MESS_SEAT', 'Nilkhet girls mess seat', 'Home-style meals, Wi-Fi, and a quiet study room. Female students only.', 3800.00, 1, 'FEMALE', 'Nilkhet, 2 minutes from DU gate', 'নিলখেট, ডিইউ গেট থেকে ২ মিনিট', 1.2, ARRAY['Wi-Fi','Mess','Study room']),
    ('DU', 'SUB_LET', 'Dhanmondi boys sublet', 'Single room with attached bath, 15 minutes by bus to the DU campus.', 7000.00, 1, 'MALE', 'Dhanmondi, near TSC bus stop', 'ধানমন্ডি, টিএসসি বাস স্টপের কাছে', 3.5, ARRAY['Wi-Fi','Attached bath']),
    ('BUET', 'MESS_SEAT', 'Sherebangla Hall seat', 'Vacant seat in a 3-person room. Mess and Wi-Fi included.', 5000.00, 1, 'MALE', 'Sherebangla Hall, BUET', 'শেরেবাংলা হল, BUET', 0.3, ARRAY['Wi-Fi','Mess']),
    ('BUET', 'MESS_SEAT', 'Azimpur boys mess', 'Home-style mess with 3 meals. Owner is a BUET alumnus.', 4200.00, 2, 'MALE', 'Azimpur, 10 minutes from BUET', 'আজিমপুর, BUET থেকে ১০ মিনিট', 2.1, ARRAY['Mess','Study room']),
    ('BUET', 'SUB_LET', 'Dhanmondi female sublet', 'Single room with attached bath and a shared study room.', 8500.00, 1, 'FEMALE', 'Dhanmondi, near BUET bus stop', 'ধানমন্ডি, BUET বাস স্টপের কাছে', 3.8, ARRAY['Wi-Fi','Attached bath']),
    ('SUST', 'MESS_SEAT', 'Shahjalal Hall seat', 'Vacant seat in a 4-person room with mess.', 4000.00, 1, 'FEMALE', 'Shahjalal Hall, SUST', 'শাহজালাল হল, SUST', 0.2, ARRAY['Wi-Fi','Mess']),
    ('SUST', 'MESS_SEAT', 'Sylhet city mess', 'Home-style mess with 3 meals and Wi-Fi.', 3500.00, 2, 'MALE', 'Sylhet city, 10 minutes from SUST', 'সিলেট শহর, SUST থেকে ১০ মিনিট', 2.5, ARRAY['Mess','Wi-Fi']),
    ('SUST', 'SUB_LET', 'Academic Building B nearby sublet', 'Single room with attached bath, quiet study environment.', 6000.00, 1, 'ANY', 'Sylhet, near SUST gate', 'সিলেট, SUST গেটের কাছে', 1.8, ARRAY['Wi-Fi','Attached bath']),
    ('RU', 'MESS_SEAT', 'Bangabandhu Hall seat', 'Vacant seat in a 3-person room with mess.', 3800.00, 1, 'MALE', 'Bangabandhu Hall, RU', 'বঙ্গবন্ধু হল, RU', 0.3, ARRAY['Mess','Wi-Fi']),
    ('RU', 'MESS_SEAT', 'Kazla boys mess', 'Home-style mess with 3 meals and a study room.', 3200.00, 2, 'MALE', 'Kazla, near RU gate', 'কাজলা, RU গেটের কাছে', 1.1, ARRAY['Mess','Study room']),
    ('RU', 'SUB_LET', 'Rajshahi city sublet', 'Single room with attached bath, 15 minutes to campus.', 6500.00, 1, 'ANY', 'Rajshahi city, near RU', 'রাজশাহী শহর, RU-এর কাছে', 4.0, ARRAY['Wi-Fi','Attached bath']),
    ('CU', 'MESS_SEAT', 'Suhrawardy Hall seat', 'Vacant seat in a 4-person room with mess.', 3600.00, 1, 'FEMALE', 'Suhrawardy Hall, CU', 'সুহরাওয়ার্দি হল, CU', 0.2, ARRAY['Mess','Wi-Fi']),
    ('CU', 'MESS_SEAT', 'CU campus mess', 'Home-style mess with 3 meals and Wi-Fi.', 3300.00, 2, 'MALE', 'CU campus, near Zero Point', 'CU ক্যাম্পাস, জিরো পয়েন্টের কাছে', 0.6, ARRAY['Mess','Wi-Fi']),
    ('CU', 'SUB_LET', 'Chattogram city sublet', 'Single room with attached bath, 20 minutes to campus.', 7000.00, 1, 'ANY', 'Chattogram city, near CU', 'চট্টগ্রাম শহর, CU-এর কাছে', 5.2, ARRAY['Wi-Fi','Attached bath'])
  ) AS v(code, kind, title, description, rent, seats, gender, area, area_bn, distance, amenities)
  JOIN public.universities u ON u.code = v.code
  JOIN public.profiles p ON p.university_id = u.id AND p.trust_level = 'ID_VERIFIED'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.housing_listings h
    WHERE h.university_id = u.id AND h.title = v.title
  );

  -- -------------------------------------------------------------------------
  -- Cafeteria menus + items — 3 menus per campus
  -- -------------------------------------------------------------------------
  INSERT INTO public.cafeteria_menus (university_id, name_en, name_bn, serving_date, meal, pickup_window, is_active)
  SELECT u.id, v.name_en, v.name_bn, CURRENT_DATE, v.meal::text, v.window, true
  FROM (VALUES
    ('DU', 'Salimullah Hall lunch', 'সলিমুল্লাহ হল লাঞ্চ', 'LUNCH', '12:30 - 14:00'),
    ('DU', 'TSC cafeteria snacks', 'টিএসসি ক্যাফেটেরিয়া সnek', 'SNACKS', '16:00 - 19:00'),
    ('DU', 'Nilkhet home food dinner', 'নিলখেটের ঘরের খাবার', 'DINNER', '19:00 - 21:30'),
    ('BUET', 'Sherebangla Hall dinner', 'শেরেবাংলা হল রাতের খাবার', 'DINNER', '19:00 - 21:00'),
    ('BUET', 'BUET cafeteria lunch', 'BUET ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00'),
    ('BUET', 'Azimpur home food', 'আজিমপুরের ঘরের খাবার', 'DINNER', '19:30 - 21:30'),
    ('SUST', 'Shahjalal Hall dinner', 'শাহজালাল হল রাতের খাবার', 'DINNER', '19:00 - 21:00'),
    ('SUST', 'SUST cafeteria lunch', 'SUST ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00'),
    ('SUST', 'Sylhet home food', 'সিলেটের ঘরের খাবার', 'DINNER', '19:30 - 21:30'),
    ('RU', 'Bangabandhu Hall lunch', 'বঙ্গবন্ধু হল লাঞ্চ', 'LUNCH', '12:30 - 14:00'),
    ('RU', 'RU cafeteria snacks', 'RU ক্যাফেটেরিয়া সnek', 'SNACKS', '16:00 - 19:00'),
    ('RU', 'Kazla home food', 'কাজলার ঘরের খাবার', 'DINNER', '19:00 - 21:30'),
    ('CU', 'Suhrawardy Hall dinner', 'সুহরাওয়ার্দি হল রাতের খাবার', 'DINNER', '19:00 - 21:00'),
    ('CU', 'CU cafeteria lunch', 'CU ক্যাফেটেরিয়া লাঞ্চ', 'LUNCH', '12:00 - 14:00'),
    ('CU', 'Chattogram home food', 'চট্টগ্রামের ঘরের খাবার', 'DINNER', '19:30 - 21:30')
  ) AS v(code, name_en, name_bn, meal, window)
  JOIN public.universities u ON u.code = v.code
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cafeteria_menus m
    WHERE m.university_id = u.id AND m.name_en = v.name_en AND m.serving_date = CURRENT_DATE
  );

  INSERT INTO public.cafeteria_items (university_id, menu_id, name_en, name_bn, price_bdt, is_available, stock, is_vegetarian)
  SELECT m.university_id, m.id, v.item_name, v.item_name, v.price, true, 40, v.veg
  FROM (VALUES
    ('Salimullah Hall lunch', 'Rice, Hilsa fish, dal, mixed vegetable', 120.00, false),
    ('Salimullah Hall lunch', 'Dal', 20.00, true),
    ('TSC cafeteria snacks', 'Singara', 25.00, true),
    ('TSC cafeteria snacks', 'Tea', 15.00, true),
    ('Nilkhet home food dinner', 'Khichuri, beef bhuna, salad', 150.00, false),
    ('Sherebangla Hall dinner', 'Rice, chicken curry, dal, vegetable', 130.00, false),
    ('BUET cafeteria lunch', 'Rice, fish, dal, salad', 110.00, false),
    ('Azimpur home food', 'Khichuri, beef, omelette', 160.00, false),
    ('Shahjalal Hall dinner', 'Rice, fish, dal, vegetable', 120.00, false),
    ('SUST cafeteria lunch', 'Rice, chicken, dal, salad', 115.00, false),
    ('Sylhet home food', 'Khichuri, beef bhuna, salad', 150.00, false),
    ('Bangabandhu Hall lunch', 'Rice, fish, dal, vegetable', 115.00, false),
    ('RU cafeteria snacks', 'Singara', 25.00, true),
    ('Kazla home food', 'Khichuri, beef, salad', 145.00, false),
    ('Suhrawardy Hall dinner', 'Rice, fish, dal, vegetable', 120.00, false),
    ('CU cafeteria lunch', 'Rice, chicken, dal, salad', 110.00, false),
    ('Chattogram home food', 'Khichuri, beef, omelette', 150.00, false)
  ) AS v(menu_name, item_name, price, veg)
  JOIN public.cafeteria_menus m ON m.name_en = v.menu_name AND m.serving_date = CURRENT_DATE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cafeteria_items i
    WHERE i.menu_id = m.id AND i.name_en = v.item_name
  );

  RAISE NOTICE 'Multi-university demo seed complete: DU, BUET, SUST, RU, CU.';
END $$;

COMMIT;
