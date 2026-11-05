import { describe, expect, it, vi } from 'vitest';
import { LISTING_SCOPE_STORAGE_KEY, useAppStore } from '@/lib/store';

describe('listing scope persistence', () => {
  it('hydrates a saved preference, persists updates, and tolerates blocked storage', () => {
    const storage = new Map([[LISTING_SCOPE_STORAGE_KEY, 'all_campuses']]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } });
    expect(useAppStore.getState().listingScope).toBe('my_campus');
    useAppStore.getState().hydrateListingScope();
    expect(useAppStore.getState().listingScope).toBe('all_campuses');
    useAppStore.getState().setListingScope('my_campus');
    expect(storage.get(LISTING_SCOPE_STORAGE_KEY)).toBe('my_campus');
    vi.stubGlobal('window', { localStorage: { setItem: () => { throw new Error('blocked'); } } });
    expect(() => useAppStore.getState().setListingScope('all_campuses')).not.toThrow();
    expect(useAppStore.getState().listingScope).toBe('all_campuses');
    vi.unstubAllGlobals();
  });
});
