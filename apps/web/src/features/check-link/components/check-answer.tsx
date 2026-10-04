import { Archive, ExternalLink, Hourglass } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { AnswerFocus } from '@/features/check-link/components/answer-focus';
import { Actions, AnswerPanel } from '@/features/check-link/components/answer-panel';
import { OutsideAnswer } from '@/features/check-link/components/outside-answer';
import { QueuedAnswer } from '@/features/check-link/components/queued-answer';
import { UnreadableAnswer } from '@/features/check-link/components/unreadable-answer';
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

// What a pasted link came to, laid out (CS-65, CS-115). A listing we know and can price gets the answer on this very page,
// the verdict first: the listing's photo, name and price with its deal badge on one side, and the price analysis (gauge,
// «چرا؟») on the other, every number from the same functions the listing page uses, so the two never disagree; the full
// page is one tap away. Every other answer is a panel that says plainly what is known and what happens, and the four
// states look different from each other: queued (the car is read, the ad is not yet), outside (the car is not read: the
// limit, the cars that are, one way forward) and unreadable (the link does not say which car), beside the rating. Server
// markup, except the photo and the ask.

const COPY = CHECK_COPY;

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
      data-answer-kind="found"
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
            <h2 id="check-answer-title" tabIndex={-1} className="text-heading font-bold text-balance">
              <bdi>{listingTitle(listing)}</bdi>
            </h2>
            <p className="text-secondary text-pretty text-muted">{summaryLine(listing).join('، ')}</p>
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
      </div>
      <PriceAnalysis gauge={gauge} explanation={explanation} />
    </section>
  );
}

const SEARCH_ALL = '/search';

export function CheckAnswerView({ answer }: { answer: CheckAnswer }) {
  return (
    <>
      <AnswerContent answer={answer} />
      <AnswerFocus />
    </>
  );
}

function AnswerContent({ answer }: { answer: CheckAnswer }) {
  switch (answer.kind) {
    case 'found':
      return <FoundCard page={answer.page} />;
    case 'queued':
      return <QueuedAnswer answer={answer} />;
    case 'outside':
      return <OutsideAnswer answer={answer} />;
    case 'unreadable':
      return <UnreadableAnswer answer={answer} />;
    case 'limited':
      return (
        <AnswerPanel
          kind="limited"
          icon={Hourglass}
          title={COPY.limited.title}
          actions={
            <Link href={SEARCH_ALL} className={actionClasses('secondary')}>
              {COPY.problems.searchInstead}
            </Link>
          }
        >
          <p>{COPY.limited.body}</p>
        </AnswerPanel>
      );
    case 'off_market':
      return (
        <div className="@container flex flex-col gap-8">
          <AnswerPanel
            kind="off_market"
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
          </AnswerPanel>
          {answer.suggestions.length === 0 ? null : (
            <SimilarSection
              items={answer.suggestions}
              searchLink={
                answer.page.listing.model === null
                  ? SEARCH_ALL
                  : searchHref({ filters: { model: [answer.page.listing.model.key] } })
              }
              words={{
                title: COPY.off.similar,
                hint: COPY.queued.dealsHint,
                all: COPY.problems.searchInstead,
              }}
            />
          )}
        </div>
      );
  }
}
