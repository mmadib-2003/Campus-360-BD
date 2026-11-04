'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';
import { getDemoUniversity } from '@/lib/modules/demo-data';

interface UniversityRow {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
}

let cache: UniversityRow[] | null = null;

/**
 * Shows the owning university on every listing. In preview mode the campus is
 * resolved from the local multi-university registry; with Supabase connected
 * the same component resolves the id against the public registry endpoint.
 */
export function CampusBadge({ universityId, className = '' }: { universityId?: string | null; className?: string }) {
  const { locale } = useUi();
  const [universities, setUniversities] = React.useState<UniversityRow[]>(cache ?? []);

  React.useEffect(() => {
    if (cache) {
      setUniversities(cache);
      return;
    }
    let cancelled = false;
    fetch('/api/universities')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload?.success) return;
        cache = payload.data as UniversityRow[];
        setUniversities(cache);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const demo = getDemoUniversity(universityId);
  const university = demo ?? universities.find((row) => row.id === universityId);
  if (!university) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold ${className}`}
      title={locale === 'bn' ? university.name_bn : university.name_en}
    >
      🏛️ {locale === 'bn' ? university.name_bn : university.name_en} ({university.code})
    </span>
  );
}
