/** URL-facing campus scope. Unknown values are deliberately campus-local. */
export type CampusScope = 'my_campus' | 'all';
export function parseCampusScope(value: string | null): CampusScope {
  return value === 'all' || value === 'all_campuses' ? 'all' : 'my_campus';
}

/** Only explicitly public listing modules may be widened across campuses. */
export const SHARED_MODULES = new Set([
  'marketplace', 'marketplace-pickup-points', 'skills', 'clubs', 'club-notices',
  'health-contacts', 'mentors', 'mentorship-slots', 'housing', 'rideshare',
  'careers', 'cafeteria-menus', 'cafeteria-items', 'lost-found',
  'sports-teams', 'sports-challenges', 'sports-venues', 'campaigns', 'reviews',
]);

/** Apply the same visibility rules as the public listing policies, even when
 * a signed demo session uses a service client that bypasses RLS. */
export function applySharedListingVisibility(query: any, key: string): any {
  switch (key) {
    case 'marketplace': return query.in('status', ['AVAILABLE', 'RESERVED']).is('deleted_at', null);
    case 'skills': case 'careers': return query.eq('status', 'OPEN');
    case 'housing': return query.eq('status', 'AVAILABLE');
    case 'rideshare': case 'sports-teams': return query.in('status', ['OPEN', 'FULL']);
    case 'lost-found': return query.in('status', ['OPEN', 'RESOLVED']);
    case 'sports-challenges': return query.in('status', ['OPEN', 'ACCEPTED']);
    case 'campaigns': return query.in('status', ['ACTIVE', 'COMPLETED']);
    case 'reviews': return query.eq('is_hidden', false).is('deleted_at', null);
    case 'marketplace-pickup-points': case 'health-contacts': case 'mentorship-slots':
    case 'cafeteria-menus': case 'sports-venues': return query.eq('is_active', true);
    default: return query;
  }
}

/** In-memory demo equivalent of the listed-row predicates above. */
export function isSharedDemoRowVisible(key: string, row: Record<string, unknown>): boolean {
  switch (key) {
    case 'marketplace': return ['AVAILABLE', 'RESERVED'].includes(String(row.status)) && !row.deleted_at;
    case 'skills': case 'careers': return row.status === 'OPEN';
    case 'housing': return row.status === 'AVAILABLE';
    case 'rideshare': case 'sports-teams': return ['OPEN', 'FULL'].includes(String(row.status));
    case 'lost-found': return ['OPEN', 'RESOLVED'].includes(String(row.status));
    case 'sports-challenges': return ['OPEN', 'ACCEPTED'].includes(String(row.status));
    case 'campaigns': return ['ACTIVE', 'COMPLETED'].includes(String(row.status));
    case 'reviews': return row.is_hidden === false && !row.deleted_at;
    case 'marketplace-pickup-points': case 'health-contacts': case 'mentorship-slots':
    case 'cafeteria-menus': case 'sports-venues': return row.is_active === true;
    default: return true;
  }
}

/** Parent rows for actions that must remain within the user's campus. */
export const LOCAL_ACTION_PARENTS: Record<string, [string, string]> = {
  'marketplace-orders': ['listing_id', 'marketplace_listings'],
  'marketplace-messages': ['listing_id', 'marketplace_listings'],
  'skill-applications': ['posting_id', 'skill_postings'],
  'complaint-upvotes': ['complaint_id', 'complaints'],
  'club-members': ['club_id', 'clubs'],
  'club-notices': ['club_id', 'clubs'],
  'event-rsvps': ['event_id', 'events'],
  'mentorship-bookings': ['slot_id', 'mentorship_slots'],
  'career-applications': ['opportunity_id', 'career_opportunities'],
  'venue-bookings': ['venue_id', 'sports_venues'],
  donations: ['campaign_id', 'donation_campaigns'],
};

/** Preserve the global choice through internal navigation without dropping filters. */
export function withCampusScope(href: string, scope: CampusScope): string {
  if (scope !== 'all' || !href.startsWith('/') || href.startsWith('//')) return href;
  const [pathAndQuery, fragment] = href.split('#', 2);
  const [path, query = ''] = pathAndQuery.split('?', 2);
  const params = new URLSearchParams(query);
  if (params.get('scope') === 'admin') return href;
  params.set('scope', 'all_campuses');
  return `${path}?${params.toString()}${fragment === undefined ? '' : `#${fragment}`}`;
}
