-- JU image and campus write guardrails for public cross-campus browsing.
-- Private data and personal contact columns remain protected.
BEGIN;

-- The image is bundled with the web app and versioned to invalidate browser/CDN caches.
UPDATE public.universities
SET cover_image_url = '/campuses/ju.jpg?v=ju-shaheed-minar', updated_at = now()
WHERE code = 'JU';
-- Public cross-campus listings use the existing anonymous row policies and
-- restricted column grants in 0013 via a stateless public client. Do not add
-- authenticated base-table cross-campus policies: RLS does not hide personal
-- contact columns, medical data, private complaints, or archive metadata.

-- Existing permissive policies are ORed together. Restrictive policies ensure
-- none of those policies can accidentally authorize cross-campus writes.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'marketplace_listings','campus_pickup_points','skill_postings','clubs','club_notices',
    'health_contacts','mentor_profiles','mentorship_slots','housing_listings','rideshare_offers',
    'career_opportunities','cafeteria_menus','cafeteria_items','lost_items','sports_teams',
    'sports_challenges','sports_venues','donation_campaigns','reviews','events',
    'marketplace_orders','marketplace_messages','skill_applications','complaint_upvotes',
    'club_members','event_rsvps','mentorship_bookings','career_applications','sports_venue_bookings','donations'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Campus write guard insert', target);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Campus write guard update', target);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Campus write guard delete', target);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (university_id = public.current_user_university_id())', 'Campus write guard insert', target);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (university_id = public.current_user_university_id()) WITH CHECK (university_id = public.current_user_university_id())', 'Campus write guard update', target);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (university_id = public.current_user_university_id())', 'Campus write guard delete', target);
  END LOOP;
END $$;

-- A row with the caller's university_id must not refer to a foreign campus's
-- listing, ticket, club or event, even when the parent is publicly readable.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('marketplace_orders','listing_id','marketplace_listings'),
    ('marketplace_messages','listing_id','marketplace_listings'),
    ('skill_applications','posting_id','skill_postings'),
    ('complaint_upvotes','complaint_id','complaints'),
    ('club_members','club_id','clubs'),
    ('club_notices','club_id','clubs'),
    ('event_rsvps','event_id','events'),
    ('mentorship_bookings','slot_id','mentorship_slots'),
    ('career_applications','opportunity_id','career_opportunities'),
    ('sports_venue_bookings','venue_id','sports_venues'),
    ('donations','campaign_id','donation_campaigns')
  ) AS t(child, foreign_key, parent)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Campus parent guard insert', item.child);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Campus parent guard update', item.child);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I AND p.university_id = public.current_user_university_id()))',
      'Campus parent guard insert', item.child, item.parent, item.child, item.foreign_key);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (EXISTS (SELECT 1 FROM public.%I p WHERE p.id = %I.%I AND p.university_id = public.current_user_university_id()))',
      'Campus parent guard update', item.child, item.parent, item.child, item.foreign_key);
  END LOOP;
END $$;
COMMIT;
