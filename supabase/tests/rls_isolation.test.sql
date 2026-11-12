-- supabase/tests/rls_isolation.test.sql
-- Run via: supabase test db
-- Note: harness alignment with 0026 trigger + RLS audit delete documented in Issue #38.
BEGIN;
SELECT plan(11);

-- Create two test users: Student A at JU, Student B at DU
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student.a@juniv.edu'),
  ('22222222-2222-2222-2222-222222222222', 'student.b@du.ac.bd');

INSERT INTO public.profiles (id, university_id, email, full_name, student_id, trust_level, email_verified)
VALUES
  ('11111111-1111-1111-1111-111111111111', (SELECT id FROM public.universities WHERE code = 'JU'), 'student.a@juniv.edu', 'JU Student A', 'JU-2021', 'EMAIL_VERIFIED', true),
  ('22222222-2222-2222-2222-222222222222', (SELECT id FROM public.universities WHERE code = 'DU'), 'student.b@du.ac.bd', 'DU Student B', 'DU-2021', 'EMAIL_VERIFIED', true)
ON CONFLICT (id) DO UPDATE SET
  university_id = EXCLUDED.university_id,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  student_id = EXCLUDED.student_id,
  trust_level = EXCLUDED.trust_level,
  email_verified = EXCLUDED.email_verified;

-- JU Student A creates a private post and a grievance complaint
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.posts (id, university_id, author_id, body)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM public.universities WHERE code = 'JU'),
  '11111111-1111-1111-1111-111111111111',
  'JU internal campus post'
);

INSERT INTO public.complaints (id, university_id, tracking_code, student_id, is_anonymous, title, category, description, sla_due_at)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (SELECT id FROM public.universities WHERE code = 'JU'),
  'JU-CASE-2026-999999',
  '11111111-1111-1111-1111-111111111111',
  false,
  'Hall water supply issue',
  'HALL_RESIDENCE',
  'Water pump inactive on 3rd floor for 24 hours.',
  now() + INTERVAL '48 hours'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.posts WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'JU Student A can read their own university post'
);

-- Switch session to DU Student B and verify zero cross-university leakage
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

SELECT is(
  (SELECT COUNT(*)::int FROM public.posts WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'DU Student B CANNOT read JU private post (RLS tenant isolation enforced)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.complaints WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'DU Student B CANNOT read JU complaint'
);

-- Verify immutable audit log cannot be deleted (exercised as postgres so RLS 0-row
-- filtering does not skip FOR EACH ROW trigger trg_complaint_audit_log_immutable; see #38)
SET LOCAL ROLE postgres;
PREPARE delete_audit AS DELETE FROM public.complaint_audit_log;
SELECT throws_ok(
  'delete_audit',
  'Audit logs are immutable and cannot be updated or deleted.',
  'Immutable trigger blocks deletion on complaint_audit_log'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

-- Verify review aggregate trigger updates review_aggregates automatically
INSERT INTO public.reviews (university_id, author_id, target_type, target_id, rating, body)
VALUES (
  (SELECT id FROM public.universities WHERE code = 'DU'),
  '22222222-2222-2222-2222-222222222222',
  'LIBRARY',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  5,
  'Excellent reading room air conditioning and Wi-Fi.'
);

SELECT is(
  (SELECT review_count FROM public.review_aggregates WHERE target_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1,
  'Trigger automatically populates review_aggregates count'
);

SELECT is(
  (SELECT avg_rating FROM public.review_aggregates WHERE target_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  5.00,
  'Trigger automatically computes avg_rating = 5.00'
);


-- Marketplace tenant isolation: DU Student B creates a listing
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.marketplace_listings (id, university_id, seller_id, title, description, category, price_bdt, condition, kind, status)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  (SELECT id FROM public.universities WHERE code = 'DU'),
  '22222222-2222-2222-2222-222222222222',
  'DU Cormen Algorithms 3rd ed',
  'Introduction to Algorithms, 3rd edition, pickup at Nilkhet Book Market.',
  'Books',
  450.00,
  'GOOD',
  'SELL',
  'AVAILABLE'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.marketplace_listings WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'DU Student B can read their own DU marketplace listing'
);

-- Switch back to JU Student A: the DU listing must be invisible
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT is(
  (SELECT COUNT(*)::int FROM public.marketplace_listings WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  0,
  'JU Student A CANNOT read DU marketplace listing (RLS tenant isolation)'
);

-- Public registry policies exist for anon + authenticated
SELECT is(
  (SELECT COUNT(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'universities'
      AND policyname = 'Public read universities'),
  1,
  'Public read policy exists on universities'
);

SELECT is(
  (SELECT COUNT(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'university_email_domains'
      AND policyname = 'Public read email domains'),
  1,
  'Public read policy exists on university_email_domains'
);

SELECT is(
  (SELECT COUNT(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'marketplace_listings'
      AND policyname = 'Tenant read marketplace_listings'),
  1,
  'Tenant-scoped SELECT policy exists on marketplace_listings'
);

SELECT * FROM finish();
ROLLBACK;
