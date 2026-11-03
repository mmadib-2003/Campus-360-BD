-- supabase/migrations/0005_rls_policies.sql

-- Helper functions in public schema (SECURITY DEFINER, search_path locked)
CREATE OR REPLACE FUNCTION public.current_user_university_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT university_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.current_user_trust_level()
RETURNS trust_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT trust_level FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL),
    'UNVERIFIED'::trust_level
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_trust_level() IN ('EMAIL_VERIFIED', 'ID_VERIFIED', 'TRUSTED');
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(target_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = target_role
      AND (university_id = public.current_user_university_id() OR role = 'SUPER_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_admin_mfa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

-- Enable RLS across all tables
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE governing_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_support_requests ENABLE ROW LEVEL SECURITY;

-- Public Directory Tables (Universities, Domains, Departments, Halls, Governing Units)
CREATE POLICY "Public read active universities" ON universities
  FOR SELECT USING (is_active = true OR public.current_user_has_role('SUPER_ADMIN'));

CREATE POLICY "Super admin manage universities" ON universities
  FOR ALL USING (public.current_user_has_role('SUPER_ADMIN') AND public.current_user_has_admin_mfa());

CREATE POLICY "Public read email domains" ON university_email_domains
  FOR SELECT USING (is_active = true OR public.current_user_has_role('SUPER_ADMIN'));

CREATE POLICY "Super admin manage email domains" ON university_email_domains
  FOR ALL USING (public.current_user_has_role('SUPER_ADMIN') AND public.current_user_has_admin_mfa());

CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Public read halls" ON halls FOR SELECT USING (true);
CREATE POLICY "Public read governing units" ON governing_units FOR SELECT USING (true);
CREATE POLICY "Public read complaint routing" ON complaint_routing FOR SELECT USING (true);

-- Profiles & Roles (Strict Tenant Isolation)
CREATE POLICY "Users read same-university profiles" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (university_id = public.current_user_university_id() AND public.current_user_is_verified())
    OR public.current_user_has_role('SUPER_ADMIN')
  );

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND university_id = public.current_user_university_id());

CREATE POLICY "Users read own or same-univ roles" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR university_id = public.current_user_university_id()
    OR public.current_user_has_role('SUPER_ADMIN')
  );

-- ID Verification
CREATE POLICY "Users view and submit own ID verification" ON id_verification
  FOR SELECT USING (
    user_id = auth.uid()
    OR (university_id = public.current_user_university_id() AND public.current_user_has_role('UNIVERSITY_ADMIN'))
    OR public.current_user_has_role('SUPER_ADMIN')
  );

CREATE POLICY "Verified email users submit ID verification" ON id_verification
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
  );

-- Posts, Marketplace, Health Donors & Blood Requests (Strict Same-University + Verified Write)
CREATE POLICY "Same university read posts" ON posts
  FOR SELECT USING (university_id = public.current_user_university_id() AND deleted_at IS NULL);

CREATE POLICY "Verified users create posts in own university" ON posts
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND author_id = auth.uid()
    AND public.current_user_is_verified()
  );

CREATE POLICY "Same university read marketplace" ON marketplace_listings
  FOR SELECT USING (university_id = public.current_user_university_id() AND deleted_at IS NULL);

CREATE POLICY "Verified users create marketplace listing" ON marketplace_listings
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND seller_id = auth.uid()
    AND public.current_user_is_verified()
  );

CREATE POLICY "Same university read donors" ON health_donors
  FOR SELECT USING (university_id = public.current_user_university_id() AND public.current_user_is_verified());

CREATE POLICY "Verified users manage own donor profile" ON health_donors
  FOR ALL USING (user_id = auth.uid() AND university_id = public.current_user_university_id());

CREATE POLICY "Same university read blood requests" ON blood_requests
  FOR SELECT USING (university_id = public.current_user_university_id());

CREATE POLICY "Verified users create blood requests" ON blood_requests
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND requester_id = auth.uid()
    AND public.current_user_is_verified()
  );

-- Academic Archive (Same-University Private OR Opt-in Public Metadata)
CREATE POLICY "Read academic archive files" ON academic_files
  FOR SELECT USING (
    deleted_at IS NULL
    AND dmca_quarantined = false
    AND (
      visibility = 'PUBLIC'
      OR (university_id = public.current_user_university_id() AND public.current_user_is_verified())
      OR public.current_user_has_role('SUPER_ADMIN')
    )
  );

CREATE POLICY "Verified users upload to own university archive" ON academic_files
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND uploader_id = auth.uid()
    AND public.current_user_is_verified()
  );

CREATE POLICY "Uploader updates own archive metadata" ON academic_files
  FOR UPDATE USING (uploader_id = auth.uid() AND university_id = public.current_user_university_id());

-- Complaints & Grievances (Strict Privacy + Governing Body + Super Admin)
CREATE POLICY "Students and governing body read complaints" ON complaints
  FOR SELECT USING (
    (student_id IS NOT NULL AND student_id = auth.uid())
    OR (
      university_id = public.current_user_university_id()
      AND (
        public.current_user_has_role('GOVERNING_BODY')
        OR public.current_user_has_role('UNIVERSITY_ADMIN')
        OR public.current_user_has_role('COUNSELOR')
      )
    )
    OR public.current_user_has_role('SUPER_ADMIN')
  );

CREATE POLICY "Verified students file complaints in own university" ON complaints
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND public.current_user_is_verified()
    AND (
      (is_anonymous = true AND student_id IS NULL)
      OR (is_anonymous = false AND student_id = auth.uid())
    )
  );

CREATE POLICY "Governing body updates assigned university complaints" ON complaints
  FOR UPDATE USING (
    (
      university_id = public.current_user_university_id()
      AND (public.current_user_has_role('GOVERNING_BODY') OR public.current_user_has_role('UNIVERSITY_ADMIN'))
    )
    OR (student_id = auth.uid())
    OR public.current_user_has_role('SUPER_ADMIN')
  );

CREATE POLICY "Read complaint messages excluding internal notes for students" ON complaint_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_messages.complaint_id
        AND (
          (c.student_id = auth.uid() AND complaint_messages.is_internal_note = false)
          OR (
            c.university_id = public.current_user_university_id()
            AND (public.current_user_has_role('GOVERNING_BODY') OR public.current_user_has_role('UNIVERSITY_ADMIN'))
          )
          OR public.current_user_has_role('SUPER_ADMIN')
        )
    )
  );

-- Events & RSVPs
CREATE POLICY "Read university or opted-in public events" ON events
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      is_public = true
      OR university_id = public.current_user_university_id()
      OR public.current_user_has_role('SUPER_ADMIN')
    )
  );

CREATE POLICY "Verified users create events in own university" ON events
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND organizer_id = auth.uid()
    AND public.current_user_is_verified()
  );

CREATE POLICY "Organizer updates own event" ON events
  FOR UPDATE USING (organizer_id = auth.uid() AND university_id = public.current_user_university_id());

CREATE POLICY "Same university RSVP to events" ON event_rsvps
  FOR ALL USING (
    user_id = auth.uid() AND university_id = public.current_user_university_id()
  ) WITH CHECK (
    user_id = auth.uid() AND university_id = public.current_user_university_id() AND public.current_user_is_verified()
  );

-- Reviews & Aggregates
CREATE POLICY "Read active reviews for own university" ON reviews
  FOR SELECT USING (
    deleted_at IS NULL
    AND is_hidden = false
    AND (university_id = public.current_user_university_id() OR public.current_user_has_role('SUPER_ADMIN'))
  );

CREATE POLICY "Verified users create review" ON reviews
  FOR INSERT WITH CHECK (
    university_id = public.current_user_university_id()
    AND author_id = auth.uid()
    AND public.current_user_is_verified()
    AND (
      target_type NOT IN ('BLOOD_DONOR', 'COMPLAINT_RESOLUTION')
      OR public.current_user_trust_level() IN ('ID_VERIFIED', 'TRUSTED', 'EMAIL_VERIFIED')
    )
  );

CREATE POLICY "Author updates own review within 7 days" ON reviews
  FOR UPDATE USING (author_id = auth.uid() AND university_id = public.current_user_university_id());

CREATE POLICY "Read review aggregates" ON review_aggregates
  FOR SELECT USING (true);

-- Notifications
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users manage own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());
