// apps/web/lib/modules/nav.ts
// Single source of truth for the app's navigation surface.
//
// Every module the platform exposes is listed exactly once here. The desktop
// sidebar renders it as four collapsible groups, the mobile drawer and the
// ⌘K palette render the flat list, and the dashboard module switcher filters
// the same array — so a route can never appear in one place and go missing
// from another (zero feature removal).

export interface NavModule {
  href: string;
  /** i18n key under `messages.ui`. */
  key: string;
  icon: string;
}

export const NAV_MODULES: NavModule[] = [
  { href: '/', key: 'moduleFeed', icon: '🏠' },
  { href: '/marketplace', key: 'moduleMarketplace2', icon: '🛍️' },
  { href: '/skills', key: 'moduleSkills', icon: '🎓' },
  { href: '/civic', key: 'moduleCivic', icon: '🛡️' },
  { href: '/events', key: 'moduleEvents', icon: '📅' },
  { href: '/events/map', key: 'moduleLiveMap', icon: '📍' },
  { href: '/health', key: 'moduleHealth', icon: '🩸' },
  { href: '/archive', key: 'moduleArchive', icon: '📚' },
  { href: '/mentorship', key: 'moduleMentorship', icon: '📖' },
  { href: '/housing', key: 'moduleHousing2', icon: '🏢' },
  { href: '/careers', key: 'moduleCareers', icon: '💼' },
  { href: '/dining', key: 'moduleDining2', icon: '🍛' },
  { href: '/lost-found', key: 'moduleLostFound2', icon: '🔍' },
  { href: '/sports', key: 'moduleSports', icon: '🏆' },
  { href: '/trust', key: 'moduleTrust', icon: '✅' },
  { href: '/reviews', key: 'moduleReviews', icon: '⭐' },
  { href: '/admin/console', key: 'moduleAdmin', icon: '🏛️' },
];

/** Desktop sidebar groups (Phase 3). Every NAV_MODULES href appears once. */
export const NAV_GROUPS: Array<{ labelKey: string; hrefs: string[] }> = [
  { labelKey: 'Core Workspace', hrefs: ['/', '/events/map'] },
  { labelKey: 'Academic & Clubs', hrefs: ['/skills', '/archive', '/mentorship', '/careers', '/events'] },
  { labelKey: 'Community & Commerce', hrefs: ['/marketplace', '/housing', '/dining', '/lost-found', '/sports', '/reviews'] },
  { labelKey: 'Safety & Governance', hrefs: ['/civic', '/health', '/trust', '/admin/console'] },
];

/** The four thumb-reachable mobile tabs plus the "All Modules" drawer. */
export const MOBILE_TABS: Array<{ href: string; icon: string; labelKey: string }> = [
  { href: '/', icon: '🏠', labelKey: 'Home' },
  { href: '/archive', icon: '📚', labelKey: 'Academic' },
  { href: '/marketplace', icon: '🛍️', labelKey: 'Market' },
  { href: '/health', icon: '🩸', labelKey: 'Emergency Blood' },
];
