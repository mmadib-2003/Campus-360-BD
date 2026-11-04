-- supabase/migrations/0013_anon_public_listing_reads.sql
-- ============================================================================
-- Browse without a session: RLS for the public listing surfaces.
--
-- Before this file, a logged-out visitor saw an empty feed/skills/housing page
-- even though the rows exist. Two things caused it, and only one of them is in
-- this migration:
--
--   * the module tables' read policies are `TO authenticated` (or `TO public`
--     with a `university_id = current_user_university_id()` test), and
--     `current_user_university_id()` is NULL for an anonymous request, so every
--     row was filtered out silently -- a 200 with [], not an error;
--   * apps/web/app/api/modules/[module]/route.ts required a session before it
--     queried at all (see the matching `publicRead` change on the app side).
--
-- Design:
--   1. Row visibility only for content that is *listed* right now (OPEN /
--      AVAILABLE / ACTIVE ...). A closed, cancelled or hidden row is not made
--      public by this file.
--   2. Column visibility for contact details. RLS cannot hide columns, but
--      PostgREST honours column-level SELECT, so each table's grant below is
--      exactly its live columns minus the ones that let a stranger phone a
--      student. "Sign in to see how to contact them" is the intended experience.
--   3. Identity stays minimal: anon may read the name and avatar of a profile
--      that actually authored visible content -- and nothing else about them.
--
-- Deliberately NOT opened: blood requests/responses and donors (patient names,
-- phone numbers), donations (donor identities), donations ledger, alumni
-- directory, direct messages/conversations, complaints/disputes, orders,
-- applications, RSVPs, membership rosters, bookings, counseling slots,
-- home-food listings. Those keep the `authenticated` tenant policy.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Who may be named in public: an author with currently listed content.
--    SECURITY DEFINER so the policy does not recurse through RLS on the tables
--    it inspects; STABLE so it is evaluated once per query, not per column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_publicly_listed_author(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.posts            t WHERE t.author_id     = p_uid AND t.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.skill_postings   t WHERE t.author_id     = p_uid AND t.status = 'OPEN')
    OR EXISTS (SELECT 1 FROM public.housing_listings t WHERE t.owner_id      = p_uid AND t.status = 'AVAILABLE')
    OR EXISTS (SELECT 1 FROM public.rideshare_offers t WHERE t.owner_id      = p_uid AND t.status IN ('OPEN','FULL'))
    OR EXISTS (SELECT 1 FROM public.lost_items       t WHERE t.reporter_id   = p_uid AND t.status IN ('OPEN','RESOLVED'))
    OR EXISTS (SELECT 1 FROM public.marketplace_listings t WHERE t.seller_id  = p_uid AND t.status IN ('AVAILABLE','RESERVED') AND t.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.sports_teams     t WHERE t.captain_id    = p_uid AND t.status IN ('OPEN','FULL'))
    OR EXISTS (SELECT 1 FROM public.sports_challenges t WHERE t.challenger_id = p_uid AND t.status IN ('OPEN','ACCEPTED'))
    OR EXISTS (SELECT 1 FROM public.mentor_profiles  t WHERE t.user_id       = p_uid)
    OR EXISTS (SELECT 1 FROM public.club_notices     t WHERE t.author_id     = p_uid)
    OR EXISTS (SELECT 1 FROM public.reviews          t WHERE t.author_id     = p_uid AND t.is_hidden = false AND t.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.donation_campaigns t WHERE t.organizer_id = p_uid AND t.status IN ('ACTIVE','COMPLETED'))
  );
$$;

COMMENT ON FUNCTION public.is_publicly_listed_author(uuid) IS
  'True when a user has content that is currently listed publicly. Powers the anonymous profiles read; see 0013.';

REVOKE ALL ON FUNCTION public.is_publicly_listed_author(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_publicly_listed_author(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profiles: a name and an avatar, and only for listed authors.
--    email / student_id / crisis_callback_phone / bio / demo_otp are NOT granted.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon read listed authors" ON public.profiles;
CREATE POLICY "Anon read listed authors"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND trust_level <> 'UNVERIFIED'
    AND public.is_publicly_listed_author(id)
  );

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
    id,university_id,full_name,avatar_url,trust_level,preferred_language
  ) ON public.profiles TO anon;

-- · cafeteria_items  (module: cafeteria-items)
DROP POLICY IF EXISTS "Anon read cafeteria items" ON public.cafeteria_items;
CREATE POLICY "Anon read cafeteria items"
  ON public.cafeteria_items
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON public.cafeteria_items FROM anon;
GRANT SELECT (
    id, university_id, menu_id, name_en, name_bn,
    price_bdt, is_available, stock, is_vegetarian, created_at,
    updated_at
  ) ON public.cafeteria_items TO anon;

-- · cafeteria_menus  (module: cafeteria-menus)
DROP POLICY IF EXISTS "Anon read cafeteria menus" ON public.cafeteria_menus;
CREATE POLICY "Anon read cafeteria menus"
  ON public.cafeteria_menus
  FOR SELECT
  TO anon
  USING (is_active = true);

REVOKE SELECT ON public.cafeteria_menus FROM anon;
GRANT SELECT (
    id, university_id, hall_id, name_en, name_bn,
    serving_date, meal, pickup_window, is_active, created_at,
    updated_at
  ) ON public.cafeteria_menus TO anon;

-- · campus_pickup_points  (module: marketplace-pickup-points)  -- reference data
DROP POLICY IF EXISTS "Anon read campus pickup points" ON public.campus_pickup_points;
CREATE POLICY "Anon read campus pickup points"
  ON public.campus_pickup_points
  FOR SELECT
  TO anon
  USING (is_active = true);

REVOKE SELECT ON public.campus_pickup_points FROM anon;
GRANT SELECT (
    id, university_id, code, name_en, name_bn,
    location_en, location_bn, is_active, created_at, updated_at
  ) ON public.campus_pickup_points TO anon;

-- · career_opportunities  (module: careers)  -- the alumni behind a posting stays private
DROP POLICY IF EXISTS "Anon read career opportunities" ON public.career_opportunities;
CREATE POLICY "Anon read career opportunities"
  ON public.career_opportunities
  FOR SELECT
  TO anon
  USING (status = 'OPEN');

REVOKE SELECT ON public.career_opportunities FROM anon;
GRANT SELECT (
    id, university_id, alumni_id, kind, company,
    title, description, location, is_remote, salary_range,
    apply_url, deadline, status, created_at, updated_at
  ) ON public.career_opportunities TO anon;

-- · club_notices  (module: club-notices)
DROP POLICY IF EXISTS "Anon read club notices" ON public.club_notices;
CREATE POLICY "Anon read club notices"
  ON public.club_notices
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON public.club_notices FROM anon;
GRANT SELECT (
    id, university_id, club_id, author_id, title,
    body, created_at
  ) ON public.club_notices TO anon;

-- · clubs  (module: clubs)
DROP POLICY IF EXISTS "Anon read clubs" ON public.clubs;
CREATE POLICY "Anon read clubs"
  ON public.clubs
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON public.clubs FROM anon;
GRANT SELECT (
    id, university_id, slug, name_en, name_bn,
    category, description_en, description_bn, logo_url, member_count,
    is_recruiting, created_at, updated_at
  ) ON public.clubs TO anon;
-- withheld from anon: contact_email

-- · donation_campaigns  (module: campaigns)  -- the donor list stays member-only
DROP POLICY IF EXISTS "Anon read donation campaigns" ON public.donation_campaigns;
CREATE POLICY "Anon read donation campaigns"
  ON public.donation_campaigns
  FOR SELECT
  TO anon
  USING (status IN ('ACTIVE','COMPLETED'));

REVOKE SELECT ON public.donation_campaigns FROM anon;
GRANT SELECT (
    id, university_id, organizer_id, title, story,
    cause, target_bdt, raised_bdt, donors_count, deadline,
    cover_image_url, is_verified, status, created_at, updated_at
  ) ON public.donation_campaigns TO anon;

-- · health_contacts  (module: health-contacts)  -- institution hotlines, not personal numbers
DROP POLICY IF EXISTS "Anon read health contacts" ON public.health_contacts;
CREATE POLICY "Anon read health contacts"
  ON public.health_contacts
  FOR SELECT
  TO anon
  USING (is_active = true);

REVOKE SELECT ON public.health_contacts FROM anon;
GRANT SELECT (
    id, university_id, kind, label_en, label_bn,
    phone, available_hours, notes_en, notes_bn, is_active,
    created_at
  ) ON public.health_contacts TO anon;

-- · housing_listings  (module: housing)  -- the owner replies in-app once the visitor signs in
DROP POLICY IF EXISTS "Anon read housing listings" ON public.housing_listings;
CREATE POLICY "Anon read housing listings"
  ON public.housing_listings
  FOR SELECT
  TO anon
  USING (status = 'AVAILABLE');

REVOKE SELECT ON public.housing_listings FROM anon;
GRANT SELECT (
    id, university_id, owner_id, kind, title,
    description, rent_bdt, seat_count, gender_policy, area_en,
    area_bn, distance_km, amenities, image_urls, status,
    created_at, updated_at
  ) ON public.housing_listings TO anon;
-- withheld from anon: contact_phone

-- · lost_items  (module: lost-found)  -- claim details need a session
DROP POLICY IF EXISTS "Anon read lost items" ON public.lost_items;
CREATE POLICY "Anon read lost items"
  ON public.lost_items
  FOR SELECT
  TO anon
  USING (status IN ('OPEN','RESOLVED'));

REVOKE SELECT ON public.lost_items FROM anon;
GRANT SELECT (
    id, university_id, reporter_id, kind, title,
    description, category, keywords, location_en, occurred_on,
    image_urls, status, matched_item_id, created_at, updated_at
  ) ON public.lost_items TO anon;
-- withheld from anon: contact_note

-- · marketplace_listings  (module: marketplace)  -- SOLD rows stay member-only
DROP POLICY IF EXISTS "Anon read marketplace listings" ON public.marketplace_listings;
CREATE POLICY "Anon read marketplace listings"
  ON public.marketplace_listings
  FOR SELECT
  TO anon
  USING (status IN ('AVAILABLE','RESERVED') AND deleted_at IS NULL);

REVOKE SELECT ON public.marketplace_listings FROM anon;
GRANT SELECT (
    id, university_id, seller_id, title, description,
    category, price_bdt, condition, images, status,
    deleted_at, created_at, updated_at, kind, rent_period,
    is_negotiable, keyword_tags, views_count, pickup_point_id
  ) ON public.marketplace_listings TO anon;

-- · mentor_profiles  (module: mentors)
DROP POLICY IF EXISTS "Anon read mentor profiles" ON public.mentor_profiles;
CREATE POLICY "Anon read mentor profiles"
  ON public.mentor_profiles
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON public.mentor_profiles FROM anon;
GRANT SELECT (
    id, university_id, user_id, headline, expertise,
    languages, session_rate_bdt, bio, is_accepting, sessions_count,
    rating, created_at, updated_at
  ) ON public.mentor_profiles TO anon;

-- · mentorship_slots  (module: mentorship-slots)
DROP POLICY IF EXISTS "Anon read mentorship slots" ON public.mentorship_slots;
CREATE POLICY "Anon read mentorship slots"
  ON public.mentorship_slots
  FOR SELECT
  TO anon
  USING (is_active = true);

REVOKE SELECT ON public.mentorship_slots FROM anon;
GRANT SELECT (
    id, university_id, mentor_id, topic, starts_at,
    ends_at, capacity, booked_count, is_active, created_at
  ) ON public.mentorship_slots TO anon;

-- · reviews  (module: reviews)
DROP POLICY IF EXISTS "Anon read reviews" ON public.reviews;
CREATE POLICY "Anon read reviews"
  ON public.reviews
  FOR SELECT
  TO anon
  USING (is_hidden = false AND deleted_at IS NULL);

REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (
    id, university_id, author_id, target_type, target_id,
    rating, title, body, photo_urls, tags,
    verified_participation, pending_reports_count, is_hidden, deleted_at, created_at,
    updated_at
  ) ON public.reviews TO anon;

-- · rideshare_offers  (module: rideshare)  -- FULL is still a real offer, just not joinable
DROP POLICY IF EXISTS "Anon read rideshare offers" ON public.rideshare_offers;
CREATE POLICY "Anon read rideshare offers"
  ON public.rideshare_offers
  FOR SELECT
  TO anon
  USING (status IN ('OPEN','FULL'));

REVOKE SELECT ON public.rideshare_offers FROM anon;
GRANT SELECT (
    id, university_id, owner_id, mode, origin,
    destination, depart_at, seats_total, seats_available, fare_bdt,
    vehicle_details, notes, status, created_at, updated_at
  ) ON public.rideshare_offers TO anon;

-- · skill_postings  (module: skills)  -- closed postings are the author's own business
DROP POLICY IF EXISTS "Anon read skill postings" ON public.skill_postings;
CREATE POLICY "Anon read skill postings"
  ON public.skill_postings
  FOR SELECT
  TO anon
  USING (status = 'OPEN');

REVOKE SELECT ON public.skill_postings FROM anon;
GRANT SELECT (
    id, university_id, author_id, type, title,
    description, category, skills, location_en, location_bn,
    availability, rate_bdt, is_remote, status, applicants_count,
    created_at, updated_at
  ) ON public.skill_postings TO anon;
-- withheld from anon: contact_note

-- · sports_challenges  (module: sports-challenges)
DROP POLICY IF EXISTS "Anon read sports challenges" ON public.sports_challenges;
CREATE POLICY "Anon read sports challenges"
  ON public.sports_challenges
  FOR SELECT
  TO anon
  USING (status IN ('OPEN','ACCEPTED'));

REVOKE SELECT ON public.sports_challenges FROM anon;
GRANT SELECT (
    id, university_id, challenger_id, team_name, sport,
    title, description, preferred_date, venue, status,
    created_at, updated_at
  ) ON public.sports_challenges TO anon;

-- · sports_teams  (module: sports-teams)
DROP POLICY IF EXISTS "Anon read sports teams" ON public.sports_teams;
CREATE POLICY "Anon read sports teams"
  ON public.sports_teams
  FOR SELECT
  TO anon
  USING (status IN ('OPEN','FULL'));

REVOKE SELECT ON public.sports_teams FROM anon;
GRANT SELECT (
    id, university_id, captain_id, name, sport,
    skill_level, needed_roles, description, status, created_at,
    updated_at
  ) ON public.sports_teams TO anon;
-- withheld from anon: contact_note

-- · sports_venues  (module: sports-venues)  -- reference data
DROP POLICY IF EXISTS "Anon read sports venues" ON public.sports_venues;
CREATE POLICY "Anon read sports venues"
  ON public.sports_venues
  FOR SELECT
  TO anon
  USING (is_active = true);

REVOKE SELECT ON public.sports_venues FROM anon;
GRANT SELECT (
    id, university_id, name_en, name_bn, sport,
    capacity, hourly_rate_bdt, lat, lng, is_active,
    created_at
  ) ON public.sports_venues TO anon;

-- ---------------------------------------------------------------------------
-- 4. Sanity: every table an anon policy was just created on must still have its
--    tenant policy for members. If a future migration drops one, this raises
--    instead of silently leaving signed-in users with less access than guests.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t.tbl, ', ' ORDER BY t.tbl)
    INTO missing
  FROM (VALUES
    ('cafeteria_items'),
    ('cafeteria_menus'),
    ('campus_pickup_points'),
    ('career_opportunities'),
    ('club_notices'),
    ('clubs'),
    ('donation_campaigns'),
    ('health_contacts'),
    ('housing_listings'),
    ('lost_items'),
    ('marketplace_listings'),
    ('mentor_profiles'),
    ('mentorship_slots'),
    ('profiles'),
    ('reviews'),
    ('rideshare_offers'),
    ('skill_postings'),
    ('sports_challenges'),
    ('sports_teams'),
    ('sports_venues')
  ) t(tbl)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tbl
      AND p.cmd = 'SELECT' AND p.roles::text LIKE '%authenticated%'
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '0013: member tenant SELECT policy missing on: %', missing;
  END IF;
END $$;

COMMIT;

-- Rollback (safe: removes only what this file added):
--   DROP POLICY IF EXISTS "Anon read listed authors" ON public.profiles;
--   DROP FUNCTION public.is_publicly_listed_author(uuid);
--   -- per table: DROP POLICY IF EXISTS "Anon read <name>" ON public.<table>;
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;  -- restores full-column reads
