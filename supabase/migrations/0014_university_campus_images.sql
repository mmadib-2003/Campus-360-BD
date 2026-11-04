-- 0014_university_campus_images.sql
-- A cover image for each university, so the home feed and the public campus
-- directory can show a campus instead of a coloured monogram tile.
--
-- The registry already has logo_url, which seed.sql has pointed at
-- /logos/<code>.svg since it was seeded -- a directory the repo never had, so
-- every campus image in the product has been a 404 and every component gave up
-- silently. logo_url gets real monogram SVGs (see apps/web/public/logos/), and
-- this new column carries a wide photographic cover.
--
-- These are generated placeholder illustrations, not photographs of the
-- institutions: universities that want their own picture set cover_image_url to
-- a real URL and nothing else changes. Kept as a plain text path rather than a
-- storage object id so an external CDN URL works just as well.
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN public.universities.cover_image_url IS
  'Wide campus illustration shown in the home feed and campus directory. Placeholder art by default; any absolute URL or /public path. NULL renders the monogram fallback.';
