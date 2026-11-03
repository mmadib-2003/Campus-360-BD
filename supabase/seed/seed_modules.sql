-- supabase/seed/seed_modules.sql
-- Reference data for the 12 interactive modules (run after seed.sql).
-- Demo activity rows live in supabase/seed/seed_demo_activity.sql.

BEGIN;

-- ---------------------------------------------------------------------------
-- Module 5 — campus medical & counselling helplines for every university
-- ---------------------------------------------------------------------------
INSERT INTO public.health_contacts (university_id, kind, label_en, label_bn, phone, available_hours, notes_en, notes_bn)
SELECT
  u.id,
  h.kind::text,
  h.label_en,
  h.label_bn,
  h.phone,
  h.hours,
  h.notes_en,
  h.notes_bn
FROM public.universities u
CROSS JOIN (
  VALUES
    ('AMBULANCE', 'Campus Ambulance', 'ক্যাম্পাস অ্যাম্বুলেন্স', '+880-2-7791045', '24/7',
     'Medical Center dispatch. Average response inside campus: 4 minutes.',
     'মেডিকেল সেন্টার ডিসপ্যাচ, ক্যাম্পাসে গড় সাড়া ৪ মিনিট।'),
    ('MEDICAL_CENTER', 'University Medical Center', 'বিশ্ববিদ্যালয় মেডিকেল সেন্টার', '+880-2-7791050', '08:00 – 22:00',
     'Free OPD for students carrying a valid ID card.',
     'বৈধ আইডি কার্ড থাকলে শিক্ষার্থীদের জন্য বিনামূল্যে অপিডি।'),
    ('COUNSELING', 'Student Counseling Cell', 'শিক্ষার্থী কাউন্সেলিং সেল', '+880-2-7791033', '10:00 – 17:00',
     'Confidential support. Anonymous booking available in the app.',
     'গোপনীয় সহায়তা। অ্যাপে নামহীন বুকিং সম্ভব।'),
    ('SECURITY', 'Campus Security Control Room', 'ক্যাম্পাস নিরাপত্তা কন্ট্রোল রুম', '+880-2-7791020', '24/7',
     'Proctor and security escalation line for unsafe areas.',
     'অনিরাপদ এলাকার জন্য প্রক্টর ও নিরাপত্তা হটলাইন।'),
    ('NATIONAL', 'National Emergency Service', 'জাতীয় জরুরি সেবা', '999', '24/7',
     'Police, fire service and ambulance dispatch.',
     'পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স।')
) AS h(kind, label_en, label_bn, phone, hours, notes_en, notes_bn)
WHERE NOT EXISTS (
  SELECT 1 FROM public.health_contacts hc
  WHERE hc.university_id = u.id AND hc.kind = h.kind
);

-- ---------------------------------------------------------------------------
-- Module 1 — monitored campus pickup points / locker system
-- ---------------------------------------------------------------------------
INSERT INTO public.campus_pickup_points (university_id, code, name_en, name_bn, location_en, location_bn)
SELECT
  u.id,
  p.code,
  p.name_en,
  p.name_bn,
  p.location_en,
  p.location_bn
FROM public.universities u
CROSS JOIN (
  VALUES
    ('LIB-A', 'Central Library Locker A', 'কেন্দ্রীয় লাইব্রেরি লকার এ', 'Ground floor, beside the help desk', 'নিচতলা, হেল্প ডেস্কের পাশে'),
    ('TSC-1', 'TSC Security Desk', 'টিএসসি সিকিউরিটি ডেস্ক', 'TSC main entrance', 'টিএসসি প্রধান ফটক'),
    ('HALL-C', 'Halls Zone C Gate', 'হল জোন সি গেট', 'Between the residential halls, security post', 'হল এলাকার নিরাপত্তা পোস্ট')
) AS p(code, name_en, name_bn, location_en, location_bn)
ON CONFLICT (university_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Module 11 — sports venues
-- ---------------------------------------------------------------------------
INSERT INTO public.sports_venues (university_id, name_en, name_bn, sport, capacity, hourly_rate_bdt, lat, lng)
SELECT
  u.id,
  v.name_en,
  v.name_bn,
  v.sport,
  v.capacity,
  v.rate,
  u.lat,
  u.lng
FROM public.universities u
CROSS JOIN (
  VALUES
    ('Central Field (Football)', 'কেন্দ্রীয় মাঠ (ফুটবল)', 'Football', 22, 0::numeric),
    ('Gymnasium — Badminton Court', 'জিমনেসিয়াম — ব্যাডমিন্টন কোর্ট', 'Badminton', 4, 150::numeric),
    ('Cricket Practice Nets', 'ক্রিকেট প্র্যাকটিস নেট', 'Cricket', 12, 100::numeric)
) AS v(name_en, name_bn, sport, capacity, rate)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sports_venues sv
  WHERE sv.university_id = u.id AND sv.name_en = v.name_en
);

-- ---------------------------------------------------------------------------
-- Module 4 — a starter set of clubs for every university
-- ---------------------------------------------------------------------------
INSERT INTO public.clubs (university_id, slug, name_en, name_bn, category, description_en, description_bn, is_recruiting)
SELECT
  u.id,
  c.slug,
  c.name_en,
  c.name_bn,
  c.category,
  c.description_en,
  c.description_bn,
  true
FROM public.universities u
CROSS JOIN (
  VALUES
    ('debate-club', 'Debate Club', 'ডিবেট ক্লাব', 'Debate',
     'Weekly parliamentary debates, workshops and national tournament preparation.',
     'সাপ্তাহিক বিতর্ক, কর্মশালা ও জাতীয় প্রতিযোগিতার প্রস্তুতি।'),
    ('cse-society', 'CSE Society', 'সিএসই সোসাইটি', 'Technology',
     'Hackathons, ICPC bootcamps, open-source sprints and industry talks.',
     'হ্যাকাথন, আইসিপিসি বুটক্যাম্প ও ইন্ডাস্ট্রি টক।'),
    ('photography-society', 'Photography Society', 'ফটোগ্রাফি সোসাইটি', 'Arts',
     'Campus photowalks, darkroom sessions and an annual exhibition.',
     'ক্যাম্পাস ফটোওয়াক ও বার্ষিক প্রদর্শনী।'),
    ('volunteer-network', 'Volunteer Network', 'ভলান্টিয়ার নেটওয়ার্ক', 'Volunteering',
     'Blood donation drives, flood relief and community tutoring programmes.',
     'রক্তদান কর্মসূচি, বন্যা ত্রাণ ও কমিউনিটি টিউটরিং।')
) AS c(slug, name_en, name_bn, category, description_en, description_bn)
ON CONFLICT (university_id, slug) DO NOTHING;

COMMIT;
