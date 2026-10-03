import { Archive, ExternalLink, FileSearch, SearchX } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { CheckAnswer } from '@/features/check-link/check-link-types';
import { PriceAnalysis } from '@/features/listing/components/price-analysis';
import { PriceCard } from '@/features/listing/components/price-card';
import { clickOutHref } from '@/features/listing/components/primary-action';
import { SimilarSection } from '@/features/listing/components/off-market';
import { gaugeView } from '@/features/listing/gauge-view';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import { buildExplanation } from '@/features/listing/listing-explanation';
import type { ListingPageData } from '@/features/listing/listing-types';
import { listingTitle, priceView, summaryLine } from '@/features/listing/listing-view';
import { ListingPhoto } from '@/features/search/components/listing-photo';
import { searchHref } from '@carshenas/search/search';

// What a pasted link came to, laid out (CS-65). A listing we know and can price gets the answer on this very page, the
// verdict first: the listing's photo, name and price with its deal badge on one side, and the price analysis (gauge,
// «چرا؟») on the other, every number from the same functions the listing page uses, so the two never disagree; the full
// page is one tap away. Every other answer is a panel that says plainly what we know and what we did, and offers listings
// that are rated. Server markup, except the photo.

const COPY = CHECK_COPY;

function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
  actions,
}: {
  icon: typeof SearchX;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section
      aria-labelledby="check-answer-title"
      data-check-answer
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-pressed text-muted">
        <Icon icon={icon} size={24} />
      </span>
      <h2 id="check-answer-title" className="text-heading font-bold text-balance">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-body text-pretty text-muted">{children}</div>
      <Actions>{actions}</Actions>
    </section>
  );
}

function FoundCard({ page }: { page: ListingPageData }) {
  const { listing, valuation } = page;
  const gauge = gaugeView(listing, valuation);
  const explanation = buildExplanation({ listing, valuation, comparables: page.comparables });
  const href = clickOutHref(listing.url);
  const photo = page.photos[0];
  return (
    <section
      aria-labelledby="check-answer-title"
      data-check-answer
      data-rated={gauge?.banded === true ? '' : undefined}
      className="grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-8"
    >
      <div className="@container flex flex-col gap-4 rounded-card border border-divider bg-surface p-4 lg:sticky lg:top-4">
        {/* Photo beside the name when the card is 20 rem wide inside (a phone at the normal text size); above it when it is
            narrower: the desktop column (21 rem, 19 rem inside) and any phone whose text is enlarged. */}
        <div className="grid grid-cols-1 gap-3 @xs:grid-cols-[7rem_minmax(0,1fr)]">
          <div className="relative aspect-4/3 overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo">
            <ListingPhoto
              src={photo?.thumbnailUrl ?? photo?.url ?? null}
              eager
              sizes="(min-width: 64rem) 21rem, 7rem"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-meta font-medium text-muted">{COPY.result.from(listing.source.name)}</p>
            <h2 id="check-answer-title" className="text-heading font-bold text-balance">
              <bdi>{listingTitle(listing)}</bdi>
            </h2>
            <p className="text-secondary text-pretty text-muted">{summaryLine(listing).join(' · ')}</p>
          </div>
        </div>
        <PriceCard price={priceView(listing)} gauge={gauge} hasAnalysis />
        <Actions>
          <Link
            href={`/listings/${String(listing.id)}`}
            className={`${actionClasses('primary')} w-full sm:w-auto lg:w-full`}
          >
            {COPY.result.full}
          </Link>
          {href === null ? null : (
            <a
              href={href}
              target="_blank"
              rel="noopener"
              aria-label={`${COPY.result.open(listing.source.name)}، ${LISTING_COPY.action.opensInNewTab}`}
              className={`${actionClasses('secondary')} w-full gap-2 sm:w-auto lg:w-full`}
            >
              {COPY.result.open(listing.source.name)}
              <Icon icon={ExternalLink} />
            </a>
          )}
        </Actions>
        <p className="text-meta text-pretty text-muted">{COPY.result.fullHint}</p>
      </div>
      <PriceAnalysis gauge={gauge} explanation={explanation} />
    </section>
  );
}

const SEARCH_ALL = '/search';

export function CheckAnswerView({ answer }: { answer: CheckAnswer }) {
  switch (answer.kind) {
    case 'found':
      return <FoundCard page={answer.page} />;
    case 'off_market':
      return (
        <Panel
          icon={Archive}
          title={COPY.off.title}
          actions={
            <Link
              href={`/listings/${String(answer.page.listing.id)}` as Route}
              className={actionClasses('primary')}
            >
              {COPY.off.open}
            </Link>
          }
        >
          <p>{COPY.off.body}</p>
        </Panel>
      );
    case 'unread': {
      const model = answer.listing.model;
      const modelName = model?.name ?? answer.listing.name;
      const href = clickOutHref(answer.listing.url);
      const modelSearch = model === null ? SEARCH_ALL : searchHref({ filters: { model: [model.key] } });
      return (
        <div className="flex flex-col gap-8">
          <Panel
            icon={FileSearch}
            title={COPY.unread.title}
            actions={
              <>
                <Link href={modelSearch as Route} className={actionClasses('primary')}>
                  {COPY.unread.allOfModel(modelName)}
                </Link>
                {href === null ? null : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    aria-label={`${COPY.result.open(answer.listing.source.name)}، ${LISTING_COPY.action.opensInNewTab}`}
                    className={`${actionClasses('secondary')} gap-2`}
                  >
                    {COPY.result.open(answer.listing.source.name)}
                    <Icon icon={ExternalLink} />
                  </a>
                )}
              </>
            }
          >
            <p>{COPY.unread.body(modelName)}</p>
            {answer.counted ? <p>{COPY.unread.counted}</p> : null}
          </Panel>
          {answer.suggestions.length === 0 ? null : (
            <SimilarSection
              items={answer.suggestions}
              searchLink={modelSearch}
              words={{
                title: COPY.unread.suggestions(modelName),
                hint: COPY.unread.suggestionsHint,
                all: COPY.unread.allOfModel(modelName),
              }}
            />
          )}
        </div>
      );
    }
    case 'not_found':
      return (
        <div className="flex flex-col gap-8">
          <Panel
            icon={SearchX}
            title={COPY.notFound.title}
            actions={
              <Link href={SEARCH_ALL} className={actionClasses('primary')}>
                {COPY.notFound.all}
              </Link>
            }
          >
            <p>{answer.recorded ? COPY.notFound.body : COPY.notFound.bodyUnrecorded}</p>
          </Panel>
          {answer.suggestions.length === 0 ? null : (
            <SimilarSection
              items={answer.suggestions}
              searchLink={SEARCH_ALL}
              words={{
                title: COPY.notFound.suggestions,
                hint: COPY.notFound.suggestionsHint,
                all: COPY.notFound.all,
              }}
            />
          )}
        </div>
      );
  }
}
