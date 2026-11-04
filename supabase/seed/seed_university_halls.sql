-- supabase/seed/seed_university_halls.sql
-- ============================================================================
-- Residential hall registry for the mandatory student-signup hall selector.
--
-- Real halls for DU, RU, CU, BUET and SUST (success criterion 2), plus the
-- Jahangirnagar University halls so the preview campus switcher stays complete.
-- The /admin/panel (halls section) manages entries for remaining universities.
--
-- Runs after seed.sql (which creates the universities). Idempotent.
--
-- IMPORTANT: every INSERT here is a SELECT ... FROM public.universities, so
-- running this file alone against a database with no universities inserts
-- ZERO rows and still reports success. Apply supabase/seed/seed.sql first,
-- then verify with: SELECT count(*) FROM public.universities;
-- (The sign-up hall picker reads university_halls — NOT the legacy
-- public.halls table that seed.sql populates.)
-- ============================================================================

BEGIN;

INSERT INTO public.university_halls (university_id, name, name_bn, type)
SELECT u.id, h.name, h.name_bn, h.type
FROM public.universities u
JOIN (VALUES
  -- University of Dhaka (DU)
  ('DU', 'Salimullah Muslim Hall',    'সলিমুল্লাহ মুসলিম হল',        'RESIDENTIAL'),
  ('DU', 'Shahidullah Hall',          'শহীদুল্লাহ হল',               'RESIDENTIAL'),
  ('DU', 'Jagannath Hall',            'জগন্নাথ হল',                  'RESIDENTIAL'),
  ('DU', 'Fazlul Huq Muslim Hall',    'ফজলুল হক মুসলিম হল',          'RESIDENTIAL'),
  ('DU', 'Sergeant Zahurul Haq Hall', 'সার্জেন্ট জহুরুল হক হল',      'RESIDENTIAL'),
  ('DU', 'Rokeya Hall',               'রোকেয়া হল',                  'RESIDENTIAL'),
  ('DU', 'Masterda Surja Sen Hall',   'মাস্টারদা সূর্যসেন হল',        'RESIDENTIAL'),
  ('DU', 'Haji Muhammad Mohsin Hall', 'হাজী মোহাম্মদ মোহসিন হল',     'RESIDENTIAL'),
  ('DU', 'Shamsun Nahar Hall',        'শামসুন নাহার হল',             'RESIDENTIAL'),

  -- University of Rajshahi (RU)
  ('RU', 'Shah Makhdum Hall',          'শাহ মখদুম হল',               'RESIDENTIAL'),
  ('RU', 'Nawab Abdul Latif Hall',     'নবাব আবদুল লতিফ হল',          'RESIDENTIAL'),
  ('RU', 'Syed Ameer Ali Hall',        'সৈয়দ আমীর আলী হল',           'RESIDENTIAL'),
  ('RU', 'Shahid Shamsuzzoha Hall',    'শহীদ শামসুজ্জোহা হল',          'RESIDENTIAL'),
  ('RU', 'Shahid Habibur Rahman Hall', 'শহীদ হাবিবুর রহমান হল',       'RESIDENTIAL'),
  ('RU', 'Mother Box Hall',            'মাদার বক্স হল',               'RESIDENTIAL'),

  -- University of Chittagong (CU)
  ('CU', 'Shahid Farhad Hossain Hall', 'শহীদ ফরহাদ হোসেন হল',         'RESIDENTIAL'),
  ('CU', 'Amanat Hall',                'আমানত হল',                    'RESIDENTIAL'),
  ('CU', 'Shah Abdur Rab Hall',        'শাহ আবদুর রাব হল',            'RESIDENTIAL'),
  ('CU', 'Shahjalal Hall',             'শাহজালাল হল',                 'RESIDENTIAL'),
  ('CU', 'Suhrawardy Hall',            'সোহরাওয়ার্দী হল',             'RESIDENTIAL'),
  ('CU', 'Atish Dipankar Hall',        'আতিশ দীপঙ্কর হল',             'RESIDENTIAL'),

  -- Bangladesh University of Engineering & Technology (BUET)
  ('BUET', 'Sherebangla Hall', 'শেরেবাংলা হল', 'RESIDENTIAL'),
  ('BUET', 'Ahsanullah Hall', 'আহসানউল্লাহ হল', 'RESIDENTIAL'),
  ('BUET', 'Titumir Hall',    'তিতুমীর হল',    'RESIDENTIAL'),
  ('BUET', 'Rashid Hall',     'রশীদ হল',       'RESIDENTIAL'),
  ('BUET', 'Nazrul Hall',     'নজরুল হল',       'RESIDENTIAL'),

  -- Shahjalal University of Science and Technology (SUST)
  ('SUST', 'Shahjalal Hall',       'শাহজালাল হল',                       'RESIDENTIAL'),
  ('SUST', 'Academic Building B',  'একাডেমিক ভবন বি (দিবাকালীন শিক্ষার্থী)', 'DAY_SCHOLAR'),

  -- Jahangirnagar University (JU) — keeps every seeded campus selectable
  ('JU', 'Al-Beruni Hall',            'আল বেরুনী হল',           'RESIDENTIAL'),
  ('JU', 'Mir Mosharraf Hossain Hall', 'মীর মশাররফ হোসেন হল',    'RESIDENTIAL'),
  ('JU', 'Nawab Faizunnesa Hall',     'নওয়াব ফয়জুন্নেসা হল',     'RESIDENTIAL'),
  ('JU', 'Jahanara Imam Hall',        'জাহানারা ইমাম হল',         'RESIDENTIAL')
) AS h(code, name, name_bn, type)
  ON u.code = h.code
ON CONFLICT (university_id, name) DO NOTHING;

-- Seed rows for the governance dashboard (approve/reject queue + notices).
INSERT INTO public.hall_allocations (university_id, hall_id, student_name, student_email, student_id, status, note)
SELECT u.id, h.id, v.student_name, v.student_email, v.student_id, v.status, v.note
FROM public.universities u
CROSS JOIN (VALUES
  ('DU',   'Rokeya Hall',        'Tasnim Chowdhury', 'tasnim.chowdhury@students.du.ac.bd', 'DU-2026-10231', 'PENDING',  'First-year honours — needs a seat before the hall admission deadline.'),
  ('DU',   'Salimullah Muslim Hall', 'Rafid Hasan',  'rafid.hasan@students.du.ac.bd',     'DU-2026-10876', 'APPROVED', 'Verified against the hall admission list.'),
  ('BUET', 'Ahsanullah Hall',    'Sabbir Ahmed',     'sabbir.ahmed@ug.buet.ac.bd',        'BUET-2026-142',  'PENDING',  'Transfer from Titumir Hall requested.'),
  ('RU',   'Shah Makhdum Hall',  'Maliha Akter',     'maliha.akter@student.ru.ac.bd',     'RU-2026-20114',  'PENDING',  'Awaiting medical board note.'),
  ('CU',   'Amanat Hall',        'Nusrat Jahan',     'nusrat.jahan@std.cu.ac.bd',         'CU-2026-30117',  'APPROVED', 'Seat confirmed for the 2026 session.')
) AS v(code, hall_name, student_name, student_email, student_id, status, note)
JOIN public.university_halls h
  ON h.university_id = u.id AND h.name = v.hall_name
WHERE u.code = v.code
  AND NOT EXISTS (
  SELECT 1 FROM public.hall_allocations a
  WHERE a.student_email = v.student_email
);

INSERT INTO public.governance_notices (university_id, title, body, audience)
SELECT u.id, v.title, v.body, v.audience
FROM public.universities u
CROSS JOIN (VALUES
  ('DU',   'Hall seat applications open for the 2026 session', 'Submit your residential hall application through the Governance Dashboard before the 30th. Approvals are published within 72 hours.', 'STUDENTS'),
  ('BUET', 'Ahsanullah Hall dining schedule updated',          'The evening meal window moves to 7:30–9:00 PM starting next week. Report issues through the civic board.', 'RESIDENTS'),
  ('RU',   'Load-shedding backup in residential halls',         'Generator support will cover the reading hours (8 PM–12 AM) in all residential halls from Sunday.', 'ALL')
) AS v(code, title, body, audience)
WHERE u.code = v.code
  AND NOT EXISTS (
  SELECT 1 FROM public.governance_notices n
  WHERE n.university_id = u.id AND n.title = v.title
);

COMMIT;
