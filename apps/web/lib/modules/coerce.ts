// apps/web/lib/modules/coerce.ts
import crypto from 'crypto';
import { FieldSpec } from './registry';

export interface CoerceResult {
  value: unknown;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function coerceField(spec: FieldSpec, raw: unknown): CoerceResult {
  if (raw === undefined || raw === null || raw === '') {
    if (spec.required) return { value: null, error: `${spec.column} is required` };
    return { value: null };
  }

  switch (spec.type) {
    case 'text':
    case 'longtext': {
      const value = String(raw).trim();
      if (!value) {
        return spec.required ? { value: null, error: `${spec.column} is required` } : { value: null };
      }
      if (spec.max && value.length > spec.max) {
        return { value: null, error: `${spec.column} must be at most ${spec.max} characters` };
      }
      return { value };
    }
    case 'money':
    case 'number':
    case 'int': {
      const num = Number(raw);
      if (!Number.isFinite(num)) return { value: null, error: `${spec.column} must be a number` };
      if (num < 0) return { value: null, error: `${spec.column} cannot be negative` };
      if (spec.min !== undefined && num < spec.min) {
        return { value: null, error: `${spec.column} must be at least ${spec.min}` };
      }
      if (!Number.isFinite(num)) return { value: null, error: `${spec.column} must be a number` };
      return { value: spec.type === 'int' ? Math.round(num) : Math.round(num * 100) / 100 };
    }
    case 'bool':
      return { value: raw === true || raw === 'true' || raw === 1 || raw === '1' };
    case 'enum': {
      const value = String(raw).trim().toUpperCase();
      if (spec.values && !spec.values.includes(value)) {
        return { value: null, error: `${spec.column} must be one of ${spec.values.join(', ')}` };
      }
      return { value };
    }
    case 'array': {
      const items = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : String(raw)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
      if (items.length > 40) return { value: null, error: `${spec.column} has too many entries` };
      return { value: items };
    }
    case 'date': {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return { value: null, error: `${spec.column} must be a valid date` };
      return { value: d.toISOString().slice(0, 10) };
    }
    case 'datetime': {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return { value: null, error: `${spec.column} must be a valid date/time` };
      return { value: d.toISOString() };
    }
    case 'uuid': {
      const value = String(raw).trim();
      if (!UUID_RE.test(value)) return { value: null, error: `${spec.column} must be a valid id` };
      return { value };
    }
    default:
      return { value: raw };
  }
}

export function randomCode(prefix: string, length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}-${out}`;
}

export function normalizeTokenList(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => String(item).toLowerCase().split(/[^a-z0-9\u0980-\u09FF+]+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}
