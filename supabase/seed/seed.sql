-- supabase/seed/seed.sql
-- Comprehensive seed of all Bangladesh Public Universities across all 6 categories,
-- including EN/BN names, campus coordinates, official primary & secondary email domains,
-- departments, residential halls, governing units, and complaint routing SLAs.

BEGIN;

INSERT INTO public.universities (code, name_en, name_bn, category, city, lat, lng, logo_url)
VALUES
  -- GENERAL UNIVERSITIES
  ('JU', 'Jahangirnagar University', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', 'GENERAL', 'Savar, Dhaka', 23.8791, 90.2674, '/logos/ju.svg'),
  ('DU', 'University of Dhaka', 'ঢাকা বিশ্ববিদ্যালয়', 'GENERAL', 'Dhaka', 23.7340, 90.3928, '/logos/du.svg'),
  ('RU', 'University of Rajshahi', 'রাজশাহী বিশ্ববিদ্যালয়', 'GENERAL', 'Rajshahi', 24.3686, 88.6366, '/logos/ru.svg'),
  ('CU', 'University of Chittagong', 'চট্টগ্রাম বিশ্ববিদ্যালয়', 'GENERAL', 'Chattogram', 22.4706, 91.7875, '/logos/cu.svg'),
  ('IU', 'Islamic University, Bangladesh', 'ইসলামী বিশ্ববিদ্যালয়, বাংলাদেশ', 'GENERAL', 'Kushtia', 23.7231, 89.1516, '/logos/iu.svg'),
  ('KU', 'Khulna University', 'খুলনা বিশ্ববিদ্যালয়', 'GENERAL', 'Khulna', 22.8015, 89.5335, '/logos/ku.svg'),
  ('JNU', 'Jagannath University', 'জগন্নাথ বিশ্ববিদ্যালয়', 'GENERAL', 'Dhaka', 23.7087, 90.4114, '/logos/jnu.svg'),
  ('COU', 'Comilla University', 'কুমিল্লা বিশ্ববিদ্যালয়', 'GENERAL', 'Cumilla', 23.4337, 91.1364, '/logos/cou.svg'),
  ('JKKNIU', 'Jatiya Kabi Kazi Nazrul Islam University', 'জাতীয় কবি কাজী নজরুল ইসলাম বিশ্ববিদ্যালয়', 'GENERAL', 'Trishal, Mymensingh', 24.5786, 90.3769, '/logos/jkkniu.svg'),
  ('BRUR', 'Begum Rokeya University, Rangpur', 'বেগম রোকেয়া বিশ্ববিদ্যালয়, রংপুর', 'GENERAL', 'Rangpur', 25.7165, 89.2610, '/logos/brur.svg'),
  ('BUP', 'Bangladesh University of Professionals', 'বাংলাদেশ ইউনিভার্সিটি অব প্রফেশনালস', 'GENERAL', 'Mirpur, Dhaka', 23.8384, 90.3578, '/logos/bup.svg'),
  ('BU', 'University of Barishal', 'বরিশাল বিশ্ববিদ্যালয়', 'GENERAL', 'Barishal', 22.6585, 90.3821, '/logos/bu.svg'),
  ('RABINDRA', 'Rabindra University, Bangladesh', 'রবীন্দ্র বিশ্ববিদ্যালয়, বাংলাদেশ', 'GENERAL', 'Shahzadpur, Sirajganj', 24.1670, 89.5891, '/logos/rabindra.svg'),
  ('SHU', 'Netrokona University (Sheikh Hasina University)', 'নেত্রকোনা বিশ্ববিদ্যালয়', 'GENERAL', 'Netrokona', 24.8750, 90.7310, '/logos/shu.svg'),
  ('KKU', 'Kishoreganj University', 'কিশোরগঞ্জ বিশ্ববিদ্যালয়', 'GENERAL', 'Kishoreganj', 24.4390, 90.7820, '/logos/kku.svg'),
  ('MEU', 'Meherpur University', 'মেহেরপুর বিশ্ববিদ্যালয়', 'GENERAL', 'Meherpur', 23.7750, 88.6310, '/logos/meu.svg'),

  -- SCIENCE & TECHNOLOGY UNIVERSITIES
  ('SUST', 'Shahjalal University of Science and Technology', 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Sylhet', 24.9172, 91.8319, '/logos/sust.svg'),
  ('HSTU', 'Hajee Mohammad Danesh Science and Technology University', 'হাজী মোহাম্মদ দানেশ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Dinajpur', 25.6987, 88.6562, '/logos/hstu.svg'),
  ('MBSTU', 'Mawlana Bhashani Science and Technology University', 'মাওলানা ভাসানী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Tangail', 24.2348, 89.8906, '/logos/mbstu.svg'),
  ('PSTU', 'Patuakhali Science and Technology University', 'পটুয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Dumki, Patuakhali', 22.4646, 90.3825, '/logos/pstu.svg'),
  ('NSTU', 'Noakhali Science and Technology University', 'নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Noakhali', 22.7918, 91.1021, '/logos/nstu.svg'),
  ('JUST', 'Jashore University of Science and Technology', 'যশোর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Jashore', 23.2336, 89.1254, '/logos/just.svg'),
  ('PUST', 'Pabna University of Science and Technology', 'পাবনা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Pabna', 24.0128, 89.2797, '/logos/pust.svg'),
  ('BSMRSTU', 'Gopalganj Science and Technology University (BSMRSTU)', 'গোপালগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Gopalganj', 22.9647, 89.8181, '/logos/bsmrstu.svg'),
  ('RMSTU', 'Rangamati Science and Technology University', 'রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Rangamati', 22.6372, 92.1890, '/logos/rmstu.svg'),
  ('BSFMSTU', 'Jamalpur Science and Technology University (BSFMSTU)', 'জামালপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Jamalpur', 24.9225, 89.9463, '/logos/bsfmstu.svg'),
  ('CSTU', 'Chandpur Science and Technology University', 'চাঁদপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Chandpur', 23.2321, 90.6631, '/logos/cstu.svg'),
  ('SUNAMSTU', 'Sunamganj Science and Technology University', 'সুনামগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Sunamganj', 24.8710, 91.4021, '/logos/sunamstu.svg'),
  ('BSTU', 'Bogura Science and Technology University', 'বগুড়া বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Bogura', 24.8481, 89.3730, '/logos/bstu.svg'),
  ('LSTU', 'Lakshmipur Science and Technology University', 'লক্ষ্মীপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'SCIENCE_AND_TECH', 'Lakshmipur', 22.9447, 90.8282, '/logos/lstu.svg'),

  -- ENGINEERING UNIVERSITIES
  ('BUET', 'Bangladesh University of Engineering and Technology', 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়', 'ENGINEERING', 'Dhaka', 23.7266, 90.3926, '/logos/buet.svg'),
  ('CUET', 'Chittagong University of Engineering & Technology', 'চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়', 'ENGINEERING', 'Raozan, Chattogram', 22.4620, 91.9711, '/logos/cuet.svg'),
  ('KUET', 'Khulna University of Engineering & Technology', 'খুলনা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়', 'ENGINEERING', 'Khulna', 22.9005, 89.5024, '/logos/kuet.svg'),
  ('RUET', 'Rajshahi University of Engineering & Technology', 'রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়', 'ENGINEERING', 'Rajshahi', 24.3636, 88.6284, '/logos/ruet.svg'),
  ('DUET', 'Dhaka University of Engineering & Technology, Gazipur', 'ঢাকা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়, গাজীপুর', 'ENGINEERING', 'Gazipur', 24.0177, 90.4193, '/logos/duet.svg'),

  -- AGRICULTURAL & VETERINARY UNIVERSITIES
  ('BAU', 'Bangladesh Agricultural University', 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Mymensingh', 24.7244, 90.4366, '/logos/bau.svg'),
  ('BSMRAU', 'Gazipur Agricultural University (BSMRAU)', 'গাজীপুর কৃষি বিশ্ববিদ্যালয় (বশেমুরকৃবি)', 'AGRICULTURAL', 'Gazipur', 24.0378, 90.3997, '/logos/bsmrau.svg'),
  ('SAU', 'Sher-e-Bangla Agricultural University', 'শেরেবাংলা কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Dhaka', 23.7715, 90.3752, '/logos/sau.svg'),
  ('SBAU', 'Sylhet Agricultural University', 'সিলেট কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Sylhet', 24.9097, 91.9016, '/logos/sbau.svg'),
  ('CVASU', 'Chattogram Veterinary and Animal Sciences University', 'চট্টগ্রাম ভেটেরিনারি ও এনিম্যাল সাইন্সেস বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Chattogram', 22.3621, 91.8044, '/logos/cvasu.svg'),
  ('KAU', 'Khulna Agricultural University', 'খুলনা কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Khulna', 22.8456, 89.5403, '/logos/kau.svg'),
  ('HAU', 'Habiganj Agricultural University', 'হবিগঞ্জ কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Habiganj', 24.3840, 91.4160, '/logos/hau.svg'),
  ('KURIAU', 'Kurigram Agricultural University', 'কুড়িগ্রাম কৃষি বিশ্ববিদ্যালয়', 'AGRICULTURAL', 'Kurigram', 25.8072, 89.6295, '/logos/kuriau.svg'),

  -- SPECIALIZED UNIVERSITIES (TEXTILE, MARITIME, AVIATION, DIGITAL, MEDICAL)
  ('BUTEX', 'Bangladesh University of Textiles', 'বাংলাদেশ টেক্সটাইল বিশ্ববিদ্যালয়', 'SPECIALIZED', 'Tejgaon, Dhaka', 23.7604, 90.4005, '/logos/butex.svg'),
  ('BSMRMU', 'Bangabandhu Sheikh Mujibur Rahman Maritime University', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান মেরিটাইম ইউনিভার্সিটি', 'SPECIALIZED', 'Mirpur, Dhaka', 23.8295, 90.3652, '/logos/bsmrmu.svg'),
  ('BSMRAAU', 'Bangabandhu Sheikh Mujibur Rahman Aviation and Aerospace University', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান এভিয়েশন অ্যান্ড অ্যারোস্পেস বিশ্ববিদ্যালয়', 'SPECIALIZED', 'Lalmonirhat', 25.9167, 89.4500, '/logos/bsmraau.svg'),
  ('BDU', 'Gazipur Digital University (Bangabandhu Sheikh Mujibur Rahman Digital University)', 'গাজীপুর ডিজিটাল ইউনিভার্সিটি', 'SPECIALIZED', 'Kaliakair, Gazipur', 24.0754, 90.2286, '/logos/bdu.svg'),
  ('BSMMU', 'Bangabandhu Sheikh Mujib Medical University', 'বঙ্গবন্ধু শেখ মুজিব মেডিকেল বিশ্ববিদ্যালয়', 'SPECIALIZED', 'Shahbagh, Dhaka', 23.7389, 90.3948, '/logos/bsmmu.svg'),

  -- OPEN & AFFILIATING UNIVERSITIES
  ('NU', 'National University, Bangladesh', 'জাতীয় বিশ্ববিদ্যালয়, বাংলাদেশ', 'OPEN_AND_AFFILIATING', 'Gazipur', 23.9501, 90.3807, '/logos/nu.svg'),
  ('BOU', 'Bangladesh Open University', 'বাংলাদেশ উন্মুক্ত বিশ্ববিদ্যালয়', 'OPEN_AND_AFFILIATING', 'Gazipur', 23.9472, 90.3802, '/logos/bou.svg'),
  ('IAU', 'Islamic Arabic University', 'ইসলামি আরবি বিশ্ববিদ্যালয়', 'OPEN_AND_AFFILIATING', 'Mohammadpur, Dhaka', 23.7548, 90.3587, '/logos/iau.svg')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Authentic campus photography + institutional logos (Wikimedia Commons).
--
-- The home feed used to show one generic illustration for every university.
-- These are real photographs of the campuses, served from Wikimedia Commons
-- via Special:FilePath (a stable, width-respecting redirect) and real
-- institutional logo files from Wikipedia/Wikimedia. Attribution and licence
-- details for every file are in docs/IMAGE_ATTRIBUTION.md.
--
-- Only the six flagship campuses are overwritten here; every other university
-- keeps its local monogram crest and the shared gradient fallback. The
-- `seed_massive_demo_content.sql` placeholder pass only touches rows whose
-- cover is still NULL or a local `/campuses/*.jpg` path, so these URLs survive.
-- ---------------------------------------------------------------------------
UPDATE public.universities AS u
SET cover_image_url = v.cover_image_url,
    logo_url = v.logo_url
FROM (
  VALUES
    (
      'DU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg'
    ),
    (
      'JU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Shaheed_Minar_of_Jahangirnagar_University.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/a/a9/Jahangirnagar_University_Logo.svg'
    ),
    (
      'BUET',
      'https://commons.wikimedia.org/wiki/Special:FilePath/BUET_Campus_(01).jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg'
    ),
    (
      'SUST',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Sust_campus_5.JPG?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/d/d9/Shahjalal_University_of_Science_and_Technology_logo.png'
    ),
    (
      'CU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Campus,_University_of_Chittagong_1.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/8/86/University_of_Chittagong_logo.svg'
    ),
    (
      'RU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Rajshahi_University_Campus.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/commons/4/4f/%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg'
    )
) AS v(code, cover_image_url, logo_url)
WHERE u.code = v.code;

-- Seed Primary & Secondary Official Email Domains for all seeded universities
INSERT INTO public.university_email_domains (university_id, domain, is_primary)
SELECT id, lower(code) || '.ac.bd', true FROM public.universities WHERE code NOT IN ('JU', 'DU', 'BUET', 'SUST', 'RU', 'CU')
ON CONFLICT (domain) DO NOTHING;

INSERT INTO public.university_email_domains (university_id, domain, is_primary)
VALUES
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'juniv.edu', true),
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'student.juniv.edu', false),
  ((SELECT id FROM public.universities WHERE code = 'DU'), 'du.ac.bd', true),
  ((SELECT id FROM public.universities WHERE code = 'DU'), 'students.du.ac.bd', false),
  ((SELECT id FROM public.universities WHERE code = 'BUET'), 'buet.ac.bd', true),
  ((SELECT id FROM public.universities WHERE code = 'BUET'), 'ug.buet.ac.bd', false),
  ((SELECT id FROM public.universities WHERE code = 'SUST'), 'sust.edu', true),
  ((SELECT id FROM public.universities WHERE code = 'SUST'), 'student.sust.edu', false),
  ((SELECT id FROM public.universities WHERE code = 'RU'), 'ru.ac.bd', true),
  ((SELECT id FROM public.universities WHERE code = 'CU'), 'cu.ac.bd', true),
  ((SELECT id FROM public.universities WHERE code = 'CU'), 'std.cu.ac.bd', false)
ON CONFLICT (domain) DO NOTHING;

-- Automatically generate standard departments (CSE, EEE, Economics, Physics, English, Pharmacy) for all universities
INSERT INTO public.departments (university_id, code, name_en, name_bn, faculty_en, faculty_bn)
SELECT
  u.id,
  d.code,
  d.name_en,
  d.name_bn,
  d.faculty_en,
  d.faculty_bn
FROM public.universities u
CROSS JOIN (
  VALUES
    ('CSE', 'Computer Science and Engineering', 'কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং', 'Mathematical & Physical Sciences', 'গাণিতিক ও পদার্থবিষয়ক অনুষদ'),
    ('EEE', 'Electrical and Electronic Engineering', 'ইলেকট্রিক্যাল অ্যান্ড ইলেকট্রনিক ইঞ্জিনিয়ারিং', 'Engineering & Technology', 'প্রকৌশল ও প্রযুক্তি অনুষদ'),
    ('ECON', 'Economics', 'অর্থনীতি', 'Social Sciences', 'সমাজবিজ্ঞান অনুষদ'),
    ('PHARM', 'Pharmacy', 'ফার্মেসি', 'Biological Sciences', 'জীববিজ্ঞান অনুষদ'),
    ('ENG', 'English', 'ইংরেজি', 'Arts & Humanities', 'কলা ও মানবিকী অনুষদ'),
    ('PHYS', 'Physics', 'পদার্থবিজ্ঞান', 'Mathematical & Physical Sciences', 'গাণিতিক ও পদার্থবিষয়ক অনুষদ')
) AS d(code, name_en, name_bn, faculty_en, faculty_bn)
ON CONFLICT (university_id, code) DO NOTHING;

-- Seed Halls for JU, DU, BUET, SUST + standard halls for all universities
INSERT INTO public.halls (university_id, code, name_en, name_bn, gender_policy, lat, lng)
VALUES
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'ABH', 'Al-Beruni Hall', 'আল বেরুনী হল', 'MALE', 23.8812, 90.2689),
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'MMH', 'Mir Mosharraf Hossain Hall', 'মীর মশাররফ হোসেন হল', 'MALE', 23.8745, 90.2698),
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'NFIH', 'Nawab Faizunnesa Hall', 'নওয়াব ফয়জুন্নেসা হল', 'FEMALE', 23.8825, 90.2651),
  ((SELECT id FROM public.universities WHERE code = 'JU'), 'JAH', 'Jahanara Imam Hall', 'জাহানারা ইমাম হল', 'FEMALE', 23.8832, 90.2644),
  ((SELECT id FROM public.universities WHERE code = 'DU'), 'SH', 'Salimullah Muslim Hall', 'সলিমুল্লাহ মুসলিম হল', 'MALE', 23.7289, 90.3910),
  ((SELECT id FROM public.universities WHERE code = 'DU'), 'RH', 'Rokeya Hall', 'রোকেয়া হল', 'FEMALE', 23.7332, 90.3935),
  ((SELECT id FROM public.universities WHERE code = 'BUET'), 'AH', 'Ahsanullah Hall', 'আহসানউল্লাহ হল', 'MALE', 23.7265, 90.3905),
  ((SELECT id FROM public.universities WHERE code = 'BUET'), 'SCH', 'Sabekun Nahar Sony Hall', 'সাবেকুন নাহার সনি হল', 'FEMALE', 23.7255, 90.3931)
ON CONFLICT (university_id, code) DO NOTHING;

-- Seed Governing Units (Registrar, Dean of Students, Proctor, Counseling Cell, Anti-Harassment Cell) for every university
INSERT INTO public.governing_units (university_id, unit_code, name_en, name_bn, contact_email, emergency_phone, office_location_en, office_location_bn)
SELECT
  u.id,
  g.unit_code,
  g.name_en,
  g.name_bn,
  lower(g.unit_code) || '@' || lower(u.code) || '.ac.bd',
  '+880-2-7791045',
  g.office_en,
  g.office_bn
FROM public.universities u
CROSS JOIN (
  VALUES
    ('PROCTOR', 'Office of the Proctor', 'প্রক্টর অফিস', 'Administrative Building, Ground Floor', 'প্রশাসনিক ভবন, নিচতলা'),
    ('ANTI_HARASSMENT', 'Sexual Harassment & Ragging Prevention Cell', 'যৌন নিপীড়ন ও র‍্যাগিং প্রতিরোধ সেল', 'Student Welfare Center, Room 204', 'ছাত্র কল্যাণ কেন্দ্র, কক্ষ ২০৪'),
    ('COUNSELING', 'Student Counseling & Guidance Center', 'শিক্ষার্থী কাউন্সেলিং ও নির্দেশনা কেন্দ্র', 'TSC Level 3', 'টিএসসি ৩য় তলা'),
    ('DEAN_STUDENTS', 'Office of the Dean of Students & Hall Provost Committee', 'ছাত্র উপদেষ্টা ও হল প্রভোস্ট কমিটি', 'Senate Building, 2nd Floor', 'সিনেট ভবন, ২য় তলা'),
    ('REGISTRAR', 'Office of the Registrar', 'রেজিস্ট্রার অফিস', 'Main Registrar Building', 'মূল রেজিস্ট্রার ভবন')
) AS g(unit_code, name_en, name_bn, office_en, office_bn)
ON CONFLICT (university_id, unit_code) DO NOTHING;

-- Seed Complaint Routing Rules & SLAs per Category for every university
INSERT INTO public.complaint_routing (university_id, category, primary_unit_id, escalation_unit_id, sla_hours)
SELECT
  u.id,
  r.cat::complaint_category,
  (SELECT id FROM public.governing_units gu WHERE gu.university_id = u.id AND gu.unit_code = r.primary_code),
  (SELECT id FROM public.governing_units gu WHERE gu.university_id = u.id AND gu.unit_code = r.esc_code),
  r.sla_hours
FROM public.universities u
CROSS JOIN (
  VALUES
    ('SEXUAL_HARASSMENT', 'ANTI_HARASSMENT', 'PROCTOR', 12),
    ('RAGGING_BULLYING', 'PROCTOR', 'REGISTRAR', 12),
    ('HARASSMENT', 'ANTI_HARASSMENT', 'PROCTOR', 24),
    ('HEALTH', 'COUNSELING', 'DEAN_STUDENTS', 24),
    ('HALL_RESIDENCE', 'DEAN_STUDENTS', 'PROCTOR', 48),
    ('ACADEMIC', 'REGISTRAR', 'DEAN_STUDENTS', 72),
    ('FINANCIAL', 'REGISTRAR', 'DEAN_STUDENTS', 72),
    ('INFRASTRUCTURE', 'REGISTRAR', 'PROCTOR', 96),
    ('TRANSPORT', 'PROCTOR', 'REGISTRAR', 48),
    ('DISCRIMINATION', 'ANTI_HARASSMENT', 'REGISTRAR', 24),
    ('OTHER', 'DEAN_STUDENTS', 'REGISTRAR', 72)
) AS r(cat, primary_code, esc_code, sla_hours)
ON CONFLICT (university_id, category) DO NOTHING;

COMMIT;
