import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { FilterPanel } from '@/features/search/components/filter-panel';
import { panelLayout } from '@/features/search/filter-panel-model';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SearchFacets } from '@/features/search/search-types';
import { FILTERS } from '@carshenas/search/filters';
import type { SearchFilters } from '@carshenas/search/search';

// The filter panel (CS-61): one control for each kind of filter in the shared definitions, each with its info control,
// reporting its changes through onChange; the options that are rows come with their counts, a search box and a
// «show all» button when the list is long; a group opens by itself when one of its filters is applied.

const COPY = SEARCH_COPY.panel;

function options(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    value: `${prefix}-${String(index + 1)}`,
    label: `${prefix} ${String(index + 1)}`,
    count: 100 - index,
  }));
}

const FACETS: SearchFacets = {
  make: [
    { value: 'peugeot', label: 'پژو', count: 1000 },
    { value: 'samand', label: 'سمند', count: 500 },
  ],
  model: options('مدل', 12),
  trim: [],
  body_type: [],
  city: [],
  district: [],
  source: [],
};

const NO_FILTERS: SearchFilters = {};
const NO_LABELS: Record<string, string> = {};

function Harness({
  initial = NO_FILTERS,
  sourceCount = 1,
  labels = NO_LABELS,
  facets = FACETS,
  onChange,
}: {
  initial?: SearchFilters;
  sourceCount?: number;
  labels?: Record<string, string>;
  facets?: SearchFacets;
  onChange?: (filters: SearchFilters) => void;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <FilterPanel
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onChange?.(next);
      }}
      facets={facets}
      sourceCount={sourceCount}
      labels={labels}
    />
  );
}

test('every filter that is offered has its control and an info control with its own name', () => {
  render(<Harness sourceCount={2} />);
  const layout = panelLayout(2);
  const offered = [...layout.featured, ...layout.groups.flatMap((group) => group.filters)];
  expect(offered).toHaveLength(FILTERS.length);
  // One pass over the buttons: computing the accessible name of every button once per filter is what made this slow.
  const names = new Set(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')));
  for (const filter of offered) expect(names).toContain(SEARCH_COPY.info.button(filter.label));
});

test('the source filter appears on its own when a second source has listings', () => {
  const { rerender } = render(<Harness sourceCount={1} />);
  expect(screen.queryByRole('button', { name: SEARCH_COPY.info.button('منبع') })).not.toBeInTheDocument();
  rerender(<Harness sourceCount={2} />);
  expect(screen.getByRole('button', { name: SEARCH_COPY.info.button('منبع') })).toBeInTheDocument();
});

test('checking a make reports it, with its count in the name, and unchecking takes it out', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const peugeot = screen.getByRole('checkbox', { name: /^پژو،/ });
  await user.click(peugeot);
  expect(onChange).toHaveBeenLastCalledWith({ make: ['peugeot'] });
  expect(peugeot).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: /^سمند،/ }));
  expect(onChange).toHaveBeenLastCalledWith({ make: ['peugeot', 'samand'] });
  await user.click(peugeot);
  expect(onChange).toHaveBeenLastCalledWith({ make: ['samand'] });
  await user.click(screen.getByRole('checkbox', { name: /^سمند،/ }));
  expect(onChange).toHaveBeenLastCalledWith({});
});

test('the verdict on the price is a select that says what its choice measures', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const deal = screen.getByRole('combobox', { name: 'ارزیابی قیمت' });
  await user.selectOptions(deal, 'good');
  expect(onChange).toHaveBeenLastCalledWith({ deal: 'good' });
  expect(screen.getByText(/دست‌کم .* کمتر از ارزش بازار همان خودرو باشد/)).toBeInTheDocument();
  await user.selectOptions(deal, '');
  expect(onChange).toHaveBeenLastCalledWith({});
});

test('a range is two selects whose steps are the definition’s, and one end cannot pass the other', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness initial={{ price: { min: 700_000_000 } }} onChange={onChange} />);
  const minimum = screen.getByRole('combobox', { name: 'حداقل قیمت' });
  const maximum = screen.getByRole('combobox', { name: 'حداکثر قیمت' });
  expect(minimum).toHaveValue('700000000');
  // below the minimum is not a maximum
  const lower = within(maximum)
    .getAllByRole('option')
    .filter(
      (option) => Number(option.getAttribute('value')) < 700_000_000 && option.getAttribute('value') !== '',
    );
  expect(lower.length).toBeGreaterThan(0);
  for (const option of lower) expect(option).toBeDisabled();
  await user.selectOptions(maximum, '2000000000');
  expect(onChange).toHaveBeenLastCalledWith({ price: { min: 700_000_000, max: 2_000_000_000 } });
  await user.selectOptions(minimum, '');
  expect(onChange).toHaveBeenLastCalledWith({ price: { max: 2_000_000_000 } });
});

test('a limit the address carries that the select does not offer is still shown, in its place', () => {
  render(<Harness initial={{ age: 7 }} />);
  const select = screen.getByRole('combobox', { name: 'حداکثر عمر' });
  expect(select).toHaveValue('7');
});

test('a rule filter is a checkbox, and its group opens by itself while it is applied', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const flag = screen.getByRole('checkbox', { name: 'بدون رنگ' });
  // Inside a group that is closed, so not visible: jest-dom reads a closed details element as hiding its content.
  expect(flag).not.toBeVisible();
  await user.click(flag);
  expect(onChange).toHaveBeenLastCalledWith({ paint_free: true });
  expect(flag).toBeVisible();
});

test('a group says how many of its filters are applied', () => {
  render(<Harness initial={{ paint_free: true, no_accident: true }} />);
  expect(screen.getByLabelText(`بدنه و فنی، ${COPY.appliedInGroup(2)}`)).toBeInTheDocument();
});

test('a long list shows the most listed few and every chosen value, and «show all» shows the rest', async () => {
  const user = userEvent.setup();
  render(<Harness initial={{ model: ['مدل-12'] }} />);
  const group = screen.getByRole('group', { name: 'مدل' });
  // five of the twelve, and the chosen twelfth beyond them
  expect(within(group).getAllByRole('checkbox')).toHaveLength(6);
  expect(within(group).getByRole('checkbox', { name: /^مدل 12،/ })).toBeChecked();
  await user.click(within(group).getByRole('button', { name: COPY.showAll(12) }));
  expect(within(group).getAllByRole('checkbox')).toHaveLength(12);
  await user.click(within(group).getByRole('button', { name: COPY.showFewer }));
  expect(within(group).getAllByRole('checkbox')).toHaveLength(6);
});

test('a long list can be searched, in any digit script', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const group = screen.getByRole('group', { name: 'مدل' });
  await user.type(within(group).getByRole('searchbox', { name: COPY.searchWithin('مدل') }), 'مدل ۱۰');
  expect(within(group).getAllByRole('checkbox')).toHaveLength(1);
  expect(within(group).getByRole('checkbox', { name: /^مدل 10،/ })).toBeInTheDocument();
  await user.clear(within(group).getByRole('searchbox', { name: COPY.searchWithin('مدل') }));
  await user.type(within(group).getByRole('searchbox', { name: COPY.searchWithin('مدل') }), 'ندارد');
  expect(within(group).queryByRole('checkbox')).not.toBeInTheDocument();
  expect(within(group).getByText(COPY.noMatch)).toBeInTheDocument();
});

test('a chosen value whose count fell to nothing stays in its list by its name, so it can be unchecked', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness initial={{ make: ['kia'] }} labels={{ 'make:kia': 'کیا' }} onChange={onChange} />);
  const kia = screen.getByRole('checkbox', { name: /^کیا،/ });
  expect(kia).toBeChecked();
  await user.click(kia);
  expect(onChange).toHaveBeenLastCalledWith({});
});
