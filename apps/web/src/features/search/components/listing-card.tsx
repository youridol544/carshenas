import { Check, ExternalLink, Images, TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { DealBadge } from '@/features/search/components/deal-badge';
import { ListingPhoto } from '@/features/search/components/listing-photo';
import { cardView, type ConditionView } from '@/features/search/listing-card-view';
import { listingLink, type ListingLink } from '@/features/search/listing-link';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { ListingCard as ListingCardData } from '@/features/search/search-types';

// A result card (CS-61; teardown patterns 18, 20 and 21: docs/research/2026-09-30-cargurus-autolist-jabama-teardown.md).
// The photo sits at the inline start in a fixed 4:3 frame, with the car, its facts and its place beside it; under them,
// the full width: the asking price in full digits with the deal badge and the gap to market value, the condition read
// from the listing, and where it came from. In a column of 42 rem or more the same pieces spread into three columns:
// the photo, the car with its condition and source, and the price at the inline end with the market value it is
// measured against. The container, not the screen, decides, so the card is right in a narrow column and in a wide one.
//
// ListingCard and ListingCardSkeleton both render ListingCardFrame, so their geometry cannot drift (ui-design craft.md,
// L-20); the one slot that holds one or two lines, the title, keeps two. The whole card is one link, the title's,
// stretched over it; where it leads is listingLink's one decision.

const COPY = SEARCH_COPY.card;
const PHOTO_SIZES = '(min-width: 64rem) 14rem, 7rem';

type FrameSlots = {
  photo: ReactNode;
  identity: ReactNode;
  price: ReactNode;
  condition?: ReactNode;
  footer: ReactNode;
};

/** The card's geometry in one place; the real card and its skeleton both render it. */
export function ListingCardFrame({ photo, identity, price, condition, footer }: FrameSlots) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 p-2 @2xl:grid-cols-[14rem_minmax(0,1fr)_auto] @2xl:grid-rows-[auto_auto_1fr] @2xl:gap-x-4">
      {/* self-start: a stretched grid item ignores its aspect ratio (measured in craft.md, V-35) */}
      <div className="relative col-start-1 row-start-1 aspect-4/3 w-24 self-start overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo @xs:w-28 @2xl:row-span-3 @2xl:w-full">
        {photo}
      </div>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-1 p-1 @2xl:p-3">{identity}</div>
      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-3 @2xl:col-span-1 @2xl:col-start-3 @2xl:row-span-2 @2xl:row-start-1 @2xl:flex-col @2xl:items-end @2xl:p-3 @2xl:text-end">
        {price}
      </div>
      {condition === undefined ? null : (
        <div className="col-span-2 row-start-3 px-1 pt-3 @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-2 @2xl:px-3 @2xl:pt-0">
          {condition}
        </div>
      )}
      <div className="col-span-2 row-start-4 px-1 pt-3 pb-1 @2xl:col-span-2 @2xl:col-start-2 @2xl:row-start-3 @2xl:self-end @2xl:px-3 @2xl:pt-3 @2xl:pb-3">
        {footer}
      </div>
    </div>
  );
}

function CardLink({ link, children }: { link: ListingLink; children: ReactNode }) {
  // The stretched link covers the card: the ring is drawn round the whole card (has-focus-visible, below), and the
  // link itself underlines when the keyboard reaches it.
  const className = 'after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none';
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  ) : (
    <Link href={link.href as Route} className={className}>
      {children}
    </Link>
  );
}

const CONDITION_TONES = {
  good: 'bg-surface-muted text-muted',
  warning: 'bg-warning-subtle text-warning',
  neutral: 'bg-surface-muted text-muted',
} as const satisfies Record<ConditionView['tone'], string>;

function ConditionChips({ items }: { items: readonly ConditionView[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.text}
          className={`inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-label ${CONDITION_TONES[item.tone]}`}
        >
          {item.tone === 'neutral' ? null : (
            <Icon icon={item.tone === 'good' ? Check : TriangleAlert} size={16} />
          )}
          {item.text}
        </li>
      ))}
    </ul>
  );
}

type ListingCardProps = {
  card: ListingCardData;
  /** The moment the page was made, for days on market: the server's clock, passed down so every card agrees. */
  now: string;
  /** Among the first cards the page shows: its photo loads at once. */
  eager?: boolean;
};

export function ListingCard({ card, now, eager = false }: ListingCardProps) {
  const view = cardView(card, now);
  const link = listingLink(card);
  const marketValue = view.deal?.marketValue ?? null;
  return (
    <article className="@container relative rounded-card border border-divider bg-surface transition-colors hover:bg-surface-muted active:bg-surface-hover has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
      <ListingCardFrame
        photo={
          <>
            <ListingPhoto src={view.photo?.src ?? null} eager={eager} sizes={PHOTO_SIZES} />
            {view.photo !== null && view.photo.count > 1 ? (
              <span className="pointer-events-none absolute inset-s-1 bottom-1 inline-flex items-center gap-1 rounded-badge border border-canvas bg-canvas px-1 text-meta font-medium text-default">
                <Icon icon={Images} size={16} />
                {COPY.photos(view.photo.count)}
              </span>
            ) : null}
          </>
        }
        identity={
          <>
            <h3 className="text-control font-semibold text-balance min-block-2lh @2xl:min-h-0">
              {link === null ? (
                <bdi>{view.title}</bdi>
              ) : (
                <CardLink link={link}>
                  <bdi>{view.title}</bdi>
                  <span className="sr-only">
                    {`، ${COPY.viewOn(view.source)}${link.external ? `، ${COPY.opensInNewTab}` : ''}`}
                  </span>
                </CardLink>
              )}
            </h3>
            {view.hasDetails ? (
              <>
                {view.facts.length === 0 ? null : (
                  <p className="text-secondary text-muted">{view.facts.join(' · ')}</p>
                )}
                {view.place === null ? null : <p className="text-meta text-muted">{view.place}</p>}
              </>
            ) : (
              <p className="text-secondary text-pretty text-muted">{COPY.thinHint(view.source)}</p>
            )}
          </>
        }
        price={
          <>
            <p className={`text-heading font-semibold ${view.price.kind === 'amount' ? '' : 'text-muted'}`}>
              {view.price.kind === 'amount' ? <NumericText>{view.price.text}</NumericText> : view.price.text}
            </p>
            {view.deal === null ? null : (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 @2xl:justify-end">
                <DealBadge rating={view.deal.rating} label={view.deal.label} />
                {view.deal.gap === null ? null : (
                  <span className="text-label text-muted">{view.deal.gap}</span>
                )}
              </p>
            )}
            {marketValue === null ? null : (
              <p className="hidden text-meta text-muted @2xl:block">
                <NumericText>{marketValue}</NumericText>
              </p>
            )}
          </>
        }
        condition={view.condition.length === 0 ? undefined : <ConditionChips items={view.condition} />}
        footer={
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted">
            <span>{view.source}</span>
            {view.seller === null ? null : <span>{`· ${view.seller}`}</span>}
            <span>{`· ${view.days}`}</span>
            {link?.external === true ? (
              <span aria-hidden="true" className="ms-auto inline-flex">
                <Icon icon={ExternalLink} size={16} />
              </span>
            ) : null}
          </p>
        }
      />
    </article>
  );
}

/** The same frame in grey: as many lines as the real card holds, a block where the photo goes. */
export function ListingCardSkeleton() {
  return (
    <div className="@container relative rounded-card border border-divider bg-surface">
      <ListingCardFrame
        photo={<SkeletonBlock />}
        identity={
          <>
            <div className="text-control min-block-2lh @2xl:min-h-0">
              <SkeletonText lines={2} lastLineWidth="w-2/3" />
            </div>
            <div className="text-secondary">
              <SkeletonText lastLineWidth="w-1/2" />
            </div>
            <div className="text-meta">
              <SkeletonText lastLineWidth="w-1/3" />
            </div>
          </>
        }
        price={
          <>
            <div className="w-1/2 text-heading">
              <SkeletonText lastLineWidth="w-full" />
            </div>
            <div className="w-1/3 text-label">
              <SkeletonText lastLineWidth="w-full" />
            </div>
          </>
        }
        condition={
          <div className="text-label">
            <SkeletonText lastLineWidth="w-full" />
          </div>
        }
        footer={
          <div className="text-meta">
            <SkeletonText lastLineWidth="w-1/2" />
          </div>
        }
      />
    </div>
  );
}
