import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_UNIVERSITIES, DEMO_UNIVERSITY_HALLS } from '@/lib/modules/demo-data';
import { demoTickets } from '@/lib/demo-tickets';

const expected: Record<string, number> = {
  JU: 21, DU: 23, RU: 18, CU: 15, BUET: 9, BUTEX: 4, RUET: 7,
  CUET: 7, KUET: 7, BAU: 14, SUST: 6, IU: 8, JNU: 3,
};

describe('major university registry', () => {
  it('has precisely the requested 13 offline universities', () => {
    expect(DEMO_UNIVERSITIES.map((u) => u.code).sort()).toEqual(Object.keys(expected).sort());
  });
  it('has the complete roster with no duplicate IDs', () => {
    expect(DEMO_UNIVERSITY_HALLS).toHaveLength(142);
    expect(new Set(DEMO_UNIVERSITY_HALLS.map((h) => h.id)).size).toBe(142);
    for (const [code, count] of Object.entries(expected)) {
      expect(DEMO_UNIVERSITY_HALLS.filter((h) => h.universityCode === code)).toHaveLength(count);
    }
  });
  it('includes each hall in the migration and seed', () => {
    const files = ['supabase/migrations/0022_major_universities_halls_and_real_media.sql', 'supabase/seed/seed_university_halls.sql'];
    for (const file of files) {
      const contents = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const hall of DEMO_UNIVERSITY_HALLS) expect(contents).toContain(`('${hall.universityCode}', '${hall.name.replace(/'/g, "''")}'`);
    }
  });
  it('scopes sample tickets to the supplied university', () => {
    const rows = demoTickets('university-a', 'DU');
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.university_id === 'university-a' && row.tracking_code.startsWith('DU-'))).toBe(true);
  });
});
