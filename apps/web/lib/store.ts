// apps/web/lib/store.ts
import { create } from 'zustand';
import type { Locale } from './i18n';

interface AppUiState {
  locale: Locale;
  theme: 'light' | 'dark';
  cmdKOpen: boolean;
  mobileDrawerOpen: boolean;
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
