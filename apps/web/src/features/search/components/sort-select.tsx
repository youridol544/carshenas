'use client';

import { ArrowUpDown } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { SelectField } from '@/components/ui/select-field';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { useIsDesktop } from '@/features/search/use-viewport';
import { DEFAULT_SORT, SORTS, SORT_IDS } from '@carshenas/search/sorts';

// The order of the results: a native select at the top of the list, not a sheet of radio buttons (listing-patterns.md).
// Best deal first is the default; choosing another changes the address (`sort`), and the default is left out of it.
// Changing the order is something a buyer does dozens of times a day, so nothing animates.

export function SortSelect({ only }: { only: 'phone' | 'desktop' }) {
  const { search, navigate } = useSearchNavigation();
  const desktop = useIsDesktop();
  // The page has one sort select per layout; only the one that is shown is mounted.
  if (desktop !== null && desktop !== (only === 'desktop')) return null;
  return (
    <SelectField
      label={SEARCH_COPY.controls.sort}
      value={search.sort ?? DEFAULT_SORT}
      prefix={<Icon icon={ArrowUpDown} />}
      onChange={(value) => {
        const sort = SORT_IDS.find((id) => id === value);
        if (sort !== undefined) navigate({ ...search, sort });
      }}
    >
      {SORTS.map((sort) => (
        <option key={sort.id} value={sort.id}>
          {sort.label}
        </option>
      ))}
    </SelectField>
  );
}
