-- supabase/migrations/0012_academic_programs.sql
-- ============================================================================
-- Academic program registry + profiles.program_id
--
-- The signup flow already captures university / hall / department, but nothing
-- records *what* the student studies: Honors vs. Degree (Pass), a professional
-- BSc, a Master's, a Ph.D. … which is what decides term structure, course
-- requests and (later) faculty visibility.
--
-- Design notes
--   • Global registry, NOT per-university: these are UGC-standard programme
--     names, identical wording across campuses, so a per-university table would
--     need 51 copies of the same list and could drift.
--   • `code` is UNIQUE (not (university_id, code)) — the seed in this file is
--     idempotent and re-runnable.
--   • Mirrors public.university_halls (0009) for the same read shape: RLS
--     enabled with a public SELECT policy, because the combobox loads before a
--     session exists.
--   • profiles.program_id is nullable with ON DELETE SET NULL: a programme that
--     is retired must never orphan a profile, and the column stays NULL for
--     every existing account until the student picks one (or an admin backfills
--     from the admission data).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.academic_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL DEFAULT '',
  cycle TEXT NOT NULL DEFAULT 'UNDERGRADUATE'
    CHECK (cycle IN ('UNDERGRADUATE', 'GRADUATE', 'DOCTORAL', 'DIPLOMA')),
  duration_years SMALLINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academic_programs_cycle
  ON public.academic_programs(cycle);

ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;

-- The signup combobox must load programmes before authentication.
DROP POLICY IF EXISTS "Public read academic programs" ON public.academic_programs;
CREATE POLICY "Public read academic programs"
  ON public.academic_programs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER set_academic_programs_updated_at
BEFORE UPDATE ON public.academic_programs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Reference data shipped with the schema so a migration run on an empty or a
-- live project ends in the same state (the UI needs rows the moment it ships).
INSERT INTO public.academic_programs (code, name_en, name_bn, cycle, duration_years, sort_order) VALUES
  ('HONORS',          'Bachelor''s (Honors)',            'অনার্স (স্নাতক সম্মান)',                 'UNDERGRADUATE', 4, 10),
  ('DEGREE_PASS',     'Bachelor''s (Degree / Pass)',     'ডিগ্রি (পাস) কোর্স',                     'UNDERGRADUATE', 3, 20),
  ('ENGINEERING_BSC', 'B.Sc. in Engineering',             'প্রকৌশলে বিএসসি',                        'UNDERGRADUATE', 4, 30),
  ('AGRICULTURE_BSC', 'B.Sc. in Agriculture',             'কৃষিতে বিএসসি',                          'UNDERGRADUATE', 4, 40),
  ('ARCHITECTURE_BARCH', 'B. Architecture',               'স্থাপত্যে বি.আর্চ',                       'UNDERGRADUATE', 5, 50),
  ('MEDICAL_MBBS',    'M.B.B.S. (Medicine)',              'এমবিবিএস (চিকিৎসা)',                     'UNDERGRADUATE', 6, 60),
  ('DENTAL_BDS',      'B.D.S. (Dentistry)',               'বিডিএস (দন্ত)',                           'UNDERGRADUATE', 5, 70),
  ('NURSING_BSC',     'B.Sc. in Nursing',                 'নার্সিংয়ে বিএসসি',                        'UNDERGRADUATE', 4, 80),
  ('PHARMACY',        'Pharmacy (Pharm.D / B.Pharm)',     'ফার্মেসি (ফার্মডি / বিফার্ম)',            'UNDERGRADUATE', 4, 90),
  ('MASTERS',         'Master''s / MBA / MPA',            'স্নাতকোত্তর / এমবিএ / এমপিএ',            'GRADUATE',     2, 100),
  ('MASTERS_FINAL',   'Master''s (Final Year)',           'স্নাতকোত্তর (ফাইনাল ইয়ার)',              'GRADUATE',     1, 110),
  ('PG_DIPLOMA',      'Post-Graduate Diploma',            'স্নাতকোত্তর ডিপ্লোমা',                    'DIPLOMA',      1, 120),
  ('DIPLOMA',         'Diploma (Post-SSC)',               'ডিপ্লোমা (এসএসসি-োত্তর)',                 'DIPLOMA',      4, 130),
  ('PHD',             'Ph.D. / Doctorate',                'পিএইচডি (ডক্টরেট)',                      'DOCTORAL',     4, 140)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS program_id UUID
    REFERENCES public.academic_programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_program
  ON public.profiles(program_id);

COMMIT;
