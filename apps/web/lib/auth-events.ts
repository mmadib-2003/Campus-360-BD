'use client';

/** Invalidate cookie-backed sessions in this tab and other open tabs. */
export const AUTH_CHANGED_EVENT = 'campus360:auth-changed';
export const AUTH_CHANGED_STORAGE_KEY = 'campus360.auth-changed';

export function notifyAuthChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  try {
    // No session or personal data is stored here, only a change notification.
    window.localStorage.setItem(AUTH_CHANGED_STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Storage can be unavailable; same-tab and Supabase subscriptions still work.
  }
}
