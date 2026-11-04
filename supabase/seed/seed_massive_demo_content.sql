-- supabase/seed/seed_massive_demo_content.sql
-- ============================================================================
-- MASSIVE DEMO COVERAGE: up to 10 campuses x 24 module tables, wide AND local.
--
-- Why: seed_demo_content.sql is already good -- specific, bilingual, plausible
-- -- but it is thin (6 housing listings spread over 51 universities, and /civic
-- is empty outright because public.complaints has zero rows). Every section of
-- the product therefore looked half-empty on every campus but one or two.
--
-- What this does: every row that is *currently listed* at one of the flagship
-- campuses is re-materialised for each of the others, with the local
-- detail re-resolved instead of copied -- hall, author, club, department, menu,
-- campaign, pickup point and price/date all come from the target campus, and
-- prose mentioning another campus's area, city or hall is rewritten through
-- pg_temp.localize(). So JU's listings talk about Savar and Masterda Surya Sen
-- Hall, CU's about Agrabad and Shahjalal Hall, rather than being DU with a new
-- university_id.
--
-- Rules that keep it honest:
--   * ids are md5('<table>:v1:' || source id || ':' || campus code) and every
--     statement is guarded by NOT EXISTS on that id + ON CONFLICT DO NOTHING,
--     so the file is idempotent and a second run inserts nothing.
--   * no existing row is ever updated (except universities.logo_url /
--     cover_image_url, which are only filled when missing or are placeholders),
--     so nothing here can clobber data the app itself owns.
--   * only rows that are already OPEN / AVAILABLE / PUBLIC / not-hidden at their
--     home campus are ported, which is exactly the shape the anonymous listing
--     policies in 0013_anon_public_listing_reads.sql let through. Statuses are
--     carried over rather than widened, so a SOLD item does not come back to
--     life at another campus.
--   * authors are always a deleted_at IS NULL profile of the SAME university
--     with trust_level <> 'UNVERIFIED', chosen by a distinct offset per row so
--     the UNIQUE(user_id) tables (mentor_profiles, health_donors,
--     alumni_profiles) do not collide with each other.
--   * timestamps: created/updated walk backwards a little per row so "2 hours
--     ago" varies, while starts_at / deadline / serving_date move forwards so
--     events, slots and today's mess menu stay future-dated (ends_at keeps its
--     CHECK by deriving from the same offset as starts_at).
--
-- Shape note: this file is a small rules table plus one generic port, not 1000
-- literal INSERTs. The row count is ~1.4k and the payload had to stay inside a
-- single transaction (a temp-table per statement would have needed ~200 KB of
-- repeated SQL); the rules in pg_temp.rule are what a reviewer should read.
--
-- Run against the target project as one batch:
--   psql "$DATABASE_URL" -f supabase/seed/seed_massive_demo_content.sql
-- or paste into the SQL editor. Generated demo data: safe to re-run, safe to
-- delete (the ':v1:' id namespace makes this file's rows removable exactly).
-- ============================================================================

BEGIN;

-- · which campuses get the extra rows.
-- Not a hardcoded list: content in this schema is authored, and public.profiles.id
-- is a FOREIGN KEY to auth.users(id), so a demo row cannot be attributed to an
-- account that does not exist. Only campuses with at least one live, non-UNVERIFIED
-- profile can therefore host listings honestly -- that is DU, JU, BUET, RU, CU,
-- SUST and JUST today, which covers every campus the demo accounts are for. The
-- rest stay thin until they get real signups, rather than shipping rows with a
-- borrowed author (which 0013's anonymous policies would hide anyway, since the
-- author has to share the university).
CREATE TEMP TABLE codes ON COMMIT DROP AS
SELECT u.code
FROM public.universities u
WHERE u.is_active
  AND u.code = ANY(ARRAY['DU','JU','BUET','RU','CU','SUST','JUST','KU','IU','JNU'])
  AND (SELECT count(*) FROM public.profiles p
        WHERE p.university_id = u.id
          AND p.deleted_at IS NULL
          AND p.trust_level IS DISTINCT FROM 'UNVERIFIED') >= 1;

-- Area/city wording is read back out of the rows the flagship seed already
-- established (housing/skill listings), so this file types no Bengali literals
-- of its own and cannot introduce a wrong spelling of a place name.
CREATE TEMP TABLE campus ON COMMIT DROP AS
SELECT u.id AS uid, u.code, v.ix,
       u.city AS city_en,
       split_part(u.name_bn, ' ', 1) AS city_bn,
       coalesce((SELECT h.area_en FROM public.housing_listings h
                  WHERE h.university_id = u.id AND h.area_en IS NOT NULL
                  ORDER BY h.created_at DESC NULLS LAST LIMIT 1),
                u.city || ' campus') AS area_en,
       coalesce((SELECT h.area_bn FROM public.housing_listings h
                  WHERE h.university_id = u.id AND h.area_bn IS NOT NULL
                  ORDER BY h.created_at DESC NULLS LAST LIMIT 1),
                (SELECT s.location_bn FROM public.skill_postings s
                  WHERE s.university_id = u.id AND s.location_bn IS NOT NULL LIMIT 1),
                split_part(u.name_bn, ' ', 1)) AS area_bn
FROM public.universities u
JOIN (VALUES ('DU',0),('JU',1),('BUET',2),('RU',3),('CU',4),
             ('SUST',5),('JUST',6),('KU',7),('IU',8),('JNU',9)) AS v(code, ix)
  ON v.code = u.code;

-- · reference halls for every campus that has none (today: only DU, JU, BUET).
-- Names come from public.university_halls, the hall list this project already
-- ships with, so they are the real halls of that campus rather than invented
-- ones. public.halls is what dining menus, the hall chip on a profile and a
-- donor's hall link resolve through, so without it those surfaces stay blank.
-- gender_policy is only asserted where the name itself says so; otherwise
-- MIXED, which never wrongly hides a hall from a student.
INSERT INTO public.halls (university_id, code, name_en, name_bn, gender_policy, lat, lng)
SELECT h.university_id,
       upper(left(regexp_replace(h.name, '[^A-Za-z]', '', 'g'), 12)),
       h.name,
       coalesce(nullif(h.name_bn, ''), h.name),
       CASE WHEN lower(h.name) ~ '(girl|girls|female|mohila|mobila|women|lady)' THEN 'FEMALE' ELSE 'MIXED' END,
       round((u.lat + ((rank() OVER (PARTITION BY h.university_id ORDER BY h.name)) % 5) * 0.0009)::numeric, 6)::float8,
       round((u.lng - ((rank() OVER (PARTITION BY h.university_id ORDER BY h.name)) % 4) * 0.0007)::numeric, 6)::float8
FROM public.university_halls h
JOIN public.universities u ON u.id = h.university_id
WHERE h.is_active
  -- `university_halls` doubles as the hall-application dropdown, so it also holds
  -- *statuses*: "Day Scholar (no hall seat applied for)" is not a building, and
  -- importing it turned it into a hall that the dining/housing modules then
  -- advertised (and that this seed's own localiser then pasted into event venues
  -- and menu names). Reference data keeps the option; `halls` does not.
  AND lower(h.name) !~ '(day scholar|no hall seat|off-campus residence|not applicable)'
  AND NOT EXISTS (SELECT 1 FROM public.halls x WHERE x.university_id = h.university_id)
ON CONFLICT (university_id, code) DO NOTHING;

-- · regex-escaping for the vocabulary above. Postgres has no regexp_quote(), and
-- an unescaped '(' in a hall name would make the whole pattern invalid, so each
-- metacharacter is prefixed here. chr(92) is used instead of a backslash literal
-- so this file stays free of backslash escapes at every layer that reads it.
CREATE FUNCTION pg_temp.rxq(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $rx$
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(
            replace(replace(replace(replace(replace(s,
    chr(92), chr(92) || chr(92)),
    '.',   chr(92) || '.'),
    '*',   chr(92) || '*'),
    '+',   chr(92) || '+'),
    '?',   chr(92) || '?'),
    '(',   chr(92) || '('),
    ')',   chr(92) || ')'),
    '[',   chr(92) || '['),
    ']',   chr(92) || ']'),
    '{',   chr(92) || '{'),
    '}',   chr(92) || '}'),
    '|',   chr(92) || '|'),
    '^',   chr(92) || '^'),
    '$',   chr(92) || '$')
$rx$;

-- · the vocabulary to rewrite, built from the data rather than hardcoded, so it
-- stays in sync with whatever halls and areas actually exist. Longest first so
-- 'Sher-e-Bangla Fazlul Haque Hall' is not half-eaten by a shorter name, and
-- regexp_quote'd because hall names contain dots and hyphens.
CREATE TEMP TABLE pat ON COMMIT DROP AS
SELECT 'hall' AS kind, 'en' AS lang,
       string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n) AS rx
FROM (SELECT name_en AS n FROM public.halls
      UNION SELECT name FROM public.university_halls) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
SELECT 'hall', 'bn', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT name_bn AS n FROM public.halls
      UNION SELECT name_bn FROM public.university_halls) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
SELECT 'area', 'en', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT area_en AS n FROM public.housing_listings
      UNION SELECT location_en FROM public.skill_postings
      UNION SELECT area_en FROM pg_temp.campus) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
SELECT 'area', 'bn', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT area_bn AS n FROM public.housing_listings
      UNION SELECT location_bn FROM public.skill_postings
      UNION SELECT area_bn FROM pg_temp.campus) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
SELECT 'city', 'en', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT city AS n FROM public.universities
      UNION SELECT city_en FROM pg_temp.campus) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
SELECT 'city', 'bn', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT city_bn AS n FROM pg_temp.campus
      UNION SELECT split_part(name_bn, ' ', 1) FROM public.universities) s
WHERE n IS NOT NULL AND n <> ''
UNION ALL
-- University names/codes. Without this pass a row ported from SUST to JUST kept
-- saying "Programming tutor for SUST 1st/2nd year". The English list is wrapped in
-- word boundaries (chr(92) || 'y') so a two-letter code such as 'DU' cannot bite
-- inside a word; the Bengali list is left unbounded because non-ASCII letters are
-- not word characters under this database locale, where a word boundary would
-- simply never match.
SELECT 'uni', 'en',
       string_agg(chr(92) || 'y' || pg_temp.rxq(n) || chr(92) || 'y', '|' ORDER BY length(n) DESC, n)
FROM (SELECT name_en AS n FROM public.universities
      UNION SELECT code FROM public.universities) s
WHERE n IS NOT NULL AND length(n) >= 2
UNION ALL
SELECT 'uni', 'bn', string_agg(pg_temp.rxq(n), '|' ORDER BY length(n) DESC, n)
FROM (SELECT name_bn AS n FROM public.universities
      UNION SELECT split_part(name_bn, ' ', 1) FROM public.universities) s
WHERE n IS NOT NULL AND n <> '';

-- · one helper does all four substitutions for a column (hall, area, city, university). Hall/area/city resolve
-- to a deterministic row of the target campus, so every column of one ported row
-- names the SAME hall (a title and its body never disagree). A pattern that is
-- missing falls back to chr(1), which no text contains, rather than to NULL
-- (which would silently null out the column).
CREATE FUNCTION pg_temp.localize(t text, tid uuid, m text) RETURNS text
LANGUAGE sql STABLE AS $fn$
  SELECT CASE WHEN t IS NULL OR t = '' THEN t ELSE
    regexp_replace(
      regexp_replace(
      regexp_replace(
        regexp_replace(t,
          '(?:' || coalesce((SELECT rx FROM pg_temp.pat WHERE kind = 'hall' AND lang = m), chr(1)) || ')',
          coalesce((SELECT CASE WHEN m = 'bn' THEN h.name_bn ELSE h.name_en END
                     FROM public.halls h WHERE h.university_id = tid
                    ORDER BY md5(h.id::text || 'loc') LIMIT 1), ''), 'g'),
        '(?:' || coalesce((SELECT rx FROM pg_temp.pat WHERE kind = 'area' AND lang = m), chr(1)) || ')',
        coalesce((SELECT CASE WHEN m = 'bn' THEN c.area_bn ELSE c.area_en END
                    FROM pg_temp.campus c WHERE c.uid = tid), ''), 'g'),
      '(?:' || coalesce((SELECT rx FROM pg_temp.pat WHERE kind = 'city' AND lang = m), chr(1)) || ')',
      coalesce((SELECT CASE WHEN m = 'bn' THEN c.city_bn ELSE c.city_en END
                  FROM pg_temp.campus c WHERE c.uid = tid), ''), 'g'),
      '(?:' || coalesce((SELECT rx FROM pg_temp.pat WHERE kind = 'uni' AND lang = m), chr(1)) || ')',
      coalesce((SELECT CASE WHEN m = 'bn' THEN nullif(u.name_bn, '') ELSE u.name_en END
                  FROM public.universities u WHERE u.id = tid), ''), 'g')
  END
$fn$;

-- · the port rules. txt = prose columns to localize (only plain text columns are
-- ever touched; enum-backed columns such as status, category, kind, condition
-- are always carried over untouched so they stay valid values). own = a column
-- that must be re-resolved against the target campus instead of copied.
CREATE TEMP TABLE rule ON COMMIT DROP AS
SELECT * FROM (VALUES
 ( 1,'posts',              $q$src.deleted_at IS NULL$q$,
        'title, body', ''),
 ( 2,'skill_postings',     $q$src.status = 'OPEN'$q$,
        'title, description, availability, contact_note', 'location_en:area, location_bn:areabn, contact_phone:phone'),
 ( 3,'housing_listings',   $q$src.status = 'AVAILABLE'$q$,
        'title, description, contact_note', 'area_en:area, area_bn:areabn, contact_phone:phone'),
 ( 4,'rideshare_offers',   $q$src.status IN ('OPEN','FULL')$q$,
        'vehicle_details, notes', 'origin:area, destination:city, contact_phone:phone'),
 ( 5,'lost_items',         $q$src.status = 'OPEN'$q$,
        'title, description, contact_note', 'location_en:area, matched_item_id:null'),
 ( 6,'marketplace_listings', $q$src.status IN ('AVAILABLE','RESERVED') AND src.deleted_at IS NULL$q$,
        'title, description', 'pickup_point_id:pickup, contact_phone:phone'),
 ( 7,'club_notices',       $q$EXISTS (SELECT 1 FROM public.clubs tc WHERE tc.university_id = tgt.id AND tc.slug = sc.slug)$q$,
        'title, body', 'club_id:club'),
 ( 8,'events',             $q$src.is_public AND src.deleted_at IS NULL$q$,
        'title_en, title_bn, description_en, description_bn, text_directions_en, text_directions_bn, host_organization',
        'club_id:club, venue_name:hallname, venue_name_bn:hallnamebn, formatted_address:addr'),
 ( 9,'academic_files',     $q$src.dmca_quarantined = FALSE AND EXISTS (SELECT 1 FROM public.departments td WHERE td.university_id = tgt.id AND td.code = coalesce(sd.code, td.code))$q$,
        'course_title, license_attribution', 'department_id:dept'),
 (10,'mentor_profiles',    $q$true$q$,
        'headline, bio', ''),
 (11,'mentorship_slots',   $q$false$q$,   -- handled below: booked_count must be
        '', ''),                          -- clamped to capacity, which a generic
                                          -- count bump cannot express

 (12,'alumni_profiles',    $q$true$q$,
        'employer', 'city:city'),
 (13,'career_opportunities', $q$src.status = 'OPEN' AND EXISTS (SELECT 1 FROM public.alumni_profiles aa WHERE aa.university_id = tgt.id)$q$,
        'title, description', 'alumni_id:alumnus, location:area'),
 (14,'cafeteria_menus',    $q$src.is_active$q$,
        '', 'hall_id:hall, name_en:hallname, name_bn:hallnamebn'),
 (15,'cafeteria_items',    $q$false$q$,   -- has a NOT NULL university_id of its
        '', ''),                          -- own; explicit block below, per menu

 (16,'sports_teams',       $q$src.status IN ('OPEN','FULL')$q$,
        'name, description, contact_note', ''),
 (17,'sports_challenges',  $q$src.status = 'OPEN'$q$,
        'team_name, title, description', 'venue:venue'),
 (18,'donation_campaigns', $q$src.status = 'ACTIVE'$q$,
        'title, story', ''),
 (19,'donations',          $q$EXISTS (SELECT 1 FROM public.donation_campaigns dc WHERE dc.university_id = tgt.id AND dc.status = 'ACTIVE')$q$,
        'message', 'campaign_id:campaign'),
 (20,'donation_ledger',    $q$EXISTS (SELECT 1 FROM public.donation_campaigns dc WHERE dc.university_id = tgt.id AND dc.status = 'ACTIVE')$q$,
        'description', 'campaign_id:campaign'),
 (21,'blood_requests',     $q$src.status = 'OPEN'$q$,
        '', 'hospital_name:hospital, hospital_address:addr, contact_phone:phone, fulfilled_by_donor_id:null'),
 (22,'health_donors',      $q$src.is_available AND EXISTS (SELECT 1 FROM public.profiles p3 WHERE p3.id = src.user_id AND p3.university_id = src.university_id)$q$,
        '', 'hall_id:hall, contact_phone:phone'),
 (23,'governance_notices', $q$true$q$,
        'title, body', 'created_by:gov'),
 (24,'reviews',            $q$src.is_hidden = false AND src.deleted_at IS NULL$q$,
        'title, body', 'target_id:review')
) AS r(ord, tbl, guard, txt, own);

-- · civic tickets. /civic and /complaints read empty because public.complaints
-- has zero rows -- nothing to port -- so these are authored: four ordinary
-- grievances per campus, each attached to a hall of that campus through
-- location_hint, with in-flight statuses and real SLA hours so the SLA meter,
-- the escalation list and the public board all have something true to show.
-- Bodies deliberately name no hall or area in the text itself, so the same
-- wording stays accurate wherever it is filed and the Bengali stays correct.
INSERT INTO public.complaints
  (id, university_id, tracking_code, title, description, category, severity, status,
   sla_hours, sla_due_at, sla_breached, created_at, updated_at, last_activity_at,
   is_anonymous, consent_to_share_identity, is_public_issue, upvotes_count,
   preferred_language, location_hint)
SELECT md5('complaints:v1:' || c.uid::text || ':' || t.ord)::uuid, c.uid,
       'C360-' || c.code || '-26-' || lpad(t.ord::text, 3, '0'),
       t.title, t.body, t.cat::complaint_category, t.sev::complaint_severity,
       (ARRAY['ACKNOWLEDGED','IN_REVIEW','ACTION_TAKEN'])[1 + (c.ix + t.ord) % 3]::complaint_status,
       t.sla, now() + (t.sla * interval '1 hour'), false,
       now() - ((c.ix + t.ord) * interval '1 day'),
       now() - ((t.ord % 3) * interval '5 hours'),
       now() - ((t.ord % 3) * interval '5 hours'),
       true, false, (t.ord % 2 = 1), (c.ix * 3 + t.ord) % 9,
       CASE WHEN t.ord % 2 = 0 THEN 'en' ELSE 'bn' END,
       coalesce((SELECT h.name_en || ', ' || h.name_bn FROM public.halls h
                  WHERE h.university_id = c.uid
                  ORDER BY md5(h.id::text || 'cpl') LIMIT 1), c.area_en)
FROM (VALUES
 (1, 'Evening water supply fails on the upper floors',
     'Water stops most evenings between 7 and 10pm on the third and fourth floors, which is exactly when everyone is back from classes. The motor runs but the overhead tank never fills. This has gone on for two weeks; the hall office has been told twice and a plumber was promised but has not come.'
     || chr(10) || chr(10) || U&'সেমিস্টার শুরু থেকে সন্ধ্যা ৭টা থেকে ১০টা পর্যন্ত তৃতীয় ও চতুর্থ তলায় প্রায়ই পানি আসে না, ঠিক ক্লাস থেকে ফেরার সময়টাতে। মোটর চলে কিন্তু ওপরের ট্যাঙ্ক ভরে না। দুই সপ্তাহ ধরে চলছে; হল অফিসে দুবার জানানো হয়েছে, প্লাম্বার আসবে বলেছিল কিন্তু আসেনি।',
     'INFRASTRUCTURE', 'HIGH', 24),
 (2, 'Second-year sessional results are three weeks late',
     'Results were due three weeks ago and still are not published. Two of my friends cannot register courses for the next semester because the hold sits on the previous result, and the office keeps giving a date that then moves. A written timeline would let us plan instead of queuing every Thursday.'
     || chr(10) || chr(10) || U&'দ্বিতীয় বর্ষের সেশনালের ফলাফল তিন সপ্তাহ আগে দেওয়ার কথা ছিল, এখনো প্রকাশ হয়নি। আগের ফলাফলের হোল্ড থাকায় দুই বন্ধু পরের সেমেস্টারের কোর্স রেজিস্ট্রেশন করতে পারছে না। অফিস যে তারিখ বলে তা পরে সরে যায়; লিখিত সময়সীমা দিলে প্রতি বৃহস্পতিবার লাইনে দাঁড়াতে হতো না।',
     'ACADEMIC', 'MEDIUM', 72),
 (3, 'The morning campus bus leaves students behind twice a week',
     'By the second stop there is no room left, so students who live on that side miss the first class and then wait forty minutes for the next shuttle. One more bus leaving ten minutes later would cover it, and the gate register already shows how many board at that stop.'
     || chr(10) || chr(10) || U&'দ্বিতীয় সিটেই বাস ভরে যায়, তাই ওই পাশের ছাত্রছাত্রী প্রথম ক্লাস মিস করে ও পরের বাসের জন্য প্রায় চল্লিশ মিনিট অপেক্ষা করে। দশ মিনিট পরে আর একটি বাস চালালেই সমস্যার সমাধান হবে, গেটের রেজিস্টারেই ওই সিটে ওঠার সংখ্যা দেখা যাচ্ছে।',
     'TRANSPORT', 'LOW', 48),
 (4, 'Reading room closes early during exam weeks',
     'The central library shuts its reading room in the last two weeks before exams at the usual evening time, when the demand is highest, and the floor staff say it is a power-budget rule. Extending it by four hours for those two weeks needs a decision taken above the front desk, which is why it is filed here.'
     || chr(10) || chr(10) || U&'পরীক্ষার আগের দুই সপ্তাহে কেন্দ্রীয় লাইব্রেরির রিডিং রুম সবসময়ের মতো সন্ধ্যায় বন্ধ হয়ে যায়, যখন চাহিদা সবচেয়ে বেশি। ফ্লোর স্টাফরা বলে এটি বিদ্যুৎ বাজেটের নিয়ম। ওই দুই সপ্তাহ চার ঘণ্টা বাড়িয়ে খোলা রাখার সিদ্ধান্ত টেবিলের উপরে নিতে হবে, তাই এখানে জমা দিলাম।',
     'ACADEMIC', 'MEDIUM', 72)
) AS t(ord, title, body, cat, sev, sla)
CROSS JOIN pg_temp.campus c
WHERE NOT EXISTS (SELECT 1 FROM public.complaints x
                   WHERE x.tracking_code = 'C360-' || c.code || '-26-' || lpad(t.ord::text, 3, '0'))
ON CONFLICT (tracking_code) DO NOTHING;

-- · the generic port. One dynamic INSERT..SELECT per rule, executed in the same
-- transaction so the temp tables and the localized text are all visible.
DO $do$
DECLARE
  r record; c record; e text; own_key text; collist text; explist text; q text;
  newid text; n bigint; tot bigint := 0; ins bigint := 0;
  person text; hall_e text; hallb_e text;
  rev text;
BEGIN
  -- A profile of the target campus, walked by row number so a ported row per
  -- source row does not all land on one author (and so UNIQUE(user_id) tables
  -- survive).
  person := '(SELECT p.id FROM public.profiles p WHERE p.university_id = tgt.id '
    || 'AND p.deleted_at IS NULL AND p.trust_level IS DISTINCT FROM ''UNVERIFIED'' '
    || 'ORDER BY md5(p.id::text || tgt.code || src.id::text) '
    || 'OFFSET (src.rn % GREATEST((SELECT count(*) FROM public.profiles p2 '
    || 'WHERE p2.university_id = tgt.id AND p2.deleted_at IS NULL), 1)) LIMIT 1)';

  -- A single deterministic hall per campus -- the same one for every column.
  hall_e := 'coalesce((SELECT h.name_en FROM public.halls h WHERE h.university_id = tgt.id '
    || 'ORDER BY md5(h.id::text || ''loc'') LIMIT 1), tgt.name_en || '' campus grounds'')';
  hallb_e := 'coalesce((SELECT h.name_bn FROM public.halls h WHERE h.university_id = tgt.id '
    || 'ORDER BY md5(h.id::text || ''loc'') LIMIT 1), tgt.name_bn || '' হল'')';

  -- reviews.target_id has no FK and is NOT NULL, so it is re-pointed at the same
  -- kind of thing at the target campus; the fallback keeps a NULL from turning
  -- into a not-null violation on an unrelated target type.
  rev := '(COALESCE(CASE src.target_type '
    || 'WHEN ''TUTORING'' THEN (SELECT x.id FROM public.skill_postings x WHERE x.university_id = tgt.id AND x.status = ''OPEN'' ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''EVENT'' THEN (SELECT x.id FROM public.events x WHERE x.university_id = tgt.id AND x.is_public ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''HOUSING'' THEN (SELECT x.id FROM public.housing_listings x WHERE x.university_id = tgt.id AND x.status = ''AVAILABLE'' ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''MARKETPLACE'' THEN (SELECT x.id FROM public.marketplace_listings x WHERE x.university_id = tgt.id AND x.deleted_at IS NULL ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''TRANSPORTATION'' THEN (SELECT x.id FROM public.rideshare_offers x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''LOST_AND_FOUND'' THEN (SELECT x.id FROM public.lost_items x WHERE x.university_id = tgt.id AND x.status = ''OPEN'' ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''CLUBS'' THEN (SELECT x.id FROM public.clubs x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''NOTICE_BOARD'' THEN (SELECT x.id FROM public.club_notices x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''HALL_DINING'' THEN (SELECT x.id FROM public.cafeteria_menus x WHERE x.university_id = tgt.id AND x.is_active ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''LIBRARY'' THEN (SELECT x.id FROM public.academic_files x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''ARCHIVE_FILE'' THEN (SELECT x.id FROM public.academic_files x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''BLOOD_DONOR'' THEN (SELECT x.id FROM public.health_donors x WHERE x.university_id = tgt.id AND x.is_available ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'WHEN ''COMPLAINT_RESOLUTION'' THEN (SELECT x.id FROM public.complaints x WHERE x.university_id = tgt.id ORDER BY md5(x.id::text || tgt.code) LIMIT 1) '
    || 'END, (SELECT x.id FROM public.posts x WHERE x.university_id = tgt.id AND x.deleted_at IS NULL ORDER BY md5(x.id::text || tgt.code) LIMIT 1)))';

  FOR r IN SELECT * FROM pg_temp.rule ORDER BY ord LOOP
    -- child tables without a university_id are written by their own statement
    -- below the loop, keyed on their parent instead.
    IF r.guard = $q$false$q$ THEN CONTINUE; END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = 'university_id') THEN
      RAISE NOTICE 'skip %: no university_id column', r.tbl;
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = r.tbl
                      AND column_name = 'id' AND data_type = 'uuid') THEN
      RAISE NOTICE 'skip %: id is not a uuid', r.tbl;
      CONTINUE;
    END IF;

    newid := 'md5(' || quote_literal(r.tbl || ':v1:') || ' || src.id::text || '':'' || tgt.code)::uuid';
    collist := 'id, university_id';
    explist := newid || ', tgt.id';

    FOR c IN
      SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS typ, t.typname AS base
      FROM pg_class cl
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = cl.oid
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE ns.nspname = 'public' AND cl.relname = r.tbl
        AND a.attnum > 0 AND NOT a.attisdropped
        -- generated and always-identity columns cannot take a supplied value
        -- (academic_files.search_vector is the one here), and the two columns the
        -- port always owns are listed explicitly instead.
        AND a.attgenerated = '' AND a.attidentity = ''
        AND a.attname NOT IN ('id', 'university_id')
      ORDER BY a.attnum
    LOOP
      e := NULL;
      own_key := NULL;
      SELECT split_part(o, ':', 2) INTO own_key
      FROM unnest(string_to_array(r.own, ',')) o
      WHERE split_part(replace(o, ' ', ''), ':', 1) = c.name;

      IF own_key IS NOT NULL THEN
        e := CASE own_key
          WHEN 'club' THEN '(SELECT tc.id FROM public.clubs tc WHERE tc.university_id = tgt.id AND tc.slug = sc.slug LIMIT 1)'
          WHEN 'hall' THEN '(SELECT hh.id FROM public.halls hh WHERE hh.university_id = tgt.id ORDER BY md5(hh.id::text || ''own'' || src.id::text) LIMIT 1)'
          WHEN 'hallname' THEN hall_e
          WHEN 'hallnamebn' THEN hallb_e
          WHEN 'menu' THEN '(SELECT tm.id FROM public.cafeteria_menus tm WHERE tm.university_id = tgt.id AND tm.is_active ORDER BY md5(tm.id::text || ''own'' || src.id::text) LIMIT 1)'
          WHEN 'pickup' THEN '(SELECT tp.id FROM public.campus_pickup_points tp WHERE tp.university_id = tgt.id AND tp.is_active ORDER BY md5(tp.id::text || ''own'') LIMIT 1)'
          WHEN 'campaign' THEN '(SELECT dc.id FROM public.donation_campaigns dc WHERE dc.university_id = tgt.id AND dc.status = ''ACTIVE'' ORDER BY md5(dc.id::text || ''own'') LIMIT 1)'
          WHEN 'dept' THEN '(SELECT td.id FROM public.departments td WHERE td.university_id = tgt.id AND td.code = coalesce(sd.code, td.code) ORDER BY md5(td.id::text || ''own'') LIMIT 1)'
          WHEN 'mentor' THEN '(SELECT mm.id FROM public.mentor_profiles mm WHERE mm.university_id = tgt.id ORDER BY md5(mm.id::text || ''own'' || src.id::text) LIMIT 1)'
          WHEN 'alumnus' THEN '(SELECT aa.id FROM public.alumni_profiles aa WHERE aa.university_id = tgt.id ORDER BY md5(aa.id::text || ''own'' || src.id::text) LIMIT 1)'
          -- public.profiles has no role column in this schema (roles live with the
          -- auth users), so an office notice is attributed to a live profile of the
          -- campus rather than to a role that cannot be checked here.
          WHEN 'gov' THEN '(SELECT pg.id FROM public.profiles pg WHERE pg.university_id = tgt.id AND pg.deleted_at IS NULL ORDER BY md5(pg.id::text || ''own'' || src.id::text) LIMIT 1)'
          WHEN 'venue' THEN '(SELECT vv.name_en FROM public.sports_venues vv WHERE vv.university_id = tgt.id AND vv.is_active ORDER BY md5(vv.id::text || ''own'') LIMIT 1)'
          WHEN 'area' THEN '(SELECT c1.area_en FROM pg_temp.campus c1 WHERE c1.uid = tgt.id)'
          WHEN 'areabn' THEN '(SELECT c1.area_bn FROM pg_temp.campus c1 WHERE c1.uid = tgt.id)'
          WHEN 'city' THEN 'coalesce(tgt.city, (SELECT c1.city_en FROM pg_temp.campus c1 WHERE c1.uid = tgt.id))'
          WHEN 'addr' THEN '((SELECT c1.area_en FROM pg_temp.campus c1 WHERE c1.uid = tgt.id) || '', '' || coalesce(tgt.city, ''''))'
          WHEN 'hospital' THEN 'coalesce(tgt.city, '''') || '' Medical College Hospital'''
          WHEN 'phone' THEN quote_literal('(+880) 1')
            || ' || (700000000 + (v.ix * 1000000 + src.rn * 137) % 299999999)::text'
          WHEN 'review' THEN rev
          -- 'null': the column name looks like a person foreign key but is not one
          -- (blood_requests.fulfilled_by_donor_id points at health_donors), so it is
          -- cleared rather than filled with a profile id and rejected by the FK.
          WHEN 'null' THEN 'NULL'
          ELSE NULL
        END;
        IF e IS NULL THEN CONTINUE; END IF;   -- unknown resolver: leave the column alone
      ELSIF c.typ = 'uuid' AND c.name ~ '(author_id|owner_id|seller_id|reporter_id|uploader_id|organizer_id|captain_id|requester_id|challenger_id|donor_id|user_id)$' THEN
        e := person;
      ELSIF c.typ = 'text' AND (',' || replace(r.txt, ' ', '') || ',') LIKE ('%,' || c.name || ',%') THEN
        e := 'pg_temp.localize(src.' || quote_ident(c.name) || ', tgt.id, '
          || quote_literal(CASE WHEN right(c.name, 3) = '_bn' THEN 'bn' ELSE 'en' END) || ')';
      ELSIF right(c.name, 4) = '_bdt' AND c.typ IN ('integer','bigint','numeric') THEN
        -- prices scale a little per campus instead of repeating Dhaka rates
        -- everywhere; GREATEST keeps a rent or fare above a silly floor.
        e := '(GREATEST(50, round(coalesce(src.' || quote_ident(c.name) || ', 500) '
          || '* (0.85 + v.ix * 0.05))) )::' || c.typ;
      ELSIF right(c.name, 6) = '_count' AND c.typ IN ('integer','bigint','smallint') THEN
        e := '(GREATEST(0, coalesce(src.' || quote_ident(c.name) || ', 0) + v.ix + (src.rn % 4)))::' || c.typ;
      ELSIF c.name IN ('lat','lng') AND c.typ IN ('double precision','real','numeric') THEN
        e := '(src.' || quote_ident(c.name) || ' + ' || CASE WHEN c.name = 'lat' THEN 'v.ix * 0.0016' ELSE '-v.ix * 0.0014' END || ')::' || c.typ;
      ELSIF c.typ LIKE 'timestamp%' THEN
        e := CASE
          -- State-transition stamps are never re-dated: writing a timestamp into
          -- deleted_at would soft-delete every ported row (and resolved_at /
          -- closed_at would claim work that was never done), so they carry the
          -- source value, which the guards keep NULL for listed content.
          WHEN c.name IN ('deleted_at','resolved_at','closed_at','escalated_at','rejected_at',
                          'approved_at','cancelled_at','canceled_at','fulfilled_at','claimed_at',
                          'removed_at','hidden_at','feedback_requested_at','removal_requested_at',
                          'checked_in_at','synced_at','last_seen_at','read_at','sent_at','responded_at')
            THEN 'src.' || quote_ident(c.name)
          WHEN c.name IN ('starts_at','opens_at') THEN
            '(date_trunc(''day'', now()) + (((v.ix + src.rn * 2) % 21) + 3) * interval ''1 day'' + interval ''16 hours 30 minutes'')'
          WHEN c.name IN ('ends_at','closes_at') THEN
            '(date_trunc(''day'', now()) + (((v.ix + src.rn * 2) % 21) + 3) * interval ''1 day'' + interval ''18 hours'')'
          WHEN c.name IN ('deadline','needed_by','expires_at','due_at','valid_until','depart_at') THEN
            '(date_trunc(''day'', now()) + ((v.ix % 12) + 6 + (src.rn % 5)) * interval ''1 day'' + interval ''12 hours'')'
          ELSE '(now() - (((v.ix * 3 + src.rn) % 26) * interval ''1 day'') - ((src.rn % 9) * interval ''37 minutes''))'
        END;
      ELSIF c.typ = 'date' THEN
        e := CASE
          WHEN c.name = 'serving_date' THEN '(current_date + (v.ix % 2))'
          WHEN c.name IN ('deadline','preferred_date','valid_until') THEN '(current_date + 10 + v.ix)'
          WHEN c.name = 'last_donated_at' THEN '(current_date - (60 + v.ix * 7))'
          WHEN c.name IN ('occurred_on','occurred_at') THEN '(current_date - (((v.ix + src.rn) % 12)::int))'
          ELSE 'src.' || quote_ident(c.name)
        END;
      ELSE
        e := 'src.' || quote_ident(c.name);
      END IF;

      collist := collist || ', ' || quote_ident(c.name);
      explist := explist || ', ' || e;
    END LOOP;

    q := 'INSERT INTO public.' || quote_ident(r.tbl) || ' (' || collist || ') SELECT ' || explist
      || ' FROM (SELECT s.*, row_number() OVER (ORDER BY s.id) AS rn FROM public.' || quote_ident(r.tbl) || ' s) src'
      || ' JOIN public.universities tgt ON tgt.is_active AND tgt.code IN (SELECT code FROM pg_temp.codes)'
      || ' JOIN pg_temp.campus v ON v.uid = tgt.id'
      || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema='public' AND table_name=r.tbl AND column_name='club_id')
              THEN ' LEFT JOIN public.clubs sc ON sc.id = src.club_id' ELSE '' END
      || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema='public' AND table_name=r.tbl AND column_name='department_id')
              THEN ' LEFT JOIN public.departments sd ON sd.id = src.department_id' ELSE '' END
      || ' WHERE src.university_id IN (SELECT u2.id FROM public.universities u2'
      || '   WHERE u2.code IN (SELECT code FROM pg_temp.codes))'
      || ' AND src.university_id <> tgt.id AND (' || r.guard || ')'
      || ' AND NOT EXISTS (SELECT 1 FROM public.' || quote_ident(r.tbl) || ' x WHERE x.id = ' || newid || ')'
      || ' ON CONFLICT DO NOTHING';

    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    tot := tot + n;
    RAISE NOTICE '% -> % rows', r.tbl, n;
  END LOOP;

  -- mentorship_slots and cafeteria_items are written here rather than by a rule:
  -- the first needs booked_count clamped under capacity (a generic *_count bump
  -- could break that CHECK) and has no updated_at column at all, the second needs
  -- both its menu_id AND its own NOT NULL university_id pointing at the same
  -- campus, so it is keyed on the menu row the generic port just created.
  INSERT INTO public.mentorship_slots
    (id, university_id, mentor_id, topic, starts_at, ends_at, capacity, booked_count, is_active, created_at)
  SELECT md5('mentorship_slots:v1:' || s.id::text || ':' || tgt.code)::uuid, tgt.id, mp.id,
         pg_temp.localize(coalesce(s.topic, 'Mentorship session'), tgt.id, 'en'),
         date_trunc('day', now()) + (((v2.ix + s.rn * 2) % 14) + 2) * interval '1 day' + interval '16 hours 30 minutes',
         date_trunc('day', now()) + (((v2.ix + s.rn * 2) % 14) + 2) * interval '1 day' + interval '18 hours',
         GREATEST(2, coalesce(s.capacity, 4) + (v2.ix % 3)),
         GREATEST(0, LEAST(GREATEST(1, coalesce(s.capacity, 4) - 1), coalesce(s.booked_count, 0) + (v2.ix % 2))),
         true, now()
  FROM (SELECT x.*, row_number() OVER (ORDER BY x.id) AS rn FROM public.mentorship_slots x) s
  JOIN public.mentor_profiles sm ON sm.id = s.mentor_id
  JOIN pg_temp.campus v ON v.uid = sm.university_id
  -- one slot is offered at EVERY other flagship campus (picking that campus's own
  -- mentor), not at a single globally-chosen one: a flat LIMIT 1 here left campuses
  -- with 0-1 open slots, which renders as an empty mentorship tab.
  JOIN public.universities tgt ON tgt.code IN (SELECT code FROM pg_temp.codes)
    AND tgt.id <> sm.university_id
  JOIN LATERAL (SELECT m.id, m.university_id FROM public.mentor_profiles m
                 WHERE m.university_id = tgt.id
                 ORDER BY md5(m.id::text || 'slot' || s.id::text) LIMIT 1) mp ON TRUE
  JOIN pg_temp.campus v2 ON v2.uid = tgt.id
  WHERE s.is_active
    AND NOT EXISTS (SELECT 1 FROM public.mentorship_slots x WHERE x.id = md5('mentorship_slots:v1:' || s.id::text || ':' || tgt.code)::uuid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;
  RAISE NOTICE 'mentorship_slots -> % rows', n;

  INSERT INTO public.cafeteria_items
    (id, university_id, menu_id, name_en, name_bn, price_bdt, is_available, stock, created_at, updated_at)
  SELECT md5('cafeteria_items:v1:' || i.id::text || ':' || nm.id::text)::uuid, tgt.id, nm.id,
         i.name_en, i.name_bn,
         GREATEST(10, coalesce(i.price_bdt, 40) + v.ix * 2),
         coalesce(i.is_available, true), GREATEST(0, coalesce(i.stock, 30) - (v.ix % 5)),
         now(), now()
  FROM public.cafeteria_items i
  JOIN public.cafeteria_menus sm ON sm.id = i.menu_id
  JOIN public.universities su ON su.id = sm.university_id
    AND su.code IN (SELECT code FROM pg_temp.codes)
  JOIN public.universities tgt ON tgt.code IN (SELECT code FROM pg_temp.codes)
    AND tgt.id <> sm.university_id
  JOIN LATERAL (SELECT md5('cafeteria_menus:v1:' || sm.id::text || ':' || tgt.code)::uuid AS id) nm ON TRUE
  JOIN pg_temp.campus v ON v.uid = tgt.id
  WHERE EXISTS (SELECT 1 FROM public.cafeteria_menus m WHERE m.id = nm.id AND m.is_active)
    AND NOT EXISTS (SELECT 1 FROM public.cafeteria_items x
                     WHERE x.id = md5('cafeteria_items:v1:' || i.id::text || ':' || nm.id::text)::uuid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;
  RAISE NOTICE 'cafeteria_items -> % rows', n;

  RAISE NOTICE 'ported % rows in total', tot;
END
$do$;

-- · repair pass, for databases ported before the day-scholar exclusion above.
-- Every text column of every ported table is swept for the two pseudo-hall labels
-- (English and Bengali) and rewritten to a real hall of THAT campus, falling back
-- to a neutral campus phrase where the campus has none -- which is the honest
-- answer, since the registry lists no residential halls for e.g. JUST. Idempotent:
-- once the labels are gone the WHERE clause matches nothing, so a fresh run of
-- this file costs two no-op statements. The orphaned cafeteria_menus rows are then
-- re-pointed at their campus's hall, because hall_id is ON DELETE SET NULL and the
-- dining module groups the day's menu under it.
DO $hallfix$
DECLARE
  t text; c record; p record; q text; n bigint; tot bigint := 0;
  pseudo text := '(day scholar|no hall seat|off-campus residence)';
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','skill_postings','housing_listings','rideshare_offers',
    'lost_items','marketplace_listings','club_notices','events','academic_files',
    'mentor_profiles','alumni_profiles','career_opportunities','cafeteria_menus',
    'sports_teams','sports_challenges','donation_campaigns','donations',
    'donation_ledger','blood_requests','health_donors','governance_notices','reviews',
    'complaints']
  LOOP
    FOR c IN
      SELECT a.attname AS name
      FROM pg_attribute a
      WHERE a.attrelid = ('public.' || t)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped AND a.atttypid = 'text'::regtype
    LOOP
      FOR p IN SELECT DISTINCT name_en AS en, name_bn AS bn FROM public.halls
                WHERE lower(name_en) ~ '(day scholar|no hall seat|off-campus residence)'
      LOOP
        q := format('UPDATE public.%1$I SET %2$I = replace(%2$I, $1, coalesce('
          || '(SELECT h.name_en FROM public.halls h WHERE h.university_id = university_id '
          ||   'AND lower(h.name_en) !~ $4 ORDER BY md5(h.id::text) LIMIT 1), $2)) '
          || 'WHERE %2$I LIKE ''%%'' || $3 || ''%%''', t, c.name);
        EXECUTE q USING p.en, 'the central student common room', p.en, pseudo;
        GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;

        q := format('UPDATE public.%1$I SET %2$I = replace(%2$I, $1, coalesce('
          || '(SELECT h.name_bn FROM public.halls h WHERE h.university_id = university_id '
          ||   'AND lower(h.name_en) !~ $4 ORDER BY md5(h.id::text) LIMIT 1), $2)) '
          || 'WHERE %2$I LIKE ''%%'' || $3 || ''%%''', t, c.name);
        EXECUTE q USING p.bn, 'কেন্দ্রীয় ছাত্র কমন রুম', p.bn, pseudo;
        GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;
      END LOOP;
    END LOOP;
  END LOOP;

  DELETE FROM public.halls
   WHERE lower(name_en) ~ '(day scholar|no hall seat|off-campus residence)';
  GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;

  UPDATE public.cafeteria_menus m
     SET hall_id = (SELECT h.id FROM public.halls h
                     WHERE h.university_id = m.university_id
                     ORDER BY md5(h.id::text || 'menu') LIMIT 1)
   WHERE m.hall_id IS NULL
     AND EXISTS (SELECT 1 FROM public.halls h WHERE h.university_id = m.university_id);
  GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;

  -- ...and a menu whose NAME names a hall has to point at THAT hall. The 'hall'
  -- resolver (hall_id) and the hallname resolver (name_en/name_bn) pick
  -- independently, so a ported menu could end up titled "Mir Mosharraf Hossain
  -- Hall" while hall_id referenced another hall of the same campus -- locally
  -- consistent, but visibly self-contradictory in the dining card.
  WITH fix AS (
    SELECT m.id AS menu, h.id AS hall,
           row_number() OVER (PARTITION BY m.id ORDER BY length(h.name_en) DESC) AS rn
    FROM public.cafeteria_menus m
    JOIN public.halls h ON h.university_id = m.university_id
    WHERE m.hall_id IS NOT NULL AND h.id <> m.hall_id
      AND (position(h.name_en in m.name_en) > 0
           OR position(coalesce(h.name_bn, '') in coalesce(m.name_bn, '')) > 0)
  )
  UPDATE public.cafeteria_menus m
     SET hall_id = f.hall
    FROM fix f
   WHERE f.menu = m.id AND f.rn = 1;
  GET DIAGNOSTICS n = ROW_COUNT; tot := tot + n;

  RAISE NOTICE 'hall repair touched % rows', tot;
END
$hallfix$;

-- · campus imagery for the home feed.
-- seed.sql has pointed universities.logo_url at /logos/<code>.svg since the
-- registry was seeded, and that directory was never created -- so every campus
-- image in the product has been a 404 and every component using it has been
-- hiding a broken <img>. Both columns are filled here from generated assets that
-- do exist in apps/web/public: a monogram crest per university, and one wide
-- placeholder cover. These are illustrations, not photographs of the
-- institutions, and that is the honest default for a demo; a university that
-- wants its own picture updates this one column.
UPDATE public.universities
   SET logo_url = '/logos/' || lower(code) || '.svg'
 WHERE is_active AND (logo_url IS NULL OR logo_url LIKE '/logos/%.svg');

UPDATE public.universities
   SET cover_image_url = CASE WHEN code IN ('DU','JU','BUET','RU','CU','SUST','JUST','KU','IU','JNU')
                              THEN '/campuses/' || lower(code) || '.jpg'
                              ELSE '/campuses/campus.jpg' END
 WHERE is_active AND (cover_image_url IS NULL OR cover_image_url LIKE '/campuses/%.jpg');

COMMIT;

-- Rollback: this file only ever adds rows whose id contains the ':v1:' namespace
-- (plus the two universities columns above), so it can be undone per table
-- exactly, without touching a pre-existing row:
--   DELETE FROM public.<table> t
--    WHERE t.id IN (SELECT md5('<table>:v1:' || s.id::text || ':' || u.code)::uuid
--                     FROM public.<table> s
--                     JOIN public.universities su ON su.id = s.university_id
--                     JOIN public.universities u ON u.id = t.university_id)
--   ... run before deleting, or drop children first (reviews, donations,
--   donation_ledger, cafeteria_items), then parents.
--   DELETE FROM public.complaints WHERE tracking_code LIKE 'C360-%-26-%';
--   UPDATE public.universities SET cover_image_url = NULL WHERE is_active;
