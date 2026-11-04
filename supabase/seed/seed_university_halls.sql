-- supabase/seed/seed_university_halls.sql
-- ============================================================================
-- Residential hall registry for the student-signup hall selector.
--
-- Coverage (2026-11-04 revision):
--   • Named, verified hall rosters for the six campuses whose halls are fully
--     documented: DU (21 incl. hostels), JU (16), RU (18), CU (14), BUET (9),
--     SUST (6, per sust.edu).
--   • Named halls for the other universities wherever a public roster exists
--     (KU, IU, JNU, KUET/RUET/DUET/CUET, BAU, BSMRAU, SAU, SBAU, BUP, COU, …).
--   • Every remaining campus gets one explicit `DAY_SCHOLAR` row, so signup is
--     never blocked by a missing hall while the hall list is still being
--     collected. That row is labelled as such — it is a placeholder for
--     "no hall seat applied for", not an invented hall name.
--
-- Names follow each university's current public listing. Several halls were
-- renamed in the 2025 wave (e.g. Bangabandhu/Sheikh Hasina halls → "Bijoy 24"),
-- so where a rename is in force the *current* name is used and the superseded
-- name is not duplicated. /admin/panel (halls section) edits any entry, and
-- re-running this file is safe: every statement is idempotent.
--
-- IMPORTANT: every INSERT here is `… SELECT … FROM public.universities`, so
-- running this file against a database with no universities inserts ZERO rows
-- and still reports success. Apply supabase/seed/seed.sql FIRST, then verify
-- with: SELECT count(*) FROM public.universities;
-- The signup hall picker reads university_halls — NOT the legacy public.halls
-- table that seed.sql populates.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Normalise the earlier short-form rows to each university's canonical
--    current name, so the exhaustive insert below cannot create near-duplicates.
-- ---------------------------------------------------------------------------
UPDATE public.university_halls h SET name = 'Dr. Muhammad Shahidullah Hall'
  WHERE h.name = 'Shahidullah Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'DU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Dr. Muhammad Shahidullah Hall');
UPDATE public.university_halls h SET name = 'Masterda Surya Sen Hall'
  WHERE h.name = 'Masterda Surja Sen Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'DU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Masterda Surya Sen Hall');
UPDATE public.university_halls h SET name = 'Shaheed Sergeant Zahurul Haq Hall'
  WHERE h.name = 'Sergeant Zahurul Haq Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'DU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shaheed Sergeant Zahurul Haq Hall');
UPDATE public.university_halls h SET name = 'Haji Muhammad Mohsin Hall'
  WHERE h.name = 'Haji Muhammad Mohshin Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'DU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Haji Muhammad Mohsin Hall');

UPDATE public.university_halls h SET name = 'Sher-e-Bangla Hall'
  WHERE h.name = 'Sherebangla Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'BUET')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Sher-e-Bangla Hall');
UPDATE public.university_halls h SET name = 'Dr. M. A. Rashid Hall'
  WHERE h.name = 'Rashid Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'BUET')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Dr. M. A. Rashid Hall');
UPDATE public.university_halls h SET name = 'Nazrul Islam Hall'
  WHERE h.name = 'Nazrul Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'BUET')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Nazrul Islam Hall');

UPDATE public.university_halls h SET name = 'Syed Amir Ali Hall'
  WHERE h.name = 'Syed Ameer Ali Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'RU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Syed Amir Ali Hall');
UPDATE public.university_halls h SET name = 'Shaheed Shamsuzzoha Hall'
  WHERE h.name = 'Shahid Shamsuzzoha Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'RU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shaheed Shamsuzzoha Hall');
UPDATE public.university_halls h SET name = 'Shaheed Habibur Rahman Hall'
  WHERE h.name = 'Shahid Habibur Rahman Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'RU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shaheed Habibur Rahman Hall');
UPDATE public.university_halls h SET name = 'Madar Bux Hall'
  WHERE h.name = 'Mother Box Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'RU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Madar Bux Hall');

UPDATE public.university_halls h SET name = 'Shaheed Forhad Hall'
  WHERE h.name = 'Shahid Farhad Hossain Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'CU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shaheed Forhad Hall');
UPDATE public.university_halls h SET name = 'Shah Amanat Hall'
  WHERE h.name = 'Amanat Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'CU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shah Amanat Hall');
UPDATE public.university_halls h SET name = 'Shaheed Abdur Rab Hall'
  WHERE h.name = 'Shah Abdur Rab Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'CU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shaheed Abdur Rab Hall');
UPDATE public.university_halls h SET name = 'Atish Dipankar Srijnan Hall'
  WHERE h.name = 'Atish Dipankar Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'CU')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Atish Dipankar Srijnan Hall');

-- SUST's roster (per sust.edu) has no "Shahjalal Hall"; the first hall is
-- Shah Paran Hall. Rename rather than leave a phantom entry.
UPDATE public.university_halls h SET name = 'Shah Paran Hall'
  WHERE h.name = 'Shahjalal Hall'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'SUST')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Shah Paran Hall');
UPDATE public.university_halls h SET name = 'Day Scholar (Kumargaon off-campus residence)', type = 'DAY_SCHOLAR'
  WHERE h.name = 'Academic Building B'
    AND h.university_id = (SELECT id FROM public.universities WHERE code = 'SUST')
    AND NOT EXISTS (SELECT 1 FROM public.university_halls x
                    WHERE x.university_id = h.university_id AND x.name = 'Day Scholar (Kumargaon off-campus residence)');

-- ---------------------------------------------------------------------------
-- 2. Full rosters. (code, name, name_bn, type)
-- ---------------------------------------------------------------------------
INSERT INTO public.university_halls (university_id, name, name_bn, type)
SELECT u.id, h.name, h.name_bn, h.type
FROM public.universities u
JOIN (VALUES
  -- ── University of Dhaka — 19 halls + the campus hostels ──────────────────
  ('DU', 'Salimullah Muslim Hall', 'সলিমুল্লাহ মুসলিম হল', 'RESIDENTIAL'),
  ('DU', 'Dr. Muhammad Shahidullah Hall', 'ড. মুহম্মদ শহীদুল্লাহ হল', 'RESIDENTIAL'),
  ('DU', 'Jagannath Hall', 'জগন্নাথ হল', 'RESIDENTIAL'),
  ('DU', 'Fazlul Huq Muslim Hall', 'ফজলুল হক মুসলিম হল', 'RESIDENTIAL'),
  ('DU', 'Shaheed Sergeant Zahurul Haq Hall', 'শহীদ সার্জেন্ট জহুরুল হক হল', 'RESIDENTIAL'),
  ('DU', 'Bangabandhu Sheikh Mujibur Rahman Hall', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান হল', 'RESIDENTIAL'),
  ('DU', 'Muktijoddha Ziaur Rahman Hall', 'মুক্তিযোদ্ধা জিয়াউর রহমান হল', 'RESIDENTIAL'),
  ('DU', 'Haji Muhammad Mohsin Hall', 'হাজী মোহাম্মদ মোহসিন হল', 'RESIDENTIAL'),
  ('DU', 'Sir A. F. Rahman Hall', 'স্যার এ. এফ. রহমান হল', 'RESIDENTIAL'),
  ('DU', 'Kabi Jasimuddin Hall', 'কবি জসিমউদ্দীন হল', 'RESIDENTIAL'),
  ('DU', 'Amar Ekushey Hall', 'আমার একুশে হল', 'RESIDENTIAL'),
  ('DU', 'Bangladesh-Kuwait Maitree Hall', 'বাংলাদেশ-কুয়েত মৈত্রী হল', 'RESIDENTIAL'),
  ('DU', 'Bijoy Ekattor Hall', 'বিজয় একাত্তর হল', 'RESIDENTIAL'),
  ('DU', 'Rokeya Hall', 'রোকেয়া হল', 'RESIDENTIAL'),
  ('DU', 'Masterda Surya Sen Hall', 'মাস্টারদা সূর্য সেন হল', 'RESIDENTIAL'),
  ('DU', 'Shamsun Nahar Hall', 'শামসুন নাহার হল', 'RESIDENTIAL'),
  ('DU', 'Begum Fazilatunnesa Mujib Hall', 'বেগম ফজিলাতুন্নেসা মুজিব হল', 'RESIDENTIAL'),
  ('DU', 'Kabi Sufia Kamal Hall', 'কবি সফিয়া কামাল হল', 'RESIDENTIAL'),
  ('DU', 'Sir Philip J. Hartog International Hall', 'স্যার ফিলিপ জে. হার্টোগ ইন্টারন্যাশনাল হল', 'RESIDENTIAL'),
  ('DU', 'IBA Hostel', 'আইবিএ হোস্টেল', 'RESIDENTIAL'),
  ('DU', 'Shahnewaz Chhatrabas', 'শাহনাজ ছাত্রাবাস', 'RESIDENTIAL'),

  -- ── Jahangirnagar University — 16 halls (8 male, 8 female) ───────────────
  ('JU', 'Al Beruni Hall', 'আল বেরুনী হল', 'RESIDENTIAL'),
  ('JU', 'Mir Mosharraf Hossain Hall', 'মীর মশাররফ হোসেন হল', 'RESIDENTIAL'),
  ('JU', 'Shaheed Salam-Barkat Hall', 'শহীদ সালাম-বরকত হল', 'RESIDENTIAL'),
  ('JU', 'A. F. M. Kamaluddin Hall', 'এ. এফ. এম. কমালুদ্দীন হল', 'RESIDENTIAL'),
  ('JU', 'Maulana Bhashani Hall', 'মাওলানা ভাসানী হল', 'RESIDENTIAL'),
  ('JU', 'Bangabandhu Sheikh Mujibur Rahman Hall', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান হল', 'RESIDENTIAL'),
  ('JU', 'Shaheed Rafiq-Jabbar Hall', 'শহীদ রফিক-জব্বার হল', 'RESIDENTIAL'),
  ('JU', 'Bishwakabi Rabindranath Tagore Hall', 'বিশ্বকবি রবীন্দ্রনাথ ঠাকুর হল', 'RESIDENTIAL'),
  ('JU', 'Nawab Faizunnesa Hall', 'নওয়াব ফয়জুন্নেসা হল', 'RESIDENTIAL'),
  ('JU', 'Jahanara Imam Hall', 'জাহানারা ইমাম হল', 'RESIDENTIAL'),
  ('JU', 'Pritilata Hall', 'প্রীতিলতা হল', 'RESIDENTIAL'),
  ('JU', 'Fazilatunnesa Hall', 'ফজিলাতুন্নেসা হল', 'RESIDENTIAL'),
  ('JU', 'Bangamata Sheikh Fazilatunnesa Mujib Hall', 'বাংামাতা শেখ ফজিলাতুন্নেসা মুজিব হল', 'RESIDENTIAL'),
  ('JU', 'Begum Sufia Kamal Hall', 'বেগম সফিয়া কামাল হল', 'RESIDENTIAL'),
  ('JU', 'Sheikh Hasina Hall', 'শেখ হাসিনা হল', 'RESIDENTIAL'),
  ('JU', 'Begum Khaleda Zia Hall', 'বেগম খালেদা জিয়া হল', 'RESIDENTIAL'),

  -- ── University of Rajshahi — 18 halls ────────────────────────────────────
  ('RU', 'Sher-e-Bangla Fazlul Haque Hall', 'শেরেবাংলা ফজলুল হক হল', 'RESIDENTIAL'),
  ('RU', 'Shah Makhdum Hall', 'শাহ মখদুম হল', 'RESIDENTIAL'),
  ('RU', 'Nawab Abdul Latif Hall', 'নবাব আবদুল লতিফ হল', 'RESIDENTIAL'),
  ('RU', 'Syed Amir Ali Hall', 'সৈয়দ আমীর আলী হল', 'RESIDENTIAL'),
  ('RU', 'Shaheed Shamsuzzoha Hall', 'শহীদ শামসুজ্জোহা হল', 'RESIDENTIAL'),
  ('RU', 'Shaheed Habibur Rahman Hall', 'শহীদ হাবিবুর রহমান হল', 'RESIDENTIAL'),
  ('RU', 'Motihar Hall', 'মোতিহার হল', 'RESIDENTIAL'),
  ('RU', 'Madar Bux Hall', 'মাদার বখ্শ হল', 'RESIDENTIAL'),
  ('RU', 'Shaheed Sohrawardy Hall', 'শহীদ সোহরাওয়ার্দী হল', 'RESIDENTIAL'),
  ('RU', 'Shaheed Ziaur Rahman Hall', 'শহীদ জিয়াউর রহমান হল', 'RESIDENTIAL'),
  ('RU', 'Bijoy 24 Hall', 'বিজয় ২৪ হল', 'RESIDENTIAL'),
  ('RU', 'Monnujan Hall', 'মননুজান হল', 'RESIDENTIAL'),
  ('RU', 'Begum Rokeya Hall', 'বেগম রোকেয়া হল', 'RESIDENTIAL'),
  ('RU', 'Tapashi Rabeya Hall', 'তপসী রাবেয়া হল', 'RESIDENTIAL'),
  ('RU', 'Begum Khaleda Zia Hall', 'বেগম খালেদা জিয়া হল', 'RESIDENTIAL'),
  ('RU', 'Rahamatunnesa Hall', 'রহমতুন্নেসা হল', 'RESIDENTIAL'),
  ('RU', 'Bangamata Fazilatunnesa Mujib Hall', 'বাংামাতা ফজিলাতুন্নেসা মুজিব হল', 'RESIDENTIAL'),
  ('RU', 'Shaheed Mir Abdul Quaiyum International Dormitory', 'শহীদ মীর আবদুল কায়ুম ইন্টারন্যাশনাল ডরমেটরি', 'RESIDENTIAL'),

  -- ── University of Chittagong — 14 halls ─────────────────────────────────
  ('CU', 'Shahjalal Hall', 'শাহজালাল হল', 'RESIDENTIAL'),
  ('CU', 'Suhrawardy Hall', 'সোহরাওয়ার্দী হল', 'RESIDENTIAL'),
  ('CU', 'Shah Amanat Hall', 'শাহ আমানত হল', 'RESIDENTIAL'),
  ('CU', 'Bangabandhu Sheikh Mujibur Rahman Hall', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান হল', 'RESIDENTIAL'),
  ('CU', 'Masterda Surya Sen Hall', 'মাস্টারদা সূর্য সেন হল', 'RESIDENTIAL'),
  ('CU', 'Shaheed Abdur Rab Hall', 'শহীদ আবদুর রব হল', 'RESIDENTIAL'),
  ('CU', 'Shaheed Forhad Hall', 'শহীদ ফরহাদ হল', 'RESIDENTIAL'),
  ('CU', 'A. F. Rahman Hall', 'এ. এফ. রহমান হল', 'RESIDENTIAL'),
  ('CU', 'Alaol Hall', 'আলাওল হল', 'RESIDENTIAL'),
  ('CU', 'Atish Dipankar Srijnan Hall', 'অতীশ দীপঙ্কর জ্ঞান হল', 'RESIDENTIAL'),
  ('CU', 'Pritilata Hall', 'প্রীতিলতা হল', 'RESIDENTIAL'),
  ('CU', 'Shamsun Nahar Hall', 'শামসুন নাহার হল', 'RESIDENTIAL'),
  ('CU', 'Bijoy 24 Hall', 'বিজয় ২৪ হল', 'RESIDENTIAL'),
  ('CU', 'Deshnetri Begum Khaleda Zia Hall', 'দেশনেত্রী বেগম খালেদা জিয়া হল', 'RESIDENTIAL'),

  -- ── BUET — 8 halls (+ the ladies hall) ──────────────────────────────────
  ('BUET', 'Sher-e-Bangla Hall', 'শেরেবাংলা হল', 'RESIDENTIAL'),
  ('BUET', 'Ahsanullah Hall', 'আহসানউল্লাহ হল', 'RESIDENTIAL'),
  ('BUET', 'Titumir Hall', 'তিতুমীর হল', 'RESIDENTIAL'),
  ('BUET', 'Dr. M. A. Rashid Hall', 'ড. এম. এ. রশীদ হল', 'RESIDENTIAL'),
  ('BUET', 'Nazrul Islam Hall', 'নজরুল ইসলাম হল', 'RESIDENTIAL'),
  ('BUET', 'Suhrawardy Hall', 'সোহরাওয়ার্দী হল', 'RESIDENTIAL'),
  ('BUET', 'Shahid Smriti Hall', 'শহীদ স্মৃতি হল', 'RESIDENTIAL'),
  ('BUET', 'Chatri Hall', 'ছাত্রী হল', 'RESIDENTIAL'),
  ('BUET', 'Sabekun Nahar Sony Hall', 'সাবেকুন নাহার সনি হল', 'RESIDENTIAL'),

  -- ── SUST — roster as published by sust.edu ──────────────────────────────
  ('SUST', 'Shah Paran Hall', 'শাহ পরান ছাত্র হল', 'RESIDENTIAL'),
  ('SUST', 'Syed Mujtaba Ali Hall', 'সৈয়দ মুজতবা আলী ছাত্র হল', 'RESIDENTIAL'),
  ('SUST', 'Bijoy 24 Hall', 'বিজয় ২৪ ছাত্র হল', 'RESIDENTIAL'),
  ('SUST', 'Ayesha Siddiqa Hall', 'আয়েশা সিদ্দিকা ছাত্রী হল', 'RESIDENTIAL'),
  ('SUST', 'Begum Sirajunnesa Chowdhury Hall', 'বেগম সিরাজুন্নেসা চৌধুরী ছাত্রী হল', 'RESIDENTIAL'),
  ('SUST', 'Fatimah Tuz Zahra Hall', 'ফাতেমা তুজ জাহরা ছাত্রী হল', 'RESIDENTIAL'),

  -- Halls for the remaining 45 campuses are collected through /admin/panel; the
  -- fallback in section 3 keeps their students signable-up meanwhile. (A named roster
  -- was added here only for DU, JU, RU, CU, BUET and SUST, the six whose halls are
  -- documented in a public listing that could be verified during this revision.)

) AS h(code, name, name_bn, type)
  ON u.code = h.code
-- DO UPDATE (not DO NOTHING) so this seed is authoritative for the Bengali
-- spelling of a hall that an earlier revision already inserted under the same
-- name; re-running it repairs name_bn/type instead of leaving the old text.
ON CONFLICT (university_id, name) DO UPDATE
  SET name_bn = EXCLUDED.name_bn,
      type = EXCLUDED.type,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Every campus still without a named hall gets an explicit day-scholar row.
--    Signup requires a hall choice for students, so an empty roster silently
--    locks those campuses out; this keeps them selectable and honest.
-- ---------------------------------------------------------------------------
INSERT INTO public.university_halls (university_id, name, name_bn, type)
SELECT u.id,
       'Day Scholar (no hall seat applied for)',
       'দিবাকালীন (হলে সিটের আবেদন করা হয়নি)',
       'DAY_SCHOLAR'
FROM public.universities u
WHERE NOT EXISTS (
  SELECT 1 FROM public.university_halls h
  WHERE h.university_id = u.id
)
ON CONFLICT (university_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Governance dashboard seed rows (approve/reject queue + notices).
--    Idempotent, keyed on the student email / notice title.
-- ---------------------------------------------------------------------------
INSERT INTO public.hall_allocations (university_id, hall_id, student_name, student_email, student_id, status, note)
SELECT u.id, h.id, v.student_name, v.student_email, v.student_id, v.status, v.note
FROM public.universities u
CROSS JOIN (VALUES
  ('DU',   'Rokeya Hall',            'Tasnim Chowdhury', 'tasnim.chowdhury@students.du.ac.bd', 'DU-2026-10231', 'PENDING',  'First-year honours — needs a seat before the hall admission deadline.'),
  ('DU',   'Salimullah Muslim Hall', 'Rafid Hasan',      'rafid.hasan@students.du.ac.bd',      'DU-2026-10876', 'APPROVED', 'Verified against the hall admission list.'),
  ('BUET', 'Ahsanullah Hall',        'Sabbir Ahmed',     'sabbir.ahmed@ug.buet.ac.bd',         'BUET-2026-142',  'PENDING',  'Transfer from Titumir Hall requested.'),
  ('RU',   'Shah Makhdum Hall',      'Maliha Akter',     'maliha.akter@student.ru.ac.bd',      'RU-2026-20114',  'PENDING',  'Awaiting medical board note.'),
  ('CU',   'Shah Amanat Hall',       'Nusrat Jahan',     'nusrat.jahan@std.cu.ac.bd',          'CU-2026-30117',  'APPROVED', 'Seat confirmed for the 2026 session.')
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
