import { ArrowLeft } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { CardRail } from '@/features/home/components/card-rail';
import { HOME_COPY } from '@/features/home/home-copy';
import type { HomeRow } from '@/features/home/server/home-queries';
import { ListingCard } from '@/features/search/components/listing-card';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { CATALOGUES } from '@carshenas/search/catalogues';
import { catalogueSearch, describeSearch, searchHref, toStoredSearch } from '@carshenas/search/search';
import { SaveSearchButton } from '@/features/search-files/components/save-search-button';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';

// One premade catalogue as a row of listing cards (CS-63; CS-58 defines the catalogue, CS-61 the card): its title with
// the info control (the text comes from the definition, passed in), the one-sentence description, how many listings it
// holds with «دیدن همه», which opens the search page with the catalogue's own filters, and then the first cards in the
// catalogue's order, ending in a tile that says the same. The title is the row's heading, so a screen reader lists the
// rows by name.

type CatalogueRowProps = {
  row: HomeRow;
  info: InfoContent;
  now: string;
};

export function CatalogueRow({ row, info, now }: CatalogueRowProps) {
  const catalogue = CATALOGUES.find((candidate) => candidate.id === row.id);
  if (catalogue === undefined) return null;
  const search = catalogueSearch(row.id);
  const href = searchHref(search) as Route;
  const headingId = `home-row-${row.id}`;
  return (
    <section aria-labelledby={headingId} data-catalogue={row.id}>
      <CardRail
        label={catalogue.title}
        heading={
          <>
            <div className="flex items-center gap-1">
              <h2 id={headingId} className="text-heading font-bold text-balance">
                {catalogue.title}
              </h2>
              <InfoPopover
                label={SEARCH_COPY.catalogues.info(catalogue.title)}
                closeLabel={SEARCH_COPY.info.close}
                content={info}
              />
            </div>
            <p className="max-w-reading text-secondary text-pretty text-muted">
              <span className="font-medium text-default">{HOME_COPY.rows.count(row.count)}</span>
              {'، '}
              {catalogue.description}
            </p>
          </>
        }
        seeAll={
          <>
            {/* «بسپارش به کارشناس» (CS-70): the row's catalogue as a search file */}
            <SaveSearchButton
              variant="row"
              search={toStoredSearch(search)}
              chips={describeSearch(search)}
              suggestedName={catalogue.title}
              href={searchHref(search)}
              accessibleName={SEARCH_FILES_COPY.save.buttonFor(catalogue.title)}
            />
            <Link
              href={href}
              aria-label={HOME_COPY.rows.seeAllOf(catalogue.title)}
              className="inline-flex min-h-11 max-w-full items-center gap-1 px-2 text-control text-link underline"
            >
              {HOME_COPY.rows.seeAll}
            </Link>
          </>
        }
      >
        {row.cards.map((card) => (
          <li key={card.id} className="flex w-80 shrink-0 snap-start flex-col *:flex-1 lg:w-96">
            <ListingCard card={card} now={now} />
          </li>
        ))}
        <li className="flex w-48 shrink-0 snap-start">
          <Link
            href={href}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-card border border-divider bg-surface-muted p-4 text-center text-control font-semibold transition-colors hover:bg-surface-hover active:bg-surface-pressed"
          >
            <span>{HOME_COPY.rows.seeAllCount(row.count)}</span>
            <Icon icon={ArrowLeft} />
          </Link>
        </li>
      </CardRail>
    </section>
  );
}
