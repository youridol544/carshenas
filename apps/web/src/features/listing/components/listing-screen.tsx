import { ArrowRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { MarkButton } from '@/features/marks/components/mark-button';
import { NumericText } from '@/components/ui/numeric-text';
import { Icon } from '@/components/ui/icon';
import { ComparablesSection } from '@/features/listing/components/comparables-section';
import { ConditionSection } from '@/features/listing/components/condition-section';
import { FactsSection } from '@/features/listing/components/facts-section';
import { FreshnessNote } from '@/features/listing/components/freshness-note';
import { OffMarketBanner, SimilarSection } from '@/features/listing/components/off-market';
import { PhotoGallery } from '@/features/listing/components/photo-gallery';
import { PriceAnalysis } from '@/features/listing/components/price-analysis';
import { PriceCard } from '@/features/listing/components/price-card';
import { PriceHistorySection } from '@/features/listing/components/price-history-section';
import { clickOutHref, PrimaryAction } from '@/features/listing/components/primary-action';
import { RiskFlags } from '@/features/listing/components/risk-flags';
import { ShareButton } from '@/features/listing/components/share-button';
import { gaugeView } from '@/features/listing/gauge-view';
import { buildExplanation } from '@/features/listing/listing-explanation';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { ListingPageData, ListingStatus } from '@/features/listing/listing-types';
import {
  comparableRows,
  declaredRows,
  factRows,
  freshnessView,
  historyView,
  listingTitle,
  priceView,
  riskFlags,
  summaryLine,
  textConditionRows,
  textTermRows,
} from '@/features/listing/listing-view';
import { formatDate } from '@carshenas/locale/format-date';
import { searchHref } from '@carshenas/search/search';
import { modelHref, modelOfKey } from '@/lib/model-address';

// The listing page (CS-64): the photo, the title and the price with its verdict, then the price analysis as the hero
// (the gauge, the explanation, the comparables behind the value), the cautions, the condition with its quotes, the
// price history and the facts. On a phone it is one column with the click-out in a bar that stays in reach; from 64 rem
// the photos and the sections take the main column and the title, price, click-out and freshness stay beside them, in
// view while the sections scroll. One primary action only: the same link is rendered in the bar (phone) and in the
// column (desktop), and CSS shows one of them. A listing that has left the market says so first and offers similar ones.
// Everything here is server markup except the gallery, the share button and the freshness note.

const STATE_MESSAGE: Record<Exclude<ListingStatus, 'active' | 'removed'>, (source: string) => string> = {
  sold: () => LISTING_COPY.state.sold,
  expired: () => LISTING_COPY.state.expired,
  gone: (source) => LISTING_COPY.state.off(source),
};

export function ListingScreen({ page }: { page: ListingPageData }) {
  const { listing, valuation } = page;
  const title = listingTitle(listing);
  const price = priceView(listing);
  const gauge = gaugeView(listing, valuation);
  const explanation = buildExplanation({ listing, valuation, comparables: page.comparables });
  const freshness = freshnessView(listing, page.now);
  const href = clickOutHref(listing.url);
  const onMarket = listing.status === 'active';
  const showAnalysis = onMarket || valuation !== null;
  const offMessage =
    listing.status === 'active' || listing.status === 'removed'
      ? null
      : STATE_MESSAGE[listing.status](listing.source.name);
  const modelPage = modelOfKey(listing.model?.key);
  const similarLink = listing.model === null ? null : searchHref({ filters: { model: [listing.model.key] } });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pt-4 lg:pb-16">
      <nav aria-label={LISTING_COPY.back} className="flex flex-wrap items-center justify-between gap-x-2">
        <Link
          href="/search"
          className="-ms-3 inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-control text-link hover:bg-surface-hover"
        >
          <Icon icon={ArrowRight} />
          {LISTING_COPY.back}
        </Link>
        {/* On a phone the controls sit here; from 64 rem they move beside the title. */}
        <div className="flex items-center lg:hidden">
          <MarkButton listingId={listing.id} title={title} variant="inline" />
          <ShareButton title={title} />
        </div>
      </nav>
      {offMessage === null ? null : (
        <OffMarketBanner message={offMessage} since={formatDate(listing.delistedAt ?? listing.lastSeenAt)} />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PhotoGallery photos={page.photos} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-bold text-balance">
              <bdi>{title}</bdi>
            </h1>
            <p className="text-secondary text-pretty text-muted">{summaryLine(listing).join('، ')}</p>
            {modelPage === null || listing.model === null ? null : (
              <ul aria-label={LISTING_COPY.model.label} className="flex flex-wrap gap-x-4">
                <li>
                  <Link
                    href={modelHref(modelPage) as Route}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center text-secondary text-link underline"
                  >
                    {LISTING_COPY.model.page(listing.model.name)}
                  </Link>
                </li>
                {similarLink === null ? null : (
                  <li>
                    <Link
                      href={similarLink as Route}
                      className="inline-flex min-h-11 items-center text-secondary text-link underline"
                    >
                      {LISTING_COPY.model.rest}
                    </Link>
                  </li>
                )}
              </ul>
            )}
            <div className="-ms-3 hidden items-center lg:flex">
              <MarkButton listingId={listing.id} title={title} variant="inline" />
              <ShareButton title={title} />
            </div>
          </div>
          <PriceCard price={price} gauge={gauge} hasAnalysis={showAnalysis} />
          {onMarket ? (
            href === null ? null : (
              <div className="hidden flex-col gap-2 lg:flex">
                <PrimaryAction href={href} source={listing.source.name} className="w-full" />
                <p className="text-meta text-pretty text-muted">{LISTING_COPY.action.note}</p>
              </div>
            )
          ) : (
            <div className="hidden flex-col items-start gap-2 lg:flex">
              {similarLink === null ? null : (
                <Link href={similarLink as Route} className={`${actionClasses('primary')} w-full`}>
                  {LISTING_COPY.state.seeSimilar}
                </Link>
              )}
              {href === null ? null : (
                <a href={href} target="_blank" rel="noopener" className={actionClasses('tertiary')}>
                  {LISTING_COPY.state.lastOnSource(listing.source.name)}
                </a>
              )}
            </div>
          )}
          <FreshnessNote
            listingId={listing.id}
            checked={freshness.checked}
            requestsRecheck={freshness.requestsRecheck}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-2">
          {onMarket ? null : <SimilarSection items={page.similar} searchLink={similarLink} />}
          {showAnalysis ? <PriceAnalysis gauge={gauge} explanation={explanation} /> : null}
          <RiskFlags flags={riskFlags(page)} />
          <ConditionSection
            declared={declaredRows(listing)}
            fromText={textConditionRows(page.evidence)}
            terms={textTermRows(page.evidence)}
          />
          {valuation === null ? null : <ComparablesSection rows={comparableRows(page.comparables)} />}
          <PriceHistorySection history={historyView(page)} />
          <FactsSection rows={factRows(listing, page.now)} />
        </div>
      </div>
      {(onMarket ? href : similarLink) === null ? null : (
        <div
          data-sticky-bar
          className="sticky bottom-0 z-30 -mx-4 border-t border-divider bg-surface p-3 shadow-raised lg:hidden"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 text-control font-bold">
              {price.kind === 'down_payment' ? `${price.caption}: ` : ''}
              {price.kind === 'words' ? price.text : <NumericText>{price.text}</NumericText>}
            </p>
            {onMarket && href !== null ? (
              <div className="flex grow items-center gap-2">
                {/* CS-69: in reach of the thumb, beside the click-out. */}
                <MarkButton listingId={listing.id} title={title} variant="bar" />
                <PrimaryAction href={href} source={listing.source.name} className="grow" />
              </div>
            ) : similarLink === null ? null : (
              <Link href={similarLink as Route} className={`${actionClasses('primary')} grow`}>
                {LISTING_COPY.state.seeSimilar}
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
