// packages/shared/src/moderation.ts
const BLOCKED_TERMS = ['abuseword1', 'slurword2', 'harassword3'];

export function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase();
  return BLOCKED_TERMS.some((term) => normalized.includes(term));
}
