// apps/web/lib/modules/registry.ts
/**
 * Campus360 module registry.
 *
 * One declarative description per interactive module powers:
 *  - the generic, tenant-isolated REST surface at /api/modules/[module]
 *  - the realtime channel naming used by the client hooks
 *  - server-side validation allow-lists (only registered fields are writable)
 *
 * Nothing here changes the existing UI: it provides the data plumbing the
 * interactive components in `components/modules` consume.
 */

export type FieldType = 'text' | 'longtext' | 'number' | 'money' | 'int' | 'bool' | 'enum' | 'array' | 'date' | 'datetime' | 'uuid';

export interface FieldSpec {
  column: string;
  type: FieldType;
  required?: boolean;
  values?: string[];
  max?: number;
  min?: number;
  default?: unknown;
  /** Injected from the session instead of the request body. */
  owner?: boolean;
  /** Server-computed; never accepted from the client. */
  readOnly?: boolean;
}

export interface ModuleSpec {
  key: string;
  table: string;
  /** Column used to scope rows to the acting user. */
  ownerColumn?: string;
  select?: string;
  fields: FieldSpec[];
  orderBy?: { column: string; ascending: boolean };
  /** Query params accepted for filtering (must be real columns). */
  filters?: string[];
  /** Free-text search columns used by `?q=`. */
  searchColumns?: string[];
  /** Realtime channel suffix so clients can subscribe to table changes. */
  realtimeTable: string;
  /** Status vocabulary for UI badges. */
  statusValues?: string[];
  softDelete?: boolean;
  verifiedOnly?: boolean;
  /**
   * Readable by a signed-out visitor. The route honours this for GET only, and it is a
   * claim about the DATABASE as much as about the UI: a module gets the flag only when
   * supabase/migrations/0013_anon_public_listing_reads.sql gave `anon` a SELECT policy
   * on `table`. Without that policy the read still succeeds and returns zero rows --
   * exactly the "the campus looks empty" failure this change exists to end -- so the
   * flags and the migration are checked against each other in
   * __tests__/anon-listing-reads.test.ts.
   */
  publicRead?: boolean;
  /**
   * Column list for anonymous reads: `select` minus whatever 0013 withheld from `anon`
   * (contact details), and minus embeds on tables guests may not read. PostgREST answers
   * a request for an ungranted column with a 400, so this is not optional for those
   * specs -- their plain `select` still names contact_note / contact_email /
   * alumni_profiles.
   */
  publicSelect?: string;
}

const str = (column: string, required = false, max = 500): FieldSpec => ({ column, type: 'text', required, max });
const long = (column: string, required = false, max = 5000): FieldSpec => ({ column, type: 'longtext', required, max });
const money = (column: string, required = false): FieldSpec => ({ column, type: 'money', required });
const int = (column: string, required = false, min = 0): FieldSpec => ({ column, type: 'int', required, min });
const boolean = (column: string): FieldSpec => ({ column, type: 'bool' });
const arr = (column: string): FieldSpec => ({ column, type: 'array' });
const en = (column: string, values: string[], required = false): FieldSpec => ({ column, type: 'enum', values, required });
const date = (column: string, required = false): FieldSpec => ({ column, type: 'date', required });
const dt = (column: string, required = false): FieldSpec => ({ column, type: 'datetime', required });

export const MODULES: Record<string, ModuleSpec> = {
  /* ------------------------------------------------------------------ */
  /* Module 1 — Campus Economy & Marketplace                            */
  /* ------------------------------------------------------------------ */
  marketplace: {
    key: 'marketplace',
    publicRead: true,
    table: 'marketplace_listings',
    ownerColumn: 'seller_id',
    select: 'id, university_id, seller_id, title, description, category, kind, price_bdt, rent_period, condition, images, status, is_negotiable, keyword_tags, pickup_point_id, views_count, created_at, campus_pickup_points(name_en, name_bn, location_en), profiles:seller_id(full_name, trust_level, avatar_url)',
    fields: [
      str('title', true, 140),
      long('description', true, 2000),
      str('category', true, 60),
      en('kind', ['SELL', 'RENT', 'EXCHANGE', 'WANTED'], true),
      money('price_bdt'),
      str('rent_period', false, 40),
      en('condition', ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']),
      arr('images'),
      arr('keyword_tags'),
      { column: 'pickup_point_id', type: 'uuid' },
      boolean('is_negotiable'),
      en('status', ['AVAILABLE', 'RESERVED', 'SOLD']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['category', 'kind', 'status', 'condition'],
    searchColumns: ['title', 'description'],
    realtimeTable: 'marketplace_listings',
    softDelete: true,
    statusValues: ['AVAILABLE', 'RESERVED', 'SOLD'],
    verifiedOnly: true,
  },
  'marketplace-pickup-points': {
    key: 'marketplace-pickup-points',
    publicRead: true,
    table: 'campus_pickup_points',
    select: 'id, university_id, code, name_en, name_bn, location_en, location_bn, is_active',
    fields: [
      str('name_en', true, 120),
      str('name_bn', true, 120),
      str('code', true, 20),
      str('location_en', true, 200),
      str('location_bn', true, 200),
    ],
    orderBy: { column: 'name_en', ascending: true },
    realtimeTable: 'campus_pickup_points',
  },
  'marketplace-orders': {
    key: 'marketplace-orders',
    table: 'marketplace_orders',
    ownerColumn: 'buyer_id',
    select: 'id, university_id, listing_id, buyer_id, seller_id, pickup_point_id, amount_bdt, order_code, note, status, meetup_window, created_at, campus_pickup_points(name_en, location_en)',
    fields: [
      { column: 'listing_id', type: 'uuid', required: true },
      { column: 'seller_id', type: 'uuid', required: true },
      money('amount_bdt'),
      str('note', false, 500),
      str('meetup_window', false, 120),
      en('status', ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['status', 'listing_id'],
    realtimeTable: 'marketplace_orders',
    verifiedOnly: true,
  },
  'marketplace-messages': {
    key: 'marketplace-messages',
    table: 'marketplace_messages',
    ownerColumn: 'sender_id',
    select: 'id, university_id, listing_id, sender_id, recipient_id, body, read_at, created_at',
    fields: [
      { column: 'listing_id', type: 'uuid', required: true },
      { column: 'recipient_id', type: 'uuid', required: true },
      long('body', true, 2000),
    ],
    orderBy: { column: 'created_at', ascending: true },
    filters: ['listing_id'],
    realtimeTable: 'marketplace_messages',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 2 — Skill Hub, Tutoring & Part-Time Jobs                    */
  /* ------------------------------------------------------------------ */
  skills: {
    key: 'skills',
    publicRead: true,
    table: 'skill_postings',
    ownerColumn: 'author_id',
    select: 'id, university_id, author_id, type, title, description, category, skills, location_en, location_bn, availability, rate_bdt, is_remote, status, applicants_count, created_at',
    fields: [
      en('type', ['TUTORING', 'FREELANCE', 'PART_TIME_JOB', 'INTERNSHIP'], true),
      str('title', true, 140),
      long('description', true, 3000),
      str('category', true, 60),
      arr('skills'),
      str('location_en', false, 120),
      str('location_bn', false, 120),
      en('availability', ['FLEXIBLE', 'WEEKDAYS', 'WEEKENDS', 'EVENINGS', 'MORNING']),
      money('rate_bdt'),
      boolean('is_remote'),
      str('contact_note', false, 240),
      en('status', ['OPEN', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['type', 'category', 'status', 'availability', 'is_remote'],
    searchColumns: ['title', 'description'],
    realtimeTable: 'skill_postings',
    statusValues: ['OPEN', 'CLOSED'],
    verifiedOnly: true,
  },
  'skill-applications': {
    key: 'skill-applications',
    table: 'skill_applications',
    ownerColumn: 'applicant_id',
    select: 'id, university_id, posting_id, applicant_id, message, status, created_at',
    fields: [{ column: 'posting_id', type: 'uuid', required: true }, long('message', false, 1000)],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['posting_id', 'status'],
    realtimeTable: 'skill_applications',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 3 — Civic Ticketing (upvotes)                               */
  /* ------------------------------------------------------------------ */
  'complaint-upvotes': {
    key: 'complaint-upvotes',
    table: 'complaint_upvotes',
    ownerColumn: 'user_id',
    select: 'id, university_id, complaint_id, user_id, created_at',
    fields: [{ column: 'complaint_id', type: 'uuid', required: true }],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['complaint_id'],
    realtimeTable: 'complaint_upvotes',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 4 — Events & Club Connect                                   */
  /* ------------------------------------------------------------------ */
  clubs: {
    key: 'clubs',
    publicRead: true,
    table: 'clubs',
    select: 'id, university_id, slug, name_en, name_bn, category, description_en, description_bn, logo_url, member_count, is_recruiting, contact_email, created_at',
    publicSelect: 'id, university_id, slug, name_en, name_bn, category, description_en, description_bn, logo_url, member_count, is_recruiting, created_at',
    fields: [
      str('name_en', true, 120),
      str('name_bn', true, 120),
      str('category', true, 60),
      long('description_en', true, 2000),
      long('description_bn', false, 2000),
      boolean('is_recruiting'),
      str('contact_email', false, 160),
    ],
    orderBy: { column: 'name_en', ascending: true },
    filters: ['category', 'is_recruiting'],
    searchColumns: ['name_en', 'name_bn', 'description_en'],
    realtimeTable: 'clubs',
    verifiedOnly: true,
  },
  'club-members': {
    key: 'club-members',
    table: 'club_members',
    ownerColumn: 'user_id',
    select: 'id, university_id, club_id, user_id, member_role, status, created_at',
    fields: [{ column: 'club_id', type: 'uuid', required: true }, en('member_role', ['MEMBER', 'EXECUTIVE', 'PRESIDENT'])],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['club_id'],
    realtimeTable: 'club_members',
    verifiedOnly: true,
  },
  'club-notices': {
    key: 'club-notices',
    publicRead: true,
    table: 'club_notices',
    ownerColumn: 'author_id',
    select: 'id, university_id, club_id, author_id, title, body, created_at',
    fields: [{ column: 'club_id', type: 'uuid', required: true }, str('title', true, 160), long('body', true, 3000)],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['club_id'],
    realtimeTable: 'club_notices',
    verifiedOnly: true,
  },
  'event-rsvps': {
    key: 'event-rsvps',
    table: 'event_rsvps',
    ownerColumn: 'user_id',
    select: 'id, event_id, university_id, user_id, status, checked_in_at, created_at',
    fields: [{ column: 'event_id', type: 'uuid', required: true }, en('status', ['GOING', 'INTERESTED', 'CANCELLED'])],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['event_id', 'status'],
    realtimeTable: 'event_rsvps',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 5 — Emergency & Health                                      */
  /* ------------------------------------------------------------------ */
  'blood-requests': {
    key: 'blood-requests',
    table: 'blood_requests',
    ownerColumn: 'requester_id',
    select: 'id, university_id, requester_id, patient_name, blood_group, bags_needed, hospital_name, hospital_address, contact_phone, urgency, needed_by, status, created_at, profiles:requester_id(full_name)',
    fields: [
      str('patient_name', true, 120),
      en('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], true),
      int('bags_needed', true, 1),
      str('hospital_name', true, 160),
      str('hospital_address', true, 240),
      str('contact_phone', true, 32),
      en('urgency', ['NORMAL', 'URGENT', 'CRITICAL']),
      dt('needed_by', true),
      en('status', ['OPEN', 'FULFILLED', 'CANCELLED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['blood_group', 'urgency', 'status'],
    realtimeTable: 'blood_requests',
    statusValues: ['OPEN', 'FULFILLED', 'CANCELLED'],
    verifiedOnly: true,
  },
  'blood-responses': {
    key: 'blood-responses',
    table: 'blood_request_responses',
    ownerColumn: 'user_id',
    select: 'id, university_id, request_id, user_id, donor_id, message, status, created_at',
    fields: [{ column: 'request_id', type: 'uuid', required: true }, long('message', false, 500)],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['request_id'],
    realtimeTable: 'blood_request_responses',
    verifiedOnly: true,
  },
  donors: {
    key: 'donors',
    table: 'health_donors',
    ownerColumn: 'user_id',
    select: 'id, university_id, user_id, blood_group, last_donated_at, is_available, verified_donations_count, hall_id, halls(name_en, name_bn), profiles:user_id(full_name, avatar_url)',
    fields: [
      en('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], true),
      str('contact_phone', true, 32),
      date('last_donated_at'),
      boolean('is_available'),
      { column: 'hall_id', type: 'uuid' },
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['blood_group', 'is_available'],
    realtimeTable: 'health_donors',
    verifiedOnly: true,
  },
  'health-contacts': {
    key: 'health-contacts',
    publicRead: true,
    table: 'health_contacts',
    select: 'id, university_id, kind, label_en, label_bn, phone, available_hours, notes_en, notes_bn, is_active',
    fields: [
      en('kind', ['AMBULANCE', 'MEDICAL_CENTER', 'COUNSELING', 'SECURITY', 'NATIONAL'], true),
      str('label_en', true, 120),
      str('label_bn', true, 120),
      str('phone', true, 32),
      str('available_hours', false, 60),
      long('notes_en', false, 500),
      long('notes_bn', false, 500),
    ],
    orderBy: { column: 'kind', ascending: true },
    filters: ['kind'],
    realtimeTable: 'health_contacts',
  },
  'counseling-slots': {
    key: 'counseling-slots',
    table: 'counseling_slots',
    select: 'id, university_id, counselor_alias, mode, starts_at, ends_at, capacity, booked_count, is_active',
    fields: [
      str('counselor_alias', true, 80),
      en('mode', ['IN_PERSON', 'ONLINE', 'PHONE']),
      dt('starts_at', true),
      dt('ends_at', true),
      int('capacity', false, 1),
    ],
    orderBy: { column: 'starts_at', ascending: true },
    filters: ['mode', 'counselor_alias'],
    realtimeTable: 'counseling_slots',
  },

  /* ------------------------------------------------------------------ */
  /* Module 6 — Academic Archive & Mentorship                           */
  /* ------------------------------------------------------------------ */
  mentors: {
    key: 'mentors',
    publicRead: true,
    table: 'mentor_profiles',
    ownerColumn: 'user_id',
    select: 'id, university_id, user_id, headline, expertise, languages, session_rate_bdt, bio, is_accepting, sessions_count, rating, profiles:user_id(full_name, avatar_url)',
    fields: [
      str('headline', true, 140),
      arr('expertise'),
      arr('languages'),
      money('session_rate_bdt'),
      long('bio', false, 1500),
      boolean('is_accepting'),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['is_accepting'],
    searchColumns: ['headline', 'bio'],
    realtimeTable: 'mentor_profiles',
    verifiedOnly: true,
  },
  'mentorship-slots': {
    key: 'mentorship-slots',
    publicRead: true,
    table: 'mentorship_slots',
    ownerColumn: 'mentor_id',
    select: 'id, university_id, mentor_id, topic, starts_at, ends_at, capacity, booked_count, is_active, mentor_profiles(headline, user_id, profiles:user_id(full_name))',
    fields: [
      { column: 'mentor_id', type: 'uuid', required: true },
      str('topic', true, 160),
      dt('starts_at', true),
      dt('ends_at', true),
      int('capacity', false, 1),
    ],
    orderBy: { column: 'starts_at', ascending: true },
    filters: ['mentor_id', 'topic'],
    realtimeTable: 'mentorship_slots',
    verifiedOnly: true,
  },
  'mentorship-bookings': {
    key: 'mentorship-bookings',
    table: 'mentorship_bookings',
    ownerColumn: 'mentee_id',
    select: 'id, university_id, slot_id, mentor_id, mentee_id, message, status, created_at',
    fields: [
      { column: 'slot_id', type: 'uuid', required: true },
      { column: 'mentor_id', type: 'uuid', required: true },
      long('message', false, 1000),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['slot_id', 'status'],
    realtimeTable: 'mentorship_bookings',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 7 — Housing & Commute                                       */
  /* ------------------------------------------------------------------ */
  housing: {
    key: 'housing',
    publicRead: true,
    table: 'housing_listings',
    ownerColumn: 'owner_id',
    select: 'id, university_id, owner_id, kind, title, description, rent_bdt, seat_count, gender_policy, area_en, area_bn, distance_km, amenities, image_urls, status, created_at',
    fields: [
      en('kind', ['MESS_SEAT', 'HOSTEL_SEAT', 'SUB_LET', 'FAMILY_FLAT', 'PAYING_GUEST'], true),
      str('title', true, 160),
      long('description', true, 3000),
      money('rent_bdt'),
      int('seat_count', false, 1),
      en('gender_policy', ['MALE', 'FEMALE', 'ANY']),
      str('area_en', true, 120),
      str('area_bn', false, 120),
      arr('amenities'),
      arr('image_urls'),
      str('contact_phone', false, 32),
      en('status', ['AVAILABLE', 'FILLED', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['kind', 'status', 'gender_policy'],
    searchColumns: ['title', 'description', 'area_en'],
    realtimeTable: 'housing_listings',
    statusValues: ['AVAILABLE', 'FILLED', 'CLOSED'],
    verifiedOnly: true,
  },
  rideshare: {
    key: 'rideshare',
    publicRead: true,
    table: 'rideshare_offers',
    ownerColumn: 'owner_id',
    select: 'id, university_id, owner_id, mode, origin, destination, depart_at, seats_total, seats_available, fare_bdt, vehicle_details, notes, status, created_at, profiles:owner_id(full_name)',
    fields: [
      en('mode', ['BUS', 'TRAIN', 'CARPOOL', 'MICROBUS'], true),
      str('origin', true, 120),
      str('destination', true, 120),
      dt('depart_at', true),
      int('seats_total', false, 1),
      int('seats_available', false, 0),
      money('fare_bdt'),
      str('vehicle_details', false, 160),
      long('notes', false, 500),
      en('status', ['OPEN', 'FULL', 'CANCELLED']),
    ],
    orderBy: { column: 'depart_at', ascending: true },
    filters: ['mode', 'status', 'destination'],
    searchColumns: ['origin', 'destination'],
    realtimeTable: 'rideshare_offers',
    verifiedOnly: true,
  },
  'ride-requests': {
    key: 'ride-requests',
    table: 'rideshare_requests',
    ownerColumn: 'user_id',
    select: 'id, university_id, user_id, mode, origin, destination, depart_at, seats_needed, notes, matched_offer_id, status, created_at',
    fields: [
      en('mode', ['BUS', 'TRAIN', 'CARPOOL', 'MICROBUS'], true),
      str('origin', true, 120),
      str('destination', true, 120),
      dt('depart_at', true),
      int('seats_needed', false, 1),
      long('notes', false, 500),
      { column: 'matched_offer_id', type: 'uuid' },
      en('status', ['OPEN', 'MATCHED', 'CANCELLED']),
    ],
    orderBy: { column: 'depart_at', ascending: true },
    filters: ['mode', 'status'],
    realtimeTable: 'rideshare_requests',
    verifiedOnly: true,
  },
  'ticket-exchange': {
    key: 'ticket-exchange',
    table: 'ticket_exchanges',
    ownerColumn: 'seller_id',
    select: 'id, university_id, seller_id, mode, route_from, route_to, travel_date, seat_count, price_bdt, notes, status, created_at',
    fields: [
      en('mode', ['BUS', 'TRAIN', 'CARPOOL', 'MICROBUS']),
      str('route_from', true, 120),
      str('route_to', true, 120),
      date('travel_date', true),
      int('seat_count', false, 1),
      money('price_bdt'),
      long('notes', false, 500),
      en('status', ['AVAILABLE', 'EXCHANGED', 'WITHDRAWN']),
    ],
    orderBy: { column: 'travel_date', ascending: true },
    filters: ['mode', 'status'],
    realtimeTable: 'ticket_exchanges',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 8 — Alumni & Career Hub                                     */
  /* ------------------------------------------------------------------ */
  alumni: {
    key: 'alumni',
    table: 'alumni_profiles',
    ownerColumn: 'user_id',
    select: 'id, university_id, user_id, graduation_year, degree, employer, job_title, industry, city, country, linkedin_url, offers_referrals, is_mentor, profiles:user_id(full_name, avatar_url)',
    fields: [
      int('graduation_year', true, 1970),
      str('degree', false, 120),
      str('employer', true, 160),
      str('job_title', true, 160),
      str('industry', true, 80),
      str('city', false, 80),
      str('country', false, 80),
      str('linkedin_url', false, 240),
      boolean('offers_referrals'),
      boolean('is_mentor'),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['industry', 'offers_referrals'],
    searchColumns: ['employer', 'job_title', 'industry'],
    realtimeTable: 'alumni_profiles',
    verifiedOnly: true,
  },
  careers: {
    key: 'careers',
    publicRead: true,
    table: 'career_opportunities',
    ownerColumn: 'alumni_id',
    select: 'id, university_id, alumni_id, kind, company, title, description, location, is_remote, salary_range, apply_url, deadline, status, created_at, alumni_profiles(job_title, employer, profiles:user_id(full_name))',
    publicSelect: 'id, university_id, alumni_id, kind, company, title, description, location, is_remote, salary_range, apply_url, deadline, status, created_at',
    fields: [
      { column: 'alumni_id', type: 'uuid', required: true },
      en('kind', ['INTERNSHIP', 'FULL_TIME', 'REFERRAL', 'PART_TIME', 'CONTRACT'], true),
      str('company', true, 160),
      str('title', true, 160),
      long('description', true, 4000),
      str('location', false, 120),
      boolean('is_remote'),
      str('salary_range', false, 80),
      str('apply_url', false, 300),
      date('deadline'),
      en('status', ['OPEN', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['kind', 'status', 'is_remote'],
    searchColumns: ['company', 'title', 'description'],
    realtimeTable: 'career_opportunities',
    verifiedOnly: true,
  },
  'career-applications': {
    key: 'career-applications',
    table: 'career_applications',
    ownerColumn: 'applicant_id',
    select: 'id, university_id, opportunity_id, applicant_id, message, resume_url, status, created_at',
    fields: [
      { column: 'opportunity_id', type: 'uuid', required: true },
      long('message', false, 1500),
      str('resume_url', false, 300),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['opportunity_id', 'status'],
    realtimeTable: 'career_applications',
    verifiedOnly: true,
  },
  conversations: {
    key: 'conversations',
    table: 'direct_conversations',
    select: 'id, university_id, user_a, user_b, context, last_message_at, created_at',
    fields: [{ column: 'user_b', type: 'uuid', required: true }, str('context', false, 120)],
    orderBy: { column: 'last_message_at', ascending: false },
    realtimeTable: 'direct_conversations',
    verifiedOnly: true,
  },
  messages: {
    key: 'messages',
    table: 'direct_messages',
    ownerColumn: 'sender_id',
    select: 'id, university_id, conversation_id, sender_id, body, read_at, created_at',
    fields: [{ column: 'conversation_id', type: 'uuid', required: true }, long('body', true, 4000)],
    orderBy: { column: 'created_at', ascending: true },
    filters: ['conversation_id'],
    realtimeTable: 'direct_messages',
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 9 — Smart Cafeteria & Home-Made Food                        */
  /* ------------------------------------------------------------------ */
  'cafeteria-menus': {
    key: 'cafeteria-menus',
    publicRead: true,
    table: 'cafeteria_menus',
    select: 'id, university_id, hall_id, name_en, name_bn, serving_date, meal, pickup_window, is_active, halls(name_en), cafeteria_items(id, name_en, name_bn, price_bdt, is_available, is_vegetarian)',
    fields: [
      str('name_en', true, 120),
      str('name_bn', true, 120),
      date('serving_date', true),
      en('meal', ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'], true),
      str('pickup_window', false, 80),
      { column: 'hall_id', type: 'uuid' },
      boolean('is_active'),
    ],
    orderBy: { column: 'serving_date', ascending: false },
    filters: ['meal', 'serving_date'],
    realtimeTable: 'cafeteria_menus',
    verifiedOnly: true,
  },
  'cafeteria-items': {
    key: 'cafeteria-items',
    publicRead: true,
    table: 'cafeteria_items',
    select: 'id, university_id, menu_id, name_en, name_bn, price_bdt, is_available, stock, is_vegetarian',
    fields: [
      { column: 'menu_id', type: 'uuid', required: true },
      str('name_en', true, 120),
      str('name_bn', false, 120),
      money('price_bdt', true),
      boolean('is_available'),
      boolean('is_vegetarian'),
      int('stock', false, 0),
    ],
    orderBy: { column: 'name_en', ascending: true },
    filters: ['menu_id', 'is_available'],
    realtimeTable: 'cafeteria_items',
    verifiedOnly: true,
  },
  'home-food': {
    key: 'home-food',
    table: 'home_food_listings',
    ownerColumn: 'cook_id',
    select: 'id, university_id, cook_id, title, description, cuisine, price_bdt, portion, delivery_available, delivery_fee_bdt, available_from, available_to, image_url, status, created_at, profiles:cook_id(full_name)',
    fields: [
      str('title', true, 140),
      long('description', true, 1500),
      str('cuisine', false, 60),
      money('price_bdt', true),
      str('portion', false, 60),
      boolean('delivery_available'),
      money('delivery_fee_bdt'),
      str('available_from', false, 20),
      str('available_to', false, 20),
      str('image_url', false, 400),
      en('status', ['AVAILABLE', 'SOLD_OUT', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['cuisine', 'status', 'delivery_available'],
    searchColumns: ['title', 'description', 'cuisine'],
    realtimeTable: 'home_food_listings',
    verifiedOnly: true,
  },
  'food-orders': {
    key: 'food-orders',
    table: 'food_orders',
    ownerColumn: 'buyer_id',
    select: 'id, university_id, buyer_id, order_code, source, menu_id, item_id, food_listing_id, item_name, quantity, total_bdt, pickup_window, fulfilment, delivery_spot, status, created_at',
    fields: [
      en('source', ['CAFETERIA', 'HOME_FOOD']),
      { column: 'menu_id', type: 'uuid' },
      { column: 'item_id', type: 'uuid' },
      { column: 'food_listing_id', type: 'uuid' },
      str('item_name', true, 160),
      int('quantity', false, 1),
      money('total_bdt', true),
      str('pickup_window', false, 80),
      en('fulfilment', ['PICKUP', 'CAMPUS_DELIVERY']),
      str('delivery_spot', false, 160),
      en('status', ['PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['source', 'status'],
    realtimeTable: 'food_orders',
    statusValues: ['PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 10 — Lost & Found                                           */
  /* ------------------------------------------------------------------ */
  'lost-found': {
    key: 'lost-found',
    publicRead: true,
    table: 'lost_items',
    ownerColumn: 'reporter_id',
    select: 'id, university_id, reporter_id, kind, title, description, category, keywords, location_en, occurred_on, image_urls, contact_note, status, matched_item_id, created_at, profiles:reporter_id(full_name)',
    publicSelect: 'id, university_id, reporter_id, kind, title, description, category, keywords, location_en, occurred_on, image_urls, status, matched_item_id, created_at, profiles:reporter_id(full_name)',
    fields: [
      en('kind', ['LOST', 'FOUND'], true),
      str('title', true, 140),
      long('description', true, 1500),
      str('category', true, 60),
      arr('keywords'),
      str('location_en', false, 160),
      date('occurred_on'),
      arr('image_urls'),
      str('contact_note', false, 240),
      en('status', ['OPEN', 'RESOLVED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['kind', 'category', 'status'],
    searchColumns: ['title', 'description'],
    realtimeTable: 'lost_items',
    statusValues: ['OPEN', 'RESOLVED'],
    verifiedOnly: true,
  },

  /* ------------------------------------------------------------------ */
  /* Module 11 — Sports & Crowdfunding                                  */
  /* ------------------------------------------------------------------ */
  'sports-teams': {
    key: 'sports-teams',
    publicRead: true,
    table: 'sports_teams',
    ownerColumn: 'captain_id',
    select: 'id, university_id, captain_id, name, sport, skill_level, needed_roles, description, contact_note, status, created_at',
    publicSelect: 'id, university_id, captain_id, name, sport, skill_level, needed_roles, description, status, created_at',
    fields: [
      str('name', true, 120),
      str('sport', true, 60),
      en('skill_level', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ANY']),
      arr('needed_roles'),
      long('description', false, 1000),
      str('contact_note', false, 160),
      en('status', ['OPEN', 'FULL', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['sport', 'status', 'skill_level'],
    searchColumns: ['name', 'sport', 'description'],
    realtimeTable: 'sports_teams',
    verifiedOnly: true,
  },
  'sports-challenges': {
    key: 'sports-challenges',
    publicRead: true,
    table: 'sports_challenges',
    ownerColumn: 'challenger_id',
    select: 'id, university_id, challenger_id, team_name, sport, title, description, preferred_date, venue, status, created_at',
    fields: [
      str('team_name', true, 120),
      str('sport', true, 60),
      str('title', true, 160),
      long('description', false, 1000),
      dt('preferred_date'),
      str('venue', false, 160),
      en('status', ['OPEN', 'ACCEPTED', 'PLAYED', 'CANCELLED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['sport', 'status'],
    realtimeTable: 'sports_challenges',
    verifiedOnly: true,
  },
  'sports-venues': {
    key: 'sports-venues',
    publicRead: true,
    table: 'sports_venues',
    select: 'id, university_id, name_en, name_bn, sport, capacity, hourly_rate_bdt, lat, lng, is_active',
    fields: [
      str('name_en', true, 120),
      str('name_bn', true, 120),
      str('sport', true, 60),
      int('capacity', false, 1),
      money('hourly_rate_bdt'),
    ],
    orderBy: { column: 'name_en', ascending: true },
    filters: ['sport'],
    realtimeTable: 'sports_venues',
    verifiedOnly: true,
  },
  'venue-bookings': {
    key: 'venue-bookings',
    table: 'sports_venue_bookings',
    ownerColumn: 'user_id',
    select: 'id, university_id, venue_id, user_id, team_name, starts_at, ends_at, purpose, status, created_at, sports_venues(name_en, sport)',
    fields: [
      { column: 'venue_id', type: 'uuid', required: true },
      str('team_name', true, 120),
      dt('starts_at', true),
      dt('ends_at', true),
      str('purpose', false, 200),
      en('status', ['CONFIRMED', 'CANCELLED']),
    ],
    orderBy: { column: 'starts_at', ascending: true },
    filters: ['venue_id', 'status'],
    realtimeTable: 'sports_venue_bookings',
    verifiedOnly: true,
  },
  campaigns: {
    key: 'campaigns',
    publicRead: true,
    table: 'donation_campaigns',
    ownerColumn: 'organizer_id',
    select: 'id, university_id, organizer_id, title, story, cause, target_bdt, raised_bdt, donors_count, deadline, cover_image_url, is_verified, status, created_at',
    fields: [
      str('title', true, 160),
      long('story', true, 5000),
      en('cause', ['MEDICAL', 'EVENT', 'SPORTS', 'ACADEMIC', 'EMERGENCY', 'OTHER']),
      money('target_bdt', true),
      date('deadline'),
      str('cover_image_url', false, 400),
      en('status', ['ACTIVE', 'COMPLETED', 'CLOSED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['cause', 'status'],
    searchColumns: ['title', 'story'],
    realtimeTable: 'donation_campaigns',
    verifiedOnly: true,
  },
  donations: {
    key: 'donations',
    table: 'donations',
    ownerColumn: 'donor_id',
    select: 'id, university_id, campaign_id, donor_id, donor_name, amount_bdt, message, is_anonymous, status, created_at',
    fields: [
      { column: 'campaign_id', type: 'uuid', required: true },
      money('amount_bdt', true),
      str('donor_name', false, 120),
      long('message', false, 500),
      boolean('is_anonymous'),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['campaign_id', 'status'],
    realtimeTable: 'donations',
    verifiedOnly: true,
  },
  'donation-ledger': {
    key: 'donation-ledger',
    table: 'donation_ledger',
    select: 'id, university_id, campaign_id, entry_type, amount_bdt, description, proof_url, created_at',
    fields: [
      { column: 'campaign_id', type: 'uuid', required: true },
      en('entry_type', ['DONATION', 'DISBURSEMENT'], true),
      money('amount_bdt', true),
      str('description', true, 240),
      str('proof_url', false, 400),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['campaign_id', 'entry_type'],
    realtimeTable: 'donation_ledger',
  },

  /* ------------------------------------------------------------------ */
  /* Module 12 — Trust, Verification & Disputes                         */
  /* ------------------------------------------------------------------ */
  disputes: {
    key: 'disputes',
    table: 'disputes',
    ownerColumn: 'opened_by',
    select: 'id, university_id, opened_by, against_user_id, subject, description, category, reference_code, status, resolution, created_at',
    fields: [
      str('subject', true, 160),
      long('description', true, 3000),
      str('category', false, 60),
      { column: 'against_user_id', type: 'uuid' },
      en('status', ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['status', 'category'],
    realtimeTable: 'disputes',
    verifiedOnly: true,
  },
  'dispute-messages': {
    key: 'dispute-messages',
    table: 'dispute_messages',
    ownerColumn: 'sender_id',
    select: 'id, university_id, dispute_id, sender_id, is_admin, body, created_at',
    fields: [{ column: 'dispute_id', type: 'uuid', required: true }, long('body', true, 2000)],
    orderBy: { column: 'created_at', ascending: true },
    filters: ['dispute_id'],
    realtimeTable: 'dispute_messages',
    verifiedOnly: true,
  },
  /* ------------------------------------------------------------------ */
  /* Supporting registries used by module widgets                       */
  /* ------------------------------------------------------------------ */
  'skill-alerts': {
    key: 'skill-alerts',
    table: 'skill_alerts',
    ownerColumn: 'user_id',
    select: 'id, university_id, user_id, keywords, categories, created_at',
    fields: [arr('keywords'), arr('categories')],
    orderBy: { column: 'created_at', ascending: false },
    realtimeTable: 'skill_alerts',
    verifiedOnly: true,
  },
  'lost-item-matches': {
    key: 'lost-item-matches',
    table: 'lost_item_matches',
    select: 'id, university_id, lost_item_id, found_item_id, score, notified, created_at',
    fields: [],
    orderBy: { column: 'created_at', ascending: false },
    realtimeTable: 'lost_item_matches',
  },
  reviews: {
    key: 'reviews',
    publicRead: true,
    table: 'reviews',
    ownerColumn: 'author_id',
    select: 'id, university_id, author_id, target_type, target_id, rating, title, body, verified_participation, created_at',
    fields: [
      en('target_type', [
        'MARKETPLACE',
        'BLOOD_DONOR',
        'ARCHIVE_FILE',
        'EVENT',
        'COMPLAINT_RESOLUTION',
        'TRANSPORTATION',
        'HALL_DINING',
        'LIBRARY',
        'TUTORING',
        'HOUSING',
        'LOST_AND_FOUND',
        'CLUBS',
        'NOTICE_BOARD',
      ], true),
      { column: 'target_id', type: 'uuid', required: true },
      int('rating', true, 1),
      str('title', false, 140),
      long('body', true, 3000),
      arr('photo_urls'),
      arr('tags'),
    ],
    orderBy: { column: 'created_at', ascending: false },
    filters: ['target_type', 'target_id'],
    realtimeTable: 'reviews',
    verifiedOnly: true,
  },
};

export function getModule(key: string): ModuleSpec | null {
  return MODULES[key] ?? null;
}

export const MODULE_KEYS = Object.keys(MODULES);

/**
 * Who may read a module's list, decided in one place so the rule is unit-testable
 * without a Next request, and so the route can never drift into "anonymous callers get
 * the member query" (which would hand them the tenant filter and a `mine` scope) or
 * "anonymous callers get the member column list" (which PostgREST rejects with a 400,
 * because 0013 withheld those columns).
 *
 *  - 'member'  a session exists: tenant-scoped, full `select`.
 *  - 'public'  no session, module is publicly listed: no campus filter, `publicSelect`.
 *  - 'deny'    no session and not public -- or no server credentials at all, where the
 *              honest answer is requireAuth()'s 401/503 rather than an empty array that
 *              reads as "this campus has nothing".
 */
export function resolveListingAccess(
  spec: Pick<ModuleSpec, 'publicRead'>,
  state: { hasSession: boolean; serverConfigured: boolean }
): 'member' | 'public' | 'deny' {
  if (state.hasSession) return 'member';
  if (!state.serverConfigured) return 'deny';
  return spec.publicRead === true ? 'public' : 'deny';
}
