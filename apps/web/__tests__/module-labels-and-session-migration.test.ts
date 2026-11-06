import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_META } from '@/lib/modules/labels';
import { DICTIONARY } from '@/lib/i18n';
import en from '@/messages/en.json';
import bn from '@/messages/bn.json';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('display-only module renames', () => {
  it('uses concise labels without changing routes or icons', () => {
    expect(MODULE_META.civic).toMatchObject({ title: 'Complaint Box', titleBn: 'অভিযোগ বক্স', href: '/complaints', icon: '🛡️' });
    expect(MODULE_META.events).toMatchObject({ title: 'Events', titleBn: 'ইভেন্টসমূহ', href: '/events', icon: '📅' });
    expect(MODULE_META.mentorship).toMatchObject({ title: 'Mentorship', titleBn: 'মেন্টরশিপ', href: '/mentorship', icon: '📖' });
    // Feature descriptions and the archive link remain intact.
    expect(MODULE_META.events.blurb).toContain('RSVP');
    expect(MODULE_META.mentorship.blurb).toContain('archive');
    expect(read('apps/web/app/mentorship/page.tsx')).toContain('href="/archive"');
  });

  it('updates navigation, dashboard and both language dictionaries consistently', () => {
    for (const messages of [en, bn]) {
      expect(messages.ui.moduleCivic).toBe(messages.ui['Complaint Box']);
      expect(messages.ui.moduleEvents).toBe(messages.ui.Events);
      expect(messages.ui.moduleMentorship).toBe(messages.ui.Mentorship);
    }
    expect(en.ui.Events).toBe('Events');
    expect(bn.ui.Events).toBe('ইভেন্টসমূহ');
    expect(DICTIONARY.en.moduleCivic).toBe('Complaint Box');
    expect(DICTIONARY.bn.moduleEvents).toBe('ইভেন্টসমূহ');
    expect(DICTIONARY.bn.moduleMentorship).toBe('মেন্টরশিপ');
    const feed = read('apps/web/app/feed/page.tsx');
    expect(feed).toContain("t('Complaint Box')");
    expect(feed).toContain("t('Events')");
    expect(feed).toContain("href: '/civic'");
    expect(feed).toContain("href: '/events'");
  });
});

describe('0025 role/email/hall/session migration', () => {
  const sql = read('supabase/migrations/0025_role_email_hall_session_rules.sql');
  it('is additive, transactional and preserves unknown historical sessions', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS program_session TEXT');
    expect(sql).toContain('ALTER COLUMN hall_id DROP NOT NULL');
    expect(sql).toContain('profiles_program_session_format');
    expect(sql).toContain('program_session IS NULL OR');
    expect(sql).not.toMatch(/UPDATE\s+public\.profiles/i);
  });
});
