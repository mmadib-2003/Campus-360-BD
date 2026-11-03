// apps/web/lib/modules/demo-data.ts
/**
 * Demo/offline dataset.
 *
 * The platform prefers live Supabase data at all times. When the deployment has
 * not yet been given `NEXT_PUBLIC_SUPABASE_URL` / anon key (for example a fresh
 * Vercel preview environment), pages still render a fully interactive preview
 * using this in-memory store instead of throwing or showing empty states.
 *
 * Local writes are persisted in `sessionStorage` so a reviewer can post, RSVP,
 * upvote and chat across tabs of the same browser.
 */

export const DEMO_UNIVERSITY_ID = 'dem00000-0000-4000-8000-000000000001';

const now = Date.now();
const iso = (offsetMinutes: number) => new Date(now + offsetMinutes * 60_000).toISOString();
const day = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString().slice(0, 10);

export const DEMO_PROFILE = {
  id: 'demo-user-0001',
  university_id: DEMO_UNIVERSITY_ID,
  email: 'student@juniv.edu',
  full_name: 'Demo Student',
  trust_level: 'EMAIL_VERIFIED' as const,
  student_id: 'JU-DEMO-01',
  universities: { code: 'JU', name_en: 'Jahangirnagar University', name_bn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়' },
  halls: { name_en: 'A. F. M. Kamaluddin Hall', name_bn: 'এ. এফ. এম কামালউদ্দিন হল' },
};

type Row = Record<string, any>;

const profiles = {
  'demo-user-0001': { full_name: 'Demo Student', trust_level: 'EMAIL_VERIFIED' },
  'demo-user-0002': { full_name: 'Nusrat Jahan', trust_level: 'ID_VERIFIED' },
  'demo-user-0003': { full_name: 'Rafid Hasan', trust_level: 'TRUSTED' },
  'demo-user-0004': { full_name: 'Tasnim Chowdhury', trust_level: 'EMAIL_VERIFIED' },
};

export const DEMO_TABLES: Record<string, Row[]> = {
  marketplace_listings: [
    {
      id: 'd1a00000-0000-4000-8000-000000000001',
      university_id: DEMO_UNIVERSITY_ID,
      seller_id: 'demo-user-0002',
      title: 'Casio FX-991EX Scientific Calculator',
      description: 'Used for one semester, like new. Cleared for JU engineering exams.',
      category: 'Electronics',
      kind: 'SELL',
      price_bdt: 1400,
      condition: 'LIKE_NEW',
      images: [],
      status: 'AVAILABLE',
      is_negotiable: true,
      keyword_tags: ['calculator', 'casio', 'engineering'],
      pickup_point_id: 'd1b00000-0000-4000-8000-000000000001',
      campus_pickup_points: { name_en: 'Central Library Locker A', name_bn: 'কেন্দ্রীয় লাইব্রেরি লকার এ', location_en: 'Ground floor, beside the help desk' },
      profiles: { full_name: 'Nusrat Jahan', trust_level: 'ID_VERIFIED' },
      created_at: iso(-90),
    },
    {
      id: 'd1a00000-0000-4000-8000-000000000002',
      university_id: DEMO_UNIVERSITY_ID,
      seller_id: 'demo-user-0003',
      title: 'Hero Sprint bicycle — campus commuter',
      description: 'Well maintained, new tyres. Ideal for hall-to-department commute.',
      category: 'Transport',
      kind: 'RENT',
      price_bdt: 800,
      rent_period: 'per month',
      condition: 'GOOD',
      images: [],
      status: 'AVAILABLE',
      is_negotiable: false,
      keyword_tags: ['bicycle', 'cycle', 'commute'],
      pickup_point_id: 'd1b00000-0000-4000-8000-000000000002',
      campus_pickup_points: { name_en: 'TSC Security Desk', name_bn: 'টিএসসি সিকিউরিটি ডেস্ক', location_en: 'TSC main entrance' },
      profiles: { full_name: 'Rafid Hasan', trust_level: 'TRUSTED' },
      created_at: iso(-260),
    },
    {
      id: 'd1a00000-0000-4000-8000-000000000003',
      university_id: DEMO_UNIVERSITY_ID,
      seller_id: 'demo-user-0004',
      title: 'Data Structures & Algorithms — Cormen 3rd ed.',
      description: 'Lightly annotated. Free exchange for any IELTS preparation book.',
      category: 'Books',
      kind: 'EXCHANGE',
      price_bdt: 0,
      condition: 'GOOD',
      images: [],
      status: 'AVAILABLE',
      is_negotiable: true,
      keyword_tags: ['clrs', 'algorithms', 'cse'],
      pickup_point_id: 'd1b00000-0000-4000-8000-000000000001',
      campus_pickup_points: { name_en: 'Central Library Locker A', name_bn: 'কেন্দ্রীয় লাইব্রেরি লকার এ', location_en: 'Ground floor, beside the help desk' },
      profiles: { full_name: 'Tasnim Chowdhury', trust_level: 'EMAIL_VERIFIED' },
      created_at: iso(-720),
    },
  ],
  campus_pickup_points: [
    { id: 'd1b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, code: 'LIB-A', name_en: 'Central Library Locker A', name_bn: 'কেন্দ্রীয় লাইব্রেরি লকার এ', location_en: 'Ground floor, beside the help desk', location_bn: 'নিচতলা, হেল্প ডেস্কের পাশে', is_active: true },
    { id: 'd1b00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, code: 'TSC-1', name_en: 'TSC Security Desk', name_bn: 'টিএসসি সিকিউরিটি ডেস্ক', location_en: 'TSC main entrance', location_bn: 'টিএসসি প্রধান ফটক', is_active: true },
    { id: 'd1b00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, code: 'HALL-C', name_en: 'Halls Zone C Gate', name_bn: 'হল জোন সি গেট', location_en: 'Between New Hall and Bangabandhu Hall', location_bn: 'নতুন হল ও বঙ্গবন্ধু হলের মাঝে', is_active: true },
  ],
  marketplace_orders: [],
  marketplace_messages: [
    {
      id: 'd1c00000-0000-4000-8000-000000000001',
      university_id: DEMO_UNIVERSITY_ID,
      listing_id: 'd1a00000-0000-4000-8000-000000000001',
      sender_id: 'demo-user-0002',
      recipient_id: 'demo-user-0001',
      body: 'Hi! The calculator is still available. Can we meet at the library locker tomorrow at 5?',
      created_at: iso(-40),
    },
  ],
  skill_postings: [
    {
      id: 'd2a00000-0000-4000-8000-000000000001',
      university_id: DEMO_UNIVERSITY_ID,
      author_id: 'demo-user-0002',
      type: 'TUTORING',
      title: 'CSE-301 Data Structures crash tutoring',
      description: 'Two-hour problem-solving sessions before the mid-term. Focus on trees, graphs and DP.',
      category: 'Academic',
      skills: ['data structures', 'algorithms', 'c++'],
      location_en: 'Central Library discussion room',
      availability: 'EVENINGS',
      rate_bdt: 400,
      is_remote: false,
      status: 'OPEN',
      applicants_count: 3,
      created_at: iso(-120),
    },
    {
      id: 'd2a00000-0000-4000-8000-000000000002',
      university_id: DEMO_UNIVERSITY_ID,
      author_id: 'demo-user-0003',
      type: 'FREELANCE',
      title: 'Logo + social media kit for a student club',
      description: 'Need a designer for the debate club’s annual festival identity. Budget is flexible.',
      category: 'Design',
      skills: ['graphic design', 'figma', 'illustrator'],
      location_en: 'Remote',
      availability: 'FLEXIBLE',
      rate_bdt: 3500,
      is_remote: true,
      status: 'OPEN',
      applicants_count: 1,
      created_at: iso(-500),
    },
    {
      id: 'd2a00000-0000-4000-8000-000000000003',
      university_id: DEMO_UNIVERSITY_ID,
      author_id: 'demo-user-0004',
      type: 'PART_TIME_JOB',
      title: 'Weekend front-desk assistant at campus cyber café',
      description: 'Friday–Saturday, 10am–4pm. Basic computer troubleshooting skills needed.',
      category: 'Operations',
      skills: ['communication', 'troubleshooting'],
      location_en: 'TSC Cyber Café',
      availability: 'WEEKENDS',
      rate_bdt: 6000,
      is_remote: false,
      status: 'OPEN',
      applicants_count: 0,
      created_at: iso(-900),
    },
  ],
  skill_applications: [],
  skill_alerts: [],
  clubs: [
    { id: 'd4a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, slug: 'debate-club', name_en: 'JU Debate Club', name_bn: 'জাবি ডিবেট ক্লাব', category: 'Debate', description_en: 'Weekly parliamentary debates and national tournament prep.', description_bn: 'সাপ্তাহিক বিতর্ক ও জাতীয় প্রতিযোগিতার প্রস্তুতি।', member_count: 128, is_recruiting: true, created_at: iso(-43200) },
    { id: 'd4a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, slug: 'cse-society', name_en: 'CSE Society', name_bn: 'সিএসই সোসাইটি', category: 'Technology', description_en: 'Hackathons, ICPC bootcamps and industry talks.', description_bn: 'হ্যাকাথন, আইসিপিসি বুটক্যাম্প ও ইন্ডাস্ট্রি টক।', member_count: 264, is_recruiting: true, created_at: iso(-44000) },
    { id: 'd4a00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, slug: 'photography-society', name_en: 'Photography Society', name_bn: 'ফটোগ্রাফি সোসাইটি', category: 'Arts', description_en: 'Campus photowalks and an annual exhibition.', description_bn: 'ক্যাম্পাস ফটোওয়াক ও বার্ষিক প্রদর্শনী।', member_count: 64, is_recruiting: false, created_at: iso(-45000) },
  ],
  club_members: [],
  club_notices: [
    { id: 'd4b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, club_id: 'd4a00000-0000-4000-8000-000000000001', author_id: 'demo-user-0003', title: 'Recruitment for the 2026 executive panel is open', body: 'Apply with a 200-word motivation note before Friday.', created_at: iso(-300) },
  ],
  events: [
    {
      id: 'd4c00000-0000-4000-8000-000000000001',
      university_id: DEMO_UNIVERSITY_ID,
      organizer_id: 'demo-user-0003',
      host_organization: 'CSE Society',
      title_en: 'Inter-department Hackathon 2026',
      title_bn: 'আন্তঃবিভাগ হ্যাকাথন ২০২৬',
      description_en: '24-hour build sprint. Teams of three, open to every department.',
      category: 'Technology',
      is_public: true,
      starts_at: iso(60 * 30),
      ends_at: iso(60 * 42),
      venue_name: 'CSE Building Auditorium',
      formatted_address: 'Jahangirnagar University, Savar, Dhaka',
      text_directions_en: 'Enter through the main gate, walk 300m past the library.',
      lat: 23.8791,
      lng: 90.2674,
      place_id: 'demo-place-1',
      geofence_radius_m: 150,
      capacity: 120,
      rsvp_required: true,
      rsvp_count: 74,
      checkin_count: 0,
      live_override: 'AUTO',
      club_id: 'd4a00000-0000-4000-8000-000000000002',
      ticket_price_bdt: 0,
      created_at: iso(-2000),
    },
    {
      id: 'd4c00000-0000-4000-8000-000000000002',
      university_id: DEMO_UNIVERSITY_ID,
      organizer_id: 'demo-user-0002',
      host_organization: 'JU Debate Club',
      title_en: 'Fresher’s Parliamentary Debate',
      title_bn: 'ফ্রেশার্স পার্লামেন্টারি ডিবেট',
      description_en: 'Beginner-friendly British Parliamentary format with on-spot adjudicators.',
      category: 'Debate',
      is_public: true,
      starts_at: iso(60 * 24 * 3),
      ends_at: iso(60 * 24 * 3 + 240),
      venue_name: 'TSC Auditorium',
      formatted_address: 'Jahangirnagar University, Savar, Dhaka',
      text_directions_en: 'Opposite the central field, above the cafeteria.',
      lat: 23.8802,
      lng: 90.2681,
      place_id: 'demo-place-2',
      geofence_radius_m: 120,
      capacity: 200,
      rsvp_required: true,
      rsvp_count: 41,
      checkin_count: 0,
      live_override: 'AUTO',
      club_id: 'd4a00000-0000-4000-8000-000000000001',
      ticket_price_bdt: 100,
      created_at: iso(-3000),
    },
  ],
  event_rsvps: [],
  health_donors: [
    { id: 'd5a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0002', blood_group: 'O+', is_available: true, verified_donations_count: 4, hall_id: null, halls: { name_en: 'Bangabandhu Hall', name_bn: 'বঙ্গবন্ধু হল' }, profiles: { full_name: 'Nusrat Jahan' } },
    { id: 'd5a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0003', blood_group: 'B+', is_available: true, verified_donations_count: 2, hall_id: null, halls: { name_en: 'A. F. M. Kamaluddin Hall', name_bn: 'কামালউদ্দিন হল' }, profiles: { full_name: 'Rafid Hasan' } },
    { id: 'd5a00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0004', blood_group: 'A+', is_available: true, verified_donations_count: 6, hall_id: null, halls: { name_en: 'Pritilata Hall', name_bn: 'প্রীতিলতা হল' }, profiles: { full_name: 'Tasnim Chowdhury' } },
  ],
  blood_requests: [
    { id: 'd5b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, requester_id: 'demo-user-0004', patient_name: 'Sabbir Ahmed', blood_group: 'O+', bags_needed: 2, hospital_name: 'Enam Medical College', hospital_address: 'Savar, Dhaka', contact_phone: '+8801700000000', urgency: 'CRITICAL', needed_by: iso(60 * 8), status: 'OPEN', created_at: iso(-45), profiles: { full_name: 'Tasnim Chowdhury' } },
    { id: 'd5b00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, requester_id: 'demo-user-0002', patient_name: 'Ayesha Siddiqua', blood_group: 'B+', bags_needed: 1, hospital_name: 'Savar Upazila Health Complex', hospital_address: 'Savar Bus Stand', contact_phone: '+8801800000000', urgency: 'URGENT', needed_by: iso(60 * 30), status: 'OPEN', created_at: iso(-260), profiles: { full_name: 'Nusrat Jahan' } },
  ],
  blood_request_responses: [],
  health_contacts: [
    { id: 'd5c00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, kind: 'AMBULANCE', label_en: 'Campus Ambulance', label_bn: 'ক্যাম্পাস অ্যাম্বুলেন্স', phone: '+880-2-7791045', available_hours: '24/7', notes_en: 'Medical Center dispatch, 4-minute average response.' },
    { id: 'd5c00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, kind: 'MEDICAL_CENTER', label_en: 'University Medical Center', label_bn: 'বিশ্ববিদ্যালয় মেডিকেল সেন্টার', phone: '+880-2-7791050', available_hours: '08:00 – 22:00', notes_en: 'Free OPD for students with ID card.' },
    { id: 'd5c00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, kind: 'COUNSELING', label_en: 'Student Counseling Cell', label_bn: 'শিক্ষার্থী কাউন্সেলিং সেল', phone: '+880-2-7791033', available_hours: '10:00 – 17:00', notes_en: 'Confidential. Anonymous booking supported.' },
    { id: 'd5c00000-0000-4000-8000-000000000004', university_id: DEMO_UNIVERSITY_ID, kind: 'NATIONAL', label_en: 'National Emergency', label_bn: 'জাতীয় জরুরি সেবা', phone: '999', available_hours: '24/7', notes_en: 'Police, fire and ambulance dispatch.' },
  ],
  counseling_slots: [
    { id: 'd5d00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, counselor_alias: 'Counselor A-12', mode: 'IN_PERSON', starts_at: iso(60 * 26), ends_at: iso(60 * 27), capacity: 1, booked_count: 0, is_active: true },
    { id: 'd5d00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, counselor_alias: 'Counselor B-04', mode: 'ONLINE', starts_at: iso(60 * 50), ends_at: iso(60 * 51), capacity: 1, booked_count: 0, is_active: true },
    { id: 'd5d00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, counselor_alias: 'Peer Support Circle', mode: 'IN_PERSON', starts_at: iso(60 * 74), ends_at: iso(60 * 75), capacity: 4, booked_count: 1, is_active: true },
  ],
  counseling_bookings: [],
  mentor_profiles: [
    { id: 'd6a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0003', headline: 'Final-year CSE • ICPC regionalist', expertise: ['algorithms', 'competitive programming', 'career'], languages: ['en', 'bn'], session_rate_bdt: 0, bio: 'Happy to review your CP roadmap and internship CV.', is_accepting: true, sessions_count: 22, rating: 4.8, profiles: { full_name: 'Rafid Hasan' } },
    { id: 'd6a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0002', headline: '3rd-year Biochemistry • research writing', expertise: ['research', 'writing', 'ielts'], languages: ['en', 'bn'], session_rate_bdt: 200, bio: 'Helps with literature reviews and lab report structure.', is_accepting: true, sessions_count: 9, rating: 4.6, profiles: { full_name: 'Nusrat Jahan' } },
  ],
  mentorship_slots: [
    { id: 'd6b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, mentor_id: 'd6a00000-0000-4000-8000-000000000001', topic: 'ICPC preparation roadmap', starts_at: iso(60 * 30), ends_at: iso(60 * 30 + 45), capacity: 2, booked_count: 0, is_active: true, mentor_profiles: { headline: 'Final-year CSE • ICPC regionalist', user_id: 'demo-user-0003', profiles: { full_name: 'Rafid Hasan' } } },
    { id: 'd6b00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, mentor_id: 'd6a00000-0000-4000-8000-000000000002', topic: 'Lab report & thesis structure', starts_at: iso(60 * 54), ends_at: iso(60 * 54 + 45), capacity: 1, booked_count: 0, is_active: true, mentor_profiles: { headline: '3rd-year Biochemistry • research writing', user_id: 'demo-user-0002', profiles: { full_name: 'Nusrat Jahan' } } },
  ],
  mentorship_bookings: [],
  housing_listings: [
    { id: 'd7a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, owner_id: 'demo-user-0004', kind: 'MESS_SEAT', title: 'One seat in a 4-member mess, Wortola', description: 'Shared room, attached bath, gas line, 10 minutes walk to campus gate.', rent_bdt: 3200, seat_count: 1, gender_policy: 'FEMALE', area_en: 'Wortola, Savar', distance_km: 0.8, amenities: ['Wi-Fi', 'gas', 'attached bath', 'filtered water'], image_urls: [], status: 'AVAILABLE', created_at: iso(-320) },
    { id: 'd7a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, owner_id: 'demo-user-0002', kind: 'SUB_LET', title: 'Sub-let room for 2 months (summer break)', description: 'Furnished room near Nabinagar bus stand, kitchen access included.', rent_bdt: 4500, seat_count: 1, gender_policy: 'ANY', area_en: 'Nabinagar, Savar', distance_km: 2.1, amenities: ['furnished', 'kitchen', 'parking'], image_urls: [], status: 'AVAILABLE', created_at: iso(-640) },
  ],
  rideshare_offers: [
    { id: 'd7b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, owner_id: 'demo-user-0003', mode: 'BUS', origin: 'Savar', destination: 'Chattogram', depart_at: iso(60 * 22), seats_total: 3, seats_available: 2, fare_bdt: 650, vehicle_details: 'Shyamoli AC, seat 12–14', notes: 'Leaving right after the exam ends.', status: 'OPEN', created_at: iso(-180), profiles: { full_name: 'Rafid Hasan' } },
    { id: 'd7b00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, owner_id: 'demo-user-0002', mode: 'TRAIN', origin: 'Dhaka', destination: 'Rajshahi', depart_at: iso(60 * 48), seats_total: 2, seats_available: 1, fare_bdt: 480, vehicle_details: 'Banalata Express, KA cabin', notes: 'Split the cabin cost.', status: 'OPEN', created_at: iso(-400), profiles: { full_name: 'Nusrat Jahan' } },
  ],
  rideshare_requests: [],
  ticket_exchanges: [
    { id: 'd7c00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, seller_id: 'demo-user-0004', mode: 'BUS', route_from: 'Dhaka', route_to: 'Sylhet', travel_date: day(6), seat_count: 1, price_bdt: 700, notes: 'Eid return ticket, non-AC.', status: 'AVAILABLE', created_at: iso(-120) },
  ],
  alumni_profiles: [
    { id: 'd8a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0003', graduation_year: 2021, degree: 'BSc CSE', employer: 'Brain Station 23', job_title: 'Software Engineer II', industry: 'Technology', city: 'Dhaka', country: 'Bangladesh', offers_referrals: true, is_mentor: true, profiles: { full_name: 'Rafid Hasan' } },
    { id: 'd8a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, user_id: 'demo-user-0002', graduation_year: 2019, degree: 'BBA', employer: 'BRAC Bank', job_title: 'Product Analyst', industry: 'Finance', city: 'Dhaka', country: 'Bangladesh', offers_referrals: true, is_mentor: false, profiles: { full_name: 'Nusrat Jahan' } },
  ],
  career_opportunities: [
    { id: 'd8b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, alumni_id: 'd8a00000-0000-4000-8000-000000000001', kind: 'INTERNSHIP', company: 'Brain Station 23', title: 'Backend Engineering Intern (6 months)', description: 'Node.js + PostgreSQL. Mentorship from the platform team.', location: 'Dhaka', is_remote: false, salary_range: '৳25,000 / month', deadline: day(21), status: 'OPEN', created_at: iso(-200), alumni_profiles: { job_title: 'Software Engineer II', employer: 'Brain Station 23', profiles: { full_name: 'Rafid Hasan' } } },
    { id: 'd8b00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, alumni_id: 'd8a00000-0000-4000-8000-000000000002', kind: 'REFERRAL', company: 'BRAC Bank', title: 'Referral slots — Management Trainee 2026', description: 'Two referral slots for fresh graduates. Send your CV through the app.', location: 'Dhaka', is_remote: false, salary_range: 'Negotiable', deadline: day(40), status: 'OPEN', created_at: iso(-700), alumni_profiles: { job_title: 'Product Analyst', employer: 'BRAC Bank', profiles: { full_name: 'Nusrat Jahan' } } },
  ],
  career_applications: [],
  direct_conversations: [
    { id: 'd8c00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, user_a: 'demo-user-0001', user_b: 'demo-user-0003', context: 'Internship referral', last_message_at: iso(-30), created_at: iso(-60) },
  ],
  direct_messages: [
    { id: 'd8d00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, conversation_id: 'd8c00000-0000-4000-8000-000000000001', sender_id: 'demo-user-0003', body: 'Send me your CV and I will forward it to the hiring manager today.', created_at: iso(-30) },
  ],
  cafeteria_menus: [
    { id: 'd9a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, hall_id: null, name_en: 'Central Cafeteria — Lunch', name_bn: 'সেন্ট্রাল ক্যাফেটেরিয়া — দুপুর', serving_date: day(0), meal: 'LUNCH', pickup_window: '12:30 – 14:00', is_active: true, halls: { name_en: 'Central Cafeteria' }, cafeteria_items: [
      { id: 'd9b00000-0000-4000-8000-000000000001', name_en: 'Rice + Chicken Curry', name_bn: 'ভাত ও চিকেন কারি', price_bdt: 75, is_available: true, is_vegetarian: false },
      { id: 'd9b00000-0000-4000-8000-000000000002', name_en: 'Rice + Dal + Vegetables', name_bn: 'ভাত, ডাল ও সবজি', price_bdt: 45, is_available: true, is_vegetarian: true },
      { id: 'd9b00000-0000-4000-8000-000000000003', name_en: 'Beef Tehari', name_bn: 'গরুর তেহারি', price_bdt: 90, is_available: true, is_vegetarian: false },
    ] },
    { id: 'd9a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, hall_id: null, name_en: 'Kamaluddin Hall — Dinner', name_bn: 'কামালউদ্দিন হল — রাত', serving_date: day(0), meal: 'DINNER', pickup_window: '20:00 – 21:30', is_active: true, halls: { name_en: 'Kamaluddin Hall' }, cafeteria_items: [
      { id: 'd9b00000-0000-4000-8000-000000000004', name_en: 'Rice + Fish Curry', name_bn: 'ভাত ও মাছের ঝোল', price_bdt: 70, is_available: true, is_vegetarian: false },
      { id: 'd9b00000-0000-4000-8000-000000000005', name_en: 'Khichuri + Egg', name_bn: 'খিচুড়ি ও ডিম', price_bdt: 55, is_available: true, is_vegetarian: false },
    ] },
  ],
  cafeteria_items: [],
  home_food_listings: [
    { id: 'd9c00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, cook_id: 'demo-user-0004', title: 'Home-style beef kala bhuna (500g)', description: 'Slow cooked, no food colouring. Cooked fresh every evening.', cuisine: 'Bangladeshi', price_bdt: 320, portion: '2 persons', delivery_available: true, delivery_fee_bdt: 30, available_from: '17:00', available_to: '22:00', status: 'AVAILABLE', created_at: iso(-150), profiles: { full_name: 'Tasnim Chowdhury' } },
    { id: 'd9c00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, cook_id: 'demo-user-0002', title: 'Chicken biryani (student portion)', description: 'Includes borhani. Available for hall delivery after 8pm.', cuisine: 'Bangladeshi', price_bdt: 180, portion: '1 person', delivery_available: true, delivery_fee_bdt: 20, available_from: '19:00', available_to: '23:00', status: 'AVAILABLE', created_at: iso(-260), profiles: { full_name: 'Nusrat Jahan' } },
  ],
  food_orders: [],
  lost_items: [
    { id: 'd10a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, reporter_id: 'demo-user-0001', kind: 'LOST', title: 'Blue backpack with laptop charger', description: 'Left near the library reading room on Sunday evening.', category: 'Bag', keywords: ['blue backpack', 'charger', 'library'], location_en: 'Central Library, 2nd floor', occurred_on: day(-2), image_urls: [], status: 'OPEN', created_at: iso(-500), profiles: { full_name: 'Demo Student' } },
    { id: 'd10a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, reporter_id: 'demo-user-0002', kind: 'FOUND', title: 'Found: blue backpack near library stairs', description: 'Handed over to the library help desk. Ask for the reading-room supervisor.', category: 'Bag', keywords: ['blue backpack', 'library'], location_en: 'Central Library stairs', occurred_on: day(-1), image_urls: [], status: 'OPEN', created_at: iso(-200), profiles: { full_name: 'Nusrat Jahan' } },
    { id: 'd10a00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, reporter_id: 'demo-user-0003', kind: 'FOUND', title: 'Student ID card (CSE, 2023 batch)', description: 'Found in the TSC canteen. Available at the TSC desk.', category: 'ID Card', keywords: ['id card', 'tsc', 'cse'], location_en: 'TSC Canteen', occurred_on: day(-1), image_urls: [], status: 'OPEN', created_at: iso(-330), profiles: { full_name: 'Rafid Hasan' } },
  ],
  lost_item_matches: [],
  sports_teams: [
    { id: 'd11a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, captain_id: 'demo-user-0003', name: 'Savar Strikers', sport: 'Football', skill_level: 'INTERMEDIATE', needed_roles: ['Goalkeeper', 'Defender'], description: 'Inter-department league starting next month. Practising Tue/Thu evenings.', contact_note: 'Message the captain in-app.', status: 'OPEN', created_at: iso(-400) },
    { id: 'd11a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, captain_id: 'demo-user-0002', name: 'CSE Cricket XI', sport: 'Cricket', skill_level: 'ANY', needed_roles: ['Batsman', 'Bowler'], description: 'Friendly weekend matches against other departments.', contact_note: 'Join via the Sports Hub.', status: 'OPEN', created_at: iso(-900) },
  ],
  sports_challenges: [
    { id: 'd11b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, challenger_id: 'demo-user-0004', team_name: 'Sociology United', sport: 'Football', title: 'Looking for a friendly 7-a-side match', description: 'Saturday morning, 60 minutes, bring your own bibs.', preferred_date: iso(60 * 72), venue: 'Central Field', status: 'OPEN', created_at: iso(-250) },
  ],
  sports_venues: [
    { id: 'd11c00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, name_en: 'Central Field (Football)', name_bn: 'কেন্দ্রীয় মাঠ (ফুটবল)', sport: 'Football', capacity: 22, hourly_rate_bdt: 0, lat: 23.8796, lng: 90.2679, is_active: true },
    { id: 'd11c00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, name_en: 'Gymnasium — Badminton Court', name_bn: 'জিমনেসিয়াম — ব্যাডমিন্টন কোর্ট', sport: 'Badminton', capacity: 4, hourly_rate_bdt: 150, lat: 23.8801, lng: 90.2671, is_active: true },
  ],
  sports_venue_bookings: [],
  donation_campaigns: [
    { id: 'd11d00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, organizer_id: 'demo-user-0003', title: 'Emergency surgery support for a JU student', story: 'A final-year student needs urgent cardiac surgery. Funds cover hospital bills only; every disbursement is logged.', cause: 'MEDICAL', target_bdt: 250000, raised_bdt: 118500, donors_count: 63, deadline: day(18), is_verified: true, status: 'ACTIVE', created_at: iso(-2000) },
    { id: 'd11d00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, organizer_id: 'demo-user-0002', title: 'Send the debate team to the nationals', story: 'Travel, lodging and registration for 6 debaters representing the university.', cause: 'EVENT', target_bdt: 60000, raised_bdt: 21000, donors_count: 24, deadline: day(25), is_verified: true, status: 'ACTIVE', created_at: iso(-1200) },
  ],
  donations: [],
  donation_ledger: [
    { id: 'd11e00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, campaign_id: 'd11d00000-0000-4000-8000-000000000001', entry_type: 'DISBURSEMENT', amount_bdt: 85000, description: 'Hospital advance payment (receipt attached)', created_at: iso(-1000) },
  ],
  disputes: [
    { id: 'd12a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, opened_by: 'demo-user-0001', subject: 'Item not as described in marketplace', description: 'The calculator battery is failing; the seller is not responding.', category: 'MARKETPLACE', reference_code: 'DSP-4KQ2T9', status: 'IN_REVIEW', created_at: iso(-400) },
  ],
  dispute_messages: [
    { id: 'd12b00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, dispute_id: 'd12a00000-0000-4000-8000-000000000001', sender_id: null, is_admin: true, body: 'We have contacted both parties. Please upload a photo of the battery compartment.', created_at: iso(-200) },
  ],
  complaints: [
    { id: 'd13a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, tracking_code: 'JU-CASE-2026-482913', student_id: null, is_anonymous: true, title: 'Broken streetlights on the road to the new hall', category: 'INFRASTRUCTURE', severity: 'HIGH', status: 'IN_REVIEW', upvotes_count: 27, sla_due_at: iso(60 * 40), created_at: iso(-1400) },
  ],
  complaint_upvotes: [],
  complaints_public: [
    { id: 'd13a00000-0000-4000-8000-000000000001', university_id: DEMO_UNIVERSITY_ID, tracking_code: 'JU-CASE-2026-482913', title: 'Broken streetlights on the road to the new hall', category: 'INFRASTRUCTURE', severity: 'HIGH', status: 'IN_REVIEW', upvotes_count: 27, is_public_issue: true, location_hint: 'Between the new hall and the central field', evidence_urls: [], created_at: iso(-1400), sla_due_at: iso(60 * 40) },
    { id: 'd13a00000-0000-4000-8000-000000000002', university_id: DEMO_UNIVERSITY_ID, tracking_code: 'JU-CASE-2026-770114', title: 'Waterlogging at the main academic building entrance', category: 'INFRASTRUCTURE', severity: 'MEDIUM', status: 'SUBMITTED', upvotes_count: 41, is_public_issue: true, location_hint: 'Main academic building, Gate 2', evidence_urls: [], created_at: iso(-2600), sla_due_at: iso(60 * 70) },
    { id: 'd13a00000-0000-4000-8000-000000000003', university_id: DEMO_UNIVERSITY_ID, tracking_code: 'JU-CASE-2026-119230', title: 'Unsafe broken railing at the TSC footbridge', category: 'INFRASTRUCTURE', severity: 'CRITICAL', status: 'ACTION_TAKEN', upvotes_count: 88, is_public_issue: true, location_hint: 'TSC footbridge', evidence_urls: [], created_at: iso(-4300), sla_due_at: iso(60 * 10) },
  ],
};

const STORAGE_KEY = 'campus360.demo.store.v1';

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function loadOverrides(): Record<string, Row[]> {
  if (!hasSessionStorage()) return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Row[]>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Row[]>) {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* quota or privacy mode — demo writes simply are not persisted */
  }
}

export function demoTable(table: string): Row[] {
  const overrides = loadOverrides();
  const base = DEMO_TABLES[table] ?? [];
  if (!overrides[table]) return [...base];
  return [...overrides[table], ...base];
}

export function demoList(table: string, options: {
  filters?: Record<string, string>;
  search?: string;
  searchColumns?: string[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  mineOnly?: boolean;
  ownerValue?: string;
}): Row[] {
  let rows = demoTable(table);

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (!value || value === 'ALL') continue;
      rows = rows.filter((row) => String(row[key] ?? '').toLowerCase() === value.toLowerCase());
    }
  }

  if (options.search && options.searchColumns?.length) {
    const needle = options.search.toLowerCase();
    rows = rows.filter((row) =>
      options.searchColumns!.some((column) => String(row[column] ?? '').toLowerCase().includes(needle))
    );
  }

  const orderBy = options.orderBy ?? { column: 'created_at', ascending: false };
  rows = [...rows].sort((a, b) => {
    const av = new Date(a[orderBy.column] ?? 0).getTime();
    const bv = new Date(b[orderBy.column] ?? 0).getTime();
    return orderBy.ascending ? av - bv : bv - av;
  });

  return options.limit ? rows.slice(0, options.limit) : rows;
}

export function demoInsert(table: string, row: Row): Row {
  const overrides = loadOverrides();
  const created = {
    id: row.id ?? `demo-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    ...row,
  };
  overrides[table] = [created, ...(overrides[table] ?? [])];
  saveOverrides(overrides);
  return created;
}

export function demoUpdate(table: string, id: string, patch: Row): Row | null {
  const overrides = loadOverrides();
  const list = overrides[table] ?? [];
  const index = list.findIndex((row) => row.id === id);
  if (index >= 0) {
    list[index] = { ...list[index], ...patch };
    overrides[table] = list;
    saveOverrides(overrides);
    return list[index];
  }
  // Base demo rows are treated as read-only seeds; record an override copy.
  const base = (DEMO_TABLES[table] ?? []).find((row) => row.id === id);
  if (!base) return null;
  const updated = { ...base, ...patch };
  overrides[table] = [updated, ...list];
  saveOverrides(overrides);
  return updated;
}

export function demoDelete(table: string, id: string) {
  const overrides = loadOverrides();
  overrides[table] = (overrides[table] ?? []).filter((row) => row.id !== id);
  saveOverrides(overrides);
}

export function demoProfileNames(): Record<string, { full_name: string; trust_level: string }> {
  return profiles;
}
