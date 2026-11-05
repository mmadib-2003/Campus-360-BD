// apps/web/lib/store.ts
import { create } from 'zustand';
import type { Locale } from './i18n';

export type ListingScope = 'my_campus' | 'all_campuses';
export const LISTING_SCOPE_STORAGE_KEY = 'campus360_listing_scope';
let scopeHydrated = false;

interface AppUiState {
  locale: Locale;
  theme: 'light' | 'dark';
  cmdKOpen: boolean;
  mobileDrawerOpen: boolean;
  listingScope: ListingScope;
  setListingScope: (scope: ListingScope) => void;
  hydrateListingScope: () => void;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
  setCmdKOpen: (open: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
}

export const useAppStore = create<AppUiState>((set) => ({
  locale: 'en',
  theme: 'dark',
  cmdKOpen: false,
  mobileDrawerOpen: false,
  listingScope: 'my_campus',
  setListingScope: (scope) => {
    if (scope !== 'my_campus' && scope !== 'all_campuses') return;
    try { if (typeof window !== 'undefined') window.localStorage.setItem(LISTING_SCOPE_STORAGE_KEY, scope); } catch { /* storage may be blocked */ }
    set((state) => state.listingScope === scope ? state : { listingScope: scope });
  },
  hydrateListingScope: () => {
    if (scopeHydrated || typeof window === 'undefined') return;
    scopeHydrated = true;
    try {
      const saved = window.localStorage.getItem(LISTING_SCOPE_STORAGE_KEY);
      if (saved === 'my_campus' || saved === 'all_campuses') set({ listingScope: saved });
    } catch { /* fall back to My Campus */ }
  },
  setLocale: (locale) => set({ locale }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return { theme: next };
    }),
  setCmdKOpen: (cmdKOpen) => set({ cmdKOpen }),
  setMobileDrawerOpen: (mobileDrawerOpen) => set({ mobileDrawerOpen }),
}));
