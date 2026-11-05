'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseCampusScope, type CampusScope } from './campus-scope';
import { useAppStore } from './store';

/** An explicit URL wins; otherwise use the persisted preference. */
export function useCampusScope() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('scope');
  const saved = useAppStore((state) => state.listingScope);
  const setListingScope = useAppStore((state) => state.setListingScope);
  const hydrate = useAppStore((state) => state.hydrateListingScope);
  const validUrlScope = raw === 'my_campus' || raw === 'all' || raw === 'all_campuses';
  const scope = validUrlScope ? parseCampusScope(raw) : parseCampusScope(saved);

  useEffect(() => {
    hydrate();
    if (raw === 'my_campus' || raw === 'all' || raw === 'all_campuses') {
      setListingScope(parseCampusScope(raw) === 'all' ? 'all_campuses' : 'my_campus');
    }
  }, [raw, hydrate, setListingScope]);

  function setScope(next: CampusScope) {
    const value = next === 'all' ? 'all_campuses' : 'my_campus';
    setListingScope(value);
    // Civic uses scope=admin for its administrative board; never replace it.
    if (raw === 'admin') return;
    const updated = new URLSearchParams(params.toString());
    updated.set('scope', value);
    router.replace(`${pathname}?${updated.toString()}`, { scroll: false });
  }
  return { scope, setScope };
}
