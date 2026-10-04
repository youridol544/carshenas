'use client';

import { useId, useState } from 'react';
import { CheckRow } from '@/components/ui/check-row';
import { InfoPopover } from '@/components/ui/info-popover';
import { RangeControl } from '@/features/search/components/range-control';
import { SelectField } from '@/components/ui/select-field';
import { normalizeForMatch, toggled } from '@/features/search/filter-panel-model';
import { filterInfo } from '@/features/search/info-content';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { FacetOption, SearchFacets } from '@/features/search/search-types';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import type { AnyFilter } from '@carshenas/search/filters';
import type { DatabaseOptions } from '@carshenas/search/kinds';
import type { SearchFilters } from '@carshenas/search/search';

// One control for each kind of filter in the shared definitions (CS-58): a checkbox for an on/off rule, a select for
// an order of values or a limit, two selects for a range (its steps are the definitions' own: any other value an
// address carries shows up in them too), a checkbox list for a choice, and for the options that are rows in the
// database a list with how many listings each would give, a search box when the list is long, and a «show all»
// button when it is not short. Each has its title and, beside it, an info control with the definition's own words
// (the owner's request of 2026-10-01). Nothing here knows whether a change applies at once (the desktop rail) or waits
// for «apply» (the phone sheet): a control reports its new value through onChange.

const COPY = SEARCH_COPY.panel;

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

// A list never scrolls inside the panel (owner, 2026-10-04): it shows its first few options and grows in place with
// «نمایش بیشتر», so the page is the only thing that scrolls. Each press adds ten options, or as many as are shown already
// when that is more, so a list of two hundred and seventy trims is six presses, not twenty-seven; the search box above a
// long list finds one at once. A chosen value beyond the first few stays in sight, so what is applied is always
// visible; hiding one or two options is pointless, so they show.
const FIRST_OPTIONS = 5;
const FIRST_CHOICES = 6;
const MORE_STEP = 10;
const SHOW_ANYWAY = 2;
const SEARCHABLE_FROM = 8;

/** The options a list shows for the number it has grown to, and how many stay hidden. */
function grown<T extends { readonly value: string }>(
  options: readonly T[],
  chosen: ReadonlySet<string>,
  count: number,
): { shown: readonly T[]; hidden: number } {
  if (options.length - count <= SHOW_ANYWAY) return { shown: options, hidden: 0 };
  const shown = [
    ...options.slice(0, count),
    ...options.slice(count).filter((option) => chosen.has(option.value)),
  ];
  return { shown, hidden: options.length - shown.length };
}

function GrowingOptions({
  options,
  selected,
  onToggle,
  first,
  columns,
  everything = false,
}: {
  options: readonly ListOption[];
  selected: ReadonlySet<string>;
  onToggle: (value: string, on: boolean) => void;
  /** How many show before the list has grown. */
  first: number;
  columns?: boolean;
  /** Show every option, with no button: a search is narrowing the list. */
  everything?: boolean;
}) {
  const [count, setCount] = useState(first);
  const { shown, hidden } = everything ? { shown: options, hidden: 0 } : grown(options, selected, count);
  // One button for both directions, so focus stays on it as the list grows and shrinks. It is there only for a list
  // that would be cut at its first few.
  const cuttable = !everything && options.length - first > SHOW_ANYWAY;
  return (
    <>
      <OptionCheckboxes options={shown} selected={selected} onToggle={onToggle} columns={columns} />
      {cuttable && (hidden > 0 || count > first) ? (
        <button
          type="button"
          onClick={() => {
            setCount(hidden > 0 ? count + Math.max(MORE_STEP, count) : first);
          }}
          className="inline-flex min-h-11 items-center self-start rounded-control px-2 text-control text-link underline"
        >
          {hidden > 0 ? COPY.showMore : COPY.showFewer}
        </button>
      ) : null}
    </>
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
      <GrowingOptions
        options={options}
        selected={new Set(selected)}
        onToggle={onToggle}
        first={FIRST_CHOICES}
        columns={columns}
      />
    </div>
  );
}

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
      <GrowingOptions
        options={matching}
        selected={chosen}
        onToggle={onToggle}
        first={FIRST_OPTIONS}
        everything={needle !== ''}
      />
      {needle !== '' && matching.length === 0 ? (
        <p className="px-2 text-secondary text-muted">{COPY.noMatch}</p>
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
