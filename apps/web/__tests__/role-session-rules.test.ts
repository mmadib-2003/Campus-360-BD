import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer from 'react-test-renderer';
import { PROGRAM_SESSION_OPTIONS, ProgramSessionSchema } from '@campus360/shared';
import { approvedDomains, hallForRole, matchesUniversityDomain, requiresHall } from '@/lib/auth-rules';

vi.mock('@/lib/i18n-client', () => ({ useUi: () => ({ locale: 'en', t: (key: string) => key }) }));

import { RoleSelector } from '@/components/auth/RoleSelector';
import { ProgramSessionCombobox } from '@/components/auth/ProgramSessionCombobox';
import { RoleEmailField } from '@/components/auth/RoleEmailField';

describe('role-based auth form controls', () => {
  it('offers exactly the three required public roles with no default selection', () => {
    const renderer = TestRenderer.create(React.createElement(RoleSelector, { value: '', onChange: vi.fn() }));
    const select = renderer.root.findByType('select');
    expect(select.props.required).toBe(true);
    expect(select.props.value).toBe('');
    expect(select.findAllByType('option').map((option) => option.props.value)).toEqual(['', 'student', 'faculty', 'alumni']);
  });

  it('suggests every recent session while allowing a valid custom session', () => {
    const onChange = vi.fn();
    const renderer = TestRenderer.create(React.createElement(ProgramSessionCombobox, { value: '', onChange }));
    const input = renderer.root.findByType('input');
    expect(input.props.required).toBe(true);
    expect(input.props.list).toBe('program-session-options');
    const options = renderer.root.findByType('datalist').findAllByType('option');
    expect(options).toHaveLength(31);
    expect(options[0].props.value).toBe('2025-26');
    expect(options.at(-1)?.props.value).toBe('1995-96');
    input.props.onChange({ target: { value: '2030-31' } });
    expect(onChange).toHaveBeenCalledWith('2030-31');
    expect(ProgramSessionSchema.safeParse('2030-31').success).toBe(true);
    expect(PROGRAM_SESSION_OPTIONS).not.toContain('2030-31');
  });

  it('explains personal-email OTP for faculty/alumni and does not flag Gmail as invalid', () => {
    for (const role of ['faculty', 'alumni']) {
      const renderer = TestRenderer.create(React.createElement(RoleEmailField, { value: 'person@gmail.com', onChange: vi.fn(), role, domains: ['du.ac.bd'] }));
      const input = renderer.root.findByType('input');
      expect(input.props.required).toBe(true);
      expect(input.props['aria-invalid']).toBe(false);
      expect(JSON.stringify(renderer.toJSON())).toContain('Gmail, Yahoo, Outlook, Hotmail, iCloud');
      expect(JSON.stringify(renderer.toJSON())).toContain('6-digit OTP');
    }
  });

  it('keeps student email restricted to exact approved domains', () => {
    const domains = approvedDomains({ university_email_domains: [{ domain: ' DU.AC.BD ' }] });
    expect(matchesUniversityDomain('student@du.ac.bd', domains)).toBe(true);
    expect(matchesUniversityDomain('student@gmail.com', domains)).toBe(false);
    expect(matchesUniversityDomain('student@evil-du.ac.bd', domains)).toBe(false);
    expect(matchesUniversityDomain('student@sub.du.ac.bd', domains)).toBe(false);
    const renderer = TestRenderer.create(React.createElement(RoleEmailField, { value: 'student@gmail.com', onChange: vi.fn(), role: 'student', domains }));
    expect(renderer.root.findByType('input').props['aria-invalid']).toBe(true);
  });

  it('submits halls only for students', () => {
    expect(requiresHall('student')).toBe(true);
    expect(requiresHall('faculty')).toBe(false);
    expect(hallForRole('student', 'hall-1')).toBe('hall-1');
    expect(hallForRole('faculty', 'hall-1')).toBeNull();
    expect(hallForRole('alumni', 'hall-1')).toBeNull();
  });
});
