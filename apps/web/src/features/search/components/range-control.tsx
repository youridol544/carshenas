'use client';

import { useId, useState } from 'react';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatMileage } from '@carshenas/locale/format-number';
import { formatTomanCompact, toToman } from '@carshenas/locale/toman';
import { FieldMessage, inputClasses } from '@/components/ui/field';
import { InfoPopover } from '@/components/ui/info-popover';
import { filterInfo } from '@/features/search/info-content';
import { formatRangeEnd, rangeProblem, readRangeEnd, type RangeProblem } from '@/features/search/range-input';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { AnyFilter } from '@carshenas/search/filters';
import type { RangeUnit } from '@carshenas/search/kinds';

// The one control of every range filter (CS-102): two fields where a buyer types a minimum and a maximum (digits in any
// script, with or without separators, shown back in Persian digits), and the definition's own steps as quick picks
// that fill an end in one press. An end applies when its field loses focus or Enter is pressed, never on each key, so
// the results do not jump while a number is being typed; a wrong value is said under the fields and applies nothing.
// The layout never moves: the message line keeps its height, and the fields are 48 px tall with 16 px text (no zoom
// on iOS). Used for mileage, price, model year and engine volume, in the rail and in the phone sheet alike.

const COPY = SEARCH_COPY.panel;
const NO_BREAK_SPACE = String.fromCharCode(0xa0);
type Range = { min?: number; max?: number };
type Draft = { min: string; max: string };

type Props = {
  filter: Extract<AnyFilter, { kind: 'range' }>;
  value: Range | undefined;
  onChange: (value: Range | undefined) => void;
};

function FilterTitle({ filter }: { filter: AnyFilter }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-label font-medium text-default">{filter.label}</span>
      <InfoPopover
        label={SEARCH_COPY.info.button(filter.label)}
        closeLabel={SEARCH_COPY.info.close}
        content={filterInfo(filter)}
      />
    </div>
  );
}

/** A quick pick's end with its unit: «۱۰٬۰۰۰ کیلومتر», «۱۶۰۰ سی‌سی», «۷۰۰ میلیون تومان»; a volume has no thousands mark. */
function pickText(unit: RangeUnit, step: number): string {
  if (unit === 'cc') return `${toPersianDigits(String(step))}${NO_BREAK_SPACE}${COPY.unit.cc}`;
  if (unit === 'km') return formatMileage(step);
  if (unit === 'toman') return `${formatTomanCompact(toToman(step))}${NO_BREAK_SPACE}${COPY.unit.toman}`;
  return toPersianDigits(String(step));
}

export function RangeControl({ filter, value, onChange }: Props) {
  const unit = filter.unit;
  const signature = `${String(value?.min ?? '')}..${String(value?.max ?? '')}`;
  const [seen, setSeen] = useState(signature);
  // What is typed and not applied yet; null shows what is applied. A change from outside (a removed chip, the address)
  // drops it, so the fields never show a value the search does not have.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<{ problem: RangeProblem; end: 'min' | 'max' | 'both' } | null>(null);
  if (seen !== signature) {
    setSeen(signature);
    setDraft(null);
    setProblem(null);
  }
  const ids = { min: useId(), max: useId(), message: useId() };
  const minText = draft?.min ?? formatRangeEnd(unit, value?.min);
  const maxText = draft?.max ?? formatRangeEnd(unit, value?.max);

  function commit(texts: Draft) {
    const min = readRangeEnd(texts.min);
    const max = readRangeEnd(texts.max);
    if (!min.ok || !max.ok) {
      setProblem({ problem: 'not_a_number', end: min.ok ? 'max' : 'min' });
      return;
    }
    const found = rangeProblem(filter.bounds, min.value, max.value);
    if (found !== null) {
      setProblem(found);
      return;
    }
    setProblem(null);
    setDraft(null);
    if (min.value === value?.min && max.value === value?.max) return;
    onChange(
      min.value === undefined && max.value === undefined
        ? undefined
        : {
            ...(min.value === undefined ? {} : { min: min.value }),
            ...(max.value === undefined ? {} : { max: max.value }),
          },
    );
  }

  function field(end: 'min' | 'max') {
    const text = end === 'min' ? minText : maxText;
    const name = end === 'min' ? COPY.fromName(filter.label) : COPY.toName(filter.label);
    const invalid = problem !== null && (problem.end === end || problem.end === 'both');
    return (
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span aria-hidden="true" className="text-meta text-muted">
          {`${end === 'min' ? COPY.typedFrom : COPY.typedTo} (${COPY.unit[unit]})`}
        </span>
        <span className="relative flex items-center">
          <input
            id={end === 'min' ? ids.min : ids.max}
            data-range-end={end}
            aria-label={name}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={ids.message}
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            value={text}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setDraft(end === 'min' ? { min: next, max: maxText } : { min: minText, max: next });
            }}
            onBlur={() => {
              if (draft !== null) commit(draft);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit(draft ?? { min: minText, max: maxText });
              }
            }}
            className={`${inputClasses} text-start`}
          />
        </span>
      </label>
    );
  }

  const minimum = value?.min;
  const maximum = value?.max;
  return (
    <div className="flex flex-col gap-2" data-range-control={filter.id}>
      <FilterTitle filter={filter} />
      <div className="flex gap-2">
        {field('min')}
        {field('max')}
      </div>
      <FieldMessage id={ids.message} tone="danger" role="status">
        {problem === null
          ? null
          : problem.problem === 'outside'
            ? COPY.problems.outside(
                formatRangeEnd(unit, filter.bounds.min),
                formatRangeEnd(unit, filter.bounds.max),
              )
            : COPY.problems[problem.problem]}
      </FieldMessage>
      <div role="group" aria-label={`${COPY.quickPicks}: ${filter.label}`} className="flex flex-wrap gap-2">
        {filter.steps
          .filter((step) => filter.quick === 'atLeast' || step > filter.bounds.min)
          .map((step) => {
            const atLeast = filter.quick === 'atLeast';
            const pressed = atLeast
              ? minimum === step && maximum === undefined
              : maximum === step && minimum === undefined;
            const end = pickText(unit, step);
            return (
              <button
                key={step}
                type="button"
                aria-pressed={pressed}
                data-range-pick={step}
                onClick={() => {
                  setProblem(null);
                  setDraft(null);
                  onChange(pressed ? undefined : atLeast ? { min: step } : { max: step });
                }}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 text-label ${
                  pressed
                    ? 'border-action bg-action-subtle text-on-action-subtle'
                    : 'border-control bg-canvas text-default'
                }`}
              >
                {atLeast ? COPY.pickAtLeast(end) : COPY.pickAtMost(end)}
              </button>
            );
          })}
      </div>
    </div>
  );
}
