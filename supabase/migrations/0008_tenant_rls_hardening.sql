-- supabase/migrations/0008_tenant_rls_hardening.sql
-- ============================================================================
-- Multi-tenancy RLS hardening
--
-- 1. Public read access to the university registry (universities +
--    university_email_domains) so the signup combobox works without auth.
-- 2. A tenant-scoped SELECT policy on EVERY table that carries university_id.
--    The policy uses auth.uid() directly and never selects from the same table
--    inside the policy itself.
-- 3. A same-university profile read policy for verified users.
--
-- The helper functions (current_user_university_id, current_user_is_verified)
-- are created in 0005 and are SECURITY DEFINER with a locked search_path.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Public university registry (no auth required to list options)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read universities" ON public.universities;
CREATE POLICY "Public read universities"
  ON public.universities
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read email domains" ON public.university_email_domains;
CREATE POLICY "Public read email domains"
  ON public.university_email_domains
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. Tenant-scoped SELECT policy for every university_id table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table text;
BEGIN
  FOR target_table IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'university_id'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Tenant read ' || target_table, target_table);

    IF target_table = 'profiles' THEN
      -- A profile is always readable by its owner; the same-university policy
      -- below covers verified directory reads without a self-select.
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (id = auth.uid())',
        'Tenant read ' || target_table, target_table
      );
    ELSE
      -- auth.uid() is used directly. The subquery reads the caller's own
      -- profile row (never the target table), so there is no policy recursion.
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
        'USING (university_id = (SELECT university_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL))',
        'Tenant read ' || target_table, target_table
      );
    END IF;
  END LOOP;
END $$;

-- Verified users may read the directory of their own campus.
DROP POLICY IF EXISTS "Same university profiles read" ON public.profiles;
CREATE POLICY "Same university profiles read"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

-- ---------------------------------------------------------------------------
-- 3. Explicit tenant policy for the civic/complaint surface
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant read complaints" ON public.complaints;
CREATE POLICY "Tenant read complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    university_id = (SELECT university_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "Tenant read complaint_status_history" ON public.complaint_status_history;
CREATE POLICY "Tenant read complaint_status_history"
  ON public.complaint_status_history
  FOR SELECT
  TO authenticated
  USING (
    university_id = (SELECT university_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL)
  );

COMMIT;
