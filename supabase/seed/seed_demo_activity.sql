-- supabase/seed/seed_demo_activity.sql
-- OPTIONAL demo activity for local development / preview environments.
-- Creates a few verified demo students and sample rows across the 12 modules so
-- every real-time surface can be exercised immediately after `supabase db reset`.
--
-- ⚠️  Never run this against production: it inserts auth users with a known
--     password and demo content.

BEGIN;

DO $$
DECLARE
  v_univ UUID;
  v_dept UUID;
  v_hall UUID;
  v_unit UUID;
  v_demo_password TEXT := '$2a$10$demodemodemodemodemodemoabcdefghijklmnopqrstuvwxyz0123';
  v_students UUID[] := ARRAY[]::UUID[];
  v_ids UUID[];
  v_student UUID;
  v_names TEXT[] := ARRAY['Nusrat Jahan', 'Rafid Hasan', 'Tasnim Chowdhury', 'Sabbir Ahmed'];
  v_emails TEXT[] := ARRAY['nusrat.demo@juniv.edu', 'rafid.demo@juniv.edu', 'tasnim.demo@juniv.edu', 'sabbir.demo@juniv.edu'];
  v_groups TEXT[] := ARRAY['O+', 'B+', 'A+', 'AB+'];
  v_club UUID;
  v_event UUID;
  v_campaign UUID;
  v_idx INT;
  v_market_id UUID;
  v_lost_id UUID;
  v_found_id UUID;
  v_civic UUID;
  v_mentor UUID;
  v_slot UUID;
  v_conv UUID;
BEGIN
  SELECT id INTO v_univ FROM public.universities WHERE code = 'JU' LIMIT 1;
  IF v_univ IS NULL THEN
    RAISE NOTICE 'JU not seeded — skipping demo activity.';
    RETURN;
  END IF;

  SELECT id INTO v_dept FROM public.departments WHERE university_id = v_univ ORDER BY code LIMIT 1;
  SELECT id INTO v_hall FROM public.halls WHERE university_id = v_univ ORDER BY code LIMIT 1;
  SELECT id INTO v_unit FROM public.governing_units WHERE university_id = v_univ AND unit_code = 'PROCTOR' LIMIT 1;

  -- 1. Demo auth users + profiles (email + id verified) --------------------
  FOR v_idx IN 1..array_length(v_names, 1) LOOP
    SELECT id INTO v_student FROM auth.users WHERE email = v_emails[v_idx];
    IF v_student IS NULL THEN
      v_student := gen_random_uuid();
      INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
      VALUES (v_student, v_emails[v_idx], v_demo_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');
    END IF;
    v_students := array_append(v_students, v_student);

    INSERT INTO public.profiles (id, university_id, department_id, hall_id, email, full_name, student_id, batch, trust_level, onboarding_completed)
    VALUES (v_student, v_univ, v_dept, v_hall, v_emails[v_idx], v_names[v_idx], 'JU-DEMO-' || v_idx, '51st Batch', 'ID_VERIFIED', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, university_id, role)
    VALUES (v_student, v_univ, 'STUDENT')
    ON CONFLICT (user_id, university_id, role) DO NOTHING;
  END LOOP;

  -- 2. Module 1 — marketplace listings ------------------------------------
  INSERT INTO public.marketplace_listings (university_id, seller_id, title, description, category, kind, price_bdt, condition, status, keyword_tags)
  VALUES
    (v_univ, v_students[1], 'Casio FX-991EX Scientific Calculator', 'Used for one semester, like new condition.', 'Electronics', 'SELL', 1400, 'LIKE_NEW', 'AVAILABLE', ARRAY['calculator','casio']),
    (v_univ, v_students[2], 'Hero Sprint bicycle — campus commuter', 'New tyres, ideal for hall-to-department rides.', 'Transport', 'RENT', 800, 'GOOD', 'AVAILABLE', ARRAY['bicycle','cycle'])
  ON CONFLICT DO NOTHING;

  -- 3. Module 2 — skill postings ------------------------------------------
  INSERT INTO public.skill_postings (university_id, author_id, type, title, description, category, skills, availability, rate_bdt, status)
  VALUES
    (v_univ, v_students[1], 'TUTORING', 'CSE-301 Data Structures crash tutoring', 'Two-hour problem-solving sessions before the mid-term.', 'Academic', ARRAY['data structures','algorithms'], 'EVENINGS', 400, 'OPEN'),
    (v_univ, v_students[2], 'FREELANCE', 'Logo + social kit for a student club', 'Annual festival identity, Figma delivery.', 'Design', ARRAY['graphic design','figma'], 'FLEXIBLE', 3500, 'OPEN')
  ON CONFLICT DO NOTHING;

  -- 4. Module 3 — civic tickets -------------------------------------------
  INSERT INTO public.complaints (university_id, tracking_code, student_id, is_anonymous, consent_to_share_identity, title, category, description, severity, status, assigned_unit_id, sla_hours, sla_due_at, is_public_issue, location_hint)
  VALUES
    (v_univ, 'JU-CASE-DEMO-001', v_students[1], false, false, 'Broken streetlights on the road to the new hall', 'INFRASTRUCTURE',
     'Three lights are out between the new hall and the central field.', 'HIGH', 'IN_REVIEW', v_unit, 96, now() + INTERVAL '60 hours', true, 'New hall road'),
    (v_univ, 'JU-CASE-DEMO-002', v_students[2], false, false, 'Waterlogging at the main academic building entrance', 'INFRASTRUCTURE',
     'Entrance floods after every rain and blocks wheelchair access.', 'MEDIUM', 'SUBMITTED', v_unit, 96, now() + INTERVAL '90 hours', true, 'Main academic building')
  ON CONFLICT (tracking_code) DO NOTHING;

  SELECT id INTO v_civic FROM public.complaints WHERE tracking_code = 'JU-CASE-DEMO-001';
  IF v_civic IS NOT NULL THEN
    INSERT INTO public.complaint_upvotes (university_id, complaint_id, user_id)
    VALUES (v_univ, v_civic, v_students[1]), (v_univ, v_civic, v_students[3])
    ON CONFLICT DO NOTHING;
  END IF;

  -- 5. Module 4 — club notices + event ------------------------------------
  SELECT id INTO v_club FROM public.clubs WHERE university_id = v_univ AND slug = 'cse-society';

  INSERT INTO public.events (university_id, organizer_id, host_organization, title_en, title_bn, description_en, category, is_public, starts_at, ends_at, venue_name, formatted_address, text_directions_en, lat, lng, place_id, geofence_radius_m, capacity, rsvp_required, club_id)
  VALUES
    (v_univ, v_students[2], 'CSE Society', 'Inter-department Hackathon 2026', 'আন্তঃবিভাগ হ্যাকাথন ২০২৬',
     '24-hour build sprint for teams of three, open to every department.', 'Technology', true,
     now() + INTERVAL '2 days', now() + INTERVAL '3 days', 'CSE Building Auditorium',
     'Jahangirnagar University, Savar, Dhaka', 'Enter through the main gate and walk 300m past the library.',
     23.8791, 90.2674, 'demo-place-ju-cse', 150, 120, true, v_club)
  ON CONFLICT DO NOTHING;

  IF v_club IS NOT NULL THEN
    INSERT INTO public.club_notices (university_id, club_id, author_id, title, body)
    VALUES (v_univ, v_club, v_students[2], 'Executive panel recruitment open',
            'Apply with a 200-word motivation note before Friday 5pm.');
  END IF;

  -- 6. Module 5 — donors, blood requests, counselling slots ---------------
  FOR v_idx IN 1..array_length(v_students, 1) LOOP
    INSERT INTO public.health_donors (university_id, user_id, blood_group, is_available, contact_phone, hall_id)
    VALUES (v_univ, v_students[v_idx], v_groups[v_idx], true, '+88017000000' || v_idx, v_hall)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;

  INSERT INTO public.blood_requests (university_id, requester_id, patient_name, blood_group, bags_needed, hospital_name, hospital_address, contact_phone, urgency, needed_by, status)
  VALUES
    (v_univ, v_students[3], 'Sabbir Ahmed', 'O+', 2, 'Enam Medical College', 'Savar, Dhaka', '+8801700000009', 'CRITICAL', now() + INTERVAL '8 hours', 'OPEN')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.counseling_slots (university_id, counselor_alias, mode, starts_at, ends_at, capacity)
  VALUES
    (v_univ, 'Counselor A-12', 'IN_PERSON', now() + INTERVAL '1 day', now() + INTERVAL '1 day 1 hour', 1),
    (v_univ, 'Counselor B-04', 'ONLINE', now() + INTERVAL '2 days', now() + INTERVAL '2 days 1 hour', 1),
    (v_univ, 'Peer Support Circle', 'IN_PERSON', now() + INTERVAL '3 days', now() + INTERVAL '3 days 1 hour', 4)
  ON CONFLICT DO NOTHING;

  -- 7. Module 6 — mentors + slots -----------------------------------------
  INSERT INTO public.mentor_profiles (university_id, user_id, headline, expertise, session_rate_bdt, bio, is_accepting, sessions_count, rating)
  VALUES (v_univ, v_students[2], 'Final-year CSE • ICPC regionalist', ARRAY['algorithms','competitive programming'], 0,
          'Happy to review your CP roadmap and internship CV.', true, 22, 4.8)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_mentor FROM public.mentor_profiles WHERE user_id = v_students[2];
  IF v_mentor IS NOT NULL THEN
    INSERT INTO public.mentorship_slots (university_id, mentor_id, topic, starts_at, ends_at, capacity)
    VALUES (v_univ, v_mentor, 'ICPC preparation roadmap', now() + INTERVAL '2 days', now() + INTERVAL '2 days 45 minutes', 2);
  END IF;

  -- 8. Module 7 — housing, rideshare and ticket exchange -------------------
  INSERT INTO public.housing_listings (university_id, owner_id, kind, title, description, rent_bdt, seat_count, gender_policy, area_en, distance_km, amenities, status)
  VALUES
    (v_univ, v_students[3], 'MESS_SEAT', 'One seat in a 4-member mess, Wortola', 'Shared room, attached bath, gas line, 10 minutes from campus gate.', 3200, 1, 'FEMALE', 'Wortola, Savar', 0.8, ARRAY['Wi-Fi','gas','attached bath'], 'AVAILABLE'),
    (v_univ, v_students[1], 'SUB_LET', 'Sub-let room for 2 months', 'Furnished room near Nabinagar bus stand, kitchen access included.', 4500, 1, 'ANY', 'Nabinagar, Savar', 2.1, ARRAY['furnished','kitchen'], 'AVAILABLE')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rideshare_offers (university_id, owner_id, mode, origin, destination, depart_at, seats_total, seats_available, fare_bdt, vehicle_details, status)
  VALUES
    (v_univ, v_students[2], 'BUS', 'Savar', 'Chattogram', now() + INTERVAL '22 hours', 3, 2, 650, 'Shyamoli AC, seats 12–14', 'OPEN'),
    (v_univ, v_students[1], 'TRAIN', 'Dhaka', 'Rajshahi', now() + INTERVAL '2 days', 2, 1, 480, 'Banalata Express, KA cabin', 'OPEN')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ticket_exchanges (university_id, seller_id, mode, route_from, route_to, travel_date, seat_count, price_bdt, notes, status)
  VALUES (v_univ, v_students[3], 'BUS', 'Dhaka', 'Sylhet', CURRENT_DATE + 6, 1, 700, 'Eid return ticket, non-AC.', 'AVAILABLE')
  ON CONFLICT DO NOTHING;

  -- 9. Module 8 — alumni, opportunities, conversation ----------------------
  INSERT INTO public.alumni_profiles (university_id, user_id, graduation_year, degree, employer, job_title, industry, city, offers_referrals, is_mentor)
  VALUES (v_univ, v_students[2], 2021, 'BSc CSE', 'Brain Station 23', 'Software Engineer II', 'Technology', 'Dhaka', true, true)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.career_opportunities (university_id, alumni_id, kind, company, title, description, location, salary_range, deadline, status)
  SELECT v_univ, a.id, 'INTERNSHIP', 'Brain Station 23', 'Backend Engineering Intern (6 months)',
         'Node.js + PostgreSQL with mentorship from the platform team.', 'Dhaka', '৳25,000 / month', CURRENT_DATE + 21, 'OPEN'
  FROM public.alumni_profiles a
  WHERE a.user_id = v_students[2]
  ON CONFLICT DO NOTHING;

  INSERT INTO public.direct_conversations (university_id, user_a, user_b, context, last_message_at)
  VALUES (v_univ, v_students[1], v_students[2], 'Internship referral', now())
  ON CONFLICT (user_a, user_b) DO NOTHING;

  SELECT id INTO v_conv FROM public.direct_conversations WHERE user_a = v_students[1] AND user_b = v_students[2];
  IF v_conv IS NOT NULL THEN
    INSERT INTO public.direct_messages (university_id, conversation_id, sender_id, body)
    SELECT v_univ, v_conv, v_students[2], 'Send me your CV and I will forward it to the hiring manager today.'
    WHERE NOT EXISTS (SELECT 1 FROM public.direct_messages WHERE conversation_id = v_conv);
  END IF;

  -- 10. Module 9 — cafeteria menu + home food ------------------------------
  INSERT INTO public.cafeteria_menus (university_id, hall_id, name_en, name_bn, serving_date, meal, pickup_window)
  VALUES (v_univ, v_hall, 'Central Cafeteria — Lunch', 'সেন্ট্রাল ক্যাফেটেরিয়া — দুপুর', CURRENT_DATE, 'LUNCH', '12:30 – 14:00')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.cafeteria_items (university_id, menu_id, name_en, name_bn, price_bdt, is_available, is_vegetarian)
  SELECT v_univ, m.id, item.name_en, item.name_bn, item.price, true, item.veg
  FROM public.cafeteria_menus m
  CROSS JOIN (
    VALUES ('Rice + Chicken Curry', 'ভাত ও চিকেন কারি', 75::numeric, false),
           ('Rice + Dal + Vegetables', 'ভাত, ডাল ও সবজি', 45::numeric, true),
           ('Beef Tehari', 'গরুর তেহারি', 90::numeric, false)
  ) AS item(name_en, name_bn, price, veg)
  WHERE m.name_en = 'Central Cafeteria — Lunch'
    AND NOT EXISTS (SELECT 1 FROM public.cafeteria_items ci WHERE ci.menu_id = m.id);

  INSERT INTO public.home_food_listings (university_id, cook_id, title, description, cuisine, price_bdt, portion, delivery_available, delivery_fee_bdt, available_from, available_to, status)
  VALUES
    (v_univ, v_students[3], 'Home-style beef kala bhuna (500g)', 'Slow cooked, no food colouring, fresh every evening.', 'Bangladeshi', 320, '2 persons', true, 30, '17:00', '22:00', 'AVAILABLE'),
    (v_univ, v_students[1], 'Chicken biryani (student portion)', 'Includes borhani. Hall delivery after 8pm.', 'Bangladeshi', 180, '1 person', true, 20, '19:00', '23:00', 'AVAILABLE')
  ON CONFLICT DO NOTHING;

  -- 11. Module 10 — lost & found pair --------------------------------------
  INSERT INTO public.lost_items (university_id, reporter_id, kind, title, description, category, keywords, location_en, occurred_on, status)
  VALUES (v_univ, v_students[1], 'LOST', 'Blue backpack with laptop charger', 'Left near the library reading room on Sunday evening.', 'Bag',
          ARRAY['blue backpack','charger','library'], 'Central Library, 2nd floor', CURRENT_DATE - 2, 'OPEN')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.lost_items (university_id, reporter_id, kind, title, description, category, keywords, location_en, occurred_on, status)
  VALUES (v_univ, v_students[3], 'FOUND', 'Found: blue backpack near library stairs', 'Handed over to the library help desk.', 'Bag',
          ARRAY['blue backpack','library'], 'Central Library stairs', CURRENT_DATE - 1, 'OPEN')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_lost_id FROM public.lost_items WHERE title = 'Blue backpack with laptop charger';
  SELECT id INTO v_found_id FROM public.lost_items WHERE title = 'Found: blue backpack near library stairs';
  IF v_lost_id IS NOT NULL AND v_found_id IS NOT NULL THEN
    INSERT INTO public.lost_item_matches (university_id, lost_item_id, found_item_id, score, notified)
    VALUES (v_univ, v_lost_id, v_found_id, 30, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 12. Module 11 — sports teams, challenges, campaigns --------------------
  INSERT INTO public.sports_teams (university_id, captain_id, name, sport, skill_level, needed_roles, description, status)
  VALUES
    (v_univ, v_students[2], 'Savar Strikers', 'Football', 'INTERMEDIATE', ARRAY['Goalkeeper','Defender'],
     'Inter-department league starting next month. Practice Tue/Thu evenings.', 'OPEN'),
    (v_univ, v_students[1], 'CSE Cricket XI', 'Cricket', 'ANY', ARRAY['Batsman','Bowler'],
     'Friendly weekend matches against other departments.', 'OPEN')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.sports_challenges (university_id, challenger_id, team_name, sport, title, description, preferred_date, venue, status)
  VALUES (v_univ, v_students[3], 'Sociology United', 'Football', 'Looking for a friendly 7-a-side match',
          'Saturday morning, 60 minutes, bring your own bibs.', now() + INTERVAL '3 days', 'Central Field', 'OPEN')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.donation_campaigns (university_id, organizer_id, title, story, cause, target_bdt, raised_bdt, donors_count, deadline, is_verified, status)
  VALUES (v_univ, v_students[2], 'Emergency surgery support for a JU student',
          'A final-year student needs urgent cardiac surgery. Funds cover hospital bills only; every disbursement is logged.',
          'MEDICAL', 250000, 0, 0, CURRENT_DATE + 18, true, 'ACTIVE')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_campaign FROM public.donation_campaigns WHERE title = 'Emergency surgery support for a JU student';
  IF v_campaign IS NOT NULL THEN
    INSERT INTO public.donations (university_id, campaign_id, donor_id, donor_name, amount_bdt, message, status)
    SELECT v_univ, v_campaign, v_students[1], v_names[1], 2500, 'Get well soon.', 'CONFIRMED'
    WHERE NOT EXISTS (SELECT 1 FROM public.donations d WHERE d.campaign_id = v_campaign);

    INSERT INTO public.donation_ledger (university_id, campaign_id, entry_type, amount_bdt, description)
    SELECT v_univ, v_campaign, 'DISBURSEMENT', 1000, 'Hospital advance payment (receipt attached)'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.donation_ledger l WHERE l.campaign_id = v_campaign AND l.entry_type = 'DISBURSEMENT'
    );
  END IF;

  -- 13. Module 12 — a sample dispute --------------------------------------
  INSERT INTO public.disputes (university_id, opened_by, subject, description, category, reference_code, status)
  SELECT v_univ, v_students[1], 'Item not as described in marketplace',
         'The calculator battery is failing; the seller is not responding.', 'MARKETPLACE', 'DSP-DEMO01', 'IN_REVIEW'
  WHERE NOT EXISTS (SELECT 1 FROM public.disputes WHERE reference_code = 'DSP-DEMO01');

  RAISE NOTICE 'Campus360 demo activity seeded for % students.', array_length(v_students, 1);
END $$;

COMMIT;
