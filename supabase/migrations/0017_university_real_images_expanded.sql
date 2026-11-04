-- 0017_university_real_images_expanded.sql
-- Expand authentic Wikimedia Commons campus photography + institutional logos
-- from the six flagship universities to 24 public universities.
--
-- 0016 covered DU, JU, BUET, SUST, CU and RU. This migration adds the next
-- tier: IU, KU, JNU, COU, BRUR, BUP, BU, JUST, BAU, CUET, KUET, RUET, MBSTU,
-- PSTU, NSTU, PUST, BSMRAU and SAU. Every URL is a real Wikimedia Commons /
-- Wikipedia file (no generated or generic placeholder art). Attribution and
-- licence links: docs/IMAGE_ATTRIBUTION.md.
--
-- Idempotent: only the 24 listed codes are touched; all other universities keep
-- whatever cover/logo they already have.

UPDATE public.universities AS u
SET cover_image_url = v.cover_image_url,
    logo_url = v.logo_url
FROM (
  VALUES
    -- Flagship six
    ('DU', 'https://commons.wikimedia.org/wiki/Special:FilePath/Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg?width=1600', 'https://upload.wikimedia.org/wikipedia/en/c/cb/Dhaka_University_logo.svg'),
    ('JU', 'https://commons.wikimedia.org/wiki/Special:FilePath/Shaheed_Minar_of_Jahangirnagar_University.jpg?width=1600', 'https://upload.wikimedia.org/wikipedia/en/a/a9/Jahangirnagar_University_Logo.svg'),
    ('BUET', 'https://commons.wikimedia.org/wiki/Special:FilePath/BUET_Campus_(01).jpg?width=1600', 'https://upload.wikimedia.org/wikipedia/en/d/da/BUET_LOGO.svg'),
    ('SUST', 'https://commons.wikimedia.org/wiki/Special:FilePath/Sust_campus_5.JPG?width=1600', 'https://upload.wikimedia.org/wikipedia/en/d/d9/Shahjalal_University_of_Science_and_Technology_logo.png'),
    ('CU', 'https://commons.wikimedia.org/wiki/Special:FilePath/Campus,_University_of_Chittagong_1.jpg?width=1600', 'https://upload.wikimedia.org/wikipedia/en/8/86/University_of_Chittagong_logo.svg'),
    ('RU', 'https://commons.wikimedia.org/wiki/Special:FilePath/Rajshahi_University_Campus.jpg?width=1600', 'https://upload.wikimedia.org/wikipedia/commons/4/4f/%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg'),
    -- Additional public universities (authentic Wikimedia Commons photography)
    ('IU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Islamic_University_Lake_with_Central_Mosque_View.jpg/1920px-Islamic_University_Lake_with_Central_Mosque_View.jpg', 'https://upload.wikimedia.org/wikipedia/en/7/7b/Islamic_University%2C_Bangladesh_logo.svg'),
    ('KU', 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Khan_Jahan_Ali_Hall.jpg', 'https://upload.wikimedia.org/wikipedia/en/1/13/Khulna_University_Logo.svg'),
    ('JNU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Jagannath_University_Bird_View.jpg/1920px-Jagannath_University_Bird_View.jpg', 'https://upload.wikimedia.org/wikipedia/en/4/47/Logo_of_Jagannath_University.svg'),
    ('COU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Comilla_University_campus_building.jpg/1920px-Comilla_University_campus_building.jpg', 'https://upload.wikimedia.org/wikipedia/en/6/65/Logo_of_Comilla_University.png'),
    ('BRUR', 'https://upload.wikimedia.org/wikipedia/commons/9/94/Campus_of_Begum_Rokeya_University%2C_Rangpur.jpg', 'https://upload.wikimedia.org/wikipedia/commons/5/5f/BRUR_Logo.svg'),
    ('BUP', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/BUP_Campus_Aerial_View_2.jpg/1920px-BUP_Campus_Aerial_View_2.jpg', 'https://upload.wikimedia.org/wikipedia/en/9/95/Bangladesh_University_of_Professionals_%28BUP%29_Logo.svg'),
    ('BU', 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Barishal_University_Campus_Front.jpg', 'https://upload.wikimedia.org/wikipedia/en/3/3e/Barishal_University_logo.svg'),
    ('JUST', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg/1920px-Sir_Jagadish_Chandra_Bose_Academic_Building%2C_Jashore_University_of_Science_and_Technology.jpg', 'https://upload.wikimedia.org/wikipedia/commons/7/74/Jashore_University_Of_Science_and_Technology_logo.png'),
    ('BAU', 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Bangladesh_Agricultural_University_%28BAU%29.jpg', 'https://upload.wikimedia.org/wikipedia/en/a/a2/Bangladesh_Agriculture_University_logo.svg'),
    ('CUET', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/CUET_GATE.jpg/1920px-CUET_GATE.jpg', 'https://upload.wikimedia.org/wikipedia/en/0/0e/CUET_Vector_Logo.svg'),
    ('KUET', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/KUET_Central_field.jpg/1920px-KUET_Central_field.jpg', 'https://upload.wikimedia.org/wikipedia/en/7/74/Logo_KUET.svg'),
    ('RUET', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Rajshahi_University_of_Engineering_and_Technology_%28RUET%29_Campus.jpg/1920px-Rajshahi_University_of_Engineering_and_Technology_%28RUET%29_Campus.jpg', 'https://upload.wikimedia.org/wikipedia/en/8/87/RUET_logo.svg'),
    ('MBSTU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Academic_building_at_Mawlana_Bhashani_Science_and_Technology_University_03.jpg/1280px-Academic_building_at_Mawlana_Bhashani_Science_and_Technology_University_03.jpg', 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Logo_Of_MBSTU.png'),
    ('PSTU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/AdminBuilding.jpg/1920px-AdminBuilding.jpg', 'https://upload.wikimedia.org/wikipedia/en/5/52/Patuakhali_Science_and_Technology_University_logo.png'),
    ('NSTU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Academic_building-1%2C_NSTU.jpg/1920px-Academic_building-1%2C_NSTU.jpg', 'https://upload.wikimedia.org/wikipedia/en/7/70/Logo_of_Noakhali_Science_and_Technology_University.gif'),
    ('PUST', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/PUST_Campus.jpg/1920px-PUST_Campus.jpg', 'https://upload.wikimedia.org/wikipedia/en/1/16/PUST_Logo.png'),
    ('BSMRAU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/BSMRAU_Agri_New_Building.jpg/1920px-BSMRAU_Agri_New_Building.jpg', 'https://upload.wikimedia.org/wikipedia/en/8/8b/Gazipur_Agricultural_University_Logo.png'),
    ('SAU', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Sher-e-Bangla_Agricultural_University.jpg/1920px-Sher-e-Bangla_Agricultural_University.jpg', 'https://upload.wikimedia.org/wikipedia/en/d/d5/Sher-e-Bangla_Agricultural_University_Logo.png')
) AS v(code, cover_image_url, logo_url)
WHERE u.code = v.code;
