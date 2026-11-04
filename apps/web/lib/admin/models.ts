// apps/web/lib/admin/models.ts
// ============================================================================
// Declarative model registry for the /admin/panel CRUD surface
// (success criterion 4): one config per managed section powers the generic
// table + drawer forms and the /api/admin/models/* handlers. Every model maps
// to a Supabase table (live mode) and its marked demo-store counterpart
// (preview mode), so create/edit/delete works in both.
// ============================================================================

export type AdminFieldType = 'text' | 'longtext' | 'number' | 'enum' | 'bool';

export interface AdminField {
  column: string;
  type: AdminFieldType;
  required?: boolean;
  values?: string[];
  /** Injected automatically on create (owner/university), not shown in forms. */
  auto?: boolean;
}

export interface AdminSection {
  key: string;
  /** i18n key for the section header. */
  label: string;
  /** Supabase table. */
  table: string;
  /** Demo-store table (preview fallback). */
  demoTable: string;
  /** Columns shown in the table view (first is the row title). */
  columns: string[];
  fields: AdminField[];
  orderBy?: { column: string; ascending: boolean };
  /** Tenant-scoped rows: admin sees all, but new rows default to the session campus. */
  scoped?: boolean;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'users',
    label: 'Users',
    table: 'profiles',
    demoTable: 'profiles',
    columns: ['full_name', 'email', 'student_id', 'trust_level'],
    fields: [
      { column: 'full_name', type: 'text', required: true },
      { column: 'email', type: 'text', required: true },
      { column: 'student_id', type: 'text', required: true },
      { column: 'batch', type: 'text' },
      { column: 'trust_level', type: 'enum', values: ['UNVERIFIED', 'EMAIL_VERIFIED', 'ID_VERIFIED', 'TRUSTED'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'universities',
    label: 'Universities',
    table: 'universities',
    demoTable: 'universities',
    columns: ['code', 'name_en', 'category', 'city'],
    fields: [
      { column: 'code', type: 'text', required: true },
      { column: 'name_en', type: 'text', required: true },
      { column: 'name_bn', type: 'text', required: true },
      {
        column: 'category',
        type: 'enum',
        required: true,
        values: ['GENERAL', 'SCIENCE_AND_TECH', 'ENGINEERING', 'AGRICULTURAL', 'SPECIALIZED', 'OPEN_AND_AFFILIATING'],
      },
      { column: 'city', type: 'text', required: true },
      { column: 'lat', type: 'number' },
      { column: 'lng', type: 'number' },
    ],
    orderBy: { column: 'name_en', ascending: true },
  },
  {
    key: 'halls',
    label: 'Halls',
    table: 'university_halls',
    demoTable: 'university_halls',
    columns: ['name', 'name_bn', 'type', 'is_active'],
    fields: [
      { column: 'name', type: 'text', required: true },
      { column: 'name_bn', type: 'text' },
      { column: 'type', type: 'enum', required: true, values: ['RESIDENTIAL', 'DAY_SCHOLAR'] },
      { column: 'is_active', type: 'bool' },
    ],
    orderBy: { column: 'name', ascending: true },
    scoped: true,
  },
  {
    key: 'marketplace-listings',
    label: 'Marketplace Listings',
    table: 'marketplace_listings',
    demoTable: 'marketplace_listings',
    columns: ['title', 'category', 'kind', 'price_bdt', 'status'],
    fields: [
      { column: 'title', type: 'text', required: true },
      { column: 'description', type: 'longtext' },
      { column: 'category', type: 'text' },
      { column: 'kind', type: 'enum', values: ['SELL', 'RENT', 'EXCHANGE', 'WANTED'] },
      { column: 'price_bdt', type: 'number' },
      { column: 'status', type: 'enum', values: ['AVAILABLE', 'RESERVED', 'SOLD'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'civic-tickets',
    label: 'Civic Tickets',
    table: 'complaints',
    demoTable: 'complaints_public',
    columns: ['tracking_code', 'title', 'category', 'severity', 'status'],
    fields: [
      { column: 'title', type: 'text', required: true },
      { column: 'description', type: 'longtext' },
      { column: 'category', type: 'enum', values: ['INFRASTRUCTURE', 'SECURITY', 'TRANSPORT', 'HALL_RESIDENCE', 'HEALTH', 'ACADEMIC', 'HARASSMENT', 'OTHER'] },
      { column: 'severity', type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      {
        column: 'status',
        type: 'enum',
        values: ['SUBMITTED', 'ACKNOWLEDGED', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'CLOSED', 'REJECTED_WITH_REASON'],
      },
      { column: 'location_hint', type: 'text' },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'events',
    label: 'Events',
    table: 'events',
    demoTable: 'events',
    columns: ['title_en', 'category', 'venue_name', 'starts_at', 'rsvp_count'],
    fields: [
      { column: 'title_en', type: 'text', required: true },
      { column: 'title_bn', type: 'text' },
      { column: 'description_en', type: 'longtext' },
      { column: 'category', type: 'text' },
      { column: 'venue_name', type: 'text' },
      { column: 'starts_at', type: 'text' },
      { column: 'capacity', type: 'number' },
    ],
    orderBy: { column: 'starts_at', ascending: true },
    scoped: true,
  },
  {
    key: 'blood-requests',
    label: 'Blood Requests',
    table: 'blood_requests',
    demoTable: 'blood_requests',
    columns: ['patient_name', 'blood_group', 'hospital_name', 'urgency', 'status'],
    fields: [
      { column: 'patient_name', type: 'text', required: true },
      { column: 'blood_group', type: 'enum', required: true, values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      { column: 'bags_needed', type: 'number' },
      { column: 'hospital_name', type: 'text' },
      { column: 'hospital_address', type: 'text' },
      { column: 'urgency', type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      { column: 'status', type: 'enum', values: ['OPEN', 'FULFILLED', 'CANCELLED'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'lost-items',
    label: 'Lost Items',
    table: 'lost_items',
    demoTable: 'lost_items',
    columns: ['title', 'kind', 'category', 'status', 'location_en'],
    fields: [
      { column: 'title', type: 'text', required: true },
      { column: 'description', type: 'longtext' },
      { column: 'kind', type: 'enum', required: true, values: ['LOST', 'FOUND'] },
      { column: 'category', type: 'text' },
      { column: 'status', type: 'enum', values: ['OPEN', 'MATCHED', 'RESOLVED', 'CLOSED'] },
      { column: 'location_en', type: 'text' },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'housing-listings',
    label: 'Housing Listings',
    table: 'housing_listings',
    demoTable: 'housing_listings',
    columns: ['title', 'area_en', 'rent_bdt', 'bedrooms', 'status'],
    fields: [
      { column: 'title', type: 'text', required: true },
      { column: 'description', type: 'longtext' },
      { column: 'area_en', type: 'text' },
      { column: 'rent_bdt', type: 'number' },
      { column: 'bedrooms', type: 'number' },
      { column: 'status', type: 'enum', values: ['AVAILABLE', 'RENTED', 'HOLD'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'career-posts',
    label: 'Career Posts',
    table: 'career_opportunities',
    demoTable: 'career_opportunities',
    columns: ['title', 'company', 'opportunity_type', 'location', 'status'],
    fields: [
      { column: 'title', type: 'text', required: true },
      { column: 'company', type: 'text' },
      { column: 'description', type: 'longtext' },
      { column: 'opportunity_type', type: 'enum', values: ['JOB', 'INTERNSHIP', 'FELLOWSHIP', 'SCHOLARSHIP'] },
      { column: 'location', type: 'text' },
      { column: 'status', type: 'enum', values: ['OPEN', 'CLOSED'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
  {
    key: 'cafeteria-menus',
    label: 'Cafeteria Menus',
    table: 'cafeteria_menus',
    demoTable: 'cafeteria_menus',
    columns: ['name_en', 'meal', 'serving_date', 'pickup_window', 'is_active'],
    fields: [
      { column: 'name_en', type: 'text', required: true },
      { column: 'name_bn', type: 'text' },
      { column: 'meal', type: 'enum', values: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'] },
      { column: 'serving_date', type: 'text' },
      { column: 'pickup_window', type: 'text' },
      { column: 'is_active', type: 'bool' },
    ],
    orderBy: { column: 'serving_date', ascending: false },
    scoped: true,
  },
  {
    key: 'disputes',
    label: 'Disputes',
    table: 'disputes',
    demoTable: 'disputes',
    columns: ['subject', 'category', 'status', 'created_at'],
    fields: [
      { column: 'subject', type: 'text', required: true },
      { column: 'body', type: 'longtext' },
      { column: 'category', type: 'text' },
      { column: 'status', type: 'enum', values: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] },
    ],
    orderBy: { column: 'created_at', ascending: false },
    scoped: true,
  },
];

export const ADMIN_SECTION_KEYS = ADMIN_SECTIONS.map((section) => section.key);

export function getAdminSection(key: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((section) => section.key === key);
}

/** Roles allowed into /admin/panel (platform operators). */
export function isPlatformAdminRole(roles: string[]): boolean {
  return roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'UNIVERSITY_ADMIN'].includes(role));
}

/** Roles allowed into /governance/dashboard (university governing body). */
export function isGovernanceRole(roles: string[]): boolean {
  return roles.some((role) => ['GOVERNANCE', 'GOVERNING_BODY'].includes(role));
}
