// apps/web/lib/welcome.ts
// Shared rules for the one-time welcome screen (/welcome).

export const WELCOME_ROUTE = '/welcome';
const WELCOME_SEEN_PREFIX = 'campus360:welcome-seen:v1:';

/** Per-account key so a visitor who later signs in sees the welcome once more. */
export function welcomeSeenKey(email: string | null | undefined): string {
  const who = email?.trim().toLowerCase();
  return `${WELCOME_SEEN_PREFIX}${who || 'guest'}`;
}

/** Storage can throw (private mode, blocked cookies); never let that break routing. */
export function hasSeenWelcome(email: string | null | undefined): boolean {
  try {
    return window.localStorage.getItem(welcomeSeenKey(email)) !== null;
  } catch {
    return true; // cannot remember -> do not loop the visitor back to /welcome
  }
}

export function markWelcomeSeen(email: string | null | undefined): void {
  try {
    window.localStorage.setItem(welcomeSeenKey(email), new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/** Public support address (same variable documented in .env.example). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@campus360bd.com';
