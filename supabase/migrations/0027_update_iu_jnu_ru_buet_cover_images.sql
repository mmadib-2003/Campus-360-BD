-- 0027_update_iu_jnu_ru_buet_cover_images.sql
-- Replace the IU, JnU, RU and BUET cover photographs with the user-supplied
-- authentic campus media bundled in apps/web/public/campuses/ (provenance
-- recorded in docs/IMAGE_ATTRIBUTION.md):
--
--   IU   -> Islamic University main gate            (/campuses/iu.jpg)
--   JnU  -> Jagannath University main building      (/campuses/jnu.jpg)
--   RU   -> Rajshahi University administration bldg (/campuses/ru.jpg)
--   BUET -> Bangladesh University of Engineering
--           and Technology, Gate 02                 (/campuses/buet.jpg)
--
-- public.universities keys campuses by `code` (0002) and carries the wide
-- cover in `cover_image_url` (0014). There is no short_name/slug column and no
-- other image column besides logo_url, which stays untouched; the optional
-- block below mirrors the value into legacy image columns *if* a database
-- still has them, and is a no-op on the current schema.
--
-- The ?v= query strings invalidate browser and Vercel CDN caches of the old
-- photos immediately; the API fallbacks (lib/demo-auth.ts, served by
-- /api/universities and /api/universities/[id]) and the registry cache version
-- (lib/registry-cache.ts) were bumped in the same change.
BEGIN;

UPDATE public.universities AS u
SET cover_image_url = v.cover_image_url,
    updated_at = now()
FROM (
  VALUES
    ('IU',   '/campuses/iu.jpg?v=iu-gate-2026'),
    ('JNU',  '/campuses/jnu.jpg?v=jnu-campus-2026'),
    ('RU',   '/campuses/ru.jpg?v=ru-admin-2026'),
    ('BUET', '/campuses/buet.jpg?v=buet-gate2-2026')
) AS v(code, cover_image_url)
WHERE upper(u.code) = v.code;

-- Legacy/alternative image columns, when a database carries them. The current
-- production schema has only cover_image_url + logo_url, so this does nothing
-- there; it keeps the migration correct for older clones without failing.
DO $$
DECLARE
  legacy_column TEXT;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY['campus_image_url', 'image_url', 'cover_image']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'universities'
        AND column_name = legacy_column
    ) THEN
      EXECUTE format(
        'UPDATE public.universities AS u
            SET %I = v.cover_image_url
          FROM (VALUES
            (''IU'',   ''/campuses/iu.jpg?v=iu-gate-2026''),
            (''JNU'',  ''/campuses/jnu.jpg?v=jnu-campus-2026''),
            (''RU'',   ''/campuses/ru.jpg?v=ru-admin-2026''),
            (''BUET'', ''/campuses/buet.jpg?v=buet-gate2-2026'')
          ) AS v(code, cover_image_url)
          WHERE upper(u.code) = v.code',
        legacy_column
      );
      RAISE NOTICE '0027: mirrored covers into public.universities.%', legacy_column;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
