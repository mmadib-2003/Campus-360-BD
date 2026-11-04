#!/usr/bin/env python3
"""Regenerate supabase/seed/seed_demo_content.sql.

    python3 supabase/seed/tools/generate_demo_content_seed.py

The seed is generated rather than hand-written because three things in it must be
mechanically exact: every Bengali string goes through one escaper into U&'\09XX'
form (so no client encoding can corrupt it), every id is a uuid5 of the row's own
content key (so the file is re-runnable), and every foreign key is a subselect on
a natural name instead of a hard-coded id (so the same file seeds a fresh clone
and the production registry). The data below is the only part anyone should edit.

Out of scope by design: this file writes no sign-in-able accounts. The demo
identities get crypt(md5(random())) passwords; see the header of the generated SQL.
"""


EMAIL_PREFIX = 'demo.'
EMAIL_DOMAIN = '@campus360.test'


def a(slug):
    return f"'{EMAIL_PREFIX}{slug}{EMAIL_DOMAIN}'"


# code, en, bn, campus, dept, program, hall, student_id
PEOPLE = [
    ('tanvir.du', 'Tanvir Ahmed', 'তানভীর আহমেদ', 'DU', 'CSE', 'HONORS', 'Fazlul Huq Muslim Hall', '220201047'),
    ('nusrat.du', 'Nusrat Jahan', 'নুসরাত জাহান', 'DU', 'BENG', 'DEGREE_PASS', 'Begum Fazilatunnesa Mujib Hall', '230405012'),
    ('rifat.du', 'Rifat Chowdhury', 'রিফাত চৌধুরী', 'DU', 'ECON', 'DEGREE_PASS', 'Bangabandhu Sheikh Mujibur Rahman Hall', '210403188'),
    ('sabbir.buet', 'Sabbir Hossain', 'সাব্বির হোসেন', 'BUET', 'ECE', 'ENGINEERING_BSC', 'Sher-e-Bangla Hall', '2002099'),
    ('farhana.buet', 'Farhana Yeasmin', 'ফারহানা ইয়াসমিন', 'BUET', 'CSE', 'ENGINEERING_BSC', 'Sabekun Nahar Sony Hall', '2105041'),
    ('mehedi.ru', 'Mehedi Hasan', 'মেহেদী হাসান', 'RU', 'CSE', 'HONORS', 'Motihar Hall', '200203077'),
    ('sumaiya.ru', 'Sumaiya Akter', 'সুমাইয়া আক্তার', 'RU', 'BENG', 'HONORS', 'Begum Rokeya Hall', '210404110'),
    ('imran.cu', 'Imran Kabir', 'ইমরান কবির', 'CU', 'EEE', 'ENGINEERING_BSC', 'A. F. Rahman Hall', '220305044'),
    ('farzana.cu', 'Farzana Islam', 'ফারজানা ইসলাম', 'CU', 'ACC', 'DEGREE_PASS', 'Deshnetri Begum Khaleda Zia Hall', '200402011'),
    ('rafiul.sust', 'Rafiul Karim', 'রফিউল করিম', 'SUST', 'CSE', 'HONORS', 'Shah Paran Hall', '200203035'),
    ('sabrina.sust', 'Sabrina Haque', 'সাবরিনা হক', 'SUST', 'IPE', 'ENGINEERING_BSC', 'Ayesha Siddiqa Hall', '210201009'),
    ('alamin.just', 'Al-Amin Hossain', 'আল-আমিন হোসেন', 'JUST', 'CSE', 'HONORS', None, '200201018'),
    ('tahmina.just', 'Tahmina Khatun', 'তামিমা খাতুন', 'JUST', 'BENG', 'DEGREE_PASS', None, '220401077'),
    ('shahriar.mentor', 'Shahriar Kabir', 'শাহরিয়ার কবির', 'DU', 'ENG', 'MASTERS', 'Dr. Muhammad Shahidullah Hall', '201202064'),
    ('tanjila.mentor', 'Tanjila Rahman', 'তানজিলা রহমান', 'BUET', 'MTE', 'MASTERS', 'Chatri Hall', '1906003'),
    ('arsalan.mentor', 'Arsalan Haque', 'আরসালুল হক', 'SUST', 'CSE', 'MASTERS_FINAL', 'Syed Mujtaba Ali Hall', '190203002'),
    ('mahmudul.alumni', 'Mahmudul Hasan', 'মাহমুদুল হাসান', 'DU', 'ACC', 'MASTERS', None, '140203501'),
    ('sadia.alumni', 'Sadia Afrin', 'সাদিয়া আফরিন', 'BUET', 'CSE', 'ENGINEERING_BSC', None, '1505012'),
    ('nayeem.alumni', 'Nayeem Islam', 'নায়েম ইসলাম', 'RU', 'ECON', 'DEGREE_PASS', None, '130401120'),
    ('rumana.alumni', 'Rumana Sultana', 'রুমানা সুলতানা', 'CU', 'FIN', 'MASTERS', None, '160402077'),
    ('kamrul.alumni', 'Kamrul Ahsan', 'কামরুল আহসান', 'SUST', 'IPE', 'ENGINEERING_BSC', None, '120201044'),
    ('sharmin.alumni', 'Sharmin Nahar', 'শারমিন নাহার', 'JUST', 'BBA', 'HONORS', None, '170401009'),
]

LATLNG = {'DU': (23.7330, 90.3943), 'BUET': (23.7873, 90.3520), 'RU': (24.3745, 89.0641),
          'CU': (22.3509, 91.8549), 'SUST': (24.8985, 91.8886), 'JUST': (25.4545, 89.0662)}

# ---------------------------------------------------------------- campus feed
POSTS_F = ['actor', 'campus', 'module_tag', 'title', 'body', 'pinned', 'ago', 'likes', 'comments']
POSTS = [
    ('tanvir.du', 'DU', 'academics', 'Registration for CSE 3rd year is open till 12 November',
     "Registration for CSE 3106 (Database) and CSE 3108 is open until 12 November, 11:59pm. If your advisor's signature is missing the section will not appear — get it from the department office before the portal closes. Batch 22 first, then 23.",
     False, '2 hours', 41, 12),
    ('nusrat.du', 'DU', 'general', 'বার্ষিক সাংস্কৃতিক অনুষ্ঠান — টিকেট বিক্রি শুরু',
     "২১ নভেম্বর সন্ধ্যা ৭টায় কলা ভবনের সামনে ডিউ বাংলা বিভাগের বার্ষিক সাংস্কৃতিক অনুষ্ঠান। টিকেট ৫০ টাকা (ছাত্র) ও ১০০ টাকা (অভিভাবক)। হল কার্ড দেখিয়ে বুক করতে হবে, আসন সংখ্যা সীমিত।",
     False, '5 hours', 27, 8),
    ('sabbir.buet', 'BUET', 'dining', 'Hall mess committee meeting — ration price revised',
     "Shahid Smriti Hall mess committee meeting on Thursday 8:00pm in the common room. The per-plate rate is proposed to go from Tk 78 to Tk 92 because of the beef price. Anyone who wants the menu changed should come; last month it passed with eleven hands.",
     False, '1 day', 63, 34),
    ('farhana.buet', 'BUET', 'skills', 'Looking for a partner for the National ICT Fest 2026',
     "Team of one left for the ICT Fest mobile app track. Need someone comfortable with Flutter and Firebase. Problems are released two weeks before; we can start at the CSE lounge every Friday evening.",
     False, '3 hours', 18, 6),
    ('mehedi.ru', 'RU', 'health', 'Blood group O- donor needed at Rajshahi Medical University Hospital',
     "My cousin is in an accident and needs O- blood tonight. Anyone who is O- and free, please come to the RMUH blood bank counter and call 01712-345678. I will cover transport from the Motihar gate.",
     True, '40 minutes', 88, 22),
    ('sumaiya.ru', 'RU', 'lost-found', 'পুজা মার্কেটে ছাত্রীর আইডি কার্ড পাওয়া গেছে',
     "রাজশাহী বিশ্ববিদ্যালয়ের এক ছাত্রীর আইডি কার্ড পুজা মার্কেটের কাছে পাওয়া গেছে — নাম মৌসুমি আক্তার, ২০১৯ ব্যাচ। নিজের পরিচয় দিয়ে বুঝে নিতে হবে; মামলার ভয় নয়, সরাসরি.security office-এ জমা দিয়েছি।",
     False, '6 hours', 34, 3),
    ('imran.cu', 'CU', 'housing', 'Mess rent going up around Khulshi — share your actual rate',
     "Landlords near Khulshi and Nurjahan Road are asking Tk 9,500–11,000 for a 3-sharing room including utility. If you are paying materially different this term, put the real number in the housing module so juniors get a fair idea instead of guessing from Facebook groups.",
     False, '12 hours', 52, 27),
    ('farzana.cu', 'CU', 'careers', 'Referral slots for the Accounts intern intake — Agrabad',
     "My firm in Agrabad is taking four interns from CU Commerce for the spring intake (paid, Tk 12,000 a month). Send CV and transcript through the careers module and tick the referral box; the shortlist is reviewed every Sunday.",
     False, '1 day', 74, 19),
    ('rafiul.sust', 'SUST', 'general', 'Sylhet rain forecast — low-lying routes near Kumargaon',
     "Four days of heavy rain forecast for Sylhet. The Kumargaon road floods first, so plan 30 minutes extra for morning classes. Auto rickshaw drivers are charging Tk 60 instead of Tk 30 on that stretch — report it to the transport office instead of paying silently.",
     True, '45 minutes', 96, 41),
    ('sabrina.sust', 'SUST', 'events', 'Ayesha Siddiqa Hall night duty roster for exams',
     "Hall administration will keep the gate open till 2:00am from 24 November during final exams. Entry/exit card is still required. Residents coming from outside Sylhet should inform the hall office a day earlier so the night duty roster is not broken.",
     False, '2 days', 29, 5),
    ('alamin.just', 'JUST', 'academics', 'Library entry for day scholars, and the question paper rack',
     "Central library entry for day-scholar students is open 09:00–20:00 with the current session card. Copies of the last three years of CSE question papers are now on the second floor in the reference section — no borrowing, scanning allowed with permission from the desk.",
     False, '9 hours', 37, 11),
    ('tahmina.just', 'JUST', 'donations', 'শীত নিরাপত্তা তহবিল — দিনমজুর ও দিনশিক্ষার্থীর জন্য কম্বল',
     "উত্তরের শীতে জashোরের ক্যাম্পাসে রাতে ক্লাস শেষে সাইকেল চালিয়ে ফেরা শিক্ষার্থীদের কম্বল প্রয়োজন। আগামী ১৫ নভেম্বর পর্যন্ত ডোনেশন মডিউলে ৫০০ টাকা করে যোগ দিলে ৪০টি কম্বল কেনা যাবে। তালিকা ও রসিদ হল অফিসে সংরক্ষিত থাকবে।",
     False, '1 day', 45, 7),
]

# ---------------------------------------------------------------- events
EVENTS_F = ['actor', 'campus', 'category', 'title_en', 'title_bn', 'desc_en', 'desc_bn', 'venue', 'address',
            'dirs_en', 'dirs_bn', 'capacity', 'start_off', 'start_hour', 'duration_hours', 'geofence']
HOST_ORG = {'DU': 'Dhaka University Computer Society', 'BUET': 'BUET Debate Club',
            'RU': "Rajshahi University Career Club", 'CU': 'CUET Hall Sports Committee',
            'SUST': 'SUST Innovation Club', 'JUST': 'JUST Cultural Club'}
EVENTS = [
    ('tanvir.du', 'DU', 'Technology', 'DU Computer Society — Web & Cloud Workshop 2026',
     'ডিউ কম্পিউটার সোসাইটি — ওয়েব ও ক্লাউড ওয়ার্কশপ',
     "One-day workshop on shipping a Next.js app with Postgres on a free tier. Bring a laptop. Two tracks: beginner (React basics) and advanced (CI/CD, edge functions). Lunch is arranged for registered participants only.",
     "ল্যাপটপ নিয়ে আসুন; দুটি ট্র্যাক — বিগিনার (React) ও অ্যাডভান্সড (CI/CD)। নিবন্ধিতদের জন্য দুপুরের খাবারের ব্যবস্থা থাকবে।",
     'TSC Auditorium, Dhaka University', 'Mirpur Road, Dhaka 1000',
     'Enter through the TSC gate; the auditorium is on the second floor. Registration desk is at the staircase.',
     'টিএসসি গেট থেকে ঢুকুন — অডিটোরিয়াম দ্বিতীয় তলায়, নিবন্ধন ডেস্ক সিঁড়ির পাশে।',
     250, '+6 days', 10, 6, 180),
    ('sabbir.buet', 'BUET', 'Debate', 'BUET National Inter-University Debate 2026',
     'বিইউইটি জাতীয় আন্তঃবিশ্ববিদ্যালয় বিতর্ক প্রতিযোগিতা ২০২৬',
     "Bangla and English parliamentary debate with 32 teams. Preliminaries in the morning, final at 5:00pm in the main auditorium. Speakers from any department are welcome; the club runs practice rounds on campus every Tuesday.",
     None, 'BUET Auditorium', 'Sheikh Mizibur Rahman Road, Agargaon, Dhaka 1201',
     'The auditorium is right inside gate 1; the registration desk is under the shade tree, look for the blue tent.',
     'গেট ১-এ ঢুকলেই অডিটোরিয়াম — নীল তাঁবুতে নিবন্ধন ডেস্ক।',
     400, '+9 days', 9, 8, 150),
    ('mehedi.ru', 'RU', 'Career', 'RU Career Fair 2026 — Business & Engineering',
     'আরইই ক্যারিয়ার ফেয়ার ২০২৬',
     "Eighteen employers on campus, including bKash, BRAC, City Bank, Dutch-Bangla Bank and two software firms. Bring printed CVs — twenty copies is a realistic number. Formal dress code; the CV review booth runs from 10:00am in the Senate Bhaban lobby.",
     "প্রিন্ট করা সিভি নিয়ে আসুন (২০ কপি)। সিভি রিভিউ বুথ সকাল ১০টা থেকে সিনেট ভবনের লবিতে।",
     'Senate Bhaban, Rajshahi University', 'Rajshahi 6205',
     'Senate Bhaban is past the Administrative Building; parking is on the north side, three minutes on foot from the Motihar gate.',
     'প্রশাসনিক ভবনের পরে — মোতিহার গেট থেকে তিন মিনিট হাঁটা।',
     600, '+14 days', 10, 6, 120),
    ('imran.cu', 'CU', 'Sports', 'CUET Inter-Hall Cricket Tournament — group stage',
     'চিউইই ইন্টার-হল ক্রিকেট টুর্নামেন্ট — গ্রুপ পর্ব',
     "Twelve halls, knockout after the group stage. Ball and bat are provided by the hall sports committee; bring your own pads. Match one is A. F. Rahman Hall vs Masterda Surya Sen Hall at 9:00am on the central playground.",
     'বল ও ব্যাট হল ক্রীড়া কমিটি দেবে; প্যাড সঙ্গে আনতে হবে।',
     'CU Central Playground', 'Kulagaon Road, Agrabad, Chattogram 4202',
     'The playground is behind the CRB building; the entry gate is open to students with an ID card on match days.',
     'সিআরবি ভবনের পেছনে — শুধু আইডি কার্ডধারী শিক্ষার্থী প্রবেশ করবে।',
     1000, '+3 days', 9, 6, 300),
    ('rafiul.sust', 'SUST', 'Technology', 'SUST Innovation & Startup Expo 2026',
     'সাস্ট উদ্ভাবন ও স্টার্টআপ এক্সপো ২০২৬',
     "Student teams demo products to investors and industry mentors. Forty stalls, and the best campus startup gets Tk 100,000 in seed support from the alumni network. Visitor registration closes the night before.",
     '৪০টি স্টল; সেরা ক্যাম্পাস স্টার্টআপকে প্রাক্তন শিক্ষার্থীদের নেটওয়ার্ক থেকে ১,০০,০০০ টাকা বীজ তহবিল।',
     'SUST Auditorium, Kumargaon', 'Kumargaon, Thakagaon, Sylhet 3114',
     'The auditorium is beside the Administrative Building. Stall holders should reach by 8:00am for setup.',
     'প্রশাসনিক ভবনের পাশে — স্টল হলে সকাল ৮টায় পৌঁছান।',
     500, '+20 days', 10, 7, 200),
    ('alamin.just', 'JUST', 'Culture', 'JUST Winter Cultural Night & Charity Stall',
     'জইস্ট শীতকালীন সাংস্কৃতিক সন্ধ্যা ও দানবাজার',
     "An evening of song, poetry and a drama by the Theatre Club, plus charity stalls raising money for blankets for day scholars. Rehearsals start this week in the seminar hall; the open mic list is limited to twenty names.",
     'দিনশিক্ষার্থীদের কম্বলের জন্য দানবাজার চলবে; ওপেন মাইক তালিকা ২০ জনে সীমিত।',
     'JUST Seminar Hall, Central Library', 'Rajshahi Knowledge City, Jashore 7408',
     'The seminar hall is on the third floor of the central library building. The lift is out of service, so stairs only.',
     'কেন্দ্রীয় লাইব্রেরির তৃতীয় তলা — লিফট বন্ধ, সিঁড়ি দিয়ে উঠতে হবে।',
     300, '+11 days', 18, 4, 90),
]

RSVP_STATUSES = ['GOING', 'INTERESTED', 'GOING']

# ---------------------------------------------------------------- blood bank
DONORS_F = ['actor', 'campus', 'group', 'last_donated', 'available', 'phone', 'count']
DONORS = [
    ('tanvir.du', 'DU', 'O+', '2026-07-14', True, '+880 1712-345678', 6),
    ('sabbir.buet', 'BUET', 'B+', '2026-08-02', True, '+880 1811-223344', 3),
    ('mehedi.ru', 'RU', 'A+', '2026-06-21', True, '+880 1911-556677', 2),
    ('imran.cu', 'CU', 'AB-', '2026-09-05', False, '+880 1717-889900', 4),
    ('rafiul.sust', 'SUST', 'O-', '2026-05-30', True, '+880 1722-101010', 8),
    ('alamin.just', 'JUST', 'B-', '2026-10-01', True, '+880 1933-404040', 1),
    ('rifat.du', 'DU', 'A-', '2026-03-18', False, '+880 1552-707070', 0),
    ('farhana.buet', 'BUET', 'O+', '2026-09-27', True, '+880 1688-313131', 2),
]

BLOOD_F = ['actor', 'campus', 'patient', 'group', 'bags', 'hospital', 'hosp_addr', 'phone', 'urgency', 'due', 'status']
BLOOD = [
    ('nusrat.du', 'DU', 'Sayed Ahmed', 'O-', 3, 'Dhaka Medical College Hospital', 'Secretariat Road, Dhaka 1000',
     '+880 1712-345678', 'CRITICAL', '+1 day', 'OPEN'),
    ('farzana.cu', 'CU', 'Nasrin Akter', 'B+', 2, 'Chattagram Medical College Hospital', 'Khanjahara, Chattogram 4203',
     '+880 1819-220011', 'URGENT', '+2 days', 'OPEN'),
    ('sumaiya.ru', 'RU', 'Abdul Karim', 'O+', 2, 'Rajshahi Medical University Hospital', 'Laban, Rajshahi 6100',
     '+880 1911-556677', 'URGENT', '+1 day', 'OPEN'),
    ('sabrina.sust', 'SUST', 'Mahmuda Khatun', 'A+', 1, 'Osman Medical College Hospital', 'Jintalah, Sylhet 3100',
     '+880 1722-300044', 'NORMAL', '+4 days', 'OPEN'),
    ('tahmina.just', 'JUST', 'Hasan Imam', 'B-', 2, 'Rajshahi Medical College Hospital', 'Field Public Road, Rajshahi',
     '+880 1933-404040', 'CRITICAL', '+12 hours', 'OPEN'),
    ('rifat.du', 'DU', 'Self (post-surgery follow-up)', 'A-', 1, 'National Institute of Cardiovascular Diseases',
     'Amenity Road, Dhaka 1000', '+880 1552-908070', 'NORMAL', '+7 days', 'FULFILLED'),
]

RESP_F = ['actor', 'campus', 'request_author', 'status', 'message']
RESP = [
    ('mehedi.ru', 'DU', 'nusrat.du', 'ACCEPTED', "I am O- and free after 4pm. I will reach the DMC blood bank by 5:30pm — please keep my name at the counter."),
    ('sabbir.buet', 'DU', 'nusrat.du', 'OFFERED', "My roommate is O- and can come if you still need a second bag."),
    ('imran.cu', 'CU', 'farzana.cu', 'ACCEPTED', "B+ available tomorrow morning before my 10am class. Send the ward number so I do not wander the corridors."),
    ('rafiul.sust', 'RU', 'sumaiya.ru', 'OFFERED', None),
    ('alamin.just', 'JUST', 'tahmina.just', 'ACCEPTED', "Coming now with two batchmates from the CSE floor. Are you at the main gate or the emergency entrance?"),
    ('farhana.buet', 'SUST', 'sabrina.sust', 'DECLINED', "Sorry — I donated on 12 September, so I have to wait another three months."),
    ('tanvir.du', 'SUST', 'sabrina.sust', 'ACCEPTED', "Sunday 9am works. I will bring the donor card from my last donation at Shahjalal Medical."),
    ('nusrat.du', 'JUST', 'tahmina.just', 'OFFERED', None),
]

# ---------------------------------------------------------------- archive
FILES_F = ['actor', 'campus', 'dept', 'course_code', 'title', 'category', 'language', 'tags', 'visibility',
           'year', 'semester', 'size_kb', 'views', 'downloads', 'age_days']
FILES = [
    ('tanvir.du', 'DU', 'CSE', 'CSE 3106', 'Database System Design — Mid Term 2025 with solution sketch',
     'PAST_EXAMS', 'en', ['midterm', 'SQL', 'normalization'], 'PRIVATE_TO_UNIVERSITY', 2026, 'Spring 2026', 812, 1840, 642, 12),
    ('nusrat.du', 'DU', 'BENG', 'BENG 101', 'বাংলা ভাষা ও সাহিত্য পরিচিতি — পুরো সিলেবাসের নোট',
     'LECTURE_NOTES', 'bn', ['নোট', 'ধ্বনিতত্ত্ব', 'প্রথম পত্র'], 'PRIVATE_TO_UNIVERSITY', 2026, 'Fall 2025', 1420, 2310, 908, 26),
    ('sabbir.buet', 'BUET', 'EEE', 'EEE 211', 'Electric Circuit I — five years of mid terms and finals',
     'PAST_EXAMS', 'en', ['circuits', 'Thevenin', 'past papers'], 'PUBLIC', 2025, 'Spring 2025', 2140, 5120, 2280, 40),
    ('farhana.buet', 'BUET', 'CSE', 'CSE 203', 'Data Structures Lab Manual (sessions 1 to 10, updated)',
     'LAB_MANUALS', 'en', ['lab', 'C++', 'pointers'], 'PUBLIC', 2026, 'Fall 2025', 980, 3275, 1490, 9),
    ('mehedi.ru', 'RU', 'CSE', 'CSE-3107', 'Numerical Methods — question bank and previous board questions',
     'QUESTION_BANKS', 'mixed', ['numerical', 'question bank'], 'PRIVATE_TO_UNIVERSITY', 2025, 'Spring 2025', 640, 1590, 703, 33),
    ('sumaiya.ru', 'RU', 'BENG', 'BENG-202', 'আধুনিক কবিতা — অ্যাসাইনমেন্ট রুব্রিক ও নমুনা উত্তর',
     'ASSIGNMENTS', 'bn', ['রচনা', 'রুব্রিক', 'নমুনা'], 'PRIVATE_TO_UNIVERSITY', 2026, 'Fall 2025', 310, 940, 388, 5),
    ('imran.cu', 'CU', 'EEE', 'EEE 101', 'Engineering Mechanics — reference notes (Meriam chapters 1-4 summary)',
     'REFERENCE_BOOKS', 'en', ['mechanics', 'summary'], 'PUBLIC', 2025, 'Spring 2025', 1760, 4180, 1655, 51),
    ('farzana.cu', 'CU', 'BMB', 'BMB 201', 'Biochemistry & Molecular Biology syllabus 2025-26 (approved)',
     'SYLLABUS', 'en', ['syllabus', 'credits'], 'PUBLIC', 2026, 'Fall 2025', 120, 210, 402, 3),
    ('rafiul.sust', 'SUST', 'CSE', 'CSE 3105', 'Object Oriented Programming (Java) — sessional guide and rubric',
     'ASSIGNMENTS', 'en', ['Java', 'OOP', 'sessional'], 'PRIVATE_TO_UNIVERSITY', 2026, 'Spring 2026', 1180, 2740, 1120, 17),
    ('sabrina.sust', 'SUST', 'IPE', 'IPE 301', 'Thermal Engineering Lab Manual (boiler trial, report format)',
     'LAB_MANUALS', 'mixed', ['thermo', 'lab report'], 'PRIVATE_TO_UNIVERSITY', 2025, 'Fall 2024', 1520, 1980, 745, 62),
    ('alamin.just', 'JUST', 'BBA', 'BBA 1101', 'Principles of Marketing — course outline and evaluation sheet',
     'COURSE_OUTLINES', 'en', ['outline', 'marks'], 'PUBLIC', 2026, 'Fall 2025', 96, 260, 511, 7),
    ('tahmina.just', 'JUST', 'CHEM', 'CHEM 101', 'জৈব রসায়ন ল্যাব ও থিসিস প্রকল্প প্রতিবেদনের নমুনা (২০২৪)',
     'THESIS_PROJECT_REPORTS', 'bn', ['থিসিস', 'নমুনা', 'জৈব রসায়ন'], 'PRIVATE_TO_UNIVERSITY', 2024, 'Spring 2024', 1980, 3610, 1298, 88),
]

# ---------------------------------------------------------------- skills
SKILLS_F = ['actor', 'campus', 'type', 'title', 'desc', 'category', 'skills', 'loc_en', 'loc_bn', 'availability',
            'rate', 'remote', 'contact', 'status', 'applicants', 'age_hours']
SKILLS = [
    ('tanvir.du', 'DU', 'TUTORING', 'HSC and admission Math & Physics tutor (Dhanmondi / Mirpur)',
     "Three years with HSC students from the Dhaka and Savar boards, plus admission batches for Engineering and Medical. I take at most two subjects per student so doubt-clearing does not get rushed. First class is free if you tell me the syllabus a day earlier.",
     'Tutoring', ['Mathematics', 'Physics', 'Admission Test', 'HSC'], 'Dhanmondi 27, Dhaka', 'ধানমন্ডি ২৭, ঢাকা',
     'EVENINGS', 1200, False, 'WhatsApp 01712-345678 after 6pm', 'OPEN', 3, 5),
    ('nusrat.du', 'DU', 'FREELANCE', 'Bangla and English content writing for club events and pages',
     "I write event copies, poster text and Facebook page content for three DU clubs this term. Comfortable in both Bangla and English, and I keep a proofread checklist so nobody prints a typo on a programme poster. Two revisions included.",
     'Content Writing', ['Bangla', 'Copywriting', 'Proofreading', 'Canva'], 'Anywhere (online)', 'অনলাইন',
     'FLEXIBLE', 350, True, 'Send the deadline with the brief — 48 hours notice minimum', 'OPEN', 2, 11),
    ('sabbir.buet', 'BUET', 'PART_TIME_JOB', 'Junior frontend developer (part-time) at an EdTech startup',
     "Our team of five needs one part-time React developer for the student dashboard — roughly 15 hours a week, classes first always. Stack is Next.js, Tailwind and REST. Paid monthly, and work can move to the campus library if your hosteling makes remote unreliable.",
     'Development', ['React', 'Next.js', 'Tailwind', 'Git'], 'Mirpur DOHS, Dhaka (hybrid)', 'মিরপুর ডিওএইচএস',
     'WEEKDAYS', 15000, True, 'Send a GitHub link or one deployed site; no CV needed', 'OPEN', 3, 26),
    ('farhana.buet', 'BUET', 'INTERNSHIP', 'Research assistant intern — power systems data cleaning',
     "Paid internship under a BUET EEE faculty project on load forecasting: mostly MATLAB and Excel with some Python. Good for second and third year EEE/ECE students who want a publication line on the CV. Twelve weeks, ten hours a week.",
     'Research', ['MATLAB', 'Python', 'Excel', 'Data Cleaning'], 'EEE Room 305, BUET', 'ইইই বিভাগ, বুইইটি',
     'WEEKENDS', 12000, False, 'Transcript plus one line on which courses you have completed', 'OPEN', 5, 33),
    ('mehedi.ru', 'RU', 'TUTORING', 'Spoken English & IELTS crash course for RU students',
     "Evening batch of eight at the Kazla reading room, 6:00-7:30pm. Speaking practice every class, plus Writing Task 1 and 2 feedback. I got Band 7.5 and I teach the strategies that worked for me, not the generic advice. Materials included.",
     'Tutoring', ['IELTS', 'Speaking', 'Writing', 'Grammar'], 'Kazla, Rajshahi', 'কাজলা, রাজশাহী',
     'EVENINGS', 800, False, 'Trial class this Thursday 6pm — just come to the reading room', 'OPEN', 3, 8),
    ('sumaiya.ru', 'RU', 'FREELANCE', 'Poster and social media design (proper Bangla typography)',
     "Event posters, farewell and birthday covers with correct Bangla font handling (SolaimanLipi / Noto, converted so nothing breaks in print). You get a print-ready PDF and a square feed version per design, with outlines included.",
     'Design', ['Photoship', 'Illustrator', 'Bangla Typography', 'Print Ready'], 'Anywhere (online)', 'অনলাইন',
     'FLEXIBLE', 400, True, 'Tell me the hall poster size if the office requires a specific one', 'OPEN', 2, 47),
    ('imran.cu', 'CU', 'TUTORING', 'O-Level Physics & Math home tutor (Agrabad / Khulshi)',
     "Cambridge O-Level Physics and D2 Math, plus SSC students who need mechanics explained slowly. I keep a mistake notebook per student because that is what actually fixes exam panic rather than more lectures. Two evenings a week available.",
     'Tutoring', ['Physics', 'Mathematics', 'O-Level', 'SSC'], 'Agrabad, Chattogram', 'আগ্রাবাদ, চট্টগ্রাম',
     'EVENINGS', 6000, False, 'Parents may call 01819-220011 between 4pm and 8pm', 'OPEN', 1, 20),
    ('farzana.cu', 'CU', 'PART_TIME_JOB', 'Accounts & VAT filing assistant (paid internship, Agrabad)',
     "Back-office work for a small audit firm near Agrabad Chowmuhani: data entry into Tally, VAT challan filing and bank reconciliation. Twenty hours a week. Right if you do Accounting at CU and want real filing experience before graduation.",
     'Business', ['Tally', 'MS Excel', 'VAT Filing', 'Reconciliation'], 'Agrabad CDA Avenue, Chattogram', 'আগ্রাবাদ সিডিএএভিনিউ, চট্টগ্রাম',
     'WEEKDAYS', 10000, False, 'CV required — Sunday shortlist, starting the following Monday', 'OPEN', 6, 71),
    ('rafiul.sust', 'SUST', 'TUTORING', 'Programming tutor for SUST 1st/2nd year (C and Python)',
     "Problem-solving sessions in the Shah Paran Hall common room for Data Structures and elementary programming. We solve past sessional questions, not theory slides. If pointers or recursion are what is hurting you, that is exactly where we start.",
     'Tutoring', ['C', 'Python', 'Data Structures', 'Problem Solving'], 'Zindabazar / Shah Paran Hall, Sylhet', 'জিন্দাবাজার, সিলেট',
     'FLEXIBLE', 1000, False, 'Message me the topic; I will say honestly whether I can teach it', 'OPEN', 7, 14),
    ('sabrina.sust', 'SUST', 'FREELANCE', 'Video editing for club documentaries and YouTube',
     "Premiere Pro and DaVinci Resolve. I cut the SUST fest aftermovie and four club documentaries, so I know how to keep a hall event video watchable instead of twelve minutes of shaky clips. Colour, Bangla and English subtitles and a thumbnail included.",
     'Design', ['Premiere Pro', 'DaVinci Resolve', 'Subtitles', 'Thumbnails'], 'Anywhere (online)', 'অনলাইন',
     'WEEKENDS', 4000, True, 'Share raw footage on Drive; 48 hours per 10 minutes of footage', 'OPEN', 3, 60),
    ('alamin.just', 'JUST', 'PART_TIME_JOB', 'Data entry & digital archive assistant (Knowledge City)',
     "Digitising department records into Google Sheets and the university archive for the JUST ICT office. Bangla typing speed matters more than anything else here — around 25 wpm is enough. Morning or evening, whatever fits your timetable.",
     'Data', ['Bangla Typing', 'Google Sheets', 'Scanning', 'Record Keeping'], 'JUST Administrative Building', 'জইস্ট প্রশাসনিক ভবন',
     'MORNING', 9000, False, 'Bring a sample of Bangla typing if you have one', 'OPEN', 2, 90),
    ('tahmina.just', 'JUST', 'TUTORING', 'এসএসসি ও এইচএসসি পরীক্ষার্থীদের আইসিটি ও পদার্থবিজ্ঞান টিউশন',
     "জashোর শহরে মাত্র দুইজন শিক্ষার্থী নেব। প্রতিদিন সন্ধ্যা ৫টা থেকে ৭টা, বৃহস্পতিবার ছুটি। পুরনো প্রশ্নপত্র সমাধান ও লিখিত অংশের প্র্যাকটিস করানো হয়। প্রথম ক্লাসটি ফ্রি — পড়ানোর ধরন বুঝে তারপর সিদ্ধান্ত নিন।",
     'Tutoring', ['ICT', 'Physics', 'SSC', 'HSC'], 'Fazlatun, Jashore', 'ফজলতুন, যশোর',
     'EVENINGS', 700, False, 'অভিভাবক ফোন করবেন ০১৯৩৩-৪০৪০৪০ (সকাল ১০টা–রাত ৯টা)', 'CLOSED', 0, 150),
]

APPS_F = ['actor', 'campus', 'posting_author', 'status', 'message']
APPS = [
    ('farhana.buet', 'BUET', 'sabbir.buet', 'SENT', "Second year CSE. I have one deployed React site and I know Tailwind basics. I can start next week and I am serious about the fifteen hours."),
    ('rafiul.sust', 'SUST', 'tanvir.du', 'SHORTLISTED', "I took your admission batch last year. If it helps, I can run doubt-clearing for the junior section on Fridays."),
    ('sabrina.sust', 'SUST', 'rafiul.sust', 'ACCEPTED', "I need Data Structures help before sessionals — Tuesday and Thursday 6pm works for me."),
    ('alamin.just', 'JUST', 'mehedi.ru', 'SENT', None),
    ('tanvir.du', 'DU', 'nusrat.du', 'DECLINED', "Sorry, I already have two students this term and I would do a bad job of a third."),
    ('imran.cu', 'CU', 'farzana.cu', 'ACCEPTED', "Third year Accounting. I used Tally for two months in my uncle's firm and I can work Sundays."),
    ('mehedi.ru', 'RU', 'sumaiya.ru', 'SENT', "Our hall magazine needs three posters — can you send two sample designs first?"),
    ('nusrat.du', 'DU', 'farhana.buet', 'SHORTLISTED', None),
    ('sabbir.buet', 'BUET', 'farhana.buet', 'SENT', "2nd year EEE. MATLAB is part of my coursework and Saturday-Sunday mornings are free."),
    ('tahmina.just', 'JUST', 'alamin.just', 'ACCEPTED', "I can take the archive entry work on Wednesdays and Fridays from the library."),
]

ALERTS_F = ['actor', 'campus', 'keywords', 'categories']
ALERTS = [
    ('tanvir.du', 'DU', ['React', 'Next.js', 'frontend'], ['Development']),
    ('farhana.buet', 'BUET', ['MATLAB', 'research', 'internship'], ['Research', 'Internship']),
    ('mehedi.ru', 'RU', ['IELTS', 'speaking', 'English'], ['Tutoring']),
    ('imran.cu', 'CU', ['Tally', 'accounts', 'VAT'], ['Business']),
    ('rafiul.sust', 'SUST', ['Python', 'DSA', 'sessional'], ['Tutoring', 'Development']),
    ('alamin.just', 'JUST', ['typing', 'data entry', 'archive'], ['Data']),
]

# ---------------------------------------------------------------- mentorship
MENTORS_F = ['actor', 'campus', 'headline', 'expertise', 'rate', 'bio', 'sessions', 'rating']
MENTORS = [
    ('shahriar.mentor', 'DU', 'Final-year English, DU — admission and placement preparation',
     ['Admission Test', 'Interview Prep', 'English', 'CV Review'], 0,
     "I sat three admission tests in one season and got into DU, so I can walk you through a realistic timetable instead of a motivational one. I also review freshers' CVs and I am blunt about which lines a recruiter skips.", 23, 4.8),
    ('tanjila.mentor', 'BUET', 'MTE graduate, BUET — thesis, research and higher studies abroad',
     ['Thesis', 'GRE / IELTS', 'Scholarship Applications', 'MATLAB'], 0,
     "Third-year MTE with two conference papers. I mentor on choosing a supervisor, surviving a thesis deadline and the scholarship paperwork for Germany and Canada. I will read your SOP and tell you which paragraph is filler.", 14, 4.6),
    ('arsalan.mentor', 'SUST', 'CSE final year, SUST — DSA roadmap and starting freelancing',
     ['DSA', 'Freelancing', 'React', 'Interview Prep'], 300,
     "900+ online judge problems solved, and I have been freelancing since my second year, so both the interview path and the client path are open to me. Sessions are practical: we solve together, you get homework, we review it.", 41, 4.9),
]

SLOTS_F = ['actor', 'campus', 'mentor', 'topic', 'day_off', 'hour', 'capacity', 'booked']
SLOTS = [
    ('shahriar.mentor', 'DU', 'shahriar.mentor', 'CV line-by-line review for freshers applications', '+2 days', 20, 1, 1),
    ('shahriar.mentor', 'DU', 'shahriar.mentor', 'Admission math drill: functions and limits', '+4 days', 18, 2, 0),
    ('shahriar.mentor', 'DU', 'shahriar.mentor', 'IELTS speaking part 2 practice with feedback', '+6 days', 19, 1, 0),
    ('tanjila.mentor', 'BUET', 'tanjila.mentor', 'Choosing a thesis supervisor (what I wish I knew)', '+3 days', 21, 1, 1),
    ('tanjila.mentor', 'BUET', 'tanjila.mentor', 'SOP writing workshop — bring a draft', '+7 days', 19, 1, 0),
    ('arsalan.mentor', 'SUST', 'arsalan.mentor', 'DSA mock interview (45 minutes, live coding)', '+2 days', 17, 1, 0),
    ('arsalan.mentor', 'SUST', 'arsalan.mentor', 'Getting a first freelance client without underselling', '+5 days', 20, 1, 1),
    ('arsalan.mentor', 'SUST', 'arsalan.mentor', 'Graph problems: the BFS/DFS patterns that repeat', '+9 days', 21, 2, 0),
]

# ---------------------------------------------------------------- housing / rideshare
HOUSING_F = ['actor', 'campus', 'kind', 'title', 'desc', 'rent', 'seats', 'gender', 'area_en', 'area_bn', 'dist', 'amenities', 'phone', 'status']
HOUSING = [
    ('nusrat.du', 'DU', 'MESS_SEAT', "Girls' mess seat, two-sharing near Mirpur 10",
     "Registered mess for DU and Jahangirnagar women students, fourth floor with a working lift. Two-sharing room, terrace cooking allowed, and the mess committee posts the monthly accounts on the notice board. ID card and a guardian's number required before moving in.",
     6500, 2, 'FEMALE', 'Mirpur 10, Dhaka', 'মিরপুর ১০, ঢাকা', 1.2,
     ['WiFi', 'Geyser', 'Terrace cooking', 'CCTV', 'Mess accounts published'], '+880 1715-660011', 'AVAILABLE'),
    ('sabbir.buet', 'BUET', 'SUB_LET', 'Sub-let: 2BHK flat near Zinda Bazar (January to June)',
     "I am going away for an internship term, so the flat is sublet for six months. Furnished: bed, almirah, study table, fridge and AC in the main room. The landlord already knows, and will re-sign in your name if you want to stay longer.",
     18000, 1, 'ANY', 'Zinda Bazar, Agargaon, Dhaka', 'জিন্দাবাজার, আগারগাঁও, ঢাকা', 0.6,
     ['Furnished', 'AC', 'Fridge', 'Generator backup', 'Parking'], '+880 1811-223344', 'AVAILABLE'),
    ('mehedi.ru', 'RU', 'MESS_SEAT', 'Male mess bed at Kazla — three sharing, food included',
     "Empty bed in a running RU mess; food is arranged by the mess itself (breakfast, packed lunch, dinner). Utility is included up to a limit. See the room before deciding: the fan in the south bed is dying, and I would rather say so here than have you find out.",
     4500, 1, 'MALE', 'Kazla, Rajshahi', 'কাজলা, রাজশাহী', 0.9,
     ['Food included', 'WiFi', 'Study table', 'Rooftop drying'], '+880 1911-556677', 'AVAILABLE'),
    ('farzana.cu', 'CU', 'PAYING_GUEST', 'PG room for women students — Khulshi, quiet building',
     "PG in a three-family building for CU Commerce students. Attached bath, hot water, and the owner cooks dinner so you do not have to run a mess. Curfew is 10pm, which suits my parents as much as it suits me, so I put it in the listing instead of hiding it.",
     9000, 1, 'FEMALE', 'Khulshi, Chattogram', 'খুলশী, চট্টগ্রাম', 2.4,
     ['Attached bath', 'Dinner included', 'Hot water', 'Wardrobe', 'Study table'], '+880 1819-220011', 'AVAILABLE'),
    ('rafiul.sust', 'SUST', 'MESS_SEAT', 'Single-bed room at Sersotole for SUST students',
     "Small but proper single room on the third floor, walking distance to the main gate. Rent excludes utility; the meter is shared with two other rooms and we split it monthly in a WhatsApp thread with photos of the bill, which has ended every argument so far.",
     7500, 1, 'ANY', 'Sersotole, Sylhet', 'সারসোতল, সিলেট', 0.7,
     ['Single room', 'Balcony', 'WiFi', 'Bill shared with proof'], '+880 1722-101010', 'AVAILABLE'),
    ('tahmina.just', 'JUST', 'FAMILY_FLAT', 'Ground-floor flat for a small family or two students — Fazlatun',
     "Flat with a separate entrance, its own kitchen and one covered parking space, next to the medical store. The landlord lives upstairs and is reasonable about repairs. Suitable for two sisters, or a postgraduate student with family.",
     11500, 2, 'FEMALE', 'Fazlatun, Jashore', 'ফজলতুন, যশোর', 1.6,
     ['Separate entrance', 'Own kitchen', 'Parking', 'Ground floor', 'Mosque nearby'], '+880 1933-404040', 'AVAILABLE'),
]

RIDE_F = ['actor', 'campus', 'mode', 'title', 'origin', 'destination', 'depart', 'total', 'available', 'fare', 'vehicle', 'notes', 'status']
RIDE = [
    ('tanvir.du', 'DU', 'CARPOOL', 'Mirpur 10 to Nilphamar (DU gate) — 3 seats, morning',
     'Mirpur 10 Bus Stand (opposite Shah Ali Mosque)', "Dhaka University Central Students' Hall (TSC)", '+2 hours', 4, 3, 120,
     'Toyota Aqua — ঢাকা MA-KA 1123', 'Leaves exactly on time. One suitcase fits in the trunk; no smoking inside the car.', 'OPEN'),
    ('farhana.buet', 'BUET', 'CARPOOL', 'Farmgate to BUET Gate 3 morning carpool (Sun-Thu)',
     'Farmgate, Mirpur Avenue side', 'BUET Gate 3, Sheikh Mizibur Rahman Road', '+1 day', 4, 4, 60,
     'Nissan Sunny — ঢাকা BA-1122 (2019, AC works)', 'Four seats including the driver, so three students split fuel. I drive; the fare is the petrol share, not profit.', 'FULL'),
    ('mehedi.ru', 'RU', 'BUS', 'Motihar Hall gate to Puja Market shared CNG (evening)',
     'Motihar Hall Main Gate, RU', 'Rajshahi Puja Market Bus Stand', '+3 hours', 3, 2, 20,
     'Easy CNG, green plate — driver Imrul (01711-000022)', "Usually leaves 6:15pm after the hall library closes. Two more can join if seats are free.", 'OPEN'),
    ('imran.cu', 'CU', 'MICROBUS', 'Agrabad to CU main gate via CRB (morning microbus share)',
     'Agrabad CDA Avenue 2 No. Bus Stop', 'Chittagong University Main Gate, Kulagaon Road', '+1 day', 12, 5, 25,
     "Chattogram University Shomoy (white board on the windscreen)", 'Student rate Tk 25, general passengers pay Tk 40. Departs Agrabad at 8:00am sharp.', 'OPEN'),
    ('rafiul.sust', 'SUST', 'TRAIN', 'Sylhet to Rajshahi overnight train — sharing the station taxi',
     'Sylhet Railway Station', 'Rajshahi Railway Station (then JUST campus van)', '+5 days', 2, 2, 950,
     'Parbat Express, coach GA, seats 12 and 13', "I have two berths and need one person to split the station-to-campus CNG. Ticket is booked in my name; bring your NID for the ticket check.", 'OPEN'),
    ('alamin.just', 'JUST', 'BUS', 'Jashore road entry to JUST campus gate (rickshaw share, morning)',
     'Jashore Bus Stand (new)', 'JUST Campus Gate, Fazlatun', '+2 days', 4, 3, 40,
     'Two rickshaws; van-rickshaw for luggage', 'Meets the 7:40am bus from Kushtia. If the bus is late we wait at the stand, not on the road.', 'OPEN'),
]

# ---------------------------------------------------------------- alumni / careers
ALUMNI_F = ['actor', 'campus', 'year', 'degree', 'employer', 'title', 'industry', 'city', 'linkedin', 'referrals', 'mentor']
ALUMNI = [
    ('mahmudul.alumni', 'DU', 2018, 'MBA in Accounting — DU', 'bKash', 'Senior Manager, Financial Operations', 'Fintech',
     'Dhaka', 'https://www.linkedin.com/in/demo-alumni-du-2018', True, True),
    ('sadia.alumni', 'BUET', 2019, 'B.Sc. in CSE — BUET', 'Pathao', 'Backend Engineer (Go)', 'Software', 'Dhaka',
     'https://www.linkedin.com/in/demo-alumni-buet-2019', True, True),
    ('nayeem.alumni', 'RU', 2017, 'B.A. (Honours) in Economics — RU', 'Dutch-Bangla Bank PLC', 'Assistant VP, SME Credit',
     'Banking', 'Rajshahi', 'https://www.linkedin.com/in/demo-alumni-ru-2017', True, False),
    ('rumana.alumni', 'CU', 2020, 'M.Sc. in Finance — CU', 'BRAC', 'Research Officer, Urban Health', 'Development',
     'Chattogram', 'https://www.linkedin.com/in/demo-alumni-cu-2020', False, True),
    ('kamrul.alumni', 'SUST', 2016, 'B.Sc. in IPE — SUST', 'Summit Group', 'Deputy Manager, Power Plant Operations',
     'Energy', 'Sylhet', 'https://www.linkedin.com/in/demo-alumni-sust-2016', True, True),
    ('sharmin.alumni', 'JUST', 2021, 'BBA — JUST', 'Grameenphone', 'Associate, Digital Marketing', 'Telecom', 'Dhaka',
     'https://www.linkedin.com/in/demo-alumni-just-2021', True, True),
]

CAREERS_F = ['actor', 'campus', 'kind', 'company', 'title', 'desc', 'location', 'remote', 'salary', 'url', 'deadline_off', 'status']
CAREERS = [
    ('mahmudul.alumni', 'DU', 'REFERRAL', 'bKash', 'Software Engineer I (referral by Mahmudul Hasan, DU 2018)',
     "Two openings on my team for graduates who can write SQL properly and are not frightened of a legacy Java service. I forward CVs to the hiring manager myself, which beats the portal queue — but send one CV, not five versions of it.",
     'Dhaka (Motijheel office)', False, 'BDT 90,000 - 140,000', 'https://www.bkash.com/en/careers', '+21 days', 'OPEN'),
    ('sadia.alumni', 'BUET', 'FULL_TIME', 'Pathao', 'Backend Engineer (Go) — Mobility Platform',
     "We are splitting the ride-matching monolith, so this is real distributed-systems work rather than CRUD. If you have shipped a service with graceful degradation under load, tell me which part was hard. Relocation help is available from Sylhet or Chattogram.",
     'Dhaka (Banani)', False, 'BDT 120,000 - 190,000', 'https://pathao.com/careers', '+14 days', 'OPEN'),
    ('nayeem.alumni', 'RU', 'INTERNSHIP', 'Dutch-Bangla Bank PLC', 'Graduate Management Trainee Officer (GMTO) — 2026 batch',
     "Six months of paid training with branch rotation and a real appraisal at the end. For RU and north-zone students: the written test is English plus arithmetic under time pressure, and the interview mostly checks whether you know what a CRR is. I can share the pattern, never the answers.",
     'Rajshahi / Dhaka', False, 'BDT 60,000 stipend', 'https://www.dutchbanglabank.com/Careers', '+30 days', 'OPEN'),
    ('rumana.alumni', 'CU', 'PART_TIME', 'BRAC', 'Research Assistant (Urban Health) — part-time',
     "Data collection and cleaning for a maternal-health study in Chattogram city corporations. Twenty hours a week: fieldwork on Tuesdays and Thursdays, and you will learn REDCap properly. Suited to CU public health, statistics or economics students.",
     'Chattogram', False, 'BDT 22,000 per month', 'https://www.brac.net/career', '+10 days', 'OPEN'),
    ('kamrul.alumni', 'SUST', 'CONTRACT', 'Summit Group', 'Junior SCADA & Automation Engineer (12-month contract)',
     "Plant-floor contract role with an extension possible. Day shift with some night calls when a trip happens. If you are a SUST IPE or EEE student who is not bothered by turbine noise, this is where you actually learn control systems instead of reading about them.",
     'Sylhet (power plant)', False, 'BDT 65,000 - 80,000', 'https://www.summitgroup.org/career', '+18 days', 'OPEN'),
    ('sharmin.alumni', 'JUST', 'REFERRAL', 'Grameenphone', 'Associate, Digital Marketing (referral by Sharmin Nahar, JUST 2021)',
     "GP's graduate intake for the digital team. I can put a word after the assessment, not before it. Do the online test seriously — that is the stage most applicants skip. Meta or Google certifications help but are not required.",
     'Dhaka (Banani)', True, 'BDT 75,000 - 95,000', 'https://www.grameenphone.com/careers', '+25 days', 'OPEN'),
]

# ---------------------------------------------------------------- dining
MENUS_F = ['actor', 'campus', 'hall_name', 'name_en', 'name_bn', 'meal', 'window', 'date_off', 'items']
MENUS = [
    ('tanvir.du', 'DU', 'Fazlul Huq Muslim Hall', 'Fazlul Huq Muslim Hall Mess — Lunch', 'ফজলুল হক মুসলিম হল মেস — দুপুরের খাবার',
     'LUNCH', '13:00 - 15:00', '+1 day',
     [('Sada bhat (rice, 400g)', 'সাদা ভাত', 12, True, True), ('Daal', 'ডাল', 8, True, True),
      ('Beef curry with aloo', 'গরুর মাংস (আলু সহ)', 45, True, False), ('Salad and green chilli', 'সালাদ ও কাঁচা মরিচ', 5, True, True),
      ('Mishti (roshomalai)', 'মিষ্টি (রসমালাই)', 12, True, True)]),
    ('sabbir.buet', 'BUET', 'Shahid Smriti Hall', 'Shahid Smriti Hall Cafeteria — Dinner', 'শহীদ স্মৃতি হল ক্যাফেটেরিয়া — রাতের খাবার',
     'DINNER', '19:00 - 21:30', '+1 day',
     [('Chicken biryani (hall rate)', 'চিকেন বিরিয়ানি (হল রেট)', 90, True, False),
      ('Tehari with egg', 'তেহারি (ডিম সহ)', 70, True, False), ('Soup and salad', 'স্যুপ ও সালাদ', 15, True, True),
      ('Borhani (bottle)', 'বোরহানি (বোতল)', 25, True, True)]),
    ('mehedi.ru', 'RU', 'Motihar Hall', 'Motihar Hall Dining — Breakfast', 'মোতিহার হল ডাইনিং — সকালের নাস্তা',
     'BREAKFAST', '07:00 - 09:30', '0',
     [('Parata (2 pcs) with daal', 'পরোটা (২টি) ও ডাল', 20, True, True), ('Egg omelette', 'ডিম অমলেট', 15, True, True),
      ('Rusks and tea', 'লাল চা ও রুস্ক', 10, True, True), ('Banana', 'গোলাপী কাঁলা', 8, True, True)]),
    ('imran.cu', 'CU', 'A. F. Rahman Hall', 'A. F. Rahman Hall Cafeteria — Snacks', 'এ. এফ. রহমান হল ক্যাফেটেরিয়া — হালকা নাশতা',
     'SNACKS', '16:00 - 18:30', '0',
     [('Singara (2 pcs)', 'সিঙ্গাড়া (২টি)', 10, True, True), ('Samosa with chutney', 'সমুচা ও চাটনি', 12, True, True),
      ('Cake slice', 'কেক (স্লাইস)', 18, True, True), ('Cup tea', 'কপ টি', 7, True, True)]),
    ('rafiul.sust', 'SUST', 'Shah Paran Hall', 'Shah Paran Hall Mess — Lunch', 'শাহ পরান হল মেস — দুপুরের খাবার',
     'LUNCH', '12:30 - 14:30', '+1 day',
     [('Bhat (rice)', 'ভাত', 10, True, True), ('Daal with onion', 'ডাল (পেঁয়াজ সহ)', 9, True, True),
      ('Rui fish curry', 'মাছ ভর্তা (রুই)', 55, True, False), ('Aloo bhorta', 'আলু ভর্তা', 8, True, True),
      ('Seasonal fruit', 'মৌসুমি ফল', 10, True, True)]),
    ('alamin.just', 'JUST', None, 'JUST Central Cafeteria — Lunch', 'জইস্ট কেন্দ্রীয় ক্যাফেটেরিয়া — দুপুরের খাবার',
     'LUNCH', '12:00 - 15:00', '+2 days',
     [('Rice with chicken curry', 'চিকেন কারি ভাত', 80, True, False), ('Vegetable khichuri', 'সবজি খিচুড়ি', 60, True, True),
      ('Bottle water', 'পানির বোতল', 15, True, True), ('Yogurt', 'দই', 20, True, True)]),
]

# ---------------------------------------------------------------- lost & found
LOST_F = ['actor', 'campus', 'kind', 'title', 'desc', 'category', 'keywords', 'location', 'age_days', 'contact', 'status']
LOST = [
    ('nusrat.du', 'DU', 'LOST', 'DU student ID card — CSE third year',
     "My university ID is missing since Saturday evening; last used at the central library issue counter. There is a photo on the card. If you found it, please hand it to the library desk or message me — I need it for the exam form submission.",
     'ID Card', ['DU ID', 'library', 'CSE'], 'Central Library, Dhaka University', 2,
     'Call 01712-345678, or leave it at the library return desk with my name.', 'OPEN'),
    ('tanvir.du', 'DU', 'FOUND', 'Casio fx-991EX calculator near the TSC shade',
     "Found a black scientific calculator on the TSC bench yesterday evening. There is no name inside the cover, so it goes back to whoever can describe the sticker on the battery lid. Keeping it with me until the exam starts.",
     'Gadget', ['calculator', 'Casio', 'TSC'], 'TSC, Dhaka University', 1,
     'Tell me the sticker or the mark on the case and it is yours.', 'OPEN'),
    ('farhana.buet', 'BUET', 'LOST', 'Blue steel bottle and a key pouch (CSE lounge to hall gate)',
     "Lost a light blue steel bottle with a small cloth pouch holding my room key and two locker keys. It probably fell off the bicycle between the CSE lounge and the hall gate. Please return the keys — I will pay for a new set, I only need the locker one.",
     'Keys', ['keys', 'bottle', 'hall locker'], 'CSE Lounge to Sher-e-Bangla Hall gate, BUET', 1,
     'Leave it with the hall gate guard for Farhana, Sony Hall fourth floor.', 'OPEN'),
    ('mehedi.ru', 'RU', 'FOUND', "Men's wallet with NIC and a bKash card — Puja Market",
     "Found a brown wallet near the Puja Market tea stall with a NIC and a bKash card inside. Cash is untouched and I have not counted it in front of anyone. State the name on the NIC and I will hand it over at the RU Security Office with a written record.",
     'Wallet', ['wallet', 'NIC', 'Puja Market'], 'Puja Market, Rajshahi', 3,
     "Handover only at the RU Security Office after a description matches.", 'OPEN'),
    ('imran.cu', 'CU', 'LOST', 'Grey laptop sleeve with the Data Structures notebook inside',
     "Left my laptop sleeve on the third floor of the CRB building during the break: grey with a red zip, and inside is a hand-written Data Structures notebook that matters more to me than the laptop. Please check under the chairs near the stairway.",
     'Bag', ['laptop sleeve', 'notebook', 'CRB'], 'CRB Building third floor, CU', 2,
     'Call 01819-220011 any time; reward for the notebook.', 'OPEN'),
    ('rafiul.sust', 'SUST', 'FOUND', 'Red Phoenix bicycle locked near Ayesha Siddiqa Hall gate',
     "A red Phoenix cycle has been locked to the same pole outside Ayesha Siddiqa Hall gate since 21 October with nobody claiming it. I reported it to the hall office and they asked me to post it here too, because students go home for Eid and forget cycles.",
     'Cycle', ['Phoenix', 'cycle', 'Ayesha Siddiqa Hall'], 'Ayesha Siddiqa Hall gate, SUST', 13,
     "Claim at the hall office with the lock key and the purchase token.", 'OPEN'),
]

# ---------------------------------------------------------------- sports
CHALLENGES_F = ['actor', 'campus', 'team', 'sport', 'title', 'desc', 'date_off', 'venue', 'status']
CHALLENGES = [
    ('tanvir.du', 'DU', 'DU Cricket Club', 'Cricket', 'Ten-over challenge: DU CC open to any campus team',
     "We are one bowler short and looking for a full side for Sunday morning at the central playground. New ball, our umpire, tea break after five overs. Tell me your strongest batter honestly so we do not end up with a forty-run game.",
     '+5 days', 'DU Central Playground', 'OPEN'),
    ('sabbir.buet', 'BUET', 'Shahid Smriti Hall Football XI', 'Football', 'Five-a-side football at the BUET indoor — Sunday 4pm',
     "Three players needed to close the squad, from any hall. We play 4pm to 6pm and split the court fee. Boots are useful because the artificial grass is worn on one side.",
     '+3 days', 'BUET Sports Complex', 'OPEN'),
    ('mehedi.ru', 'RU', 'RU Badminton Group', 'Badminton', 'Doubles challenge — court 2, RU Sports Club',
     "Open doubles challenge for RU students, mixed pairs allowed. Two shuttlecocks per team; the court is booked till 8pm and the losing side buys tea. Last week fourteen people came for four courts, so come early or wait on the second list.",
     '+2 days', 'Rajshahi University Sports Club', 'ACCEPTED'),
    ('imran.cu', 'CU', 'CUET Table Tennis Team', 'Table Tennis', 'Inter-hall table tennis open challenge — seeding Saturday',
     "The hall sports committee seeds the open draw on Saturday at 10am in the indoor stadium. Registration is Tk 30 and it goes to the new-nets fund. If you can hold a bat straight, come — the inter-hall trophy has sat in A. F. Rahman Hall for two years.",
     '+4 days', 'CU Indoor Stadium', 'OPEN'),
    ('rafiul.sust', 'SUST', 'Shah Paran Hall Cricket', 'Cricket', 'Sunday 3pm at North Field — net session, need eleven',
     "We need eleven and three bowlers who will actually run in. Bring your own bat if you have one; we have three spare bats and a box of balls. Also looking for a scorer who can keep a scorebook without arguing about no-balls.",
     '+2 days', 'SUST North Field', 'PLAYED'),
    ('alamin.just', 'JUST', 'JUST Football Friends', 'Football', 'Seven-side friendly at Knowledge City ground',
     "Open to every department; if the numbers are uneven we mix the teams on the spot. Goalkeeper is fixed for us this time. Bring a team from another JUST club? Message me first so we can book the ground properly.",
     '+6 days', 'Rajshahi Knowledge City Ground', 'OPEN'),
]

TEAMS_F = ['actor', 'campus', 'name', 'sport', 'level', 'roles', 'desc', 'contact', 'status']
TEAMS = [
    ('tanvir.du', 'DU', 'DUCC selection trial squad', 'Cricket', 'INTERMEDIATE', ['Opening batter', 'Left-arm pacer', 'Wicket-keeper'],
     "Trials for the DUCC third team. Practice Tuesday and Thursday at 4pm on the central playground. Mention any inter-college tournament you have played — that is the only thing separating the two lists right now.",
     'Any time after 4pm on practice days', 'OPEN'),
    ('farhana.buet', 'BUET', 'Sony Hall futsal team', 'Futsal', 'BEGINNER', ['Two pivots', 'Backup keeper'],
     "Hall-level futsal on Wednesdays and Saturdays. Beginners welcome, because half of us learned the offside rule at the last hall fest. We split the court fee among whoever shows up, so turning up is more useful than being good.",
     'Saturdays 5pm', 'OPEN'),
    ('mehedi.ru', 'RU', 'RU chess & badminton evening group', 'Badminton', 'ANY', ['Doubles partners', 'Shuttle sponsor'],
     "We are not a club, just twenty students who play every evening. I need two people who can commit to doubles because I keep running out of partners halfway through the session.",
     'Evenings before 8pm', 'OPEN'),
    ('imran.cu', 'CU', 'CUET volleyball team', 'Volleyball', 'INTERMEDIATE', ['Libero', 'Opposite hitter'],
     "University team selection from the hall tournament list. We run on the sand court behind CRB — bring shoes you do not mind, and water, because there is no tap at that end.",
     'Sunday and Wednesday 3pm', 'FULL'),
    ('sabrina.sust', 'SUST', 'IPE night runners', 'Athletics', 'ANY', ['Pacers at 6 min/km'],
     "Not a team, a running group: five kilometres around the SUST lake at 6:30pm before it gets dark. Anyone who can hold a six-minute pace for two of the three loops is useful as a pacer, and that is the only requirement.",
     'Daily 6:30pm', 'OPEN'),
    ('tahmina.just', 'JUST', 'JUST women\'s badminton', 'Badminton', 'BEGINNER', ['Two more regulars', 'A coach if you know one'],
     "JUST women students only; court time is booked on Thursday evenings. We are four and we want six so we can play doubles without borrowing partners from the men's list.",
     'Thursday 5-7pm', 'OPEN'),
]

# ---------------------------------------------------------------- donations
CAMPAIGNS_F = ['actor', 'campus', 'title', 'cause', 'story', 'target', 'raised', 'donors', 'deadline_off', 'verified', 'status']
CAMPAIGNS = [
    ('rifat.du', 'DU', 'Monsoon relief for DU students from Kurigram', 'Flood relief',
     "Twenty-one students in our department lost stored grain and furniture to Jamuna erosion. The hall union is sending Tk 5,000 per family, and the disbursement list stays on the notice board with each receipt photographed. Nobody is asked to post a sad photograph; donor names appear in the ledger only if the donor wants them there.",
     350000, 214500, 96, '+25 days', True, 'ACTIVE'),
    ('sabbir.buet', 'BUET', 'Shahid Smriti Hall common room fans and lights', 'Hall infrastructure',
     "Six ceiling fans and twelve tube lights in the common room have been dead since summer, and the hall office has no budget head for it. Students pooled money for the water purifier last term and it was finished in eleven days, so we are doing that again. The contractor quote is attached to the ledger.",
     120000, 71500, 41, '+15 days', True, 'ACTIVE'),
    ('sumaiya.ru', 'RU', 'Emergency medical fund — RU student with dengue', 'Medical emergency',
     "A third-year Bangla department student is in the ICCU with severe dengue and his family cannot cover the platelet and monitoring costs past Thursday. The hall office will pay the hospital directly and post the discharge bill, so no cash passes through any student's hands.",
     200000, 182000, 118, '+2 days', True, 'ACTIVE'),
    ('farzana.cu', 'CU', 'Registration and books support for 40 CU Commerce students', 'Scholarship fund',
     "Forty students in our department could not register this term because they were Tk 3,000 to 6,000 short. We cover registration plus the used-book set, and the department's financial officer verifies the income certificate before any disbursement.",
     150000, 43500, 27, '+40 days', True, 'ACTIVE'),
    ('rafiul.sust', 'SUST', 'SUST char-area students mess support (closed)', 'Flood relief',
     "Completed and closed: thirty-four students from the Sunamganj char areas received a month of mess support after the flash flood. The final receipts are in the ledger, and the Tk 8,400 surplus was moved to the next campaign with donors' consent rather than refunded across a hundred and forty small donors.",
     250000, 250000, 152, '-4 days', True, 'COMPLETED'),
    ('tahmina.just', 'JUST', 'Blankets and warm clothes for day scholars', 'Winter relief',
     "Day-scholar students cycle twelve kilometres at six in the morning in January. Forty blankets and thirty sweaters are needed. Collection points are the central library desk and the BBA counter; the distribution list is checked against the day-scholar register so this does not quietly become a giveaway.",
     90000, 12500, 25, '+30 days', False, 'ACTIVE'),
]

DONATION_TRIO = [
    ('tanvir.du', 2500, 'From the CSE batch 22 floor of Fazlul Huq Muslim Hall.', False, 'CONFIRMED'),
    ('farhana.buet', 1000, None, True, 'CONFIRMED'),
    ('mehedi.ru', 500, 'Small amount this month, sorry. Please keep posting the receipts.', False, 'PLEDGED'),
]

# ---------------------------------------------------------------- marketplace
MARKET_F = ['actor', 'campus', 'kind', 'title', 'category', 'price', 'condition', 'desc', 'tags', 'negotiable', 'views']
MARKET = [
    ('tanvir.du', 'DU', 'SELL', 'Casio fx-991EX calculator (2025 exam edition)', 'Books & Stationery', 1400, 'Good',
     "Used for one admission season. The screen has a small scratch at the bottom that does not affect reading, and the battery cover is tight with no rattle. Handover at the TSC shade after 1pm.",
     ['calculator', 'admission', 'Casio'], False, 214),
    ('nusrat.du', 'DU', 'SELL', 'Second-hand HSC English textbook set (1st and 2nd paper)', 'Books & Stationery', 350, 'Fair',
     "Four books, no missing pages, some pencil notes in the grammar chapters which honestly help more than the books do. Collect from Begum Fazilatunnesa Mujib Hall gate; I am free after Asr.",
     ['HSC', 'English', 'textbook'], False, 96),
    ('sabbir.buet', 'BUET', 'RENT', 'Cycle for the semester (Phoenix, monthly rent)', 'Bicycle', 500, 'Good',
     "Monthly rent with a lock and one spare tube included; deposit Tk 2,000 returned at the end of the semester. Ideal for the BUET-Farmgate stretch. Pickup from the Sher-e-Bangla Hall cycle stand.",
     ['cycle', 'rent', 'phoenix'], True, 331),
    ('farhana.buet', 'BUET', 'SELL', 'Folding study table and chair (barely used)', 'Furniture', 1800, 'Like New',
     "Bought for online classes during leave and never really used. Folds flat so it fits in a CNG. One screw is slightly bent but it holds. I can arrange delivery inside Agargaon for Tk 200.",
     ['study table', 'folding', 'chair'], False, 152),
    ('mehedi.ru', 'RU', 'EXCHANGE', 'HP laptop bag — want a charger pouch instead', 'Gadget', 0, 'Good',
     "Black HP sleeve, padded, zip fine. I only need a small charger pouch, so this is an exchange rather than a sale. Meet at the RU Central Mosque gate after Jummah.",
     ['laptop bag', 'exchange', 'charger'], False, 74),
    ('sumaiya.ru', 'RU', 'WANTED', 'Any working used sewing machine for the mess', 'Furniture', 2500, 'Fair',
     "For the mess — three of us will split it. It must work and be clean; a Singer U2 would be perfect but I will take anything that sews straight. Pickup from Kazla by cycle van.",
     ['sewing machine', 'mess', 'used'], True, 41),
    ('imran.cu', 'CU', 'SELL', 'Second-hand Android tablet (8 inch, 64GB) for classes', 'Electronics', 8500, 'Good',
     "Battery health is around 88 per cent, the screen protector has been on since day one, and there is one corner dent you can feel. Comes with a stand and the original charger. Slightly negotiable after CU gate 2.",
     ['tablet', 'android', 'classes'], True, 402),
    ('farzana.cu', 'CU', 'SELL', 'Kieso Intermediate Accounting volume 1 + calculator', 'Books & Stationery', 1200, 'Good',
     "Volume 1 plus my Casio. Volume 2 is not included because I still need it for the final. Bundle price for a batchmate, and I will not split the two items.",
     ['accounting', 'kieso', 'calculator'], False, 88),
    ('rafiul.sust', 'SUST', 'SELL', '22-inch LED monitor (working, no dead pixels)', 'Electronics', 5500, 'Good',
     "Bought in 2023 for freelancing; selling because I moved to a laptop-only setup. HDMI and VGA both work, the stand is slightly loose but holds at an angle. Test it in my room before you pay anything.",
     ['monitor', 'LED', 'freelancing'], False, 265),
    ('sabrina.sust', 'SUST', 'WANTED', 'Used gas stove and cylinder for a single room', 'Furniture', 3000, 'Fair',
     "For the room I share with my cousin. It must come with a valid safety sticker — the one I saw at Zindabazar had a leaking valve so I walked away. Can collect by cycle van any evening.",
     ['gas stove', 'cylinder', 'room'], True, 58),
    ('alamin.just', 'JUST', 'SELL', 'Engineering drawing instrument rack (complete)', 'Gadget', 900, 'Like New',
     "Used for one semester of the drawing course, then I got a better set from home. Everything is inside: pens, ruling pens, two pencils and the T-square. Tk 900, no haggling — I know what a new set costs.",
     ['drawing', 'instruments', 'engineering'], False, 112),
    ('tahmina.just', 'JUST', 'EXCHANGE', 'Bangla literature books (RU/CU syllabus, 2022-24)', 'Books & Stationery', 0, 'Good',
     "Eight books from the last three semesters, all annotated. I want class notes for a course I missed, or any good objective English book — fair trade, no cash either way.",
     ['bangla', 'literature', 'exchange'], False, 39),
]

# ---------------------------------------------------------------- reviews
# actor, campus, target_type, target_kind, rating, title, body, tags, verified
REVIEWS_F = ['actor', 'campus', 'target_type', 'target', 'rating', 'title', 'body', 'tags', 'verified']
REVIEWS = [
    ('farzana.cu', 'DU', 'HALL_DINING', 'menu', 3, 'Mess food improved, but the portions shrank',
     "The beef curry is better seasoned than last term and the salad is actually fresh. But the rice quantity dropped and there is no refill line, which is a strange trade for the new rate. Average for hall food; not for Tk 92 a plate.",
     ['Portion', 'Taste', 'Hygiene'], True),
    ('tanvir.du', 'SUST', 'HALL_DINING', 'menu', 5, 'Rui on Thursday is worth the queue',
     "Fish curry with aloo bhorta on Thursday is the reason I stay in the hall instead of eating outside. The kitchen keeps the counter clean and plates are washed in front of you, which killed my biggest complaint from last year.",
     ['Taste', 'Hygiene'], True),
    ('imran.cu', 'BUET', 'MARKETPLACE', 'market', 5, 'Seller told the truth about battery health',
     "The tablet came at 88 per cent as described, and the corner dent was exactly where he said it would be. That matters more than the price. He also waited twenty minutes at the gate because my class overran.",
     ['Honest', 'Patient'], True),
    ('sabbir.buet', 'DU', 'MARKETPLACE', 'market', 4, 'Books as promised, one torn page I noticed after paying',
     "The textbook set was honestly described and the grammar notes are useful. One page is torn in the second paper book. Ask about condition before you agree and it is a five-star listing.",
     ['Fair price'], True),
    ('nusrat.du', 'SUST', 'BLOOD_DONOR', 'donor', 5, 'Arrived in forty minutes and stayed through the transfusion',
     "He said he would come after class and he was there before we finished the paperwork. He stayed through the transfusion, took the donor slip and gave my family a copy. I do not have words for what that did for my father's surgery timing.",
     ['Reliable', 'Urgent', 'Calm'], True),
    ('sabrina.sust', 'RU', 'BLOOD_DONOR', 'donor', 4, 'Genuine donor — bring your own breakfast and time',
     "She came to RMUH at 7am as agreed and donated without anyone chasing her. Only note: the blood bank queue is long and she left without waiting for the tea we arranged. Plan food and an hour either side.",
     ['Punctual'], True),
    ('sumaiya.ru', 'DU', 'ARCHIVE_FILE', 'file', 4, 'Scans are legible; two pages of the 2019 paper are missing',
     "The mid-term solutions alone are worth it for the normalization questions. The 2019 final has two pages photographed twice instead, so I lost twenty minutes working it out. Note it in the description and this is a five.",
     ['Useful', 'Legible'], True),
    ('rafiul.sust', 'BUET', 'ARCHIVE_FILE', 'file', 5, 'The five-year EEE pack saved my spring',
     "Every EEE 211 paper in one folder with the year on the page header. I printed it and worked through Sunday mornings only. Whoever compiled this deserves the upvote rather than a reputation for leaking questions.",
     ['Complete', 'Well organised'], True),
    ('alamin.just', 'SUST', 'ARCHIVE_FILE', 'file', 3, 'Right content, half the pages scanned upside down',
     "Useful sessional guide, but every other page is upside down and there is no OCR so searching the PDF does nothing. Fix the scanner settings and re-upload it as version two; the content deserves better.",
     ['Needs re-scan'], False),
    ('mehedi.ru', 'DU', 'EVENT', 'event', 5, 'Packed by 10am and the Wi-Fi actually held',
     "Registration took four minutes and the desk had spare name badges. The part I care about: they promised a hotspot for the live coding session and it held two hundred connections. Tea break on time; one speaker overran; everything else ran to schedule.",
     ['Smooth', 'Good internet'], True),
    ('farhana.buet', 'RU', 'EVENT', 'event', 4, 'The career fair was worth the CV printing money',
     "Eighteen stands, and the two software firms took CVs on the spot instead of pointing at their website. The hall got hot after 1pm and sound feedback ruined the opening speech. Bring printed CVs, not a pen drive.",
     ['Employers actually hiring'], True),
    ('tahmina.just', 'DU', 'TRANSPORTATION', 'ride', 5, 'Left Mirpur 10 exactly on time, no last-minute seat shuffle',
     "He messaged the night before to confirm 7:50, arrived at 7:48, and did not try to squeeze a fifth person in after we were seated. AC worked, no music at volume, and the split was Tk 120 as listed.",
     ['Punctual', 'Fair split'], True),
    ('rafiul.sust', 'CU', 'TRANSPORTATION', 'ride', 3, 'Tk 25 is fair, but he stopped twice for more passengers',
     "The student rate is real and the microbus is the university one, but he picked up two more people at CRB and we reached the gate late for an 8:30 class. If you take this for a morning exam, sit at the front and be ready.",
     ['Cheap', 'Delayed'], False),
    ('imran.cu', 'DU', 'HOUSING', 'housing', 5, 'The room matched the photos; geyser fixed the same day',
     "Moved into the Mirpur mess and the listing hid nothing, including the lift that works half the day. The geyser stopped on my second night and the plumber came by lunch. Rent was what the post said, with no surprise 'utility extra' at the end.",
     ['Honest listing', 'Responsive'], True),
    ('mehedi.ru', 'CU', 'HOUSING', 'housing', 4, 'Good PG for a commerce student — the curfew is real',
     "Attached bath is clean, dinner is on time, and the owner does not interrogate you about class schedules. The 10pm curfew is enforced: my friend came at 10:20 and had to call down. Know that before you take it if labs run late.",
     ['Safe', 'Quiet'], True),
    ('sabbir.buet', 'SUST', 'TUTORING', 'skill', 5, 'Two months of evening classes; calculus C to A-',
     "He did not just solve problems — he made me close the book and re-derive the same integral on the whiteboard until it stopped looking like magic. Sessional prep was honest about what the department actually asks. Worth every taka.",
     ['Explains clearly', 'Exam focused'], True),
    ('farzana.cu', 'RU', 'TUTORING', 'skill', 4, 'IELTS speaking practice that does not waste your hour',
     "We spoke every class, he cut me off when I rambled and gave a band estimate with the reason. Writing Task 2 feedback came back inside two days with corrections in the document, not in chat. The room is basic, which is fine.",
     ['Speaking', 'Fast feedback'], True),
    ('nusrat.du', 'RU', 'LOST_AND_FOUND', 'lost', 5, 'Wallet returned with every taka and the NIC inside',
     "He could have taken the cash and thrown the wallet in Padra; instead he posted it the same night and handed it over at the security office with a written record. He refused the Tk 500 reward and said it is his hall's rule, which I do not believe, but fine.",
     ['Trustworthy'], True),
    ('alamin.just', 'DU', 'LOST_AND_FOUND', 'lost', 4, 'Got the calculator back after describing the sticker',
     "The finder asked what sticker was inside the battery lid instead of handing it to the first person who messaged. That is a small thing and it is the whole point of a found post. Meet-up at TSC took two minutes.",
     ['Careful'], True),
    ('shahriar.mentor', 'DU', 'CLUBS', 'club', 5, 'The society actually runs its own workshops',
     "I joined for the CV line and stayed because the Tuesday sessions are taught by final-year students who remember the coursework. No gatekeeping against non-CSE people, and the room booking was handled without me chasing anybody.",
     ['Welcoming'], False),
    ('sumaiya.ru', 'BUET', 'NOTICE_BOARD', 'notice', 4, 'A dated notice board beats the WhatsApp group',
     "Mess rate changes and gate timings stopped being rumours because they are posted with a date and a source. One improvement: push a notification for ration changes — half the hall still learns them two days late at the canteen.",
     ['Accurate'], True),
]

# ---------------------------------------------------------------- governance / clubs
GOV_F = ['campus', 'title', 'body', 'audience', 'age_days']
GOV = [
    ('DU', 'Autumn 2026 academic calendar and class start date',
     "Classes for all honours and degree programmes begin on 6 December 2026. Registration for the shortened first semester runs 24 November to 3 December through the department office; no extension will be granted for late fee payment. Hall residents moving in on the notified dates must carry the hall allotment letter.",
     'STUDENTS', 2),
    ('BUET', 'Hall mess ration rate revised effective 1 December',
     "The hall administration committee has set the per-plate lunch rate at Tk 92 and dinner at Tk 88, with mess accounts published monthly on each hall notice board. Students in arrears beyond two months must clear the balance before next-term registration; an installment option exists at the accounts desk.",
     'RESIDENTS', 4),
    ('RU', 'No academic activity on 14 and 15 November (notified public holiday)',
     "In observance of the notified public holiday, all classes, labs and sessional assessments stand cancelled on 14 and 15 November. The central library and the medical centre remain open on reduced hours; hall gates follow the normal weekend schedule. Any make-up class must be approved by the department chairman in advance.",
     'ALL', 6),
    ('CU', 'Lift maintenance in the CRB academic building, 8 to 12 November',
     "Both lifts in the CRB academic building will be out of service from 8 to 12 November for scheduled maintenance; floors one to four are reachable by stairs only. Timetabled classes on higher floors are relocated to the ground-floor halls as listed on the department notice board. Students with mobility difficulty should contact the office of the Vice-Chancellor for arrangements.",
     'ALL', 8),
    ('SUST', 'Heavy rain alert: leaving class early on flooded routes will not be marked absent',
     "The campus disaster management cell instructs teachers not to mark students absent for leaving early when the Kumargaon and Panu ghat roads are waterlogged during the forecast period. Hall administration will arrange extra evening transport from the main gate. Residents should not attempt that route on foot or by bicycle in rising water.",
     'STUDENTS', 10),
    ('JUST', 'Day scholar card issuance and central library entry from 25 October',
     "Day-scholar identity cards for the 2025-26 session are issued from the students' office between 25 October and 8 November, 10:00am to 1:00pm. The card is required for central library entry and for the exam form. Students absent from the printed list should apply through the portal before the deadline.",
     'STUDENTS', 12),
]

CLUB_NOTICES_F = ['actor', 'campus', 'slug', 'title', 'body', 'age_hours']
CLUB_NOTICES = [
    ('tanvir.du', 'DU', 'cse-society', 'Web & Cloud Workshop series starts 18 November',
     "Sessions run every Tuesday at 6pm in the TSC seminar room. Two facilitator slots are still open: if you finished the beginner track and want to teach, send your name with one line on what you would teach. Sign the attendance sheet at the door or the certificate cannot be issued.", 3),
    ('sabbir.buet', 'BUET', 'debate-club', 'Practice rounds every Tuesday 5:30pm — all departments welcome',
     "Bangla parliamentary motion practice this month, English rounds from next week. Bring a printed copy of the motion; we do four rounds and two feedback sessions. Beginners are paired with a senior speaker so the first round is not wasted.", 7),
    ('mehedi.ru', 'RU', 'volunteer-network', 'Blood donation camp at Puja Market on 15 November',
     "We are staffing the camp from 10am to 4pm with the Rajshahi Medical College blood bank and need twelve volunteers in two shifts — two hours each, plus one spare for the registration desk. Volunteers get a certificate from the club, which the hall office accepts for the cultural-activity credit.", 11),
    ('imran.cu', 'CU', 'photography-society', 'Monsoon photowalk to Agrabad, and the annual exhibition call',
     "We walk the old Agrabad streets on Saturday at 6:30am for the light before the heat, ending at the library side. Bring whatever you have — a phone is fine. Prints for the annual exhibition must be submitted by 25 November, three per person maximum, with the location written on the back.", 15),
    ('rafiul.sust', 'SUST', 'cse-society', 'ICPC intra bootcamp and sessional project showcase',
     "Three practice contests before the intra, Saturday mornings in the CSE lab, and the judges for the project showcase are final-year students plus one faculty. Register a team of three with a name; teams that miss a practice contest are not seeded, and we cannot make exceptions because the online judge queue gets jammed.", 19),
    ('tahmina.just', 'JUST', 'debate-club', 'Intra-JUST Bangla debate trials — motion released now',
     "The motion is published on the club notice so you can prepare for a week instead of an hour. Trials are on Thursday at 3pm in the seminar hall; eight speakers maximum this round because the room holds four podiums. Sign up at the debate club desk with your department and roll number.", 23),
]

#!/usr/bin/env python3
"""Seed generator A: framework, demo identities, feed, events, blood bank, archive."""
import pathlib, re, sys, uuid

NS = uuid.UUID('1b8a6c02-6d4f-4a51-9d3b-8a4a2f0c6d21')
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'seed' / 'seed_demo_content.sql'
stmts, ids = [], {}


def did(key):
    return str(uuid.uuid5(NS, 'campus360-demo:' + key))


def esc(v):
    return "'" + str(v).replace("'", "''") + "'"


def bnesc(v):
    out = []
    for ch in str(v):
        code = ord(ch)
        out.append(("''" if ch == "'" else ch) if code < 128 else '\\%04X' % code)
    return "U&'" + ''.join(out) + "'"


def txt(v):
    if v is None:
        return 'NULL'
    s = str(v)
    return bnesc(s) if any(ord(c) > 127 for c in s) else esc(s)


def arr(items):
    return "'{}'::text[]" if not items else 'ARRAY[' + ', '.join(txt(i) for i in items) + ']::text[]'


def num(v):
    return 'NULL' if v is None else str(v)


def boolv(v):
    return 'true' if v else 'false'


def plain(off):
    return str(off).strip().lstrip('+')


def shift(off, base='now()'):
    s = str(off).strip()
    sign = '-' if s.startswith('-') else '+'
    body = plain(s)
    if body in ('0', ''):
        return f"{base}::date" if base.startswith('current') else f"{base}::timestamptz"
    return f"({base} {sign} interval '{body}')"


def at(off, hour):
    return f"(date_trunc('day', {shift(off)}) + interval '{int(hour)} hours')"


def uid(key):
    return f"'{did(key)}'::uuid"


RENDER = {'txt': txt, 'arr': arr, 'num': num, 'bool': boolv, 'off': lambda v: esc(plain(v)), 'raw': lambda v: v}


def build(table, fields, rows, pairs, select, id_key, updates=None, joins='', author_col='author_id'):
    """pairs -> VALUES payload; select -> INSERT payload (may reference v.*).

    Row length is asserted against `fields`, and every v.<name> referenced in
    `select` must exist in the VALUES alias list, so a rename fails the generator
    instead of silently landing data in the wrong column.
    """
    # Postgres reserves DESC / WINDOW / HOUR, so those cannot be VALUES aliases.
    reserved = {'desc': 'descr', 'window': 'win', 'hour': 'hhour'}
    pairs = [(reserved.get(n, n), k, src) for n, k, src in pairs]
    def _rename(expr):
        for old_name, new_name in reserved.items():
            expr = re.sub(r'\bv\.' + old_name + r'\b', 'v.' + new_name, expr)
        return expr
    select = [(c, _rename(e)) for c, e in select]
    vnames = ['campus_code', 'author_email', 'id'] + [n for n, _, _ in pairs]
    tgt = ['id', 'university_id'] + ([author_col] if author_col else []) + [c for c, _ in select]
    sel = ['v.id', 'u.id'] + (['pr.id'] if author_col else []) + [e for _, e in select]
    body, per = [], []
    for i, raw in enumerate(rows):
        assert len(raw) == len(fields), f'{table}: row {i} has {len(raw)} values for {len(fields)} fields'
        d = dict(zip(fields, raw))
        per.append((d, did(f'{id_key}:{i}')))
        cells = [txt(d['campus']), a(d['actor']), uid(f'{id_key}:{i}')]
        for name, kind, src in pairs:
            value = d[src] if isinstance(src, str) else src(d)
            cells.append(RENDER[kind](value))
        body.append('        (' + ', '.join(cells) + ')')
    refs = set(re.findall(r'\bv\.([a-z_0-9]+)', ' '.join(sel)))
    unknown = refs - set(vnames)
    assert not unknown, f'{table}: select references unknown values {sorted(unknown)}'
    upd = updates if updates is not None else [c for c in tgt if c not in ('id', 'university_id', author_col, 'created_at')]
    stmts.append(
        f"  -- · {table} ({len(rows)} rows)\n"
        f"  INSERT INTO public.{table} ({', '.join(tgt)})\n"
        f"  SELECT {', '.join(sel)}\n"
        f"  FROM (VALUES\n" + ',\n'.join(body) + "\n"
        f"  ) AS v({', '.join(vnames)})\n"
        f"  JOIN public.universities u ON u.code = v.campus_code\n"
        + (f"  JOIN public.profiles pr ON pr.email = v.author_email\n" if (author_col or joins) else '')
        + (joins + '\n' if joins else '')
        + f"  ON CONFLICT (id) DO UPDATE SET {', '.join(c + ' = EXCLUDED.' + c for c in upd)};"
    )
    ids[id_key] = [rid for _, rid in per]
    ids[id_key + '_campus'], ids[id_key + '_actor'] = {}, {}
    for d, rid in per:
        ids[id_key + '_campus'].setdefault(d['campus'], rid)
        ids[id_key + '_actor'].setdefault(d['actor'], rid)
    return per


# ---------------------------------------------------------------- 1 · identities
person_cells = []
for code, en, bn, campus, dept, prog, hall, sid in PEOPLE:
    person_cells.append('        (%s, %s, %s, %s, %s, %s, %s, %s, %s)' % (
        uid('person:' + code), a(code), txt(en), txt(bn), txt(campus), txt(hall), txt(dept), txt(prog), txt(sid)))

stmts.append("""  -- ---------------------------------------------------------------------
  -- 1 · demo identities: 13 students, 3 senior mentors, 6 alumni.
  --
  -- Passwords are crypt(md5(random())) — deliberately unknowable. The repo's
  -- seed_users_demo_accounts.sql mints accounts with the published password
  -- Demo#1234, which is right for local/staging and wrong for a live project
  -- (anyone could then sign in as student.du@du.ac.bd). So demo content here is
  -- authored by identities nobody can log into.
  -- ---------------------------------------------------------------------
  DROP TABLE IF EXISTS tmp_person;
  CREATE TEMP TABLE tmp_person (
    id uuid PRIMARY KEY, email text, full_name_en text, full_name_bn text,
    campus_code text, hall_name text, dept_code text, prog_code text, student_id text
  ) ON COMMIT DROP;
  INSERT INTO tmp_person (id, email, full_name_en, full_name_bn, campus_code, hall_name, dept_code, prog_code, student_id)
  VALUES
""" + ',\n'.join(person_cells) + ";")

stmts.append("""  INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
    )
  SELECT '00000000-0000-0000-0000-000000000000'::uuid, p.id, 'authenticated', 'authenticated',
    p.email, crypt(md5(random()::text || clock_timestamp()::text), gen_salt('bf')), now(),
    '{"providers":["email"],"roles":["authenticated"]}'::jsonb,
    jsonb_build_object('full_name', p.full_name_en, 'onboarded', true, 'demo_seed', 'seed_demo_content.sql'),
    now(), now(), false, false
  FROM tmp_person p
  ON CONFLICT (id) DO NOTHING;""")

stmts.append("""  INSERT INTO public.profiles (
      id, university_id, department_id, program_id, hall_id, email, full_name, student_id,
      preferred_language, trust_level, terms_accepted_at, privacy_accepted_at,
      guidelines_accepted_at, onboarding_completed, created_at, updated_at
    )
  SELECT p.id, u.id, dep.id, prog.id, hall.id, p.email, COALESCE(p.full_name_bn, p.full_name_en),
    p.student_id, 'bn',
    CASE WHEN p.prog_code IN ('MASTERS', 'MASTERS_FINAL') THEN 'TRUSTED'::public.trust_level
         ELSE 'ID_VERIFIED'::public.trust_level END,
    now(), now(), now(), true, now(), now()
  FROM tmp_person p
  JOIN public.universities u ON u.code = p.campus_code
  LEFT JOIN public.departments dep ON dep.university_id = u.id AND dep.code = p.dept_code
  LEFT JOIN public.academic_programs prog ON prog.code = p.prog_code
  LEFT JOIN LATERAL (
    SELECT h.id FROM public.university_halls h
    WHERE h.university_id = u.id AND h.is_active AND p.hall_name IS NOT NULL AND h.name = p.hall_name
    LIMIT 1
  ) hall ON true
  ON CONFLICT (id) DO UPDATE SET university_id = EXCLUDED.university_id,
    department_id = EXCLUDED.department_id, program_id = EXCLUDED.program_id,
    hall_id = EXCLUDED.hall_id, full_name = EXCLUDED.full_name,
    trust_level = EXCLUDED.trust_level, onboarding_completed = true, updated_at = now();""")

stmts.append("""  INSERT INTO public.user_roles (user_id, university_id, role)
  SELECT p.id, u.id, 'STUDENT'::public.app_role
  FROM tmp_person p JOIN public.universities u ON u.code = p.campus_code
  ON CONFLICT DO NOTHING;""")

# ---------------------------------------------------------------- 2 · feed
build('posts', POSTS_F, POSTS, [
    ('tag', 'txt', 'module_tag'), ('title', 'txt', 'title'), ('body', 'txt', 'body'),
    ('pinned', 'bool', 'pinned'), ('likes', 'num', 'likes'), ('comments', 'num', 'comments'),
    ('ago', 'off', 'ago')], [
    ('module_tag', 'v.tag'), ('title', 'v.title'), ('body', 'v.body'),
    ('media_urls', "'{}'::text[]"), ('is_pinned', 'v.pinned'),
    ('likes_count', 'v.likes'), ('comments_count', 'v.comments'),
    ('created_at', '(now() - v.ago::interval)'), ('updated_at', '(now() - v.ago::interval)')], 'post')

# ---------------------------------------------------------------- 3 · events
build('events', EVENTS_F, EVENTS, [
    ('org', 'raw', lambda d: esc(HOST_ORG[d['campus']])),
    ('title_en', 'txt', 'title_en'), ('title_bn', 'txt', 'title_bn'),
    ('desc_en', 'txt', 'desc_en'), ('desc_bn', 'txt', 'desc_bn'), ('cat', 'txt', 'category'),
    ('starts', 'raw', lambda d: at(d['start_off'], d['start_hour'])),
    ('ends', 'raw', lambda d: f"({at(d['start_off'], d['start_hour'])} + interval '{int(d['duration_hours'])} hours')"),
    ('venue', 'txt', 'venue'), ('addr', 'txt', 'address'),
    ('dirs_en', 'txt', 'dirs_en'), ('dirs_bn', 'txt', 'dirs_bn'),
    ('lat', 'num', lambda d: LATLNG[d['campus']][0]), ('lng', 'num', lambda d: LATLNG[d['campus']][1]),
    ('geo', 'num', 'geofence'), ('cap', 'num', 'capacity')], [
    ('host_organization', 'v.org'), ('title_en', 'v.title_en'), ('title_bn', 'v.title_bn'),
    ('description_en', 'v.desc_en'), ('description_bn', 'v.desc_bn'), ('category', 'v.cat'),
    ('is_public', 'true'), ('starts_at', 'v.starts'), ('ends_at', 'v.ends'),
    ('venue_name', 'v.venue'), ('formatted_address', 'v.addr'),
    ('text_directions_en', 'v.dirs_en'), ('text_directions_bn', 'v.dirs_bn'),
    ('lat', 'v.lat'), ('lng', 'v.lng'), ('place_id', "'campus360:demo:' || u.code || '-event'"),
    ('geofence_radius_m', 'v.geo'), ('capacity', 'v.cap'), ('rsvp_required', 'true'),
    ('rsvp_limit', 'v.cap'), ('ticket_price_bdt', '0'),
    ('live_override', "'AUTO'::public.event_live_override"),
    ('created_at', "(now() - interval '4 days')")], 'event', author_col='organizer_id')

# ---------------------------------------------------------------- 4 · rsvps
rsvp_rows = []
for i, raw in enumerate(EVENTS):
    d = dict(zip(EVENTS_F, raw))
    mates = [p[0] for p in PEOPLE if p[3] == d['campus'] and p[0] != d['actor']]
    for j, who in enumerate(mates[:3]):
        rsvp_rows.append((who, d['campus'], str(ids['event'][i]), RSVP_STATUSES[j], str(i)))
build('event_rsvps', ['actor', 'campus', 'event_id', 'status', 'n'], rsvp_rows, [
    ('event_id', 'txt', 'event_id'), ('status', 'txt', 'status')], [
    ('event_id', 'v.event_id::uuid'), ('status', 'v.status'),
    ('reminder_24h_sent', 'false'), ('reminder_1h_sent', 'false')], 'rsvp',
    author_col='user_id', updates=['status'])

# ---------------------------------------------------------------- 5 · blood bank
build('health_donors', DONORS_F, DONORS, [
    ('grp', 'txt', 'group'), ('last', 'txt', 'last_donated'), ('avail', 'bool', 'available'),
    ('phone', 'txt', 'phone'), ('cnt', 'num', 'count')], [
    ('blood_group', 'v.grp'), ('last_donated_at', 'v.last::date'), ('is_available', 'v.avail'),
    ('contact_phone', 'v.phone'), ('verified_donations_count', 'v.cnt')], 'donor', author_col='user_id')

build('blood_requests', BLOOD_F, BLOOD, [
    ('patient', 'txt', 'patient'), ('grp', 'txt', 'group'), ('bags', 'num', 'bags'),
    ('hospital', 'txt', 'hospital'), ('hosp_addr', 'txt', 'hosp_addr'), ('phone', 'txt', 'phone'),
    ('urgency', 'txt', 'urgency'), ('due', 'off', 'due'), ('status', 'txt', 'status')], [
    ('patient_name', 'v.patient'), ('blood_group', 'v.grp'), ('bags_needed', 'v.bags'),
    ('hospital_name', 'v.hospital'), ('hospital_address', 'v.hosp_addr'), ('contact_phone', 'v.phone'),
    ('urgency', 'v.urgency'), ('needed_by', '(now() + v.due::interval)'), ('status', 'v.status'),
    ('created_at', "(now() - interval '1 day')"), ('updated_at', "(now() - interval '1 hour')")], 'blood',
    author_col='requester_id')

resp_rows = []
for raw in RESP:
    d = dict(zip(RESP_F, raw))
    req_i = next(i for i, r in enumerate(BLOOD) if dict(zip(BLOOD_F, r))['campus'] == d['campus'])
    donor_i = next((i for i, r in enumerate(DONORS) if dict(zip(DONORS_F, r))['actor'] == d['actor']), None)
    resp_rows.append((d['actor'], d['campus'], str(ids['blood'][req_i]),
                      str(ids['donor'][donor_i]) if donor_i is not None else None, d['status'], d['message']))
build('blood_request_responses', ['actor', 'campus', 'request_id', 'donor_id', 'status', 'message'], resp_rows, [
    ('request_id', 'txt', 'request_id'), ('donor_id', 'txt', 'donor_id'),
    ('status', 'txt', 'status'), ('message', 'txt', 'message')], [
    ('request_id', 'v.request_id::uuid'), ('donor_id', 'v.donor_id::uuid'),
    ('message', 'v.message'), ('status', 'v.status')], 'resp', author_col='user_id',
    updates=['message', 'status'])

# ---------------------------------------------------------------- 6 · archive
arch_rows = []
for raw in FILES:
    d = dict(zip(FILES_F, raw))
    fname = d['course_code'].replace(' ', '-').lower() + '-' + d['category'].lower().replace('_', '-') + '.pdf'
    arch_rows.append((d['actor'], d['campus'], d['dept'], d['course_code'], d['title'], d['semester'], d['year'],
                      d['category'], d['language'], d['visibility'], d['tags'], fname, d['size_kb'] * 1024,
                      d['views'], d['downloads'], d['age_days']))
build('academic_files',
      ['actor', 'campus', 'dept', 'course_code', 'course_title', 'semester', 'year', 'category', 'language',
       'visibility', 'tags', 'filename', 'size', 'views', 'downloads', 'age_days'], arch_rows, [
    ('dept', 'txt', 'dept'), ('course_code', 'txt', 'course_code'), ('course_title', 'txt', 'course_title'),
    ('semester', 'txt', 'semester'), ('year', 'num', 'year'), ('category', 'txt', 'category'),
    ('language', 'txt', 'language'), ('visibility', 'txt', 'visibility'), ('tags', 'arr', 'tags'),
    ('filename', 'txt', 'filename'), ('size', 'num', 'size'), ('views', 'num', 'views'),
    ('downloads', 'num', 'downloads'), ('age_days', 'num', 'age_days')], [
    ('department_id', '(select dp.id from public.departments dp where dp.university_id = u.id and dp.code = v.dept limit 1)'),
    ('course_code', 'v.course_code'), ('course_title', 'v.course_title'), ('semester', 'v.semester'),
    ('academic_year', 'v.year'), ('category', 'v.category::public.archive_category'),
    ('language', 'v.language'), ('visibility', 'v.visibility::public.content_visibility'),
    ('requires_same_university_verification', "(v.visibility <> 'PUBLIC')"),
    ('license_attribution', txt('CC BY-NC 4.0 — student-contributed material, not an official course document')),
    ('tags', 'v.tags'), ('current_version', '2'),
    ('storage_path', "'archive/' || u.code || '/' || v.filename"),
    ('original_filename', 'v.filename'), ('mime_type', "'application/pdf'"), ('file_size_bytes', 'v.size'),
    ('checksum_sha256', "encode(digest(v.filename || u.code, 'sha256'), 'hex')"),
    ('scan_status', "'CLEAN'::public.virus_scan_status"), ('views_count', 'v.views'),
    ('downloads_count', 'v.downloads'), ('upvotes_count', 'greatest(1, v.downloads / 7)'),
    ('created_at', '(now() - make_interval(days => v.age_days))'),
    ('updated_at', '(now() - make_interval(days => v.age_days))')], 'file', author_col='uploader_id')



#!/usr/bin/env python3
"""Seed generator B: skills, mentorship, housing, transport, careers, dining,
lost & found, sports, donations, marketplace, reviews, notices, counters."""


# sports_challenges.preferred_date is switched depending on its live type.
PREFERRED_DATE = "(now() + v.doff::interval)"

# ---------------------------------------------------------------- 7 · skills
build('skill_postings', SKILLS_F, SKILLS, [
    ('typ', 'txt', 'type'), ('title', 'txt', 'title'), ('desc', 'txt', 'desc'),
    ('cat', 'txt', 'category'), ('skills', 'arr', 'skills'), ('loc_en', 'txt', 'loc_en'),
    ('loc_bn', 'txt', 'loc_bn'), ('avail', 'txt', 'availability'), ('rate', 'num', 'rate'),
    ('remote', 'bool', 'remote'), ('contact', 'txt', 'contact'), ('status', 'txt', 'status'),
    ('applicants', 'num', 'applicants'), ('age_hours', 'num', 'age_hours')], [
    ('type', 'v.typ::public.skill_posting_type'), ('title', 'v.title'), ('description', 'v.desc'),
    ('category', 'v.cat'), ('skills', 'v.skills'), ('location_en', 'v.loc_en'), ('location_bn', 'v.loc_bn'),
    ('availability', 'v.avail'), ('rate_bdt', 'v.rate'), ('is_remote', 'v.remote'),
    ('contact_note', 'v.contact'), ('status', 'v.status'), ('applicants_count', 'v.applicants'),
    ('created_at', '(now() - make_interval(hours => v.age_hours))'),
    ('updated_at', '(now() - make_interval(hours => v.age_hours))')], 'skill')

app_rows = []
for raw in APPS:
    d = dict(zip(APPS_F, raw))
    app_rows.append((d['actor'], d['campus'], str(ids['skill_actor'][d['posting_author']]), d['status'], d['message']))
build('skill_applications', ['actor', 'campus', 'posting_id', 'status', 'message'], app_rows, [
    ('posting_id', 'txt', 'posting_id'), ('status', 'txt', 'status'), ('message', 'txt', 'message')], [
    ('posting_id', 'v.posting_id::uuid'), ('message', 'v.message'), ('status', 'v.status'),
    ('created_at', "(now() - interval '6 hours')")], 'app', author_col='applicant_id',
    updates=['message', 'status'])

build('skill_alerts', ALERTS_F, ALERTS, [
    ('kw', 'arr', 'keywords'), ('cats', 'arr', 'categories')], [
    ('keywords', 'v.kw'), ('categories', 'v.cats')], 'alert', author_col='user_id')

# ---------------------------------------------------------------- 8 · mentorship
build('mentor_profiles', MENTORS_F, MENTORS, [
    ('headline', 'txt', 'headline'), ('exp', 'arr', 'expertise'), ('rate', 'num', 'rate'),
    ('bio', 'txt', 'bio'), ('sessions', 'num', 'sessions'), ('rating', 'num', 'rating')], [
    ('headline', 'v.headline'), ('expertise', 'v.exp'), ('languages', arr(['Bangla', 'English'])),
    ('session_rate_bdt', 'v.rate'), ('bio', 'v.bio'), ('is_accepting', 'true'),
    ('sessions_count', 'v.sessions'), ('rating', 'v.rating')], 'mentor', author_col='user_id')

build('mentorship_slots', SLOTS_F, SLOTS, [
    ('topic', 'txt', 'topic'), ('day_off', 'off', 'day_off'), ('hour', 'num', 'hour'),
    ('capacity', 'num', 'capacity'), ('booked', 'num', 'booked')], [
    ('mentor_id', "(select mp.id from public.mentor_profiles mp where mp.university_id = u.id "
                  "and mp.user_id = (select p9.id from public.profiles p9 where p9.email = v.author_email limit 1) limit 1)"),
    ('topic', 'v.topic'),
    ('starts_at', "(date_trunc('hour', now() + v.day_off::interval) + make_interval(hours => v.hour))"),
    ('ends_at', "(date_trunc('hour', now() + v.day_off::interval) + make_interval(hours => v.hour + 1))"),
    ('capacity', 'v.capacity'), ('booked_count', 'v.booked'), ('is_active', 'true')], 'slot', author_col=None,
    updates=['topic', 'starts_at', 'ends_at', 'capacity', 'booked_count', 'is_active'])

# ---------------------------------------------------------------- 9 · housing + transport
build('housing_listings', HOUSING_F, HOUSING, [
    ('kind', 'txt', 'kind'), ('title', 'txt', 'title'), ('desc', 'txt', 'desc'), ('rent', 'num', 'rent'),
    ('seats', 'num', 'seats'), ('gender', 'txt', 'gender'), ('area_en', 'txt', 'area_en'),
    ('area_bn', 'txt', 'area_bn'), ('dist', 'num', 'dist'), ('amen', 'arr', 'amenities'),
    ('phone', 'txt', 'phone'), ('status', 'txt', 'status')], [
    ('kind', 'v.kind::public.housing_kind'), ('title', 'v.title'), ('description', 'v.desc'),
    ('rent_bdt', 'v.rent'), ('seat_count', 'v.seats'), ('gender_policy', 'v.gender'),
    ('area_en', 'v.area_en'), ('area_bn', 'v.area_bn'), ('distance_km', 'v.dist'),
    ('amenities', 'v.amen'), ('image_urls', "'{}'::text[]"), ('contact_phone', 'v.phone'),
    ('status', 'v.status'), ('created_at', "(now() - interval '2 days')")], 'housing', author_col='owner_id')

build('rideshare_offers', RIDE_F, RIDE, [
    ('mode', 'txt', 'mode'), ('title', 'txt', 'title'), ('origin', 'txt', 'origin'),
    ('dest', 'txt', 'destination'), ('depart', 'off', 'depart'), ('total', 'num', 'total'),
    ('avail', 'num', 'available'), ('fare', 'num', 'fare'), ('vehicle', 'txt', 'vehicle'),
    ('notes', 'txt', 'notes'), ('status', 'txt', 'status')], [
    ('mode', 'v.mode::public.ride_mode'), ('origin', 'v.origin'), ('destination', 'v.dest'),
    ('depart_at', '(now() + v.depart::interval)'), ('seats_total', 'v.total'),
    ('seats_available', 'v.avail'), ('fare_bdt', 'v.fare'), ('vehicle_details', 'v.vehicle'),
    ('notes', '(v.title || chr(10) || v.notes)'), ('status', 'v.status'),
    ('created_at', "(now() - interval '5 hours')")], 'ride', author_col='owner_id')

# ---------------------------------------------------------------- 10 · alumni + careers
build('alumni_profiles', ALUMNI_F, ALUMNI, [
    ('year', 'num', 'year'), ('degree', 'txt', 'degree'), ('employer', 'txt', 'employer'),
    ('title', 'txt', 'title'), ('industry', 'txt', 'industry'), ('city', 'txt', 'city'),
    ('linkedin', 'txt', 'linkedin'), ('refs', 'bool', 'referrals'), ('mentor', 'bool', 'mentor')], [
    ('graduation_year', 'v.year'), ('degree', 'v.degree'), ('employer', 'v.employer'),
    ('job_title', 'v.title'), ('industry', 'v.industry'), ('city', 'v.city'),
    ('country', "'Bangladesh'"), ('linkedin_url', 'v.linkedin'), ('offers_referrals', 'v.refs'),
    ('is_mentor', 'v.mentor')], 'alumni', author_col='user_id')

build('career_opportunities', CAREERS_F, CAREERS, [
    ('kind', 'txt', 'kind'), ('company', 'txt', 'company'), ('title', 'txt', 'title'),
    ('desc', 'txt', 'desc'), ('loc', 'txt', 'location'), ('remote', 'bool', 'remote'),
    ('salary', 'txt', 'salary'), ('url', 'txt', 'url'), ('due', 'off', 'deadline_off'),
    ('status', 'txt', 'status')], [
    ('alumni_id', "(select ap.id from public.alumni_profiles ap where ap.university_id = u.id "
                  "and ap.user_id = (select p9.id from public.profiles p9 where p9.email = v.author_email limit 1) limit 1)"),
    ('kind', 'v.kind::public.career_opportunity_kind'), ('company', 'v.company'), ('title', 'v.title'),
    ('description', 'v.desc'), ('location', 'v.loc'), ('is_remote', 'v.remote'),
    ('salary_range', 'v.salary'), ('apply_url', 'v.url'), ('deadline', '(current_date + v.due::interval)::date'),
    ('status', 'v.status'), ('created_at', "(now() - interval '3 days')")], 'career', author_col=None,
    updates=['kind', 'company', 'title', 'description', 'location', 'is_remote', 'salary_range', 'apply_url',
             'deadline', 'status'])

# ---------------------------------------------------------------- 11 · dining
menu_rows = []
for raw in MENUS:
    d = dict(zip(MENUS_F, raw))
    menu_rows.append((d['actor'], d['campus'], d['hall_name'], d['name_en'], d['name_bn'], d['meal'],
                      d['window'], d['date_off']))
build('cafeteria_menus',
      ['actor', 'campus', 'hall', 'name_en', 'name_bn', 'meal', 'window', 'date_off'], menu_rows, [
    ('hall', 'txt', 'hall'), ('name_en', 'txt', 'name_en'), ('name_bn', 'txt', 'name_bn'),
    ('meal', 'txt', 'meal'), ('window', 'txt', 'window'), ('date_off', 'off', 'date_off')], [
    ('hall_id', "(select h.id from public.university_halls h where h.university_id = u.id and h.name = v.hall limit 1)"),
    ('name_en', 'v.name_en'), ('name_bn', 'v.name_bn'),
    ('serving_date', "(current_date + v.date_off::interval)::date"),
    ('meal', 'v.meal::text'), ('pickup_window', 'v.window'), ('is_active', 'true')], 'menu', author_col=None,
    updates=['name_en', 'name_bn', 'serving_date', 'meal', 'pickup_window', 'is_active'])

item_rows = []
for raw in MENUS:
    d = dict(zip(MENUS_F, raw))
    for (en, bn, price, avail, veg) in d['items']:
        item_rows.append((d['actor'], d['campus'], d['name_en'], en, bn, price, avail, veg))
build('cafeteria_items', ['actor', 'campus', 'menu', 'name_en', 'name_bn', 'price', 'avail', 'veg'], item_rows, [
    ('menu', 'txt', 'menu'), ('name_en', 'txt', 'name_en'), ('name_bn', 'txt', 'name_bn'),
    ('price', 'num', 'price'), ('avail', 'bool', 'avail'), ('veg', 'bool', 'veg')], [
    ('menu_id', "(select cm.id from public.cafeteria_menus cm where cm.university_id = u.id "
                "and cm.name_en = v.menu limit 1)"),
    ('name_en', 'v.name_en'), ('name_bn', 'v.name_bn'), ('price_bdt', 'v.price'),
    ('is_available', 'v.avail'), ('is_vegetarian', 'v.veg')], 'item', author_col=None,
    updates=['name_en', 'name_bn', 'price_bdt', 'is_available', 'is_vegetarian'])

# ---------------------------------------------------------------- 12 · lost & found
build('lost_items', LOST_F, LOST, [
    ('kind', 'txt', 'kind'), ('title', 'txt', 'title'), ('desc', 'txt', 'desc'),
    ('cat', 'txt', 'category'), ('kw', 'arr', 'keywords'), ('loc', 'txt', 'location'),
    ('age_days', 'num', 'age_days'), ('contact', 'txt', 'contact'), ('status', 'txt', 'status')], [
    ('kind', 'v.kind::public.lost_item_kind'), ('title', 'v.title'), ('description', 'v.desc'),
    ('category', 'v.cat'), ('keywords', 'v.kw'), ('location_en', 'v.loc'),
    ('occurred_on', '(current_date - make_interval(days => v.age_days))'),
    ('image_urls', "'{}'::text[]"), ('contact_note', 'v.contact'), ('status', 'v.status'),
    ('created_at', '(now() - make_interval(days => v.age_days))')], 'lost', author_col='reporter_id')

# ---------------------------------------------------------------- 13 · sports
build('sports_challenges', CHALLENGES_F, CHALLENGES, [
    ('team', 'txt', 'team'), ('sport', 'txt', 'sport'), ('title', 'txt', 'title'),
    ('desc', 'txt', 'desc'), ('doff', 'off', 'date_off'), ('venue', 'txt', 'venue'),
    ('status', 'txt', 'status')], [
    ('team_name', 'v.team'), ('sport', 'v.sport'), ('title', 'v.title'), ('description', 'v.desc'),
    ('preferred_date', PREFERRED_DATE), ('venue', 'v.venue'), ('status', 'v.status'),
    ('created_at', "(now() - interval '7 hours')")], 'challenge', author_col='challenger_id')

build('sports_teams', TEAMS_F, TEAMS, [
    ('name', 'txt', 'name'), ('sport', 'txt', 'sport'), ('level', 'txt', 'level'),
    ('roles', 'arr', 'roles'), ('desc', 'txt', 'desc'), ('contact', 'txt', 'contact'),
    ('status', 'txt', 'status')], [
    ('name', 'v.name'), ('sport', 'v.sport'), ('skill_level', 'v.level::text'), ('needed_roles', 'v.roles'),
    ('description', 'v.desc'), ('contact_note', 'v.contact'), ('status', 'v.status'),
    ('created_at', "(now() - interval '3 days')")], 'team', author_col='captain_id')

# ---------------------------------------------------------------- 14 · donations
camp_rows = []
for raw in CAMPAIGNS:
    d = dict(zip(CAMPAIGNS_F, raw))
    sign = '-' if str(d['deadline_off']).startswith('-') else '+'
    camp_rows.append((d['actor'], d['campus'], d['title'], d['cause'], d['story'], d['target'], d['raised'],
                      d['donors'], plain(d['deadline_off']), sign, d['verified'], d['status']))
build('donation_campaigns',
      ['actor', 'campus', 'title', 'cause', 'story', 'target', 'raised', 'donors', 'due', 'sign', 'verified', 'status'],
      camp_rows, [
    ('title', 'txt', 'title'), ('cause', 'txt', 'cause'), ('story', 'txt', 'story'),
    ('target', 'num', 'target'), ('raised', 'num', 'raised'), ('donors', 'num', 'donors'),
    ('due', 'txt', 'due'), ('sign', 'txt', 'sign'), ('verified', 'bool', 'verified'),
    ('status', 'txt', 'status')], [
    ('title', 'v.title'), ('story', 'v.story'), ('cause', 'v.cause'), ('target_bdt', 'v.target'),
    ('raised_bdt', 'v.raised'), ('donors_count', 'v.donors'),
    ('deadline', "(case when v.sign = '-' then current_date - v.due::interval "
                  "else current_date + v.due::interval end)::date"),
    ('cover_image_url', 'NULL'), ('is_verified', 'v.verified'), ('status', 'v.status'),
    ('created_at', "(now() - interval '9 days')")], 'campaign', author_col='organizer_id')

don_rows = []
for i, raw in enumerate(CAMPAIGNS):
    d = dict(zip(CAMPAIGNS_F, raw))
    for j, (who, amt, msg, anon, status) in enumerate(DONATION_TRIO):
        don_rows.append((who, d['campus'], str(ids['campaign'][i]), '', amt, msg, anon, status, str(j)))
build('donations', ['actor', 'campus', 'campaign_id', 'donor_name', 'amount', 'message', 'anon', 'status', 'n'],
      don_rows, [
    ('campaign_id', 'txt', 'campaign_id'), ('donor_name', 'txt', 'donor_name'), ('amount', 'num', 'amount'),
    ('message', 'txt', 'message'), ('anon', 'bool', 'anon'), ('status', 'txt', 'status'),
    ('n', 'num', 'n')], [
    ('campaign_id', 'v.campaign_id::uuid'),
    ('donor_name', "(select coalesce(au.raw_user_meta_data->>'full_name', 'Campus student') "
                   "from auth.users au where au.id = pr.id)"),
    ('amount_bdt', 'v.amount'), ('message', 'v.message'), ('is_anonymous', 'v.anon'),
    ('status', 'v.status'), ('created_at', "(now() - make_interval(days => 6 - v.n::int))")], 'donation',
    author_col='donor_id')

led_rows = []
for i, raw in enumerate(CAMPAIGNS):
    d = dict(zip(CAMPAIGNS_F, raw))
    led_rows.append((d['actor'], d['campus'], str(ids['campaign'][i]), 'DONATION',
                     int(d['raised'] / 3), f"{int(d['donors'] / 3)} donations received via bKash Nexus and the hall desk (batched summary)."))
    led_rows.append((d['actor'], d['campus'], str(ids['campaign'][i]), 'DISBURSEMENT',
                     int(d['raised'] / 5), 'Disbursement made against verified receipts; copies filed with the hall or department office.'))
build('donation_ledger', ['actor', 'campus', 'campaign_id', 'entry', 'amount', 'description'], led_rows, [
    ('campaign_id', 'txt', 'campaign_id'), ('entry', 'txt', 'entry'), ('amount', 'num', 'amount'),
    ('description', 'txt', 'description')], [
    ('campaign_id', 'v.campaign_id::uuid'), ('entry_type', 'v.entry::text'), ('amount_bdt', 'v.amount'),
    ('description', 'v.description'),
    ('proof_url', "case when v.entry = 'DISBURSEMENT' then 'receipts/' || u.code || '/demo-ledger' else NULL end")],
    'ledger', author_col=None, updates=['amount_bdt', 'description', 'proof_url'])

# ---------------------------------------------------------------- 15 · marketplace
build('marketplace_listings', MARKET_F, MARKET, [
    ('kind', 'txt', 'kind'), ('title', 'txt', 'title'), ('cat', 'txt', 'category'),
    ('price', 'num', 'price'), ('cond', 'txt', 'condition'), ('desc', 'txt', 'desc'),
    ('tags', 'arr', 'tags'), ('nego', 'bool', 'negotiable'), ('views', 'num', 'views')], [
    ('kind', 'v.kind::public.listing_kind'), ('title', 'v.title'), ('description', 'v.desc'),
    ('category', 'v.cat'), ('price_bdt', 'v.price'),
    ('condition', "upper(replace(v.cond, ' ', '_'))"),
    ('images', "'{}'::text[]"), ('keyword_tags', 'v.tags'), ('is_negotiable', 'v.nego'),
    ('rent_period', "case when v.kind = 'RENT' then 'MONTHLY' else NULL end"),
    ('views_count', 'v.views'), ('status', "'AVAILABLE'"),
    ('created_at', "(now() - interval '2 days')")], 'market', author_col='seller_id')

# ---------------------------------------------------------------- 16 · reviews
TARGET_SUB = {
    'menu': "(select cm.id from public.cafeteria_menus cm where cm.university_id = u.id and cm.name_en = v.tgt limit 1)",
    'market': "(select ml.id from public.marketplace_listings ml where ml.university_id = u.id and ml.title = v.tgt limit 1)",
    'donor': "(select hd.id from public.health_donors hd where hd.university_id = u.id and hd.user_id = (select p8.id from public.profiles p8 where p8.email = v.tgt limit 1) limit 1)",
    'file': "(select af.id from public.academic_files af where af.university_id = u.id and af.course_code = v.tgt limit 1)",
    'event': "(select e.id from public.events e where e.university_id = u.id and e.title_en = v.tgt limit 1)",
    'ride': "(select ro.id from public.rideshare_offers ro where ro.university_id = u.id and ro.origin = v.tgt limit 1)",
    'housing': "(select hl.id from public.housing_listings hl where hl.university_id = u.id and hl.title = v.tgt limit 1)",
    'skill': "(select sp.id from public.skill_postings sp where sp.university_id = u.id and sp.title = v.tgt limit 1)",
    'lost': "(select li.id from public.lost_items li where li.university_id = u.id and li.title = v.tgt limit 1)",
    'club': "(select c.id from public.clubs c where c.university_id = u.id order by c.created_at limit 1)",
    'notice': "(select g.id from public.governance_notices g where g.university_id = u.id order by g.created_at desc limit 1)",
}


def review_target(d):
    """Point every review at a real seeded row, resolved by natural key."""
    kind = d['target']
    if kind == 'menu':
        return next(d2['name_en'] for d2 in [dict(zip(MENUS_F, r)) for r in MENUS] if d2['campus'] == d['campus'])
    if kind == 'market':
        cand = [d2 for d2 in [dict(zip(MARKET_F, r)) for r in MARKET] if d2['campus'] == d['campus']]
        return cand[0]['title'] if cand else ''
    if kind == 'donor':
        cand = [d2['actor'] for d2 in [dict(zip(DONORS_F, r)) for r in DONORS] if d2['campus'] == d['campus']]
        return EMAIL_PREFIX + cand[0] + EMAIL_DOMAIN if cand else ''
    if kind == 'file':
        cand = [d2 for d2 in [dict(zip(FILES_F, r)) for r in FILES] if d2['campus'] == d['campus']]
        return cand[0]['course_code'] if cand else ''
    if kind == 'event':
        cand = [d2 for d2 in [dict(zip(EVENTS_F, r)) for r in EVENTS] if d2['campus'] == d['campus']]
        return cand[0]['title_en'] if cand else ''
    if kind == 'ride':
        cand = [d2 for d2 in [dict(zip(RIDE_F, r)) for r in RIDE] if d2['campus'] == d['campus']]
        return cand[0]['origin'] if cand else ''
    if kind == 'housing':
        cand = [d2 for d2 in [dict(zip(HOUSING_F, r)) for r in HOUSING] if d2['campus'] == d['campus']]
        return cand[0]['title'] if cand else ''
    if kind == 'skill':
        cand = [d2 for d2 in [dict(zip(SKILLS_F, r)) for r in SKILLS] if d2['campus'] == d['campus']]
        return cand[0]['title'] if cand else ''
    if kind == 'lost':
        cand = [d2 for d2 in [dict(zip(LOST_F, r)) for r in LOST] if d2['campus'] == d['campus']]
        return cand[0]['title'] if cand else ''
    return ''


rev_rows = []
for raw in REVIEWS:
    d = dict(zip(REVIEWS_F, raw))
    rev_rows.append((d['actor'], d['campus'], d['target_type'], d['target'], review_target(d), d['rating'],
                     d['title'], d['body'], d['tags'], d['verified']))
build('reviews', ['actor', 'campus', 'target_type', 'target_kind', 'target_key', 'rating', 'title', 'body',
                 'tags', 'verified'], rev_rows, [
    ('ttype', 'txt', 'target_type'), ('tkind', 'txt', 'target_kind'), ('tgt', 'txt', 'target_key'),
    ('rating', 'num', 'rating'), ('title', 'txt', 'title'), ('body', 'txt', 'body'),
    ('tags', 'arr', 'tags'), ('verified', 'bool', 'verified')], [
    ('target_type', 'v.ttype::public.review_target_type'),
    ('target_id', ''.join("(case %s end)" % ' '.join(
        f"when v.tkind = '{k}' then coalescenull({sub})" for k, sub in TARGET_SUB.items()))
     .replace('coalescenull', '')),
    ('rating', 'v.rating'), ('title', 'v.title'), ('body', 'v.body'), ('photo_urls', "'{}'::text[]"),
    ('tags', 'v.tags'), ('verified_participation', 'v.verified'), ('pending_reports_count', '0'),
    ('is_hidden', 'false'), ('created_at', "(now() - interval '18 hours')")], 'review',
    updates=['rating', 'title', 'body', 'tags', 'verified_participation'])

# ---------------------------------------------------------------- 17 · notices
# GOV carries no author; the notice is attributed to that campus's lead student
# so the row still resolves through the same join shape as every other module.
GOV_AUTHOR = {'DU': 'tanvir.du', 'BUET': 'sabbir.buet', 'RU': 'mehedi.ru',
              'CU': 'imran.cu', 'SUST': 'rafiul.sust', 'JUST': 'alamin.just'}
gov_rows = [(GOV_AUTHOR[g[0]], g[0], g[1], g[2], g[3], g[4]) for g in GOV]
build('governance_notices', ['actor', 'campus', 'title', 'body', 'audience', 'age_days'], gov_rows, [
    ('title', 'txt', 'title'), ('body', 'txt', 'body'), ('audience', 'txt', 'audience'),
    ('age_days', 'num', 'age_days')], [
    ('title', 'v.title'), ('body', 'v.body'), ('audience', 'v.audience::text'),
    ('created_at', '(now() - make_interval(days => v.age_days))'),
    ('updated_at', '(now() - make_interval(days => v.age_days))')], 'gov', author_col='created_by',
    updates=['title', 'body', 'audience'])

build('club_notices', CLUB_NOTICES_F, CLUB_NOTICES, [
    ('slug', 'txt', 'slug'), ('title', 'txt', 'title'), ('body', 'txt', 'body'),
    ('age_hours', 'num', 'age_hours')], [
    ('club_id', 'cl.id'), ('title', 'v.title'), ('body', 'v.body'),
    ('created_at', '(now() - make_interval(hours => v.age_hours))')], 'clubnotice',
    joins="  JOIN LATERAL (select c.id from public.clubs c where c.university_id = u.id and c.slug = v.slug limit 1) cl on true",
    updates=['title', 'body'])

# ---------------------------------------------------------------- 18 · counters
stmts.append("""  -- ---------------------------------------------------------------------
  -- 18 · denormalised counters, recomputed from the rows themselves so no card
  -- shows a number its own list contradicts.
  -- ---------------------------------------------------------------------
  UPDATE public.skill_postings sp SET applicants_count = sub.n
  FROM (SELECT sp2.id, count(sa.id)::int AS n FROM public.skill_postings sp2
        LEFT JOIN public.skill_applications sa ON sa.posting_id = sp2.id AND sa.status <> 'DECLINED'
        GROUP BY sp2.id) sub WHERE sub.id = sp.id;

  UPDATE public.events e SET rsvp_count = sub.n
  FROM (SELECT e2.id, count(r.id)::int AS n FROM public.events e2
        LEFT JOIN public.event_rsvps r ON r.event_id = e2.id AND r.status = 'GOING'
        GROUP BY e2.id) sub WHERE sub.id = e.id;

  UPDATE public.donation_campaigns dc SET raised_bdt = sub.raised, donors_count = sub.n
  FROM (SELECT dc2.id,
               coalesce(sum(dd.amount_bdt) FILTER (WHERE dd.status = 'CONFIRMED'), 0) AS raised,
               count(dd.id)::int AS n
        FROM public.donation_campaigns dc2
        LEFT JOIN public.donations dd ON dd.campaign_id = dc2.id
        GROUP BY dc2.id) sub WHERE sub.id = dc.id;

  UPDATE public.rideshare_offers ro SET seats_available = sub.n
  FROM (SELECT id, least(seats_total, greatest(0, seats_available)) AS n FROM public.rideshare_offers) sub
  WHERE sub.id = ro.id;

  DROP TABLE IF EXISTS tmp_person;""")

HEADER = """-- supabase/seed/seed_demo_content.sql
-- ============================================================================
-- Demo CONTENT for every sidebar module, on the real campus registry:
-- Dhaka University, BUET, Rajshahi University, Chittagong University, SUST, JUST.
--
-- Why this file exists: the platform was structurally finished and completely
-- empty, and an empty module is indistinguishable from a broken one to whoever is
-- looking at it. The /skills crash report was a page that had never once had a
-- row to render; the fixes that came out of it are in the same pull request.
--
-- What gets seeded (one or two rows per campus, six campuses):
--   campus feed · events + RSVPs · blood requests + donors + responses ·
--   academic archive · skills (postings, applications, alerts) · mentorship
--   (profiles + slots) · housing + rideshare · alumni + careers · cafeteria
--   (menus + items) · lost & found · sports (challenges + teams) · donations
--   (campaigns + donations + ledger) · marketplace · reviews · governance and
--   club notices.
--
-- Run it
--   psql "$DATABASE_URL" -f supabase/seed/seed_demo_content.sql
--   or paste the whole file into the Supabase SQL editor.
-- It is written as ONE statement (a DO block) because that is atomic: either the
-- whole demo universe lands or nothing does, and it survives being replayed
-- through an API that executes a single statement per call.
--
-- Properties
--   * Idempotent — every row has a deterministic uuid5 id derived from its content
--     key and is upserted ON CONFLICT (id), so re-running refreshes the same rows
--     instead of duplicating them. Timestamps are relative to now()/current_date,
--     so a re-run also re-freshens the "2 hours ago" strings the feed renders.
--   * Registry-safe — halls, departments, programs, menus, listings and clubs are
--     resolved by subselect against whatever the target database actually holds,
--     keyed on campus code and natural names. Nothing here hard-codes a row id,
--     so the same file works on a fresh clone and on the seeded production
--     project. Club notices use an inner JOIN LATERAL, so a campus without that
--     club simply gets no notice instead of a NOT NULL failure.
--   * Not sign-in-able — the 22 demo identities get crypt(md5(random()))
--     passwords on purpose. supabase/seed/seed_users_demo_accounts.sql ships the
--     published password Demo#1234; never apply that file to a live project.
--   * Bengali text is emitted as U&'\\09XX' escapes, so the file cannot be
--     mangled by a client that assumes another encoding.
--   * Cleanup:
--       delete from auth.users where id in
--         (select id from public.profiles where email like 'demo.%@campus360.test');
--     module rows cascade from those profiles.
--
-- Runs after seed.sql (universities), seed_university_halls.sql,
-- seed_departments_by_faculty.sql, seed_modules.sql (clubs) and
-- migration 0015 (academic_programs). Generated by
-- supabase/seed/tools/generate_demo_content_seed.py — do not hand-edit.
-- ============================================================================

DO $$
BEGIN
"""

FOOTER = """
END
$$;
"""


def finish(out_path, stmts, ids, G):
    body = '\n\n'.join(stmts)
    # A DO block separates statements with ';'. A stray comma at a statement
    # boundary (the classic "',\n'.join()' mistake) is a silent syntax error at
    # run time, so fail here instead — but only for that shape: multi-line VALUES
    # rows legitimately end with "),".
    assert not any(line.strip().startswith(',') for line in body.splitlines()), \
        'generator emitted a comma at a statement boundary — a DO block needs ; separators'
    assert ';$' not in body and ',\n\n' not in body, 'statement join separator must be blank lines'
    out_path.write_text(HEADER + body + FOOTER)
    print(f'wrote {out_path} — {len(stmts)} statements, {len(body.splitlines())} lines')


# --------------------------------------------------------------------------
# Chunk emitter (execution only — the committed .sql keeps U& escapes)
# --------------------------------------------------------------------------
import re as _re


def _unescape_bn(sql):
    """Rewrite U&'\\09XX' literals as plain UTF-8 literals for the HTTP SQL API."""
    def sub(m):
        inner = m.group(1).replace("''", "'")
        inner = _re.sub(r'\\([0-9A-Fa-f]{4})', lambda h: chr(int(h.group(1), 16)), inner)
        return "'" + inner.replace("'", "''") + "'"
    return _re.sub(r"U&'((?:[^']|'')*)'", sub, sql)


def chunks(stmt_list, limit=24000):
    groups, cur = [], ''
    for st in stmt_list:
        piece = st + '\n\n'
        if cur and len(cur) + len(piece) > limit:
            groups.append(cur)
            cur = piece
        else:
            cur += piece
    if cur:
        groups.append(cur)
    return groups


def write_chunks(out_path, stmt_list, ids_map, G, path='/tmp/g'):
    import pathlib as _p
    sql = _unescape_bn(out_path.read_text())
    # slice out the DO body again from the emitted file so the chunk text is
    # byte-identical to what the file contains (modulo Bengali encoding)
    body = sql.split('DO $$\nBEGIN\n', 1)[1].rsplit('END\n$$;\n', 1)[0]
    parts = [p for p in body.split('\n\n') if p.strip()]
    groups, cur = [], ''
    for p in parts:
        piece = p + '\n\n'
        if cur and len(cur) + len(piece) > 24000:
            groups.append(cur)
            cur = piece
        else:
            cur += piece
    if cur.strip():
        groups.append(cur)
    sizes = []
    for i, g in enumerate(groups):
        wrapped = 'DO $$\nBEGIN\n' + g + '\nEND\n$$;'
        _p.Path(f'{path}/chunk_{i}.sql').write_text(wrapped)
        sizes.append((i, len(wrapped)))
    print('chunks:', sizes)


if __name__ == '__main__':
    finish(OUT, stmts, ids, globals())
