-- supabase/migrations/0007_module_expansion.sql
-- Additive migration implementing the 12 interactive Campus360 modules.
-- Every domain table is tenant-scoped by university_id (RLS: university_id = current_user_university_id()).

-- ============================================================================
-- 0. New enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE listing_kind AS ENUM ('SELL', 'RENT', 'EXCHANGE', 'WANTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skill_posting_type AS ENUM ('TUTORING', 'FREELANCE', 'PART_TIME_JOB', 'INTERNSHIP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE housing_kind AS ENUM ('MESS_SEAT', 'HOSTEL_SEAT', 'SUB_LET', 'FAMILY_FLAT', 'PAYING_GUEST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_mode AS ENUM ('BUS', 'TRAIN', 'CARPOOL', 'MICROBUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lost_item_kind AS ENUM ('LOST', 'FOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE career_opportunity_kind AS ENUM ('INTERNSHIP', 'FULL_TIME', 'REFERRAL', 'PART_TIME', 'CONTRACT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- MODULE 1 — Campus Economy & Marketplace
-- ============================================================================
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS kind listing_kind NOT NULL DEFAULT 'SELL',
  ADD COLUMN IF NOT EXISTS rent_period TEXT,
  ADD COLUMN IF NOT EXISTS is_negotiable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS keyword_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID;

CREATE TABLE IF NOT EXISTS public.campus_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  location_en TEXT NOT NULL,
  location_bn TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, code)
);
CREATE INDEX IF NOT EXISTS idx_pickup_points_univ ON public.campus_pickup_points(university_id);

DO $$ BEGIN
  ALTER TABLE public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_pickup_fk
    FOREIGN KEY (pickup_point_id) REFERENCES public.campus_pickup_points(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pickup_point_id UUID REFERENCES public.campus_pickup_points(id) ON DELETE SET NULL,
  meetup_window TEXT,
  amount_bdt NUMERIC(10, 2) NOT NULL CHECK (amount_bdt >= 0),
  order_code TEXT NOT NULL UNIQUE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_univ ON public.marketplace_orders(university_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_listing ON public.marketplace_messages(listing_id, created_at ASC);

-- ============================================================================
-- MODULE 2 — Skill Hub, Tutoring & Part-Time Jobs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.skill_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type skill_posting_type NOT NULL DEFAULT 'TUTORING',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  location_en TEXT,
  location_bn TEXT,
  availability TEXT NOT NULL DEFAULT 'FLEXIBLE',
  rate_bdt NUMERIC(10, 2),
  is_remote BOOLEAN NOT NULL DEFAULT false,
  contact_note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  applicants_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_postings_univ ON public.skill_postings(university_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.skill_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  posting_id UUID NOT NULL REFERENCES public.skill_postings(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'SHORTLISTED', 'ACCEPTED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (posting_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS public.skill_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ============================================================================
-- MODULE 3 — Civic Ticketing (upvotes on complaints) + Admin connect
-- ============================================================================
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS upvotes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_hint TEXT,
  ADD COLUMN IF NOT EXISTS is_public_issue BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.complaint_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_complaint ON public.complaint_upvotes(complaint_id);

-- ============================================================================
-- MODULE 4 — Events & Club Connect
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  description_en TEXT NOT NULL,
  description_bn TEXT,
  logo_url TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  is_recruiting BOOLEAN NOT NULL DEFAULT true,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_clubs_univ ON public.clubs(university_id, category);

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (member_role IN ('MEMBER', 'EXECUTIVE', 'PRESIDENT')),
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_price_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS rsvp_limit INTEGER;

-- ============================================================================
-- MODULE 5 — Emergency, Mental & Physical Health
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blood_request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES public.health_donors(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_blood_responses_request ON public.blood_request_responses(request_id);

CREATE TABLE IF NOT EXISTS public.health_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('AMBULANCE', 'MEDICAL_CENTER', 'COUNSELING', 'SECURITY', 'NATIONAL')),
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  phone TEXT NOT NULL,
  available_hours TEXT NOT NULL DEFAULT '24/7',
  notes_en TEXT,
  notes_bn TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_contacts_univ ON public.health_contacts(university_id, kind);

CREATE TABLE IF NOT EXISTS public.counseling_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  counselor_alias TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'IN_PERSON' CHECK (mode IN ('IN_PERSON', 'ONLINE', 'PHONE')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT counseling_slot_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_counseling_slots_univ ON public.counseling_slots(university_id, starts_at);

CREATE TABLE IF NOT EXISTS public.counseling_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.counseling_slots(id) ON DELETE CASCADE,
  booking_ref TEXT NOT NULL UNIQUE,
  alias TEXT NOT NULL,
  contact_method TEXT NOT NULL DEFAULT 'IN_APP' CHECK (contact_method IN ('IN_APP', 'PHONE', 'EMAIL')),
  contact_value TEXT,
  note TEXT,
  anonymous_token_hash TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_counseling_bookings_slot ON public.counseling_bookings(slot_id);

-- ============================================================================
-- MODULE 6 — Academic Archive & Mentorship
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT ARRAY['en', 'bn'],
  session_rate_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bio TEXT,
  is_accepting BOOLEAN NOT NULL DEFAULT true,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_univ ON public.mentor_profiles(university_id, is_accepting);

CREATE TABLE IF NOT EXISTS public.mentorship_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.mentor_profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentorship_slot_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_mentorship_slots_univ ON public.mentorship_slots(university_id, starts_at);

CREATE TABLE IF NOT EXISTS public.mentorship_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.mentorship_slots(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.mentor_profiles(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, mentee_id)
);

-- ============================================================================
-- MODULE 7 — Housing & Commute
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.housing_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind housing_kind NOT NULL DEFAULT 'MESS_SEAT',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rent_bdt NUMERIC(10, 2) NOT NULL CHECK (rent_bdt >= 0),
  seat_count INTEGER NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  gender_policy TEXT NOT NULL DEFAULT 'ANY' CHECK (gender_policy IN ('MALE', 'FEMALE', 'ANY')),
  area_en TEXT NOT NULL,
  area_bn TEXT,
  distance_km NUMERIC(4, 2),
  amenities TEXT[] NOT NULL DEFAULT '{}',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'FILLED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_housing_univ ON public.housing_listings(university_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rideshare_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode ride_mode NOT NULL DEFAULT 'BUS',
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_at TIMESTAMPTZ NOT NULL,
  seats_total INTEGER NOT NULL DEFAULT 1 CHECK (seats_total > 0),
  seats_available INTEGER NOT NULL DEFAULT 1 CHECK (seats_available >= 0),
  fare_bdt NUMERIC(10, 2),
  vehicle_details TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULL', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rideshare_offers_univ ON public.rideshare_offers(university_id, depart_at);

CREATE TABLE IF NOT EXISTS public.rideshare_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode ride_mode NOT NULL DEFAULT 'BUS',
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_at TIMESTAMPTZ NOT NULL,
  seats_needed INTEGER NOT NULL DEFAULT 1 CHECK (seats_needed > 0),
  notes TEXT,
  matched_offer_id UUID REFERENCES public.rideshare_offers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MATCHED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode ride_mode NOT NULL DEFAULT 'BUS',
  route_from TEXT NOT NULL,
  route_to TEXT NOT NULL,
  travel_date DATE NOT NULL,
  seat_count INTEGER NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  price_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'EXCHANGED', 'WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MODULE 8 — Alumni Network & Career Hub
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alumni_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  graduation_year INTEGER NOT NULL CHECK (graduation_year BETWEEN 1970 AND 2100),
  degree TEXT,
  employer TEXT NOT NULL,
  job_title TEXT NOT NULL,
  industry TEXT NOT NULL,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Bangladesh',
  linkedin_url TEXT,
  offers_referrals BOOLEAN NOT NULL DEFAULT true,
  is_mentor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_alumni_univ ON public.alumni_profiles(university_id, industry);

CREATE TABLE IF NOT EXISTS public.career_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES public.alumni_profiles(id) ON DELETE CASCADE,
  kind career_opportunity_kind NOT NULL DEFAULT 'FULL_TIME',
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  is_remote BOOLEAN NOT NULL DEFAULT false,
  salary_range TEXT,
  apply_url TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_career_opps_univ ON public.career_opportunities(university_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.career_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.career_opportunities(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv ON public.direct_messages(conversation_id, created_at ASC);

-- ============================================================================
-- MODULE 9 — Smart Cafeteria & Home-Made Food
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cafeteria_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  hall_id UUID REFERENCES public.halls(id) ON DELETE SET NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  serving_date DATE NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS')),
  pickup_window TEXT NOT NULL DEFAULT '12:30 - 14:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cafeteria_menus_univ ON public.cafeteria_menus(university_id, serving_date);

CREATE TABLE IF NOT EXISTS public.cafeteria_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.cafeteria_menus(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_bn TEXT,
  price_bdt NUMERIC(10, 2) NOT NULL CHECK (price_bdt >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  stock INTEGER,
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.home_food_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  cook_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cuisine TEXT NOT NULL DEFAULT 'Bangladeshi',
  price_bdt NUMERIC(10, 2) NOT NULL CHECK (price_bdt >= 0),
  portion TEXT NOT NULL DEFAULT '1 person',
  delivery_available BOOLEAN NOT NULL DEFAULT true,
  delivery_fee_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  available_from TEXT NOT NULL DEFAULT '11:00',
  available_to TEXT NOT NULL DEFAULT '21:00',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD_OUT', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_home_food_univ ON public.home_food_listings(university_id, status);

CREATE TABLE IF NOT EXISTS public.food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_code TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'CAFETERIA' CHECK (source IN ('CAFETERIA', 'HOME_FOOD')),
  menu_id UUID REFERENCES public.cafeteria_menus(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.cafeteria_items(id) ON DELETE SET NULL,
  food_listing_id UUID REFERENCES public.home_food_listings(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_bdt NUMERIC(10, 2) NOT NULL CHECK (total_bdt >= 0),
  pickup_window TEXT,
  fulfilment TEXT NOT NULL DEFAULT 'PICKUP' CHECK (fulfilment IN ('PICKUP', 'CAMPUS_DELIVERY')),
  delivery_spot TEXT,
  status TEXT NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_orders_univ ON public.food_orders(university_id, created_at DESC);

-- ============================================================================
-- MODULE 10 — Lost & Found
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind lost_item_kind NOT NULL DEFAULT 'LOST',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  location_en TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  contact_note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  matched_item_id UUID REFERENCES public.lost_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lost_items_univ ON public.lost_items(university_id, kind, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lost_item_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  lost_item_id UUID NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
  found_item_id UUID NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lost_item_id, found_item_id)
);

-- ============================================================================
-- MODULE 11 — Sports & Crowdfunding
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sports_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  captain_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  skill_level TEXT NOT NULL DEFAULT 'ANY' CHECK (skill_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ANY')),
  needed_roles TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  contact_note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULL', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sports_teams_univ ON public.sports_teams(university_id, sport, status);

CREATE TABLE IF NOT EXISTS public.sports_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  challenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  preferred_date TIMESTAMPTZ,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACCEPTED', 'PLAYED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sports_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  sport TEXT NOT NULL,
  capacity INTEGER,
  hourly_rate_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sports_venue_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.sports_venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_booking_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_univ ON public.sports_venue_bookings(university_id, starts_at);

CREATE TABLE IF NOT EXISTS public.donation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  cause TEXT NOT NULL DEFAULT 'MEDICAL',
  target_bdt NUMERIC(12, 2) NOT NULL CHECK (target_bdt > 0),
  raised_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  donors_count INTEGER NOT NULL DEFAULT 0,
  deadline DATE,
  cover_image_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_univ ON public.donation_campaigns(university_id, status);

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.donation_campaigns(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  donor_name TEXT NOT NULL DEFAULT 'Anonymous',
  amount_bdt NUMERIC(12, 2) NOT NULL CHECK (amount_bdt > 0),
  message TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PLEDGED', 'CONFIRMED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON public.donations(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.donation_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.donation_campaigns(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('DONATION', 'DISBURSEMENT')),
  amount_bdt NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- MODULE 12 — Trust, Verification, Moderation & Disputes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  against_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disputes_univ ON public.disputes(university_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'HIDE', 'REMOVE', 'WARN', 'SUSPEND', 'RESTORE')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RLS: enable + tenant-isolated policies
-- ============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campus_pickup_points', 'marketplace_orders', 'marketplace_messages',
    'skill_postings', 'skill_applications', 'skill_alerts',
    'complaint_upvotes', 'clubs', 'club_members', 'club_notices',
    'blood_request_responses', 'health_contacts', 'counseling_slots',
    'counseling_bookings', 'mentor_profiles', 'mentorship_slots',
    'mentorship_bookings', 'housing_listings', 'rideshare_offers',
    'rideshare_requests', 'ticket_exchanges', 'alumni_profiles',
    'career_opportunities', 'career_applications', 'direct_conversations',
    'direct_messages', 'cafeteria_menus', 'cafeteria_items',
    'home_food_listings', 'food_orders', 'lost_items', 'lost_item_matches',
    'sports_teams', 'sports_challenges', 'sports_venues',
    'sports_venue_bookings', 'donation_campaigns', 'donations',
    'donation_ledger', 'disputes', 'dispute_messages', 'moderation_actions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Universal tenant read policy (same university only) for module tables.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campus_pickup_points', 'marketplace_orders', 'marketplace_messages',
    'skill_postings', 'skill_applications', 'skill_alerts',
    'complaint_upvotes', 'clubs', 'club_members', 'club_notices',
    'blood_request_responses', 'health_contacts', 'counseling_slots',
    'mentor_profiles', 'mentorship_slots', 'mentorship_bookings',
    'housing_listings', 'rideshare_offers', 'rideshare_requests',
    'ticket_exchanges', 'alumni_profiles', 'career_opportunities',
    'career_applications', 'direct_conversations', 'direct_messages',
    'cafeteria_menus', 'cafeteria_items', 'home_food_listings',
    'food_orders', 'lost_items', 'lost_item_matches', 'sports_teams',
    'sports_challenges', 'sports_venues', 'sports_venue_bookings',
    'donation_campaigns', 'donations', 'donation_ledger'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I;', 'Tenant read ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (university_id = public.current_user_university_id());',
      'Tenant read ' || t, t
    );
  END LOOP;
END $$;

-- Verified same-university write policy for user-generated module tables.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'skill_postings', 'housing_listings', 'rideshare_offers',
    'rideshare_requests', 'ticket_exchanges', 'sports_teams',
    'sports_challenges'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (university_id = public.current_user_university_id() AND public.current_user_is_verified());',
      'Verified tenant insert ' || t, t
    );
  END LOOP;
END $$;

-- Owner-scoped updates so students can only mutate their own rows.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('housing_listings', 'owner_id'),
      ('rideshare_offers', 'owner_id'),
      ('rideshare_requests', 'user_id'),
      ('ticket_exchanges', 'seller_id'),
      ('sports_teams', 'captain_id'),
      ('sports_challenges', 'challenger_id'),
      ('marketplace_listings', 'seller_id')
    ) AS m(tbl, owner_col)
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (university_id = public.current_user_university_id() AND %I = auth.uid());',
      'Owner update ' || rec.tbl, rec.tbl, rec.owner_col
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (university_id = public.current_user_university_id() AND %I = auth.uid());',
      'Owner delete ' || rec.tbl, rec.tbl, rec.owner_col
    );
  END LOOP;
END $$;

-- Sensitive tables: counselling bookings are write-only for students (read is counselor/admin only).
DROP POLICY IF EXISTS "Anonymous counselling booking insert" ON public.counseling_bookings;
CREATE POLICY "Anonymous counselling booking insert" ON public.counseling_bookings
  FOR INSERT WITH CHECK (university_id = public.current_user_university_id());

DROP POLICY IF EXISTS "Counselors read booked sessions" ON public.counseling_bookings;
CREATE POLICY "Counselors read booked sessions" ON public.counseling_bookings
  FOR SELECT USING (
    university_id = public.current_user_university_id()
    AND (
      public.current_user_has_role('COUNSELOR')
      OR public.current_user_has_role('UNIVERSITY_ADMIN')
      OR public.current_user_has_role('SUPER_ADMIN')
    )
  );

-- Direct messages: only participants can read/write.
DROP POLICY IF EXISTS "Participants read direct messages" ON public.direct_messages;
CREATE POLICY "Participants read direct messages" ON public.direct_messages
  FOR SELECT USING (
    university_id = public.current_user_university_id()
    AND EXISTS (
      SELECT 1 FROM public.direct_conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Participants send direct messages" ON public.direct_messages;
CREATE POLICY "Participants send direct messages" ON public.direct_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND EXISTS (
      SELECT 1 FROM public.direct_conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants read conversations" ON public.direct_conversations;
CREATE POLICY "Participants read conversations" ON public.direct_conversations
  FOR SELECT USING (
    university_id = public.current_user_university_id()
    AND (user_a = auth.uid() OR user_b = auth.uid())
  );

-- Marketplace messages: participants only.
DROP POLICY IF EXISTS "Participants read marketplace messages" ON public.marketplace_messages;
CREATE POLICY "Participants read marketplace messages" ON public.marketplace_messages
  FOR SELECT USING (
    university_id = public.current_user_university_id()
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );
DROP POLICY IF EXISTS "Participants send marketplace messages" ON public.marketplace_messages;
CREATE POLICY "Participants send marketplace messages" ON public.marketplace_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

-- Disputes: opener or moderators.
DROP POLICY IF EXISTS "Opener or moderator reads disputes" ON public.disputes;
CREATE POLICY "Opener or moderator reads disputes" ON public.disputes
  FOR SELECT USING (
    university_id = public.current_user_university_id()
    AND (
      opened_by = auth.uid()
      OR public.current_user_has_role('UNIVERSITY_ADMIN')
      OR public.current_user_has_role('GOVERNING_BODY')
      OR public.current_user_has_role('SUPER_ADMIN')
    )
  );
CREATE POLICY "Verified student opens dispute" ON public.disputes
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND opened_by = auth.uid()
    AND public.current_user_is_verified()
  );

-- Donations & ledger: transparent read (tenant), donor inserts own donation.
DROP POLICY IF EXISTS "Donors create donations" ON public.donations;
CREATE POLICY "Donors create donations" ON public.donations
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND (donor_id = auth.uid() OR donor_id IS NULL)
  );

-- Admin/moderator manage everything in their tenant.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campus_pickup_points', 'marketplace_orders', 'marketplace_messages',
    'skill_postings', 'complaint_upvotes', 'clubs', 'club_members',
    'club_notices', 'blood_request_responses', 'health_contacts',
    'counseling_slots', 'counseling_bookings', 'mentor_profiles',
    'mentorship_slots', 'mentorship_bookings', 'housing_listings',
    'rideshare_offers', 'rideshare_requests', 'ticket_exchanges',
    'alumni_profiles', 'career_opportunities', 'career_applications',
    'direct_conversations', 'cafeteria_menus', 'cafeteria_items',
    'home_food_listings', 'food_orders', 'lost_items', 'lost_item_matches',
    'sports_teams', 'sports_challenges', 'sports_venues',
    'sports_venue_bookings', 'donation_campaigns', 'donations',
    'donation_ledger', 'disputes', 'dispute_messages', 'moderation_actions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (university_id = public.current_user_university_id() AND (public.current_user_has_role(''UNIVERSITY_ADMIN'') OR public.current_user_has_role(''SUPER_ADMIN'')));',
      'Admin manage ' || t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- Triggers: counters, updated_at, notification fan-out
-- ============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'campus_pickup_points', 'marketplace_orders', 'skill_postings',
    'clubs', 'counseling_bookings', 'mentor_profiles', 'mentorship_bookings',
    'housing_listings', 'rideshare_offers', 'rideshare_requests',
    'ticket_exchanges', 'alumni_profiles', 'career_opportunities',
    'cafeteria_menus', 'cafeteria_items', 'home_food_listings', 'food_orders',
    'lost_items', 'sports_teams', 'sports_challenges', 'donation_campaigns',
    'disputes'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I;', t, t
    );
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Complaint upvote counter
CREATE OR REPLACE FUNCTION public.tg_recount_complaint_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  v_id := COALESCE(NEW.complaint_id, OLD.complaint_id);
  UPDATE public.complaints
    SET upvotes_count = (SELECT COUNT(*) FROM public.complaint_upvotes WHERE complaint_id = v_id)
    WHERE id = v_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_complaint_upvotes_count ON public.complaint_upvotes;
CREATE TRIGGER trg_complaint_upvotes_count
AFTER INSERT OR DELETE ON public.complaint_upvotes
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_complaint_upvotes();

-- Skill applicant counter
CREATE OR REPLACE FUNCTION public.tg_recount_skill_applicants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.skill_postings
    SET applicants_count = (SELECT COUNT(*) FROM public.skill_applications WHERE posting_id = NEW.posting_id)
    WHERE id = NEW.posting_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_skill_applicants_count ON public.skill_applications;
CREATE TRIGGER trg_skill_applicants_count
AFTER INSERT ON public.skill_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_skill_applicants();

-- Club membership counter
CREATE OR REPLACE FUNCTION public.tg_recount_club_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_club UUID;
BEGIN
  v_club := COALESCE(NEW.club_id, OLD.club_id);
  UPDATE public.clubs
    SET member_count = (SELECT COUNT(*) FROM public.club_members WHERE club_id = v_club AND status = 'APPROVED')
    WHERE id = v_club;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_club_members_count ON public.club_members;
CREATE TRIGGER trg_club_members_count
AFTER INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_club_members();

-- Counselling slot capacity counter
CREATE OR REPLACE FUNCTION public.tg_recount_counseling_bookings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.counseling_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.counseling_bookings
      WHERE slot_id = NEW.slot_id AND status = 'BOOKED'
    )
    WHERE id = NEW.slot_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_counseling_bookings_count ON public.counseling_bookings;
CREATE TRIGGER trg_counseling_bookings_count
AFTER INSERT OR UPDATE ON public.counseling_bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_counseling_bookings();

-- Mentorship slot capacity counter
CREATE OR REPLACE FUNCTION public.tg_recount_mentorship_bookings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.mentorship_slots
    SET booked_count = (
      SELECT COUNT(*) FROM public.mentorship_bookings
      WHERE slot_id = NEW.slot_id AND status IN ('REQUESTED', 'CONFIRMED')
    )
    WHERE id = NEW.slot_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_mentorship_bookings_count ON public.mentorship_bookings;
CREATE TRIGGER trg_mentorship_bookings_count
AFTER INSERT OR UPDATE ON public.mentorship_bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_mentorship_bookings();

-- Donation campaign totals (transparent tracker)
CREATE OR REPLACE FUNCTION public.tg_recount_donation_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.donation_campaigns c
  SET raised_bdt = COALESCE((
        SELECT SUM(amount_bdt) FROM public.donations
        WHERE campaign_id = NEW.campaign_id AND status = 'CONFIRMED'
      ), 0),
      donors_count = COALESCE((
        SELECT COUNT(*) FROM public.donations
        WHERE campaign_id = NEW.campaign_id AND status = 'CONFIRMED'
      ), 0)
  WHERE c.id = NEW.campaign_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_donation_totals ON public.donations;
CREATE TRIGGER trg_donation_totals
AFTER INSERT OR UPDATE OR DELETE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.tg_recount_donation_totals();

-- Extra participant-scoped policies for interaction tables (in addition to tenant read).
DROP POLICY IF EXISTS "Participants read skill applications" ON public.skill_applications;
CREATE POLICY "Participants read skill applications" ON public.skill_applications
  FOR SELECT USING (applicant_id = auth.uid());

DROP POLICY IF EXISTS "Verified students apply to postings" ON public.skill_applications;
CREATE POLICY "Verified students apply to postings" ON public.skill_applications
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Users manage own skill alerts" ON public.skill_alerts;
CREATE POLICY "Users manage own skill alerts" ON public.skill_alerts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner or participant reads marketplace orders" ON public.marketplace_orders;
CREATE POLICY "Owner or participant reads marketplace orders" ON public.marketplace_orders
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS "Buyers create marketplace orders" ON public.marketplace_orders;
CREATE POLICY "Buyers create marketplace orders" ON public.marketplace_orders
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND buyer_id = auth.uid()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Users manage own club membership" ON public.club_members;
CREATE POLICY "Users manage own club membership" ON public.club_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Users leave clubs" ON public.club_members;
CREATE POLICY "Users leave clubs" ON public.club_members
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Verified students upvote" ON public.complaint_upvotes;
CREATE POLICY "Verified students upvote" ON public.complaint_upvotes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Users remove own upvote" ON public.complaint_upvotes;
CREATE POLICY "Users remove own upvote" ON public.complaint_upvotes
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Verified users offer blood" ON public.blood_request_responses;
CREATE POLICY "Verified users offer blood" ON public.blood_request_responses
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Verified students book mentorship" ON public.mentorship_bookings;
CREATE POLICY "Verified students book mentorship" ON public.mentorship_bookings
  FOR INSERT WITH CHECK (
    mentee_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Mentees read own sessions" ON public.mentorship_bookings;
CREATE POLICY "Mentees read own sessions" ON public.mentorship_bookings
  FOR SELECT USING (mentee_id = auth.uid());

DROP POLICY IF EXISTS "Verified students place food orders" ON public.food_orders;
CREATE POLICY "Verified students place food orders" ON public.food_orders
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Buyers read own food orders" ON public.food_orders;
CREATE POLICY "Buyers read own food orders" ON public.food_orders
  FOR SELECT USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Verified users report lost items" ON public.lost_items;
CREATE POLICY "Verified users report lost items" ON public.lost_items
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Reporters update own lost items" ON public.lost_items;
CREATE POLICY "Reporters update own lost items" ON public.lost_items
  FOR UPDATE USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Verified users book venues" ON public.sports_venue_bookings;
CREATE POLICY "Verified users book venues" ON public.sports_venue_bookings
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Verified students donate" ON public.donations;
CREATE POLICY "Verified students donate" ON public.donations
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND (donor_id = auth.uid() OR donor_id IS NULL)
  );

DROP POLICY IF EXISTS "Owners update own campaigns" ON public.donation_campaigns;
CREATE POLICY "Owners update own campaigns" ON public.donation_campaigns
  FOR UPDATE USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Verified users create campaigns" ON public.donation_campaigns;
CREATE POLICY "Verified users create campaigns" ON public.donation_campaigns
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Verified alumni post opportunities" ON public.career_opportunities;
CREATE POLICY "Verified alumni post opportunities" ON public.career_opportunities
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
    AND EXISTS (
      SELECT 1 FROM public.alumni_profiles a
      WHERE a.id = career_opportunities.alumni_id AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students apply to opportunities" ON public.career_applications;
CREATE POLICY "Students apply to opportunities" ON public.career_applications
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Applicants read own career applications" ON public.career_applications;
CREATE POLICY "Applicants read own career applications" ON public.career_applications
  FOR SELECT USING (applicant_id = auth.uid());

DROP POLICY IF EXISTS "Verified food sellers list" ON public.home_food_listings;
CREATE POLICY "Verified food sellers list" ON public.home_food_listings
  FOR INSERT WITH CHECK (
    cook_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

DROP POLICY IF EXISTS "Cooks update own food listings" ON public.home_food_listings;
CREATE POLICY "Cooks update own food listings" ON public.home_food_listings
  FOR UPDATE USING (cook_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own alumni profile" ON public.alumni_profiles;
CREATE POLICY "Users manage own alumni profile" ON public.alumni_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own mentor profile" ON public.mentor_profiles;
CREATE POLICY "Users manage own mentor profile" ON public.mentor_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Verified users create club notices" ON public.club_notices;
CREATE POLICY "Verified users create club notices" ON public.club_notices
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

-- ============================================================================
-- Trust & Verification: review aggregated trust score view
-- ============================================================================
CREATE OR REPLACE VIEW public.user_trust_summary AS
SELECT
  p.id AS user_id,
  p.university_id,
  p.full_name,
  p.trust_level,
  COALESCE(AVG(r.rating), 0)::NUMERIC(3, 2) AS avg_rating,
  COUNT(r.id)::INT AS review_count,
  (SELECT COUNT(*)::INT FROM public.donations d WHERE d.donor_id = p.id) AS donations_count,
  (SELECT COUNT(*)::INT FROM public.health_donors hd WHERE hd.user_id = p.id) AS is_donor
FROM public.profiles p
LEFT JOIN public.reviews r
  ON r.target_id = p.id
  AND r.target_type = 'MARKETPLACE'
  AND r.deleted_at IS NULL
  AND r.is_hidden = false
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.university_id, p.full_name, p.trust_level;

-- ============================================================================
-- Realtime publication (additive, idempotent)
-- ============================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketplace_listings', 'marketplace_offers', 'marketplace_messages',
    'marketplace_orders', 'campus_pickup_points', 'skill_postings',
    'skill_applications', 'complaints', 'complaint_upvotes',
    'complaint_status_history', 'clubs', 'club_members', 'club_notices',
    'events', 'event_rsvps', 'blood_requests', 'health_donors',
    'blood_request_responses', 'health_contacts', 'counseling_slots',
    'mentor_profiles', 'mentorship_slots', 'mentorship_bookings',
    'housing_listings', 'rideshare_offers', 'rideshare_requests',
    'ticket_exchanges', 'alumni_profiles', 'career_opportunities',
    'career_applications', 'direct_messages', 'direct_conversations',
    'cafeteria_menus', 'cafeteria_items', 'home_food_listings',
    'food_orders', 'lost_items', 'lost_item_matches', 'sports_teams',
    'sports_challenges', 'sports_venues', 'sports_venue_bookings',
    'donation_campaigns', 'donations', 'disputes', 'dispute_messages',
    'notifications', 'reviews'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
              WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- Storage bucket for module media (listing photos, found-item photos, evidence)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campus-media',
  'campus-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
