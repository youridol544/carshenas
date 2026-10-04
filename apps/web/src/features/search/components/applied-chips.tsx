'use client';

import { X } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { useSearchNavigation } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { isolatedWords } from '@/lib/isolated-words';
import { canonical, type Search } from '@carshenas/search/search';

// The applied filters as removable chips (listing-patterns.md: never a bare count): each says what it keeps in the
// definitions' own words and removes only itself. The chips are made on the server, with the Persian names of the makes,
// models and districts the database holds, and arrive here as data; removing one is a navigation to the search
// without it, so the address, the results and the controls all follow. A catalogue's filters show here too, so a buyer
// can drop one of them without leaving the catalogue's idea behind. A rail on a phone, wrapping on a desktop.

export type AppliedChip = {
  readonly key: string;
  readonly text: string;
  /** The search without this chip. */
  readonly without: Search;
  /** The accessible name when it is not «برداشتن <text>» (the words of a sentence are shown in quotes). */
  readonly label?: string;
  /** Words looked for in the listings' text, not a filter: drawn quieter (CS-111). */
  readonly quiet?: boolean;
  /** The buyer's words inside `text`, set apart as their own run (they may be Latin or digits). */
  readonly words?: string;
};

export function AppliedChips({ chips }: { chips: readonly AppliedChip[] }) {
  const { search, navigate } = useSearchNavigation();
  if (chips.length === 0) return null;
  return (
    <section aria-label={SEARCH_COPY.chips.label} className="-mx-4 lg:mx-0">
      <ul className="flex scroll-fade-inline items-center gap-2 overflow-x-auto overscroll-x-contain px-4 lg:flex-wrap lg:overflow-visible lg:px-0">
        {chips.map((chip) => (
          <li key={chip.key} className="shrink-0">
            <button
              type="button"
              aria-label={chip.label ?? SEARCH_COPY.chips.remove(chip.text)}
              onClick={() => {
                navigate(chip.without);
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border ps-4 pe-3 text-label font-medium whitespace-nowrap transition-colors hover:bg-surface-hover ${
                chip.quiet === true
                  ? 'border-dashed border-control bg-canvas text-muted'
                  : 'border-divider bg-surface text-default'
              }`}
            >
              {chip.words === undefined ? chip.text : isolatedWords(chip.text, chip.words)}
              <Icon icon={X} size={16} />
            </button>
          </li>
        ))}
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => {
              // Everything the chips say goes, the words too; only the order the buyer chose stays. The sentence
              // described what is gone.
              navigate(
                canonical({ filters: {}, ...(search.sort === undefined ? {} : { sort: search.sort }) }),
                {
                  keepSentence: false,
                },
              );
            }}
            className="inline-flex min-h-11 items-center rounded-full px-2 text-label font-medium whitespace-nowrap text-link underline"
          >
            {SEARCH_COPY.controls.clearFilters}
          </button>
        </li>
      </ul>
    </section>
  );
}
