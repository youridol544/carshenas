'use client';

import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import type { PhotoAddress } from '@/features/listing/listing-types';
import { PhotoPlaceholder } from '@/features/search/components/listing-photo';

// The listing's photos (CS-64, ADR-0025), loaded from the source's own https addresses: never stored by us, never
// through Next.js's optimizer, no referrer. A native scroll-snap carousel (craft.md: scroll snapping, no autoplay, no
// double-tap handlers) with buttons, a counter and, from two photos, a strip of thumbnails. The frame is 4:3 before the
// first photo arrives, so nothing moves; a whole car must show, so photos sit contained on the muted surface; the first
// is loaded at once with high priority and the rest when they scroll near; a photo that does not load (its seller or its
// source removed it) shows the same-size placeholder, never the alt text.
//
// RTL: the strip's scrollLeft is 0 at the first photo and negative towards the last (MDN), so the arithmetic below
// negates it, and «بعدی» is the left button (the inline end).

const COPY = LISTING_COPY.gallery;
const SIZES = '(min-width: 64rem) 44rem, 100vw';

function Slide({
  photo,
  index,
  count,
  eager,
}: {
  photo: PhotoAddress;
  index: number;
  count: number;
  eager: boolean;
}) {
  // Keyed by the address that failed, so a different photo in the same place gets its own chance.
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <li
      role="group"
      aria-roledescription="slide"
      aria-label={COPY.slide(index + 1, count)}
      className="relative aspect-4/3 w-full shrink-0 snap-center"
    >
      {failed === photo.url ? (
        <PhotoPlaceholder />
      ) : (
        <Image
          src={photo.url}
          alt=""
          fill
          sizes={SIZES}
          referrerPolicy="no-referrer"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          className="object-contain"
          // The server's HTML is shown before this script runs, so a photo that already failed has no error event left.
          ref={(image) => {
            if (image?.complete === true && image.naturalWidth === 0) setFailed(photo.url);
          }}
          onError={() => {
            setFailed(photo.url);
          }}
        />
      )}
    </li>
  );
}

function Thumbnail({
  photo,
  index,
  active,
  onPick,
}: {
  photo: PhotoAddress;
  index: number;
  active: boolean;
  onPick: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const address = photo.thumbnailUrl ?? photo.url;
  return (
    <li className="shrink-0">
      <button
        type="button"
        aria-label={COPY.thumbnail(index + 1)}
        aria-current={active ? 'true' : undefined}
        onClick={onPick}
        className={`relative block aspect-4/3 w-16 overflow-hidden rounded-inner border bg-surface-muted ${active ? 'border-action' : 'border-divider'}`}
      >
        {failed ? null : (
          <Image
            src={address}
            alt=""
            fill
            sizes="4rem"
            referrerPolicy="no-referrer"
            loading="lazy"
            className="object-cover"
            onError={() => {
              setFailed(true);
            }}
          />
        )}
      </button>
    </li>
  );
}

export function PhotoGallery({ photos }: { photos: readonly PhotoAddress[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="flex aspect-4/3 w-full items-center justify-center rounded-card bg-surface-muted outline-1 -outline-offset-1 outline-photo">
        <PhotoPlaceholder />
      </div>
    );
  }

  function goTo(target: number) {
    const element = track.current;
    if (element === null) return;
    const clamped = Math.min(Math.max(target, 0), count - 1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The scroll offset runs negative towards the end in a right-to-left strip.
    element.scrollTo({ left: -clamped * element.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
    setIndex(clamped);
  }

  function onScroll() {
    const element = track.current;
    if (element === null || element.clientWidth === 0) return;
    setIndex(
      Math.min(Math.max(Math.round(Math.abs(element.scrollLeft) / element.clientWidth), 0), count - 1),
    );
  }

  return (
    <div role="group" aria-roledescription="carousel" aria-label={COPY.label} className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-card bg-surface-muted outline-1 -outline-offset-1 outline-photo">
        <ul
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain"
        >
          {photos.map((photo, position) => (
            <Slide key={photo.url} photo={photo} index={position} count={count} eager={position === 0} />
          ))}
        </ul>
        {count > 1 ? (
          <>
            <span
              aria-live="polite"
              className="pointer-events-none absolute inset-s-2 bottom-2 inline-flex items-center gap-1 rounded-badge border border-canvas bg-canvas px-2 py-0.5 text-meta font-medium text-default"
            >
              <Icon icon={Images} size={16} />
              {COPY.slide(index + 1, count)}
            </span>
            <button
              type="button"
              aria-label={COPY.previous}
              disabled={index === 0}
              onClick={() => {
                goTo(index - 1);
              }}
              className="absolute inset-s-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-divider bg-canvas text-default shadow-raised transition-opacity disabled:opacity-0"
            >
              <Icon icon={ChevronRight} />
            </button>
            <button
              type="button"
              aria-label={COPY.next}
              disabled={index === count - 1}
              onClick={() => {
                goTo(index + 1);
              }}
              className="absolute inset-e-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-divider bg-canvas text-default shadow-raised transition-opacity disabled:opacity-0"
            >
              <Icon icon={ChevronLeft} />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <ul className="flex gap-2 overflow-x-auto py-1">
          {photos.map((photo, position) => (
            <Thumbnail
              key={photo.url}
              photo={photo}
              index={position}
              active={position === index}
              onPick={() => {
                goTo(position);
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
