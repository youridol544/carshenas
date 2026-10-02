import type { ReactNode } from 'react';
import { AppliedChips } from '@/features/search/components/applied-chips';
import { CatalogueStrip, type CatalogueStripItem } from '@/features/search/components/catalogue-strip';
import { CatalogueSummary } from '@/features/search/components/catalogue-summary';
import { EmptyIndex } from '@/features/search/components/empty-index';
import { FilterRail } from '@/features/search/components/filter-rail';
import { FilterSheet } from '@/features/search/components/filter-sheet';
import { IgnoredNotice } from '@/features/search/components/ignored-notice';
import { ListingCard } from '@/features/search/components/listing-card';
import { NoResults } from '@/features/search/components/no-results';
import { ResultsList } from '@/features/search/components/results-list';
import { SearchField } from '@/features/search/components/search-field';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { WordsNotice } from '@/features/search/components/words-notice';
import { SortSelect } from '@/features/search/components/sort-select';
import { catalogueInfo } from '@/features/search/info-content';
import { chosenLabels, makeLabelOf } from '@/features/search/search-labels';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { readRelaxations } from '@/features/search/server/relax-queries';
import { readScreenData } from '@/features/search/server/screen-data';
import { CATALOGUES } from '@carshenas/search/catalogues';
import {
  canonical,
  chipsOf,
  fromSearchParams,
  isCatalogueUnchanged,
  paramsFromRecord,
  toSearchParams,
} from '@carshenas/search/search';

// The search page's content (CS-61): everything that depends on the address, so it streams inside the page's Suspense
// boundary while the heading and the header prerender. It reads the search from the address through the shared schema
// (ADR-0027), asks the database for the first page, the total, the options and the counts in one round trip, and lays
// them out: the search box, the catalogues, the applied filters as chips, the count and the order, the filters (a rail
// on a desktop, a sheet on a phone) and the cards. Interaction lives in small client leaves that all change the one
// thing, the address (search-navigation.tsx).

type SearchScreenProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /**
   * A place for what plain-Farsi search understood of the words typed (CS-62): chips for the filters it found and the
   * words it could not use. It sits under the search box and above the applied filters, takes the full width of the
   * column and may be empty. It reads the address itself (`q`) and links to addresses made with searchHref.
   */
  understanding?: ReactNode;
};

export async function SearchScreen({ searchParams, understanding }: SearchScreenProps) {
  const { search, ignored } = fromSearchParams(paramsFromRecord(await searchParams));
  const data = await readScreenData(search);
  const now = new Date().toISOString();
  const labelOf = makeLabelOf(data.options, data.bodyTypes);
  const chips = chipsOf(search, labelOf);
  const { page } = data;
  const query = toSearchParams(search).toString();
  const unchangedCatalogue = isCatalogueUnchanged(search) ? search.catalogue : undefined;
  const items: CatalogueStripItem[] = CATALOGUES.map((catalogue) => ({
    id: catalogue.id,
    title: catalogue.title,
    count: data.catalogueCounts[catalogue.id],
    info: catalogueInfo(catalogue.id, labelOf),
  }));

  let body: ReactNode;
  if (page.total.count === 0) {
    const words = search.q;
    const relaxations = await readRelaxations([
      ...chips.map((chip) => ({ key: chip.key, text: chip.text, without: chip.without })),
      ...(words === undefined
        ? []
        : [{ key: 'q', text: words, without: canonical({ ...search, q: undefined }) }]),
    ]);
    body =
      chips.length === 0 && words === undefined ? (
        <EmptyIndex />
      ) : (
        <NoResults
          relaxations={relaxations}
          wordsOnly={chips.length === 0}
          clear={
            chips.length === 0
              ? null
              : {
                  filters: {},
                  ...(search.sort === undefined ? {} : { sort: search.sort }),
                  ...(search.q === undefined ? {} : { q: search.q }),
                }
          }
        />
      );
  } else {
    body = (
      <ResultsList
        key={query}
        query={query}
        initialCursor={page.nextCursor}
        initialIds={page.results.map((card) => card.id)}
        total={page.total}
        pageSize={data.pageSize}
        now={now}
      >
        {page.results.map((card, index) => (
          <li key={card.id}>
            <ListingCard card={card} now={now} eager={index < 2} />
          </li>
        ))}
      </ResultsList>
    );
  }

  // The filter panel's data: the options as this search leaves them, and the names of the chosen values.
  const filterPanel = {
    facets: data.facets,
    sourceCount: data.options.source.length,
    chosenLabels: chosenLabels(search, labelOf),
    total: page.total,
  };

  return (
    <SearchNavigationProvider
      search={search}
      className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-8"
    >
      <FilterRail {...filterPanel} />
      <div className="flex min-w-0 flex-col gap-4">
        <SearchField />
        {understanding}
        <WordsNotice text={page.text} />
        <CatalogueStrip items={items} />
        {unchangedCatalogue === undefined ? null : (
          <CatalogueSummary id={unchangedCatalogue} labelOf={labelOf} />
        )}
        <IgnoredNotice params={ignored} />
        <AppliedChips chips={chips.map(({ key, text, without }) => ({ key, text, without }))} />
        <div className="sticky top-0 z-10 -mx-4 flex flex-wrap gap-2 border-b border-divider bg-canvas px-4 py-2 lg:hidden">
          <FilterSheet {...filterPanel} />
          {page.total.count === 0 ? null : (
            <div className="flex min-w-0 flex-1 basis-48">
              <SortSelect />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          {/* a landing place for focus when the control that changed the search is gone (search-navigation.tsx) */}
          <h2 aria-live="polite" tabIndex={-1} data-results-count className="text-control font-semibold">
            {SEARCH_COPY.results.count(page.total.count, page.total.exact)}
          </h2>
          {page.total.count === 0 ? null : (
            <div className="hidden w-64 lg:block">
              <SortSelect />
            </div>
          )}
        </div>
        <div className="relative">
          {/* while a new search is on its way the old results stay, readable, under a line that runs along them */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-2 h-0.5 overflow-hidden opacity-0 transition-opacity group-data-pending/search:opacity-100 group-data-pending/search:delay-pending"
          >
            <div className="h-full pending-bar" />
          </div>
          {body}
        </div>
      </div>
    </SearchNavigationProvider>
  );
}
