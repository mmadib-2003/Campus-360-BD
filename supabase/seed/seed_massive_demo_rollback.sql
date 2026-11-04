-- supabase/seed/seed_massive_demo_rollback.sql
-- ============================================================================
-- Undoes supabase/seed/seed_massive_demo_content.sql.
--
-- Nothing needs a list of ids: every row the seed creates is keyed on a uuid it
-- derives itself (`md5('<table>:v1:' || <source row id> || ':' || <campus code>)`),
-- so recomputing that set from the surviving rows finds exactly the ported copies
-- and never a row that was there before. Complaints are the exception -- they are
-- found by their tracking_code prefix, because that is what they are unique on.
--
-- This was run in production during the seed's own development (the localiser was
-- changed halfway through, so the first port had to be taken back out). One note
-- learned the hard way: `complaints` rows CANNOT be deleted, because
-- `tg_prevent_audit_mutation` protects the child `complaint_audit_log`, and a
-- delete on the parent cascades into it. That is intentional -- an immutable audit
-- trail -- and it is why this script stops short of complaints by default and
-- documents the one statement that would remove them.
-- ============================================================================

BEGIN;

-- The same eligibility rule the seed uses: a campus is only in scope if it has at
-- least one live, non-UNVERIFIED profile to attribute content to.
CREATE TEMP TABLE rbcodes ON COMMIT DROP AS
SELECT u.code FROM public.universities u
WHERE u.is_active
  AND u.code = ANY(ARRAY['DU','JU','BUET','RU','CU','SUST','JUST','KU','IU','JNU'])
  AND (SELECT count(*) FROM public.profiles p
        WHERE p.university_id = u.id
          AND p.deleted_at IS NULL
          AND p.trust_level IS DISTINCT FROM 'UNVERIFIED') >= 1;

DO $rb$
DECLARE t text; n bigint; tot bigint := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cafeteria_items','mentorship_slots','posts','skill_postings','housing_listings',
    'rideshare_offers','lost_items','marketplace_listings','club_notices','events',
    'academic_files','mentor_profiles','alumni_profiles','career_opportunities',
    'cafeteria_menus','sports_teams','sports_challenges','donation_campaigns',
    'donations','donation_ledger','blood_requests','health_donors',
    'governance_notices','reviews']
  LOOP
    -- The two child tables key their derived id on a parent uuid rather than a
    -- campus code, so they need their own expression.
    IF t = 'cafeteria_items' THEN
      EXECUTE 'DELETE FROM public.cafeteria_items WHERE id IN (
        SELECT md5(''cafeteria_items:v1:'' || i.id::text || '':''
                    || md5(''cafeteria_menus:v1:'' || sm.id::text || '':'' || tgt.code))::uuid
        FROM public.cafeteria_items i
        JOIN public.cafeteria_menus sm ON sm.id = i.menu_id
        JOIN public.universities src ON src.id = sm.university_id
        JOIN public.universities tgt ON tgt.code IN (SELECT code FROM pg_temp.rbcodes)
          AND tgt.id <> src.id
        WHERE src.code IN (SELECT code FROM pg_temp.rbcodes))';
    ELSIF t = 'mentorship_slots' THEN
      EXECUTE 'DELETE FROM public.mentorship_slots WHERE id IN (
        SELECT md5(''mentorship_slots:v1:'' || s.id::text || '':'' || tgt.code)::uuid
        FROM public.mentorship_slots s
        JOIN public.mentor_profiles sm ON sm.id = s.mentor_id
        JOIN public.universities su ON su.id = sm.university_id
        JOIN public.universities tgt ON tgt.code IN (SELECT code FROM pg_temp.rbcodes)
          AND tgt.id <> su.id
        WHERE su.code IN (SELECT code FROM pg_temp.rbcodes))';
    ELSE
      EXECUTE format('DELETE FROM public.%1$I WHERE id IN (
          SELECT md5(%2$L || o.id::text || '':'' || tgt.code)::uuid
          FROM public.%1$I o
          JOIN public.universities src ON src.id = o.university_id
          JOIN public.universities tgt ON tgt.code IN (SELECT code FROM pg_temp.rbcodes)
            AND tgt.id <> src.id
          WHERE src.code IN (SELECT code FROM pg_temp.rbcodes))', t, t || ':v1:');
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    tot := tot + n;
    RAISE NOTICE 'rollback % -> % rows', t, n;
  END LOOP;

  -- Reference data the seed created is deliberately KEPT:
  --   * public.halls rows derived from university_halls (the modules read them, and
  --     removing them would break campuses that had none at all);
  --   * universities.logo_url / cover_image_url (harmless, and the assets ship in
  --     apps/web/public);
  --   * complaints, which the audit trigger protects (see header). To remove them
  --     anyway, detach the audit rows first:
  --       DELETE FROM public.complaint_audit_log WHERE complaint_id IN
  --         (SELECT id FROM public.complaints WHERE tracking_code LIKE ''C360-%-26-%'');
  --       DELETE FROM public.complaints WHERE tracking_code LIKE ''C360-%-26-%'';
  RAISE NOTICE 'rollback removed % rows in total', tot;
END
$rb$;

COMMIT;
