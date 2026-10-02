'use client';

import { useId, useState } from 'react';
import { CheckRow } from '@/components/ui/check-row';
import { InfoPopover } from '@/components/ui/info-popover';
import { SelectField } from '@/components/ui/select-field';
import { normalizeForMatch, toggled } from '@/features/search/filter-panel-model';
import { filterInfo } from '@/features/search/info-content';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { FacetOption, SearchFacets } from '@/features/search/search-types';
import { toPersianDigits } from '@carshenas/locale/digits';
import { formatCount, formatCountOf, formatMileage } from '@carshenas/locale/format-number';
import { formatTomanCompact, toToman } from '@carshenas/locale/toman';
import type { AnyFilter } from '@carshenas/search/filters';
import type { DatabaseOptions, RangeUnit } from '@carshenas/search/kinds';
import type { SearchFilters } from '@carshenas/search/search';

// One control for each kind of filter in the shared definitions (CS-58): a checkbox for an on/off rule, a select for
// an order of values or a limit, two selects for a range (its steps are the definitions' own: any other value an
// address carries shows up in them too), a checkbox list for a choice, and for the options that are rows in the
// database a list with how many listings each would give, a search box when the list is long, and a «show all»
// button when it is not short. Each has its title and, beside it, an info control with the definition's own words
// (the owner's request of 2026-10-01). Nothing here knows whether a change applies at once (the desktop rail) or waits
// for «apply» (the phone sheet): a control reports its new value through onChange.

const COPY = SEARCH_COPY.panel;
const NO_BREAK_SPACE = String.fromCharCode(0xa0);

export type ControlsContext = {
  readonly filters: SearchFilters;
  readonly onChange: (id: AnyFilter['id'], value: unknown) => void;
  /** The options of the database-backed filters, with the counts this search leaves them. */
  readonly facets: SearchFacets;
  /** The names of chosen database values, keyed «filter id:value», for a value the counts no longer list. */
  readonly labels: Readonly<Record<string, string>>;
};

type Kind<K extends AnyFilter['kind']> = Extract<AnyFilter, { kind: K }>;

function FilterTitle({ filter, titleId }: { filter: AnyFilter; titleId?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span id={titleId} className="text-label font-medium text-default">
        {filter.label}
      </span>
      <InfoPopover
        label={SEARCH_COPY.info.button(filter.label)}
        closeLabel={SEARCH_COPY.info.close}
        content={filterInfo(filter)}
      />
    </div>
  );
}

function FlagControl({
  filter,
  checked,
  onChange,
}: {
  filter: Kind<'flag'>;
  checked: boolean;
  onChange: (value: true | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0">
        <CheckRow
          type="checkbox"
          checked={checked}
          onChange={(on) => {
            onChange(on ? true : undefined);
          }}
        >
          {filter.label}
        </CheckRow>
      </div>
      <InfoPopover
        label={SEARCH_COPY.info.button(filter.label)}
        closeLabel={SEARCH_COPY.info.close}
        content={filterInfo(filter)}
      />
    </div>
  );
}

function RankedControl({
  filter,
  value,
  onChange,
}: {
  filter: Kind<'ranked'>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const chosen = filter.options.find((option) => option.value === value);
  return (
    <div className="flex flex-col gap-1">
      <FilterTitle filter={filter} />
      <SelectField
        label={filter.label}
        value={value ?? ''}
        onChange={(next) => {
          onChange(next === '' ? undefined : next);
        }}
      >
        <option value="">{COPY.anyOption}</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.chip}
          </option>
        ))}
      </SelectField>
      {chosen?.rule === undefined ? null : (
        <p className="text-secondary text-pretty text-muted">{chosen.rule}</p>
      )}
    </div>
  );
}

function LimitControl({
  filter,
  value,
  onChange,
}: {
  filter: Kind<'limit'>;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  // A value the address carries that the sheet does not offer is still shown, in its place.
  const choices = [...new Set([...filter.choices, ...(value === undefined ? [] : [value])])].toSorted(
    (a, b) => a - b,
  );
  return (
    <div className="flex flex-col gap-1">
      <FilterTitle filter={filter} />
      <SelectField
        label={filter.label}
        value={value === undefined ? '' : String(value)}
        onChange={(next) => {
          onChange(next === '' ? undefined : Number(next));
        }}
      >
        <option value="">{COPY.anyOption}</option>
        {choices.map((choice) => (
          <option key={choice} value={String(choice)}>
            {filter.chip(choice)}
          </option>
        ))}
      </SelectField>
      {value === undefined ? null : (
        <p className="text-secondary text-pretty text-muted">{filter.rule(value)}</p>
      )}
    </div>
  );
}

/** A range's end as the select shows it: «۵۰۰ میلیون تومان», «۳۰٬۰۰۰ کیلومتر», «۱۴۰۰». */
function stepText(unit: RangeUnit, step: number): string {
  if (unit === 'toman') return `${formatTomanCompact(toToman(step))}${NO_BREAK_SPACE}تومان`;
  if (unit === 'km') return step === 0 ? SEARCH_COPY.card.zeroKm : formatMileage(step);
  return toPersianDigits(String(step));
}

function RangeControl({
  filter,
  value,
  onChange,
}: {
  filter: Kind<'range'>;
  value: { min?: number; max?: number } | undefined;
  onChange: (value: { min?: number; max?: number } | undefined) => void;
}) {
  const min = value?.min;
  const max = value?.max;
  const steps = [
    ...new Set([...filter.steps, ...(min === undefined ? [] : [min]), ...(max === undefined ? [] : [max])]),
  ].toSorted((a, b) => a - b);
  function update(nextMin: number | undefined, nextMax: number | undefined) {
    onChange(
      nextMin === undefined && nextMax === undefined
        ? undefined
        : {
            ...(nextMin === undefined ? {} : { min: nextMin }),
            ...(nextMax === undefined ? {} : { max: nextMax }),
          },
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <FilterTitle filter={filter} />
      <div className="flex flex-col gap-2">
        <SelectField
          label={COPY.fromName(filter.label)}
          prefix={COPY.from}
          value={min === undefined ? '' : String(min)}
          onChange={(next) => {
            update(next === '' ? undefined : Number(next), max);
          }}
        >
          <option value="">{COPY.minimum}</option>
          {steps
            // A minimum at the bound of the data is no minimum at all (every known mileage is at least zero).
            .filter((step) => step > filter.bounds.min || step === min)
            .map((step) => (
              <option key={step} value={String(step)} disabled={max !== undefined && step > max}>
                {stepText(filter.unit, step)}
              </option>
            ))}
        </SelectField>
        <SelectField
          label={COPY.toName(filter.label)}
          prefix={COPY.to}
          value={max === undefined ? '' : String(max)}
          onChange={(next) => {
            update(min, next === '' ? undefined : Number(next));
          }}
        >
          <option value="">{COPY.maximum}</option>
          {steps.map((step) => (
            <option key={step} value={String(step)} disabled={min !== undefined && step < min}>
              {stepText(filter.unit, step)}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
}

type ListOption = { readonly value: string; readonly label: string; readonly count?: number };

function OptionCheckboxes({
  options,
  selected,
  onToggle,
  columns,
}: {
  options: readonly ListOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string, on: boolean) => void;
  columns?: boolean;
}) {
  return (
    <div className={columns === true ? 'grid grid-cols-2 gap-x-2' : 'flex flex-col'}>
      {options.map((option) => (
        <CheckRow
          key={option.value}
          type="checkbox"
          checked={selected.has(option.value)}
          onChange={(on) => {
            onToggle(option.value, on);
          }}
          ariaLabel={
            option.count === undefined ? undefined : `${option.label}، ${formatCountOf(option.count, 'آگهی')}`
          }
          trailing={
            option.count === undefined ? undefined : (
              <span aria-hidden="true" className="text-label text-muted">
                {formatCount(option.count)}
              </span>
            )
          }
        >
          {option.label}
        </CheckRow>
      ))}
    </div>
  );
}

function ChoiceControl({
  filter,
  selected,
  onToggle,
}: {
  filter: Kind<'choice'>;
  selected: readonly string[];
  onToggle: (value: string, on: boolean) => void;
}) {
  const titleId = useId();
  const options = filter.options ?? [];
  // A long list of short words (the colours) sits in two columns; a list of long ones (the fuels) in one.
  const columns = options.length > 6 && options.every((option) => option.label.length <= 10);
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-1">
      <FilterTitle filter={filter} titleId={titleId} />
      <OptionCheckboxes
        options={options}
        selected={new Set(selected)}
        onToggle={onToggle}
        columns={columns}
      />
    </div>
  );
}

const VISIBLE_OPTIONS = 5;
const SEARCHABLE_FROM = 8;

function DatabaseChoiceControl({
  filter,
  kind,
  selected,
  facets,
  labels,
  onToggle,
}: {
  filter: Kind<'choice'>;
  kind: DatabaseOptions;
  selected: readonly string[];
  facets: readonly FacetOption[];
  labels: Readonly<Record<string, string>>;
  onToggle: (value: string, on: boolean) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const chosen = new Set(selected);
  // A chosen value whose count fell to nothing under the other filters is not in the counts any more; it stays in the
  // list, by its name, so it can be unchecked.
  const listed = new Set(facets.map((option) => option.value));
  const stranded = selected
    .filter((value) => !listed.has(value))
    .map((value) => ({ value, label: labels[`${kind}:${value}`] ?? value, count: 0 }));
  const options: readonly ListOption[] = [...facets, ...stranded];
  const needle = normalizeForMatch(query);
  const matching =
    needle === '' ? options : options.filter((option) => normalizeForMatch(option.label).includes(needle));
  const expanded = all || needle !== '';
  // Collapsed, the most listed few, and any chosen value beyond them, so what is applied is always in sight.
  const hidden = matching.length - VISIBLE_OPTIONS;
  const shown =
    expanded || hidden <= 2
      ? matching
      : [
          ...matching.slice(0, VISIBLE_OPTIONS),
          ...matching.slice(VISIBLE_OPTIONS).filter((option) => chosen.has(option.value)),
        ];
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-1">
      <FilterTitle filter={filter} titleId={titleId} />
      {options.length < SEARCHABLE_FROM ? null : (
        <div>
          <input
            aria-label={COPY.searchWithin(filter.label)}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            placeholder={COPY.searchWithin(filter.label)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-control border border-control bg-canvas px-3 text-control text-default placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      )}
      <OptionCheckboxes options={shown} selected={chosen} onToggle={onToggle} />
      {needle !== '' && matching.length === 0 ? (
        <p className="px-2 text-secondary text-muted">{COPY.noMatch}</p>
      ) : null}
      {!expanded && hidden > 2 ? (
        <button
          type="button"
          onClick={() => {
            setAll(true);
          }}
          className="inline-flex min-h-11 items-center self-start rounded-control px-2 text-control text-link underline"
        >
          {COPY.showAll(matching.length)}
        </button>
      ) : null}
      {all && needle === '' ? (
        <button
          type="button"
          onClick={() => {
            setAll(false);
          }}
          className="inline-flex min-h-11 items-center self-start rounded-control px-2 text-control text-link underline"
        >
          {COPY.showFewer}
        </button>
      ) : null}
    </div>
  );
}

/** The control for one filter, whatever its kind. */
export function FilterControl({ filter, context }: { filter: AnyFilter; context: ControlsContext }) {
  const { filters, onChange, facets, labels } = context;
  const value: unknown = filters[filter.id];
  switch (filter.kind) {
    case 'flag':
      return (
        <FlagControl
          filter={filter}
          checked={value === true}
          onChange={(next) => {
            onChange(filter.id, next);
          }}
        />
      );
    case 'ranked':
      return (
        <RankedControl
          filter={filter}
          value={typeof value === 'string' ? value : undefined}
          onChange={(next) => {
            onChange(filter.id, next);
          }}
        />
      );
    case 'limit':
      return (
        <LimitControl
          filter={filter}
          value={typeof value === 'number' ? value : undefined}
          onChange={(next) => {
            onChange(filter.id, next);
          }}
        />
      );
    case 'range':
      return (
        <RangeControl
          filter={filter}
          value={typeof value === 'object' && value !== null ? value : undefined}
          onChange={(next) => {
            onChange(filter.id, next);
          }}
        />
      );
    case 'choice': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (option: string, on: boolean) => {
        onChange(filter.id, toggled(selected, option, on));
      };
      return filter.optionsFrom === undefined ? (
        <ChoiceControl filter={filter} selected={selected} onToggle={toggle} />
      ) : (
        <DatabaseChoiceControl
          filter={filter}
          kind={filter.optionsFrom}
          selected={selected}
          facets={facets[filter.optionsFrom]}
          labels={labels}
          onToggle={toggle}
        />
      );
    }
  }
}
