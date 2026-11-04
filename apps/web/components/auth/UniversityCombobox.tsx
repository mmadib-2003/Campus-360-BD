'use client';

import React from 'react';
import { useUi } from '@/lib/i18n-client';

export interface UniversityOption {
  id: string;
  code: string;
  name_en: string;
  name_bn: string;
  category?: string;
  city?: string;
  university_email_domains?: Array<{ domain: string; is_primary?: boolean }>;
}

export function UniversityCombobox({
  universities,
  value,
  onChange,
  label,
  placeholder,
  hint,
  invalid,
  disabled,
}: {
  universities: UniversityOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder: string;
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { locale, t } = useUi();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = universities.find((university) => university.id === value);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return universities;
    return universities.filter((university) =>
      [university.name_en, university.name_bn, university.code, university.city ?? '', university.category ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [universities, query]);

  React.useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function choose(university: UniversityOption) {
    onChange(university.id);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && filtered[highlight]) {
        event.preventDefault();
        choose(filtered[highlight]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const displayValue = open ? query : selected ? `${selected.code} — ${locale === 'bn' ? selected.name_bn : selected.name_en}` : '';

  return (
    <div ref={containerRef} className="relative">
      <label className="block font-medium mb-1 text-sm">{label}</label>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="university-combobox-list"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          placeholder={selected ? '' : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (selected) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`w-full rounded-xl p-2.5 pr-9 text-sm bg-slate-100 dark:bg-slate-800 border ${
            invalid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
          } disabled:opacity-60`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden>
          ▾
        </span>
      </div>
      {hint && !selected && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}

      {open && (
        <ul
          id="university-combobox-list"
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-xs text-slate-500">{t('No university found')}</li>
          )}
          {filtered.map((university, index) => (
            <li key={university.id} role="option" aria-selected={university.id === value}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(university)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${
                  index === highlight ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''
                }`}
              >
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                  {university.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {locale === 'bn' ? university.name_bn : university.name_en}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {[university.city, university.category].filter(Boolean).join(' • ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && selected.university_email_domains && selected.university_email_domains.length > 0 && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
          {t('Approved email domains')}:{' '}
          {selected.university_email_domains.map((domain) => `@${domain.domain}`).join(', ')}
        </p>
      )}
    </div>
  );
}
