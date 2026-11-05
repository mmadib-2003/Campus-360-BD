# Campus image & logo attribution

## User-supplied authentic media (cleared for release)

The following assets were supplied directly by the project owner (November
2026) as authentic brand/campus media for this platform. They are first-party
uploads for use in Campus360 BD — no third-party attribution is required and
no attribution check should block the release on their account:

| Asset | Local path(s) | Description |
| --- | --- | --- |
| Campus360 BD brand logo | `/logos/campus360-logo.jpg`, `/icon.jpg` | Green-and-red orbital monument logo with the "Campus 360 BD" wordmark; used for the navbar brand, favicon, Apple touch icon and OpenGraph preview. |
| University of Chittagong (CU) cover | `/campuses/cu.jpg` | Central Shaheed Minar monument relief wall on the CU campus. Served as `/campuses/cu.jpg?v=cu-monument-2026`. |
| SUST cover | `/campuses/sust.jpg` | Yellow "SUST" landmark sign at the Shahjalal University of Science and Technology entrance. Served as `/campuses/sust.jpg?v=sust-gate-2026`. |
| KUET cover | `/campuses/kuet.webp`, `/campuses/kuet.jpg` | White "KUET" landmark sign on the lawn at Khulna University of Engineering & Technology. Served as `/campuses/kuet.webp?v=kuet-landmark-2026` (JPEG twin kept so both extensions resolve). |

These local files supersede the Wikimedia Commons photographs previously used
for the CU, SUST and KUET covers (rows below are kept for history). Migration
`0024_update_cu_sust_kuet_cover_images.sql` points `public.universities` at the
versioned local paths.

> **Local-asset attribution audit pending (remaining files only):** the *other*
> campus photographs and logo files in `apps/web/public` were sourced
> separately from the remote Wikimedia files listed below. Do not treat those
> Wikimedia links as attribution for the local copies until their exact
> sources, authors and licences have been matched. Institutional logos may be
> trademarks or non-free works. The user-supplied assets in the table above are
> exempt from this pending audit.

The home feed and campus directory show authentic photographs of the flagship
Bangladeshi public universities. The files are served from Wikimedia Commons
(`Special:FilePath` for photographs, `upload.wikimedia.org` for the logo
files). The linked file pages contain the applicable authorship and licence details.

| University | Cover photograph | Author | Licence |
| --- | --- | --- | --- |
| University of Dhaka (DU) | [Curzon Hall, University of Dhaka, Dhaka.jpg](https://commons.wikimedia.org/wiki/File:Curzon_Hall,_University_of_Dhaka,_Dhaka.jpg) | Tanvir Rahat | CC BY-SA 4.0 |
| Jahangirnagar University (JU) | [Shaheed Minar of Jahangirnagar University.jpg](https://commons.wikimedia.org/wiki/File:Shaheed_Minar_of_Jahangirnagar_University.jpg) | Syed Sajidul Islam | CC BY-SA 4.0 |
| BUET | [BUET Campus (01).jpg](https://commons.wikimedia.org/wiki/File:BUET_Campus_(01).jpg) | Yahya | CC BY-SA 4.0 |
| SUST | [Sust campus 5.JPG](https://commons.wikimedia.org/wiki/File:Sust_campus_5.JPG) | Md. Saiful Aziz Shamseer | CC BY-SA 3.0 |
| University of Chittagong (CU) | [Campus, University of Chittagong 1.jpg](https://commons.wikimedia.org/wiki/File:Campus,_University_of_Chittagong_1.jpg) | Wikimedia Commons contributor | CC BY-SA 4.0 |
| University of Rajshahi (RU) | [Rajshahi University Campus.jpg](https://commons.wikimedia.org/wiki/File:Rajshahi_University_Campus.jpg) | Wikimedia Commons contributor | CC BY-SA 4.0 |

## Institutional logos

| University | Logo file |
| --- | --- |
| University of Dhaka | [Dhaka University logo.svg](https://en.wikipedia.org/wiki/File:Dhaka_University_logo.svg) |
| Jahangirnagar University | [Jahangirnagar University Logo.svg](https://en.wikipedia.org/wiki/File:Jahangirnagar_University_Logo.svg) |
| BUET | [BUET LOGO.svg](https://en.wikipedia.org/wiki/File:BUET_LOGO.svg) |
| SUST | [Shahjalal University of Science and Technology logo.png](https://en.wikipedia.org/wiki/File:Shahjalal_University_of_Science_and_Technology_logo.png) |
| University of Chittagong | [University of Chittagong logo.svg](https://en.wikipedia.org/wiki/File:University_of_Chittagong_logo.svg) |
| University of Rajshahi | [রাজশাহী বিশ্ববিদ্যালয়ের লোগো.svg](https://commons.wikimedia.org/wiki/File:%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg) |

Logos are trademarks of their respective universities and are used here for
identification only. The photographs are not official university marketing
assets; they are community-contributed Wikimedia Commons files.

## Local fallback

`apps/web/public/campuses/` contains local photographic fallbacks. Except for
the user-supplied files listed at the top of this page (`cu.jpg`, `sust.jpg`,
`kuet.webp`, `kuet.jpg` — cleared for release), their exact sources and licence
terms still need to be matched to each file before release; the Wikimedia links
on this page do not establish attribution for those copies.

## Expanded campus photography (18 additional universities)

The home feed now shows authentic campus photographs for 24 public universities.
These are the additional files (all served from Wikimedia Commons; each file
page carries the authoritative author and licence):

| University | Cover photograph |
| --- | --- |
| Islamic University, Bangladesh (IU) | [Islamic University Lake with Central Mosque View.jpg](https://commons.wikimedia.org/wiki/File:Islamic_University_Lake_with_Central_Mosque_View.jpg) |
| Khulna University (KU) | [Khan Jahan Ali Hall.jpg](https://commons.wikimedia.org/wiki/File:Khan_Jahan_Ali_Hall.jpg) |
| Jagannath University (JNU) | [Jagannath University Bird View.jpg](https://commons.wikimedia.org/wiki/File:Jagannath_University_Bird_View.jpg) |
| Comilla University (COU) | [Comilla University campus building.jpg](https://commons.wikimedia.org/wiki/File:Comilla_University_campus_building.jpg) |
| Begum Rokeya University, Rangpur (BRUR) | [Campus of Begum Rokeya University, Rangpur.jpg](https://commons.wikimedia.org/wiki/File:Campus_of_Begum_Rokeya_University,_Rangpur.jpg) |
| Bangladesh University of Professionals (BUP) | [BUP Campus Aerial View 2.jpg](https://commons.wikimedia.org/wiki/File:BUP_Campus_Aerial_View_2.jpg) |
| University of Barishal (BU) | [Barishal University Campus Front.jpg](https://commons.wikimedia.org/wiki/File:Barishal_University_Campus_Front.jpg) |
| Jashore University of Science and Technology (JUST) | [Sir Jagadish Chandra Bose Academic Building, Jashore University of Science and Technology.jpg](https://commons.wikimedia.org/wiki/File:Sir_Jagadish_Chandra_Bose_Academic_Building,_Jashore_University_of_Science_and_Technology.jpg) |
| Bangladesh Agricultural University (BAU) | [Bangladesh Agricultural University (BAU).jpg](https://commons.wikimedia.org/wiki/File:Bangladesh_Agricultural_University_(BAU).jpg) |
| CUET | [CUET GATE.jpg](https://commons.wikimedia.org/wiki/File:CUET_GATE.jpg) |
| KUET | [KUET Central field.jpg](https://commons.wikimedia.org/wiki/File:KUET_Central_field.jpg) |
| RUET | [Rajshahi University of Engineering and Technology (RUET) Campus.jpg](https://commons.wikimedia.org/wiki/File:Rajshahi_University_of_Engineering_and_Technology_(RUET)_Campus.jpg) |
| MBSTU | [Academic building at Mawlana Bhashani Science and Technology University 03.jpg](https://commons.wikimedia.org/wiki/File:Academic_building_at_Mawlana_Bhashani_Science_and_Technology_University_03.jpg) |
| PSTU | [AdminBuilding.jpg](https://commons.wikimedia.org/wiki/File:AdminBuilding.jpg) |
| NSTU | [Academic building-1, NSTU.jpg](https://commons.wikimedia.org/wiki/File:Academic_building-1,_NSTU.jpg) |
| PUST | [PUST Campus.jpg](https://commons.wikimedia.org/wiki/File:PUST_Campus.jpg) |
| BSMRAU | [BSMRAU Agri New Building.jpg](https://commons.wikimedia.org/wiki/File:BSMRAU_Agri_New_Building.jpg) |
| SAU | [Sher-e-Bangla Agricultural University.jpg](https://commons.wikimedia.org/wiki/File:Sher-e-Bangla_Agricultural_University.jpg) |

The institutional logos for these universities are likewise real files from
Wikipedia/Wikimedia (see the `logo_url` values in `supabase/seed/seed.sql` and
`supabase/migrations/0017_university_real_images_expanded.sql`).
