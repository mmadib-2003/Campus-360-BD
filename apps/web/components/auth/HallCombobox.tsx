'use client';

// apps/web/components/auth/HallCombobox.tsx
// Searchable residential-hall combobox for the student signup flow
// (success criterion 2). Blocks submission until a hall is selected.

import React from 'react';
import { useUi } from '@/lib/i18n-client';

export interface HallOption {
  id: string;
  name: string;
  name_bn?: string | null;
  type?: string | null;
}

export function HallCombobox({
  halls,
  value,
  onChange,
  label,
  placeholder,
  hint,
  invalid,
  disabled,
  id = 'residential-hall',
}: {
  halls: HallOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder: string;
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const { locale, t } = useUi();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = halls.find((hall) => hall.id === value);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return halls;
    return halls.filter((hall) =>
      [hall.name, hall.name_bn ?? '', hall.type ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [halls, query]);

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

  function choose(hall: HallOption) {
    onChange(hall.id);
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

  const displayValue = open
    ? query
    : selected
      ? locale === 'bn' && selected.name_bn
        ? selected.name_bn
        : selected.name
      : '';

  return (
    <div ref={containerRef} className="relative w-full max-w-full">
      <label htmlFor={id} className="block font-medium mb-1 text-sm">
        {label} <span className="text-rose-500">*</span>
      </label>
      <div className="relative w-full max-w-full">
        <input
          id={id}
          required
          aria-required="true"
          aria-invalid={Boolean(invalid)}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
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
          className={`w-full max-w-full truncate min-h-[44px] rounded-xl p-2.5 pr-9 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border ${
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
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-w-full max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-xs text-slate-500">
              {halls.length === 0 ? t('No halls registered for this university yet') : t('No hall found')}
            </li>
          )}
          {filtered.map((hall, index) => (
            <li key={hall.id} role="option" aria-selected={hall.id === value}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(hall)}
                className={`w-full min-h-[44px] text-left px-3 py-2 flex items-center gap-2 text-sm ${
                  index === highlight ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  {/* Long hall names wrap inside the option instead of clipping. */}
                  <span className="block break-words font-medium">
                    {locale === 'bn' && hall.name_bn ? hall.name_bn : hall.name}
                  </span>
                  {hall.type && (
                    <span className="block break-words text-[11px] text-slate-400">
                      {hall.type === 'DAY_SCHOLAR' ? t('Day scholar') : t('Residential')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
