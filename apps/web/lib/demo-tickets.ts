/** Public-safe sample tickets, scoped to the authenticated demo campus. */
export function demoTickets(universityId: string, code: string) {
  return [
    ['Campus lighting needs repair', 'INFRASTRUCTURE', 'SUBMITTED'],
    ['Hall water supply interruption', 'HALL_RESIDENCE', 'IN_PROGRESS'],
    ['Bus stop shelter maintenance', 'TRANSPORT', 'RESOLVED'],
  ].map(([title, category, status], index) => ({
    id: `demo-${code}-${index + 1}`,
    university_id: universityId,
    tracking_code: `${code}-DEMO-${index + 1}`,
    title, category, status, severity: 'MEDIUM', is_public_issue: true,
    upvotes_count: 0, created_at: '2026-01-01T00:00:00.000Z',
  }));
}
