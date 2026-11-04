// apps/web/lib/render-safe.ts
// ============================================================================
// Every value that reaches a component from PostgREST or localStorage is *maybe*
// something: a JSONB array can arrive as a list or as a string, an embedded row
// (`profiles`, `halls`, `campus_pickup_points`) is `null` when the FK is null, and
// a counter column can be NULL on rows written before the column existed. Reading
// through any of those -- `row.tags.map`, `listing.profiles.full_name`,
// `campaign.raised_bdt.toLocaleString()` -- is what produced
//
//   Application error: a client-side exception has occurred
//
// and, because there was no error boundary anywhere in the tree, that one bad row
// unmounted the whole site instead of one card. These helpers are the cheap
// half of the fix; components/SafeSection.tsx is the other half.
//
// They are deliberately total: no argument shape throws.
// ============================================================================

/** Rows to render. Anything that is not an array renders as nothing. */
export function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  // JSONB text[] columns occasionally arrive double-encoded ("[\"WiFi\"]") from
  // older writes; parsing is best-effort and never throws.
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {
        /* not JSON after all -- fall through to the empty case */
      }
    }
    return [];
  }
  return [];
}

/** True when there is at least one row -- the guard in front of every list. */
export function hasRows(value: unknown): boolean {
  return asArray(value).length > 0;
}

/**
 * A string to print. Numbers are formatted so a BDT amount never renders as
 * `NaN`/`null`, `null`/`undefined` become the caller's placeholder, and an object
 * (a stray embed) never leaks `[object Object]` into the UI.
 */
export function asText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    for (const key of ['name_en', 'name_bn', 'title', 'label_en', 'full_name', 'name']) {
      const found = asText(row[key]);
      if (found) return found;
    }
    return fallback;
  }
  return fallback;
}

/** A number for arithmetic or toLocaleString. Never `NaN`, never a throw. */
export function asNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** A row to read properties from -- an absent embed behaves like `{}`. */
export function asRow(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

/** A date to format. Bad input yields the fallback rather than "Invalid Date". */
export function asDateText(value: unknown, locale = 'en-GB', fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    // An unsupported locale must not take the page down.
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}
