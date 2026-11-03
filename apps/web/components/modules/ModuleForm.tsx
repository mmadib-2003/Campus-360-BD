// apps/web/components/modules/ModuleForm.tsx
'use client';

import React from 'react';
import { getModule, FieldSpec } from '@/lib/modules/registry';
import { fieldLabel } from '@/lib/modules/labels';
import { Input, Textarea, Select, Field, Button } from './ui';
import type { Row } from '@/lib/modules/client';

export interface SelectOptionSource {
  /** Field key -> options, e.g. { pickup_point_id: [{value,label}] } */
  [fieldColumn: string]: Array<{ value: string; label: string }>;
}

function omitFields(spec: ReturnType<typeof getModule>, omit: string[] = []) {
  if (!spec) return [] as FieldSpec[];
  return spec.fields.filter((field) => !field.readOnly && !omit.includes(field.column));
}

function defaultInputValue(field: FieldSpec, initial: Row | null): string {
  const raw = initial?.[field.column];
  if (raw === undefined || raw === null) {
    if (field.type === 'datetime') return '';
    return '';
  }
  if (field.type === 'datetime') {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return '';
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  }
  if (field.type === 'date') return String(raw).slice(0, 10);
  if (Array.isArray(raw)) return raw.join(', ');
  return String(raw);
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ModuleForm({
  moduleKey,
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Publish',
  omit = [],
  options = {},
  extra,
}: {
  moduleKey: string;
  initial?: Row | null;
  onSubmit: (values: Row) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
  submitLabel?: string;
  omit?: string[];
  options?: SelectOptionSource;
  extra?: (values: Row, setValue: (key: string, value: unknown) => void) => React.ReactNode;
}) {
  const spec = getModule(moduleKey);
  const fields = omitFields(spec, omit);
  const [values, setValues] = React.useState<Row>(() => {
    const base: Row = {};
    for (const field of fields) {
      base[field.column] = initial?.[field.column] ?? (field.type === 'bool' ? false : '');
    }
    return base;
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const setValue = React.useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload: Row = {};
    for (const field of fields) {
      const raw = values[field.column];
      if (field.type === 'bool') {
        payload[field.column] = Boolean(raw);
        continue;
      }
      if (raw === '' || raw === undefined || raw === null) {
        if (field.required) {
          setError(`${fieldLabel(field.column).label} is required.`);
          return;
        }
        continue;
      }
      payload[field.column] = raw;
    }

    setPending(true);
    const result = await onSubmit(payload);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not save. Please try again.');
    }
  }

  if (!spec) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => {
          const meta = fieldLabel(field.column);
          const value = values[field.column];
          const fullWidth = field.type === 'longtext' || field.type === 'array';

          if (field.type === 'bool') {
            return (
              <label
                key={field.column}
                className="flex items-center gap-2 text-xs sm:col-span-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => setValue(field.column, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{meta.label}</span>
              </label>
            );
          }

          if (field.type === 'enum' || options[field.column]) {
            const selectOptions =
              options[field.column] ??
              (field.values ?? []).map((v) => ({ value: v, label: toTitleCase(v) }));
            return (
              <Field key={field.column} label={meta.label} hint={meta.hint} className={field.type === 'enum' && field.values && field.values.length > 4 ? 'sm:col-span-2' : ''}>
                <Select
                  value={String(value ?? '')}
                  onChange={(e) => setValue(field.column, e.target.value)}
                  options={selectOptions}
                  placeholder={field.required ? 'Select…' : 'Optional'}
                />
              </Field>
            );
          }

          if (field.type === 'longtext') {
            return (
              <Field key={field.column} label={meta.label} className="sm:col-span-2" hint={meta.placeholder}>
                <Textarea
                  value={String(value ?? '')}
                  onChange={(e) => setValue(field.column, e.target.value)}
                  placeholder={meta.placeholder}
                  maxLength={field.max}
                />
              </Field>
            );
          }

          if (field.type === 'array') {
            return (
              <Field key={field.column} label={meta.label} hint={meta.placeholder ?? 'Comma separated'} className="sm:col-span-2">
                <Input
                  value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                  onChange={(e) => setValue(field.column, e.target.value)}
                  placeholder={meta.placeholder}
                />
              </Field>
            );
          }

          const inputType =
            field.type === 'datetime'
              ? 'datetime-local'
              : field.type === 'date'
                ? 'date'
                : field.type === 'money' || field.type === 'number' || field.type === 'int'
                  ? 'number'
                  : 'text';

          return (
            <Field
              key={field.column}
              label={meta.label}
              hint={meta.placeholder}
              className={fullWidth ? 'sm:col-span-2' : ''}
            >
              <Input
                type={inputType}
                inputMode={inputType === 'number' ? 'decimal' : undefined}
                step={field.type === 'money' ? '0.01' : inputType === 'number' ? '1' : undefined}
                min={inputType === 'number' ? 0 : undefined}
                value={defaultInputValue(field, values) || ''}
                onChange={(e) => setValue(field.column, e.target.value)}
                placeholder={meta.placeholder}
                maxLength={field.type === 'text' ? field.max : undefined}
              />
            </Field>
          );
        })}
      </div>

      {extra?.(values, setValue)}

      {error && (
        <p role="alert" className="text-xs text-rose-500 font-medium">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
