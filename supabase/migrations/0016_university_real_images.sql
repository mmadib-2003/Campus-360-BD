-- 0016_university_real_images.sql
-- Replace the generic campus illustration on the six flagship universities
-- with authentic Wikimedia Commons photography and real institutional logos.
--
-- This is the migration half of the seed change: `supabase db reset` applies
-- it to a fresh database, and `supabase db push` applies it to an existing
-- deployment without touching any other university row.
--
-- Images are served from Wikimedia Commons `Special:FilePath` (stable,
-- width-respecting) and `upload.wikimedia.org` (the original logo files).
-- Attribution/licence for every file: docs/IMAGE_ATTRIBUTION.md.
UPDATE public.universities AS u
SET cover_image_url = v.cover_image_url,
    logo_url = v.logo_url,
    updated_at = now()
FROM (
  VALUES
    (
      'DU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg'
    ),
    (
      'JU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Shaheed_Minar_of_Jahangirnagar_University.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/a/a9/Jahangirnagar_University_Logo.svg'
    ),
    (
      'BUET',
      'https://commons.wikimedia.org/wiki/Special:FilePath/BUET_Campus_(01).jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg'
    ),
    (
      'SUST',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Sust_campus_5.JPG?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/d/d9/Shahjalal_University_of_Science_and_Technology_logo.png'
    ),
    (
      'CU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Campus,_University_of_Chittagong_1.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/en/8/86/University_of_Chittagong_logo.svg'
    ),
    (
      'RU',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Rajshahi_University_Campus.jpg?width=1600',
      'https://upload.wikimedia.org/wikipedia/commons/4/4f/%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg'
    )
) AS v(code, cover_image_url, logo_url)
WHERE u.code = v.code;
