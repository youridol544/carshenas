'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { use } from 'react';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';
import type { MarkedListing, PriceChange } from '@/features/marked-listings/marked-types';
import { MarkButton } from '@/features/marks/components/mark-button';
import { MarksContext } from '@/features/marks/components/marks-provider';
import { DealBadge } from '@/features/search/components/deal-badge';
import { ListingPhoto } from '@/features/search/components/listing-photo';

// The buyer's marked listings (CS-69): one row each, with the price now beside the price on the day it was marked, a
// badge for what changed (a fall in green with its sign in words, a rise in amber, the colour never alone), the listing's
// rating while it is on the market, or what became of it when it is not. The row's photo and title lead to the listing's
// page. Unmarking happens in place: the row dims and says how to undo it, and goes for good the next time the page is
// read (the control keeps the buyer's choice, marks-provider.tsx), so a slip of the thumb costs nothing.

const CHANGE_TONES = {
  down: 'bg-success-subtle text-success',
  up: 'bg-warning-subtle text-warning',
  same: 'bg-surface-muted text-muted',
} as const satisfies Record<PriceChange['kind'], string>;

function ChangeBadge({ change }: { change: PriceChange }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-label font-medium ${CHANGE_TONES[change.kind]}`}
    >
      {change.kind === 'same' ? null : (
        <Icon icon={change.kind === 'down' ? TrendingDown : TrendingUp} size={16} />
      )}
      {change.label}
    </span>
  );
}

function Row({ listing, marked }: { listing: MarkedListing; marked: boolean }) {
  const offMarket = listing.status !== 'active';
  return (
    <li
      className={`relative rounded-card border border-divider bg-surface transition-opacity ${marked ? '' : 'opacity-60'}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 p-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="relative col-start-1 row-start-1 aspect-4/3 w-full self-start overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo">
          <ListingPhoto src={listing.photo} eager={false} sizes="(min-width: 40rem) 10rem, 7rem" />
        </div>
        <div className="col-start-2 row-start-1 flex min-w-0 flex-col gap-1 p-1 sm:px-2">
          <h3 className="min-h-2lh text-control font-semibold text-balance">
            <Link
              href={listing.href as Route}
              prefetch={false}
              className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
            >
              <bdi>{listing.title}</bdi>
            </Link>
          </h3>
          {listing.facts.length === 0 ? null : (
            <p className="text-secondary text-muted">{listing.facts.join(' · ')}</p>
          )}
          {listing.place === null ? null : <p className="text-meta text-muted">{listing.place}</p>}
          {offMarket && listing.statusLabel !== null ? (
            <p className="flex flex-wrap items-center gap-x-2 text-label font-medium text-default">
              <span className="rounded-badge bg-surface-muted px-2 py-0.5">{listing.statusLabel}</span>
              {listing.offSince === null ? null : (
                <span className="text-meta font-normal text-muted">{listing.offSince}</span>
              )}
            </p>
          ) : null}
        </div>
        <div className="col-span-2 row-start-2 flex flex-col gap-1 px-1 pt-3 sm:col-span-1 sm:col-start-2 sm:px-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-meta text-muted">
              {offMarket ? MARKED_COPY.price.last : MARKED_COPY.price.now}
            </span>
            <span
              className={`text-heading font-semibold ${listing.price.kind === 'amount' ? '' : 'text-muted'}`}
            >
              {listing.price.kind === 'amount' ? (
                <NumericText>{listing.price.text}</NumericText>
              ) : (
                listing.price.text
              )}
            </span>
          </p>
          {listing.markedPrice === null || listing.change?.kind === 'same' ? null : (
            <p className="text-secondary text-muted">
              {`${MARKED_COPY.price.whenMarked}: `}
              {listing.change === null ? (
                <NumericText>{listing.markedPrice}</NumericText>
              ) : (
                <del>
                  <NumericText>{listing.markedPrice}</NumericText>
                </del>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {listing.change === null ? null : <ChangeBadge change={listing.change} />}
            {listing.deal === null ? null : (
              <DealBadge rating={listing.deal.rating} label={listing.deal.label} />
            )}
            {listing.deal?.gap == null ? null : (
              <span className="text-label text-muted">{listing.deal.gap}</span>
            )}
          </div>
          {listing.change === null || listing.change.kind === 'same' ? null : (
            <p className="text-meta text-pretty text-muted">{listing.change.detail}</p>
          )}
        </div>
        <div className="relative z-10 col-span-2 row-start-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pt-3 sm:col-span-1 sm:col-start-2 sm:px-2">
          <p className="text-meta text-muted">
            {marked ? MARKED_COPY.markedOn(listing.markedOn) : MARKED_COPY.unmarkedNotice}
          </p>
          <MarkButton listingId={listing.id} title={listing.title} variant="row" />
        </div>
      </div>
    </li>
  );
}

type MarkedListProps = { items: readonly MarkedListing[]; total: number };

/**
 * The count and the rows, each as the buyer has it now: a mark they took off shows dimmed, and is not counted, until
 * the page is read again.
 */
export function MarkedList({ items, total }: MarkedListProps) {
  const controller = use(MarksContext);
  const isMarked = (id: number) => controller?.changes.get(id) ?? true;
  const taken = items.filter((listing) => !isMarked(listing.id)).length;
  return (
    <>
      <p role="status" className="text-secondary text-muted">
        {MARKED_COPY.count(total - taken)}
      </p>
      <ol className="flex flex-col gap-3">
        {items.map((listing) => (
          <Row key={listing.id} listing={listing} marked={isMarked(listing.id)} />
        ))}
      </ol>
    </>
  );
}
