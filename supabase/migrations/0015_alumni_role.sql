-- 0015_alumni_role.sql
-- The quick demo identities include an alumnus. `app_role` shipped with
-- STUDENT / FACULTY / COUNSELOR / GOVERNING_BODY / UNIVERSITY_ADMIN /
-- SUPER_ADMIN, and 0009 added ADMIN / GOVERNANCE. ALUMNI is used by the demo
-- store and the alumni landing page, so add it to the enum before the seed
-- inserts the role. Safe to re-run.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ALUMNI';
