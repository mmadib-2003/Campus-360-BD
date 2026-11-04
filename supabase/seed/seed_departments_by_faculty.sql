-- supabase/seed/seed_departments_by_faculty.sql
-- ============================================================================
-- Department registry for all 51 public universities, structured as:
--   • one row per (target, department code) where `target` is either a
--     university CODE (per-campus override) or a university CATEGORY
--     (applied to every campus in that category);
--   • a single INSERT … JOIN, so re-running after a new campus is added picks
--     the new campus up automatically.
--
-- Why templates: the UGC honours roster for a general university is genuinely
-- common across DU/RU/CU/KU/IU/COU/… (Bangla, English, History, Philosophy,
-- Political Science, Economics, Botany, Zoology, Physics, Chemistry, Math,
-- Statistics …), while distinctive departments are added as overrides (SUST's
-- Landscape Design and Petroleum & Mining, BUTEX's yarn/fabric/apparel stream,
-- BOU's Health & Family Sciences, the agricultural faculties, BSMMU's clinical
-- departments). Department codes reuse the ones supabase/seed/seed.sql already
-- inserts (ENG, ECON, CSE, EEE, PHYS, PHARM) so `ON CONFLICT` de-duplicates
-- instead of creating a second row for the same department.
--
-- This is a registry seed, not an authority: /admin/panel edits departments per
-- campus, and a campus that lists an extra department (e.g. IUB's "Islamic
-- Banking") simply needs that row added there. Run after supabase/seed/seed.sql
-- (same dependency as the hall seed: everything reads FROM public.universities).
-- ============================================================================

BEGIN;

INSERT INTO public.departments (university_id, code, name_en, name_bn, faculty_en, faculty_bn)
SELECT u.id, d.code, d.name_en, d.name_bn, d.faculty_en, d.faculty_bn
FROM public.universities u
JOIN (VALUES
  -- ── GENERAL + OPEN_AND_AFFILIATING: the standard UGC honours roster ──────
  ('GENERAL','BENG','Bangla','বাংলা','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','ENG','English','ইংরেজি','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','HIST','History','ইতিহাস','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','IHC','Islamic History and Culture','ইসলামের ইতিহাস ও সংস্কৃতি','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','PHIL','Philosophy','দর্শন','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','POLS','Political Science','রাষ্ট্রবিজ্ঞান','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','ECON','Economics','অর্থনীতি','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','SOCW','Social Work','সমাজকর্ম','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','PADA','Public Administration','জনপ্রশাসন','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','SOCI','Sociology','সমাজবিজ্ঞান','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','SKT','Sanskrit','সংস্কৃত','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','ISLAM','Islamic Studies','ইসলামিক স্টাডিজ','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','ARAB','Arabic Language and Literature','আরবি ভাষা ও সাহিত্য','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','FA','Fine Arts','ফাইন আর্টস (চাক্ষুষ শিল্প)','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','MUS','Music','সংগীত','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','DPA','Drama and Performance Analysis','নাটক ও পারফরম্যান্স অ্যানালাইসিস','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('GENERAL','LAW','Law','আইন','Law','আইন অনুষদ'),
  ('GENERAL','PHYS','Physics','পদার্থবিজ্ঞান','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','CHEM','Chemistry','রসায়ন','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','MATH','Mathematics','গণিত','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','STAT','Statistics','পরিসংখ্যান','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','CSE','Computer Science and Engineering','কম্পিউটার বিজ্ঞান ও প্রকৌশল','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','ILMS','Information and Library Management Science','তথ্য ও গ্রন্থাগার ব্যবস্থাপনা বিজ্ঞান','Physical Sciences','পদার্থবিজ্ঞান অনুষদ'),
  ('GENERAL','EDU','Education','শিক্ষা','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('GENERAL','PSYC','Psychology','মনোবিজ্ঞান','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','BOT','Botany','উদ্ভিদবিজ্ঞান','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','ZOO','Zoology','প্রাণিবিজ্ঞান','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','BMB','Biochemistry and Molecular Biology','বায়োরসায়ন ও আণবিক জীববিজ্ঞান','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','GEN','Genetics','জিনতত্ত্ব','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','NFS','Nutrition and Food Science','পুষ্টি ও খাদ্য বিজ্ঞান','Biological Sciences','জীববিজ্ঞান অনুষদ'),
  ('GENERAL','IBA','Business Administration (IBA)','ব্যবসায় প্রশাসন (আইবিএ)','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','ACC','Accounting','হিসাববিজ্ঞান','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','FIN','Finance','অর্থ ব্যবস্থাপনা','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','MKT','Marketing','বিপণন','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','MNS','Management','ম্যানেজমেন্ট','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','BIM','Banking and Insurance','ব্যাংক ও বিমা','Business Administration','ব্যবসায় অনুষদ'),
  ('GENERAL','PHARM','Pharmacy','ফার্মেসি','Biological Sciences','জীববিজ্ঞান অনুষদ'),

  ('OPEN_AND_AFFILIATING','BENG','Bangla','বাংলা','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('OPEN_AND_AFFILIATING','ENG','English','ইংরেজি','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('OPEN_AND_AFFILIATING','HIST','History','ইতিহাস','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('OPEN_AND_AFFILIATING','IHC','Islamic History and Culture','ইসলামের ইতিহাস ও সংস্কৃতি','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('OPEN_AND_AFFILIATING','PHIL','Philosophy','দর্শন','Arts & Humanities','কলা ও মানবিক অনুষদ'),
  ('OPEN_AND_AFFILIATING','POLS','Political Science','রাষ্ট্রবিজ্ঞান','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('OPEN_AND_AFFILIATING','ECON','Economics','অর্থনীতি','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('OPEN_AND_AFFILIATING','MGT','Management','ম্যানেজমেন্ট','Business Administration','ব্যবসায় অনুষদ'),
  ('OPEN_AND_AFFILIATING','ACC','Accounting','হিসাববিজ্ঞান','Business Administration','ব্যবসায় অনুষদ'),
  ('OPEN_AND_AFFILIATING','FIN','Finance','অর্থ ব্যবস্থাপনা','Business Administration','ব্যবসায় অনুষদ'),
  ('OPEN_AND_AFFILIATING','MKT','Marketing','বিপণন','Business Administration','ব্যবসায় অনুষদ'),
  ('OPEN_AND_AFFILIATING','LAW','Law','আইন','Law','আইন অনুষদ'),
  ('OPEN_AND_AFFILIATING','PHYS','Physics','পদার্থবিজ্ঞান','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','CHEM','Chemistry','রসায়ন','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','MATH','Mathematics','গণিত','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','STAT','Statistics','পরিসংখ্যান','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','BOT','Botany','উদ্ভিদবিজ্ঞান','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','ZOO','Zoology','প্রাণিবিজ্ঞান','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','CSE','Computer Science and Engineering','কম্পিউটার বিজ্ঞান ও প্রকৌশল','Science & Technology','বিজ্ঞান ও প্রযুক্তি অনুষদ'),
  ('OPEN_AND_AFFILIATING','EDU','Education','শিক্ষা','Humanities & Education','মানবিক ও শিক্ষা অনুষদ'),
  ('OPEN_AND_AFFILIATING','IBA','Business Administration','ব্যবসায় প্রশাসন','Business Administration','ব্যবসায় অনুষদ'),

  -- ── SCIENCE_AND_TECH ───────────────────────────────────────────────────
  ('SCIENCE_AND_TECH','CSE','Computer Science and Engineering','কম্পিউটার বিজ্ঞান ও প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SCIENCE_AND_TECH','EEE','Electrical and Electronic Engineering','তড়িৎ ও ইলেকট্রনিক প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SCIENCE_AND_TECH','ME','Mechanical Engineering','যান্ত্রিক প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SCIENCE_AND_TECH','CE','Civil Engineering','পুরকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SCIENCE_AND_TECH','IPE','Industrial and Production Engineering','শিল্প ও উৎপাদন প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SCIENCE_AND_TECH','PHYS','Physics','পদার্থবিজ্ঞান','Basic Sciences','মূলবিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','CHEM','Chemistry','রসায়ন','Basic Sciences','মূলবিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','MATH','Mathematics','গণিত','Basic Sciences','মূলবিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','STAT','Statistics','পরিসংখ্যান','Basic Sciences','মূলবিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','BMB','Biochemistry and Molecular Biology','বায়োরসায়ন ও আণবিক জীববিজ্ঞান','Life Sciences','জীববিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','BOT','Botany','উদ্ভিদবিজ্ঞান','Life Sciences','জীববিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','ZOO','Zoology','প্রাণিবিজ্ঞান','Life Sciences','জীববিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','GES','Geography and Environmental Science','ভূগোল ও পরিবেশ বিজ্ঞান','Earth & Environmental Sciences','ভূবিজ্ঞান ও পরিবেশ অনুষদ'),
  ('SCIENCE_AND_TECH','ECON','Economics','অর্থনীতি','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('SCIENCE_AND_TECH','BBA','Business Administration','ব্যবসায় প্রশাসন','Business Administration','ব্যবসায় অনুষদ'),

  -- ── ENGINEERING ────────────────────────────────────────────────────────
  ('ENGINEERING','CE','Civil Engineering','পুরকৌশল','Civil Engineering','পুরকৌশল অনুষদ'),
  ('ENGINEERING','EEE','Electrical and Electronic Engineering','তড়িৎ ও ইলেকট্রনিক প্রকৌশল','Electrical & Electronic Engineering','তড়িৎ ও ইলেকট্রনিক প্রকৌশল অনুষদ'),
  ('ENGINEERING','ME','Mechanical Engineering','যান্ত্রিক প্রকৌশল','Mechanical & Production Engineering','যান্ত্রিক ও উৎপাদন প্রকৌশল অনুষদ'),
  ('ENGINEERING','CHE','Chemical Engineering','রাসায়নিক প্রকৌশল','Chemical & Food Engineering','রাসায়নিক ও খাদ্য প্রকৌশল অনুষদ'),
  ('ENGINEERING','IPE','Industrial and Production Engineering','শিল্প ও উৎপাদন প্রকৌশল','Mechanical & Production Engineering','যান্ত্রিক ও উৎপাদন প্রকৌশল অনুষদ'),
  ('ENGINEERING','MTE','Materials and Metallurgical Engineering','ম্যাটেরিয়ালস ও ধাতু বিজ্ঞান প্রকৌশল','Materials & Metallurgical Engineering','ম্যাটেরিয়ালস ও ধাতু বিজ্ঞান অনুষদ'),
  ('ENGINEERING','CSE','Computer Science and Engineering','কম্পিউটার বিজ্ঞান ও প্রকৌশল','Electrical & Electronic Engineering','তড়িৎ ও ইলেকট্রনিক প্রকৌশল অনুষদ'),
  ('ENGINEERING','ECE','Electronics and Communication Engineering','ইলেকট্রনিক্স ও যোগাযোগ প্রকৌশল','Electrical & Electronic Engineering','তড়িৎ ও ইলেকট্রনিক প্রকৌশল অনুষদ'),
  ('ENGINEERING','ARCH','Architecture','স্থাপত্য','Architecture & Urban Planning','স্থাপত্য ও নগর পরিকল্পনা অনুষদ'),
  ('ENGINEERING','URP','Urban and Regional Planning','নগর ও আঞ্চলিক পরিকল্পনা','Architecture & Urban Planning','স্থাপত্য ও নগর পরিকল্পনা অনুষদ'),
  ('ENGINEERING','ENV','Environmental Engineering','পরিবেশ প্রকৌশল','Civil Engineering','পুরকৌশল অনুষদ'),

  -- ── AGRICULTURAL ───────────────────────────────────────────────────────
  ('AGRICULTURAL','AGR','Agronomy','উদ্ভিদ উৎপাদন','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','SOIL','Soil Science','মৃত্তিকা বিজ্ঞান','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','GPB','Genetics and Plant Breeding','জিনতত্ত্ব ও উদ্ভিদ প্রজনন','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','ENT','Entomology','কীটতত্ত্ব','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','PLP','Plant Pathology','উদ্ভিদ রোগতত্ত্ব','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','AHE','Agricultural Economics','কৃষি অর্থনীতি','Agricultural Economics & Rural Studies','কৃষি অর্থনীতি ও গ্রামীণ অধ্যয়ন অনুষদ'),
  ('AGRICULTURAL','AEE','Agricultural Extension and Education','কৃষি প্রসার ও শিক্ষা','Agricultural Economics & Rural Studies','কৃষি অর্থনীতি ও গ্রামীণ অধ্যয়ন অনুষদ'),
  ('AGRICULTURAL','RURSOC','Rural Sociology','গ্রামীণ সমাজবিজ্ঞান','Agricultural Economics & Rural Studies','কৃষি অর্থনীতি ও গ্রামীণ অধ্যয়ন অনুষদ'),
  ('AGRICULTURAL','FPME','Farm Power and Machinery','কৃষি যান্ত্রিকীকরণ (ফার্ম পাওয়ার ও মেশিনারি)','Agricultural Engineering','কৃষি প্রকৌশল অনুষদ'),
  ('AGRICULTURAL','HORT','Horticulture','উদ্যানতত্ত্ব (হর্টিকালচার)','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','FOREST','Forestry and Environmental Science','বনায়ন ও পরিবেশ বিজ্ঞান','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','SERI','Sericulture','রেশম কীট পালন (সেরিকালচার)','Agriculture','কৃষি অনুষদ'),
  ('AGRICULTURAL','AFCFT','Food Technology','খাদ্য প্রযুক্তি','Agricultural Chemistry & Food Technology','কৃষি রসায়ন ও খাদ্য প্রযুক্তি অনুষদ'),
  ('AGRICULTURAL','AGCH','Agricultural Chemistry','কৃষি রসায়ন','Agricultural Chemistry & Food Technology','কৃষি রসায়ন ও খাদ্য প্রযুক্তি অনুষদ'),
  ('AGRICULTURAL','BMB','Biochemistry and Molecular Biology','বায়োরসায়ন ও আণবিক জীববিজ্ঞান','Biology','জীববিজ্ঞান অনুষদ'),
  ('AGRICULTURAL','HND','Human Nutrition and Dietetics','মানব পুষ্টি ও ডায়েটটিক্স','Biology','জীববিজ্ঞান অনুষদ'),
  ('AGRICULTURAL','VASC','Veterinary and Animal Science','পশুচিকিৎসা ও প্রাণিবিজ্ঞান','Veterinary & Animal Science','পশুচিকিৎসা ও প্রাণিবিজ্ঞান অনুষদ'),
  ('AGRICULTURAL','FS','Fisheries Science','মৎস্য বিজ্ঞান','Fisheries & Marine Science','মৎস্য ও সমুদ্রবিজ্ঞান অনুষদ'),
  ('AGRICULTURAL','ENG','English','ইংরেজি','Basic Sciences & Humanities','মূলবিজ্ঞান ও মানবিক অনুষদ'),

  -- ── SUST / engineering-campus overrides ────────────────────────────────
  ('SUST','CFT','Chemical and Food Technology','রাসায়নিক ও খাদ্য প্রযুক্তি','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SUST','PME','Petroleum and Mining Engineering','জীবাশ্ম ও খনিজ প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('SUST','LAND','Landscape Design','ভূদৃশ্য নকশা (ল্যান্ডস্কেপ ডিজাইন)','Agriculture','কৃষি অনুষদ'),
  ('SUST','ARCH','Architecture','স্থাপত্য','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('MBSTU','TEXT','Textile Engineering','টেক্সটাইল প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('MBSTU','ACCE','Applied Chemistry and Chemical Engineering','প্রয়োগিক রসায়ন ও রাসায়নিক প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('MBSTU','FMS','Fisheries and Marine Science','মৎস্য ও সমুদ্রবিজ্ঞান','Life Sciences','জীববিজ্ঞান অনুষদ'),
  ('PSTU','AQ','Aquaculture','মৎস্য চাষ (অ্যাকুয়াকালচার)','Marine & Fisheries','মৎস্য ও সমুদ্র অনুষদ'),
  ('PSTU','MAR','Marine Science','সামুদ্রিক বিজ্ঞান','Marine & Fisheries','মৎস্য ও সমুদ্র অনুষদ'),
  ('PSTU','BGE','Biotechnology and Genetic Engineering','জৈবপ্রযুক্তি ও জিন প্রকৌশল','Agricultural & Applied Life Sciences','কৃষি ও প্রয়োগিক জীববিজ্ঞান অনুষদ'),
  ('NSTU','ACCE','Applied Chemistry and Chemical Engineering','প্রয়োগিক রসায়ন ও রাসায়নিক প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('NSTU','THM','Tourism and Hospitality Management','পর্যটন ও হোস্পিটালিটি ম্যানেজমেন্ট','Social Science','সামাজিক বিজ্ঞান অনুষদ'),
  ('NSTU','SOIL','Soil Science','মৃত্তিকা বিজ্ঞান','Life Sciences','জীববিজ্ঞান অনুষদ'),
  ('HSTU','AGR','Agronomy','উদ্ভিদ উৎপাদন','Agriculture','কৃষি অনুষদ'),
  ('HSTU','SOIL','Soil Science','মৃত্তিকা বিজ্ঞান','Agriculture','কৃষি অনুষদ'),
  ('HSTU','AEE','Agricultural Extension and Education','কৃষি প্রসার ও শিক্ষা','Agriculture','কৃষি অনুষদ'),
  ('HSTU','VMAS','Veterinary Medicine and Animal Science','পশুচিকিৎসা ও প্রাণিবিজ্ঞান','Veterinary & Animal Science','পশুচিকিৎসা ও প্রাণিবিজ্ঞান অনুষদ'),
  ('HSTU','FS','Fisheries Science','মৎস্য বিজ্ঞান','Fisheries & Marine Science','মৎস্য ও সমুদ্রবিজ্ঞান অনুষদ'),
  ('JUST','FAC','Fine Arts and Craft','ফাইন আর্টস ও কারুশিল্প','Fine Arts & Craft','ফাইন আর্টস ও কারুশিল্প অনুষদ'),
  ('JUST','ENG','English','ইংরেজি','Humanities & Social Sciences','মানবিক ও সামাজিক বিজ্ঞান অনুষদ'),
  ('JUST','BENG','Bangla','বাংলা','Humanities & Social Sciences','মানবিক ও সামাজিক বিজ্ঞান অনুষদ'),
  ('PUST','FS','Fisheries Science','মৎস্য বিজ্ঞান','Agriculture & Fisheries','কৃষি ও মৎস্য অনুষদ'),
  ('RMSTU','IIC','Information and Communication Engineering','তথ্য ও যোগাযোগ প্রকৌশল','Engineering & Technology','প্রকৌশল ও প্রযুক্তি অনুষদ'),
  ('BSTU','AGR','Agronomy','উদ্ভিদ উৎপাদন','Agriculture','কৃষি অনুষদ'),
  ('BUET','TEXT','Textile Engineering','টেক্সটাইল প্রকৌশল','Chemical & Textile Engineering','রাসায়নিক ও টেক্সটাইল প্রকৌশল অনুষদ'),
  ('RUET','PME','Petroleum and Mining Engineering','জীবাশ্ম ও খনিজ প্রকৌশল','Petroleum & Mining Engineering','জীবাশ্ম ও খনিজ প্রকৌশল অনুষদ'),
  ('DUET','FOOD','Food Technology','খাদ্য প্রযুক্তি','Chemical & Food Engineering','রাসায়নিক ও খাদ্য প্রকৌশল অনুষদ'),
  ('CUET','OCEAN','Oceanography','সমুদ্রবিজ্ঞান','Earth & Environmental Sciences','ভূবিজ্ঞান ও পরিবেশ অনুষদ'),
  ('KUET','TEXT','Textile Engineering','টেক্সটাইল প্রকৌশল','Chemical & Textile Engineering','রাসায়নিক ও টেক্সটাইল প্রকৌশল অনুষদ'),

  -- ── Dhaka / Chittagong / Rajshahi campus-specific departments ──────────
  ('CU','ANTR','Anthropology','নৃবিজ্ঞান','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),
  ('JU','FST','Film Studies','চলচ্চিত্র অধ্যয়ন','Arts & Humanities','কলা ও মানবিক অনুষদ'),

  -- ── BOU distance-education programmes with no counterpart elsewhere ────
  ('BOU','HFS','Health and Family Sciences','স্বাস্থ্য ও পরিবার কল্যাণ','Health & Family Sciences','স্বাস্থ্য ও পরিবার কল্যাণ অনুষদ'),
  ('BOU','AGRSCI','Agriculture','কৃষি','Agricultural Science','কৃষি অনুষদ'),
  ('BOU','DEVS','Development Studies','উন্নয়ন অধ্যয়ন','Social Science','সামাজিক বিজ্ঞান অনুষদ'),
  ('BOU','GWS','Gender and Women''s Studies','লিঙ্গ ও নারী অধ্যয়ন','Humanities & Law','মানবিক ও আইন অনুষদ'),
  ('BOU','ADE','Adult Education','প্রাপ্তবয়স্ক শিক্ষা','Education','শিক্ষা অনুষদ'),
  ('BOU','ISD','Islamic Studies and Dawah','ইসলামিক স্টাডিজ ও দাওয়াহ','Humanities & Law','মানবিক ও আইন অনুষদ'),
  ('NU','MBA','Business Administration (MBA)','ব্যবসায় প্রশাসন (এমবিএ)','Business Administration','ব্যবসায় অনুষদ'),
  ('NU','MPA','Public Administration (MPA)','জনপ্রশাসন (এমপিএ)','Social Sciences','সামাজিক বিজ্ঞান অনুষদ'),

  -- ── BUTEX: the textile engineering stream ─────────────────────────────
  ('BUTEX','YARN','Yarn Engineering','কাঁচা সুতা প্রকৌশল (ইয়ার্ন)','Textile Engineering','টেক্সটাইল প্রকৌশল অনুষদ'),
  ('BUTEX','FAB','Fabric Engineering','কাপড় প্রকৌশল (ফ্যাব্রিক)','Textile Engineering','টেক্সটাইল প্রকৌশল অনুষদ'),
  ('BUTEX','APP','Apparel Engineering','তৈরি পোশাক প্রকৌশল','Textile Engineering','টেক্সটাইল প্রকৌশল অনুষদ'),
  ('BUTEX','TCF','Textile Chemical and Finishing','টেক্সটাইল রাসায়নিক ও ফিনিশিং','Chemistry & Biochemistry','রসায়ন ও জৈবরসায়ন অনুষদ'),
  ('BUTEX','FDT','Fashion Design and Technology','ফ্যাশন ডিজাইন ও প্রযুক্তি','Apparel & Fashion','পোশাক ও ফ্যাশন অনুষদ'),
  ('BUTEX','PMM','Plant, Machinery and Automation','কলকারখানা, যন্ত্রপাতি ও স্বয়ংক্রিয়করণ','Mechanical, Plant & Machinery','যান্ত্রিক ও উদ্ভিদ প্রকৌশল অনুষদ'),

  -- ── BSMMU: clinical and basic medical departments ──────────────────────
  -- (No per-campus copies of ME / IPE / CSE / EEE / BBA here: those campuses
  -- already receive them through their own category template, and a second
  -- source row for the same (university_id, code) would make the upsert below
  -- fail with "ON CONFLICT DO UPDATE command cannot affect row a second time".)
  ('BSMMU','ANAT','Anatomy','অ্যানাটমি (শারীরস্থান)','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','PHYSIOL','Physiology','শারীরতত্ত্ব','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','BIOC','Biochemistry','জৈব রসায়ন','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','PATH','Pathology','রোগতত্ত্ব','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','FM','Forensic Medicine','ফরেনসিক মেডিসিন','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','CBM','Community Based Medicine','কমিউনিটি বেইজড মেডিসিন','Basic Medical Sciences','মূল চিকিৎসা বিজ্ঞান অনুষদ'),
  ('BSMMU','MED','Medicine','মেডিসিন','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','SURG','Surgery','সার্জারি','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','OG','Obstetrics and Gynaecology','প্রসূতি ও স্ত্রীরোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','PEDI','Pediatrics','শিশু রোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','NEUR','Neurology','স্নায়ুরোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','DERM','Dermatology','চর্মরোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','ENT','ENT (Otolaryngology)','নাক, কর্ণ ও গলা','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','OPH','Ophthalmology','চক্ষুরোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','ORT','Orthopedics','হাড়রোগ (অর্থোপেডিক্স)','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','PSY','Psychiatry','মানসিক রোগ','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','ANES','Anesthesiology','অ্যানেসথেসিয়া','Clinical Medicine','চিকিৎসা অনুষদ'),
  ('BSMMU','RAD','Radiology and Imaging','রেডিওলজি ও ইমেজিং','Clinical Medicine','চিকিৎসা অনুষদ')
) AS d(target, code, name_en, name_bn, faculty_en, faculty_bn)
  ON (u.code = d.target OR u.category::text = d.target)
-- Authoritative upsert (same contract as the hall seed): re-running repairs a
-- department's spelling or faculty grouping instead of leaving the old text.
-- Anything edited only in /admin/panel is expected to be upstreamed here.
ON CONFLICT (university_id, code) DO UPDATE
  SET name_en = EXCLUDED.name_en,
      name_bn = EXCLUDED.name_bn,
      faculty_en = EXCLUDED.faculty_en,
      faculty_bn = EXCLUDED.faculty_bn,
      updated_at = now();

COMMIT;
