-- supabase/migrations/0009_university_halls_and_demo_otp.sql
-- ============================================================================
-- Role-separated governance model + residential halls + demo OTP storage
--
-- 1. New app_role values: ADMIN (platform operator) and GOVERNANCE (university
--    governing body). NOTE: the new values are only *used* from migration
--    0010 onward so this file stays safe inside a single transaction.
-- 2. university_halls — the canonical residential-hall registry used by the
--    mandatory student-signup hall combobox (seeded in
--    supabase/seed/seed_university_halls.sql with real halls for DU, RU, CU,
--    BUET and SUST).
-- 3. profiles.hall_id is re-pointed at university_halls(id) and gains the
--    Track B demo-OTP columns (demo_otp + 10-minute TTL expiry).
-- 4. hall_allocations / governance_notices back the /governance dashboard
--    (approve/reject hall allocations, broadcast notices).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Role values for the separated admin / governance profiles
-- ---------------------------------------------------------------------------
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'GOVERNANCE';

-- ---------------------------------------------------------------------------
-- 2. Residential hall registry (id, university_id, name, type)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.university_halls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'RESIDENTIAL' CHECK (type IN ('RESIDENTIAL', 'DAY_SCHOLAR')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);

CREATE INDEX IF NOT EXISTS idx_university_halls_univ ON public.university_halls(university_id, name);

ALTER TABLE public.university_halls ENABLE ROW LEVEL SECURITY;

-- The signup combobox must load halls before authentication.
DROP POLICY IF EXISTS "Public read university halls" ON public.university_halls;
CREATE POLICY "Public read university halls"
  ON public.university_halls
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER set_university_halls_updated_at
BEFORE UPDATE ON public.university_halls
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. profiles: hall_id now references university_halls + demo OTP columns
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'profiles'
    AND con.contype = 'f'
    AND con.confrelid = 'public.halls'::regclass;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hall_id_fkey
  FOREIGN KEY (hall_id) REFERENCES public.university_halls(id) ON DELETE SET NULL;

-- Track B — Demo OTP: deterministic 6-digit code per email, 10-minute TTL.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_otp TEXT,
  ADD COLUMN IF NOT EXISTS demo_otp_expires_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4. Governance dashboard backing tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hall_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  hall_id UUID REFERENCES public.university_halls(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  note TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hall_allocations_univ ON public.hall_allocations(university_id, status);

CREATE TABLE IF NOT EXISTS public.governance_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'STUDENTS', 'FACULTY', 'RESIDENTS')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_notices_univ ON public.governance_notices(university_id, created_at DESC);

ALTER TABLE public.hall_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_notices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_hall_allocations_updated_at
BEFORE UPDATE ON public.hall_allocations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER set_governance_notices_updated_at
BEFORE UPDATE ON public.governance_notices
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMIT;
