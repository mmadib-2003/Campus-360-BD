import type { AuthRole } from '@campus360/shared';

export const AUTH_ROLES: Array<{ value: AuthRole; label: string }> = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty / Staff' },
  { value: 'alumni', label: 'Alumni' },
];

export function requiresHall(role: string): boolean {
  return role === 'student';
}

export function allowsPersonalEmail(role: string): boolean {
  return role === 'faculty' || role === 'alumni';
}

export function approvedDomains(university?: {
  university_email_domains?: Array<{ domain: string }>;
}): string[] {
  return (university?.university_email_domains ?? []).map((entry) => entry.domain.trim().toLowerCase()).filter(Boolean);
}

/** Exact approved domains only: lookalikes and subdomains are not approved. */
export function matchesUniversityDomain(email: string, domains: string[]): boolean {
  const domain = email.trim().toLowerCase().split('@').pop() ?? '';
  return domains.some((approved) => domain === approved.trim().toLowerCase());
}

/** Only student requests carry a hall; other roles explicitly persist NULL. */
export function hallForRole(role: string, hallId: string): string | null {
  return requiresHall(role) && hallId ? hallId : null;
}
