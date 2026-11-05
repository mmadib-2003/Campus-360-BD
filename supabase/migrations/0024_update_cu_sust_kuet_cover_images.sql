-- 0024_update_cu_sust_kuet_cover_images.sql
-- Replace the CU, SUST and KUET cover photographs with the user-supplied
-- authentic campus landmark media bundled in apps/web/public/campuses/
-- (provenance recorded in docs/IMAGE_ATTRIBUTION.md):
--
--   CU   -> Shaheed Minar / central monument relief wall  (/campuses/cu.jpg)
--   SUST -> yellow SUST gate landmark sign                (/campuses/sust.jpg)
--   KUET -> white KUET landmark sign on the lawn          (/campuses/kuet.webp,
--          with a JPEG twin at /campuses/kuet.jpg so both extensions resolve)
--
-- public.universities keys campuses by `code` (0002) and carries the wide
-- cover in `cover_image_url` (0014); there is no short_name/slug column and
-- no other image column besides logo_url, which stays untouched.
--
-- The ?v= query strings invalidate browser and Vercel CDN caches of the old
-- photos immediately; the API fallbacks (lib/demo-auth.ts) and the registry
-- cache version (lib/registry-cache.ts) were bumped in the same change.
BEGIN;

UPDATE public.universities AS u
SET cover_image_url = v.cover_image_url,
    updated_at = now()
FROM (
  VALUES
    ('CU',   '/campuses/cu.jpg?v=cu-monument-2026'),
    ('SUST', '/campuses/sust.jpg?v=sust-gate-2026'),
    ('KUET', '/campuses/kuet.webp?v=kuet-landmark-2026')
) AS v(code, cover_image_url)
WHERE u.code = v.code;

COMMIT;
