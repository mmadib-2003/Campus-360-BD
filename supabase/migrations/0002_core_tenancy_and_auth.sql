-- supabase/migrations/0002_core_tenancy_and_auth.sql

CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  category university_category NOT NULL,
  city TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_universities_code ON universities(code);
CREATE INDEX idx_universities_category ON universities(category);

CREATE TABLE university_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT domain_lowercase CHECK (domain = lower(domain))
);

CREATE INDEX idx_univ_email_domains_univ ON university_email_domains(university_id);
CREATE INDEX idx_univ_email_domains_domain ON university_email_domains(domain);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  faculty_en TEXT,
  faculty_bn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, code)
);

CREATE INDEX idx_departments_univ ON departments(university_id);

CREATE TABLE halls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  gender_policy TEXT NOT NULL DEFAULT 'MIXED',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, code)
);

CREATE INDEX idx_halls_univ ON halls(university_id);

CREATE TABLE governing_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  emergency_phone TEXT,
  office_location_en TEXT,
  office_location_bn TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, unit_code)
);

CREATE INDEX idx_governing_units_univ ON governing_units(university_id);

CREATE TABLE complaint_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  category complaint_category NOT NULL,
  primary_unit_id UUID NOT NULL REFERENCES governing_units(id) ON DELETE CASCADE,
  escalation_unit_id UUID REFERENCES governing_units(id) ON DELETE SET NULL,
  sla_hours INTEGER NOT NULL DEFAULT 72 CHECK (sla_hours > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, category)
);

CREATE INDEX idx_complaint_routing_univ_cat ON complaint_routing(university_id, category);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  hall_id UUID REFERENCES halls(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  batch TEXT,
  bio TEXT,
  avatar_url TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  crisis_callback_phone TEXT,
  crisis_callback_consent BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'bn')),
  trust_level trust_level NOT NULL DEFAULT 'UNVERIFIED',
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  privacy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guidelines_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_univ ON profiles(university_id);
CREATE INDEX idx_profiles_trust ON profiles(university_id, trust_level);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'STUDENT',
  governing_unit_id UUID REFERENCES governing_units(id) ON DELETE SET NULL,
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, university_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_univ_role ON user_roles(university_id, role);

CREATE TABLE verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  signup_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_attempts_email ON verification_attempts(email, created_at DESC);
CREATE INDEX idx_verification_attempts_ip ON verification_attempts(ip_address, created_at DESC);

CREATE TABLE id_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  student_id_number TEXT NOT NULL,
  front_storage_path TEXT NOT NULL,
  back_storage_path TEXT,
  status id_verification_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  file_purge_after TIMESTAMPTZ,
  files_purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_id_verification_univ_status ON id_verification(university_id, status);
