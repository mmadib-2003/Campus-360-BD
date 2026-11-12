// apps/web/__tests__/welcome-pillars.test.ts
// Guards the Phase 2 / Phase 3 navigation refactor against feature loss:
// every module in the shared registry must remain reachable from the
// Welcome pillars, the desktop sidebar groups and the mobile tabs.

import { describe, expect, it } from 'vitest';
import { MODULE_META } from '@/lib/modules/labels';
import { NAV_GROUPS, NAV_MODULES, MOBILE_TABS } from '@/lib/modules/nav';
import { PILLARS, pillarModuleKeys } from '@/components/welcome/pillars';

describe('welcome pillars', () => {
  it('exposes exactly four pillars', () => {
    expect(PILLARS).toHaveLength(4);
    expect(PILLARS.map((pillar) => pillar.id)).toEqual([
      'academic',
      'life',
      'health',
      'governance',
    ]);
  });

  it('covers every MODULE_META module so no feature is hidden from the welcome screen', () => {
    const covered = pillarModuleKeys();
    expect([...covered].sort()).toEqual([...Object.keys(MODULE_META)].sort());
  });

  it('gives every pillar item a title, a description and an in-app route', () => {
    for (const pillar of PILLARS) {
      expect(pillar.items.length).toBeGreaterThan(0);
      for (const item of pillar.items) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.blurb.length).toBeGreaterThan(10);
        expect(item.href.startsWith('/')).toBe(true);
      }
    }
  });

  it('keeps the pillars pointing at routes that exist in the navigation registry', () => {
    const known = new Set([
      ...NAV_MODULES.map((module) => module.href),
      ...Object.values(MODULE_META).map((meta) => meta.href),
    ]);
    for (const pillar of PILLARS) {
      for (const item of pillar.items) {
        const route = item.href.split('?')[0];
        expect(known.has(route)).toBe(true);
      }
    }
  });
});

describe('navigation registry', () => {
  it('lists every module exactly once', () => {
    const hrefs = NAV_MODULES.map((module) => module.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.length).toBeGreaterThanOrEqual(13);
  });

  it('places every module in exactly one desktop sidebar group', () => {
    const grouped = NAV_GROUPS.flatMap((group) => group.hrefs);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...NAV_MODULES.map((module) => module.href)].sort());
    expect(NAV_GROUPS.map((group) => group.labelKey)).toEqual([
      'Core Workspace',
      'Academic & Clubs',
      'Community & Commerce',
      'Safety & Governance',
    ]);
  });

  it('offers four mobile tabs and keeps every module reachable from the drawer', () => {
    expect(MOBILE_TABS).toHaveLength(4);
    for (const tab of MOBILE_TABS) {
      expect(NAV_MODULES.some((module) => module.href === tab.href)).toBe(true);
    }
  });
});
