-- Ensure Bangladesh University of Textiles (BUTEX) has institution-specific
-- Wikimedia imagery alongside the flagship image catalogue.
UPDATE public.universities
SET cover_image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bangladesh_University_of_Textiles.jpg?width=1600',
    logo_url = 'https://upload.wikimedia.org/wikipedia/en/3/36/Bangladesh_University_of_Textiles_logo.png',
    updated_at = now()
WHERE code = 'BUTEX';
