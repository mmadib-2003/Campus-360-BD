// apps/web/lib/welcome-registry.ts
// Server-side loader for the Welcome / Overview university showcase.
//
// Populates the supported public university registry during SSR so both `/`
// and `/welcome` ship real university names, codes, email domains, campus
// photography and logos in initial HTML — with zero client skeleton flash and
// an instant fallback to the canonical demo registry when Supabase is absent
// or temporarily unreachable.

import { demoUniversitiesPayload } from '@/lib/demo-auth';
import { registryRead } from '@/lib/registry-cache';
import { registryGate } from '@/lib/registry-gate';
import { isSupabaseServerConfigured } from '@/lib/request-context';
import type { RegistryUniversity } from '@/components/welcome/WelcomeView';

const BUNDLED_COVERS: Record<string, string> = {
  JU: '/campuses/ju.jpg?v=ju-shaheed-minar',
  DU: '/campuses/du.jpg',
  RU: '/campuses/ru.jpg?v=ru-admin-2026',
  CU: '/campuses/cu.jpg?v=cu-monument-2026',
  BUET: '/campuses/buet.jpg?v=buet-gate2-2026',
  BUTEX: '/campuses/butex.jpg',
  RUET: '/campuses/ruet.jpg',
  CUET: '/campuses/cuet.jpg',
  KUET: '/campuses/kuet.webp?v=kuet-landmark-2026',
  BAU: '/campuses/bau.jpg',
  SUST: '/campuses/sust.jpg?v=sust-gate-2026',
  IU: '/campuses/iu.jpg?v=iu-gate-2026',
  JNU: '/campuses/jnu.jpg?v=jnu-campus-2026',
};

function withBundledMedia(rows: RegistryUniversity[]): RegistryUniversity[] {
  return rows.map((row) => {
    const code = String(row.code ?? '').toUpperCase();
    const bundledCover = BUNDLED_COVERS[code];
    if (!bundledCover) return row;
    const lower = code.toLowerCase();
    return {
      ...row,
      logo_url: row.logo_url?.startsWith('/') ? row.logo_url : `/logos/${lower}.svg`,
      cover_image_url: row.cover_image_url?.startsWith('/') ? row.cover_image_url : bundledCover,
    };
  });
}

export async function loadWelcomeUniversities(): Promise<RegistryUniversity[]> {
  if (!isSupabaseServerConfigured()) {
    return withBundledMedia(demoUniversitiesPayload());
  }

  const gate = registryGate('universities.welcome', 'বিশ্ববিদ্যালয়ের তালিকা লোড করা যায়নি।');
  if (!gate.ok) {
    return withBundledMedia(demoUniversitiesPayload());
  }

  const read = await registryRead<RegistryUniversity[]>(
    'universities.welcome',
    () =>
      gate.client
        .from('universities')
        .select('*, university_email_domains(domain, is_primary)')
        .eq('is_active', true)
        .order('name_en', { ascending: true }),
    { surface: 'welcome-ssr' }
  );

  if (!read.ok || !Array.isArray(read.data) || read.data.length === 0) {
    return withBundledMedia(demoUniversitiesPayload());
  }

  return withBundledMedia(read.data);
}
