-- supabase/migrations/0004_triggers_and_functions.sql

-- 1. Automatic updated_at maintenance
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'universities', 'university_email_domains', 'departments', 'halls',
    'governing_units', 'complaint_routing', 'profiles', 'user_roles',
    'verification_attempts', 'id_verification', 'posts', 'post_comments',
    'marketplace_listings', 'marketplace_offers', 'health_donors', 'blood_requests',
    'academic_files', 'complaints', 'events', 'event_rsvps', 'reviews',
    'notification_preferences', 'reports', 'crisis_support_requests'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- 2. Immutable audit_log & complaint_audit_log protection
CREATE OR REPLACE FUNCTION public.tg_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted.';
END;
$$;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_audit_mutation();

CREATE TRIGGER trg_complaint_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.complaint_audit_log
FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_audit_mutation();

-- 3. Automatic Complaint Status History & Audit Trail
CREATE OR REPLACE FUNCTION public.tg_complaint_status_and_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_status_history (
      complaint_id, university_id, from_status, to_status, changed_by, reason
    ) VALUES (
      NEW.id, NEW.university_id, NULL, NEW.status, NEW.student_id, 'Initial complaint submission'
    );

    INSERT INTO public.complaint_audit_log (
      complaint_id, university_id, actor_id, actor_role, action, field_changed, old_value, new_value
    ) VALUES (
      NEW.id, NEW.university_id, NEW.student_id, 'STUDENT', 'CREATED', 'status', NULL, to_jsonb(NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.last_activity_at = now();
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.complaint_status_history (
        complaint_id, university_id, from_status, to_status, changed_by, reason
      ) VALUES (
        NEW.id, NEW.university_id, OLD.status, NEW.status, auth.uid(), COALESCE(NEW.rejection_reason, NEW.resolution_summary, 'Status updated')
      );

      INSERT INTO public.complaint_audit_log (
        complaint_id, university_id, actor_id, actor_role, action, field_changed, old_value, new_value
      ) VALUES (
        NEW.id, NEW.university_id, auth.uid(), 'GOVERNING_BODY', 'STATUS_CHANGE', 'status', to_jsonb(OLD.status), to_jsonb(NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complaint_lifecycle
AFTER INSERT OR UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_complaint_status_and_audit();

-- 4. Review Aggregates Recompute Trigger + 7-day Edit Window Enforcement
CREATE OR REPLACE FUNCTION public.tg_enforce_review_edit_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.created_at < (now() - INTERVAL '7 days') AND (
    OLD.rating IS DISTINCT FROM NEW.rating OR
    OLD.body IS DISTINCT FROM NEW.body OR
    OLD.title IS DISTINCT FROM NEW.title
  ) THEN
    RAISE EXCEPTION 'Reviews can only be edited within 7 days of creation.';
  END IF;
  IF NEW.pending_reports_count >= 5 THEN
    NEW.is_hidden = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reviews_edit_window
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_review_edit_window();

CREATE OR REPLACE FUNCTION public.tg_recompute_review_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_univ UUID;
  v_type review_target_type;
  v_target UUID;
BEGIN
  v_univ := COALESCE(NEW.university_id, OLD.university_id);
  v_type := COALESCE(NEW.target_type, OLD.target_type);
  v_target := COALESCE(NEW.target_id, OLD.target_id);

  INSERT INTO public.review_aggregates (
    university_id, target_type, target_id, avg_rating, review_count, verified_count, last_reviewed_at, updated_at
  )
  SELECT
    v_univ,
    v_type,
    v_target,
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE verified_participation = true)::int,
    MAX(created_at),
    now()
  FROM public.reviews
  WHERE university_id = v_univ
    AND target_type = v_type
    AND target_id = v_target
    AND deleted_at IS NULL
    AND is_hidden = false
  ON CONFLICT (university_id, target_type, target_id)
  DO UPDATE SET
    avg_rating = EXCLUDED.avg_rating,
    review_count = EXCLUDED.review_count,
    verified_count = EXCLUDED.verified_count,
    last_reviewed_at = EXCLUDED.last_reviewed_at,
    updated_at = now();

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_reviews_aggregates
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_review_aggregates();

-- 5. Event RSVP & Check-in Counter Maintenance
CREATE OR REPLACE FUNCTION public.tg_recompute_event_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.events
  SET
    rsvp_count = (SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = v_event_id AND status = 'GOING'),
    checkin_count = (SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = v_event_id AND checked_in_at IS NOT NULL)
  WHERE id = v_event_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_rsvps_counts
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_event_counts();
