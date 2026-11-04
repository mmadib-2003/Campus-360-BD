-- supabase/migrations/0010_admin_governance_rls.sql
-- ============================================================================
-- Platform admin / university governance RLS enforcement
--
-- * is_platform_admin() — the platform operator bypasses tenant isolation.
--   True when the JWT carries the `is_platform_admin` app-metadata claim or
--   the user holds the ADMIN / SUPER_ADMIN role.
-- * current_user_is_governance() — the university governing body, restricted
--   to university_id = current_user_university_id().
-- * Admin CRUD policies cover every table the /admin/panel manages.
-- * Governance policies cover civic complaints, hall allocations and notices.
--
-- The ADMIN / GOVERNANCE enum values were added in 0009; using them here is
-- safe because this file runs in a later transaction.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_platform_admin', 'false') = 'true'
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('ADMIN'::app_role, 'SUPER_ADMIN'::app_role)
      );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_governance()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('GOVERNANCE'::app_role, 'GOVERNING_BODY'::app_role)
      AND university_id = public.current_user_university_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Platform admin bypass — full CRUD on every managed table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'profiles', 'universities', 'university_halls', 'university_email_domains',
    'user_roles', 'marketplace_listings', 'complaints', 'events', 'blood_requests',
    'lost_items', 'housing_listings', 'career_opportunities', 'cafeteria_menus',
    'disputes', 'hall_allocations', 'governance_notices'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Platform admin full access', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())',
      'Platform admin full access', target_table
    );
  END LOOP;
END $$;

-- Anonymous, public read of the university registry (success criterion 6):
-- the /signup combobox must work without auth.
DROP POLICY IF EXISTS "Public read universities (anon)" ON public.universities;
CREATE POLICY "Public read universities (anon)"
  ON public.universities
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 3. Governance — own campus only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Governance read own campus complaints" ON public.complaints;
CREATE POLICY "Governance read own campus complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  );

DROP POLICY IF EXISTS "Governance moderate own campus complaints" ON public.complaints;
CREATE POLICY "Governance moderate own campus complaints"
  ON public.complaints
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  )
  WITH CHECK (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  );

DROP POLICY IF EXISTS "Governance manage own campus hall allocations" ON public.hall_allocations;
CREATE POLICY "Governance manage own campus hall allocations"
  ON public.hall_allocations
  FOR ALL
  TO authenticated
  USING (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  )
  WITH CHECK (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  );

DROP POLICY IF EXISTS "Tenant read hall allocations" ON public.hall_allocations;
CREATE POLICY "Tenant read hall allocations"
  ON public.hall_allocations
  FOR SELECT
  TO authenticated
  USING (university_id = public.current_user_university_id());

DROP POLICY IF EXISTS "Governance manage own campus notices" ON public.governance_notices;
CREATE POLICY "Governance manage own campus notices"
  ON public.governance_notices
  FOR ALL
  TO authenticated
  USING (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  )
  WITH CHECK (
    public.current_user_is_governance()
    AND university_id = public.current_user_university_id()
  );

DROP POLICY IF EXISTS "Tenant read governance notices" ON public.governance_notices;
CREATE POLICY "Tenant read governance notices"
  ON public.governance_notices
  FOR SELECT
  TO authenticated
  USING (university_id = public.current_user_university_id());

-- ---------------------------------------------------------------------------
-- 4. Realtime for the governance surface + civic tickets
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hall_allocations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hall_allocations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'governance_notices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.governance_notices;
  END IF;
END $$;

COMMIT;
