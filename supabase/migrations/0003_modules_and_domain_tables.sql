-- supabase/migrations/0003_modules_and_domain_tables.sql

-- 1. Campus Feed Posts, Comments & Likes
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_tag TEXT NOT NULL DEFAULT 'FEED',
  title TEXT,
  body TEXT NOT NULL,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_univ_created ON posts(university_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 2. Marketplace Listings & Offers
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price_bdt NUMERIC(10, 2) NOT NULL CHECK (price_bdt >= 0),
  condition TEXT NOT NULL CHECK (condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR')),
  images TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_univ_status ON marketplace_listings(university_id, status, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE marketplace_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offered_price_bdt NUMERIC(10, 2) NOT NULL CHECK (offered_price_bdt >= 0),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Health & Blood Donor Network
CREATE TABLE health_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  last_donated_at DATE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  contact_phone TEXT NOT NULL,
  hall_id UUID REFERENCES halls(id) ON DELETE SET NULL,
  verified_donations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_donors_univ_bg ON health_donors(university_id, blood_group, is_available);

CREATE TABLE blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  bags_needed INTEGER NOT NULL DEFAULT 1 CHECK (bags_needed > 0),
  hospital_name TEXT NOT NULL,
  hospital_address TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'URGENT' CHECK (urgency IN ('NORMAL', 'URGENT', 'CRITICAL')),
  needed_by TIMESTAMPTZ NOT NULL,
  fulfilled_by_donor_id UUID REFERENCES health_donors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULFILLED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Academic Archive & File Versioning
CREATE TABLE academic_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  semester TEXT NOT NULL,
  academic_year INTEGER NOT NULL CHECK (academic_year BETWEEN 1970 AND 2100),
  category archive_category NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'bn', 'mixed')),
  visibility content_visibility NOT NULL DEFAULT 'PRIVATE_TO_UNIVERSITY',
  requires_same_university_verification BOOLEAN NOT NULL DEFAULT true,
  license_attribution TEXT NOT NULL DEFAULT 'CC-BY-NC-4.0',
  tags TEXT[] NOT NULL DEFAULT '{}',
  current_version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
  checksum_sha256 TEXT NOT NULL,
  scan_status virus_scan_status NOT NULL DEFAULT 'PENDING',
  views_count INTEGER NOT NULL DEFAULT 0,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  dmca_quarantined BOOLEAN NOT NULL DEFAULT false,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(course_code, '') || ' ' || coalesce(course_title, '') || ' ' || coalesce(original_filename, ''))
  ) STORED,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_academic_files_univ_dept ON academic_files(university_id, department_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_academic_files_course ON academic_files(university_id, course_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_academic_files_fts ON academic_files USING GIN(search_vector);

CREATE TABLE academic_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES academic_files(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  scan_status virus_scan_status NOT NULL DEFAULT 'PENDING',
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (file_id, version_number)
);

-- 5. Grievance & Complaint System
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  consent_to_share_identity BOOLEAN NOT NULL DEFAULT false,
  tracking_secret_hash TEXT,
  device_binding_hash TEXT,
  title TEXT NOT NULL,
  category complaint_category NOT NULL,
  description TEXT NOT NULL,
  severity complaint_severity NOT NULL DEFAULT 'MEDIUM',
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'bn')),
  status complaint_status NOT NULL DEFAULT 'SUBMITTED',
  assigned_unit_id UUID REFERENCES governing_units(id) ON DELETE SET NULL,
  assigned_officer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sla_hours INTEGER NOT NULL DEFAULT 72,
  sla_due_at TIMESTAMPTZ NOT NULL,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolution_summary TEXT,
  resolution_proof_path TEXT,
  rejection_reason TEXT,
  student_rating SMALLINT CHECK (student_rating BETWEEN 1 AND 5),
  student_feedback TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaints_univ_status ON complaints(university_id, status, sla_due_at ASC);
CREATE INDEX idx_complaints_tracking_code ON complaints(tracking_code);
CREATE INDEX idx_complaints_student ON complaints(student_id) WHERE student_id IS NOT NULL;

CREATE TABLE complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  sender_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('STUDENT', 'GOVERNING_BODY', 'SYSTEM')),
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaint_messages_complaint ON complaint_messages(complaint_id, created_at ASC);

CREATE TABLE complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  uploaded_by_role TEXT NOT NULL CHECK (uploaded_by_role IN ('STUDENT', 'GOVERNING_BODY')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes <= 52428800),
  scan_status virus_scan_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  from_status complaint_status,
  to_status complaint_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE complaint_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Events with Real-Time Google Maps & Geofence
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  host_organization TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT,
  description_en TEXT NOT NULL,
  description_bn TEXT,
  category TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  venue_name TEXT NOT NULL,
  formatted_address TEXT NOT NULL,
  text_directions_en TEXT NOT NULL,
  text_directions_bn TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  place_id TEXT NOT NULL,
  geofence_radius_m INTEGER NOT NULL DEFAULT 150 CHECK (geofence_radius_m BETWEEN 25 AND 2000),
  cover_image_url TEXT,
  capacity INTEGER CHECK (capacity > 0),
  rsvp_required BOOLEAN NOT NULL DEFAULT true,
  rsvp_count INTEGER NOT NULL DEFAULT 0,
  checkin_count INTEGER NOT NULL DEFAULT 0,
  live_override event_live_override NOT NULL DEFAULT 'AUTO',
  live_ping_lat DOUBLE PRECISION,
  live_ping_lng DOUBLE PRECISION,
  live_ping_updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_event_window CHECK (ends_at > starts_at)
);

CREATE INDEX idx_events_univ_starts ON events(university_id, starts_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'GOING' CHECK (status IN ('GOING', 'INTERESTED', 'CANCELLED')),
  checked_in_at TIMESTAMPTZ,
  checkin_lat DOUBLE PRECISION,
  checkin_lng DOUBLE PRECISION,
  checkin_distance_m DOUBLE PRECISION,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 7. Polymorphic Real-Time Reviews & Trigger-Maintained Aggregates
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type review_target_type NOT NULL,
  target_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  verified_participation BOOLEAN NOT NULL DEFAULT false,
  pending_reports_count INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (author_id, target_type, target_id)
);

CREATE INDEX idx_reviews_target ON reviews(university_id, target_type, target_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = false;

CREATE TABLE review_aggregates (
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  target_type review_target_type NOT NULL,
  target_id UUID NOT NULL,
  avg_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  review_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (university_id, target_type, target_id)
);

-- 8. Notifications, Audit Log, Reports & Crisis Support
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  action_url TEXT,
  category TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  web_push_enabled BOOLEAN NOT NULL DEFAULT true,
  mobile_push_enabled BOOLEAN NOT NULL DEFAULT true,
  expo_push_token TEXT,
  web_fcm_token TEXT,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_univ_created ON audit_log(university_id, created_at DESC);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('REVIEW', 'ARCHIVE_FILE', 'POST', 'MARKETPLACE_LISTING')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIONED', 'DISMISSED')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE TABLE crisis_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  callback_phone TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'bn',
  urgency_note TEXT,
  assigned_counselor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'IN_PROGRESS', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
