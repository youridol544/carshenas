'use client';

import { CarFront } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { SEARCH_COPY } from '@/features/search/search-copy';

// A listing's photo, loaded from the source's own https address (ADR-0025): never stored by us, never through Next.js's
// optimizer (images.unoptimized), no referrer, lazy unless it is one of the first the page shows. The frame around it
// (ListingCardFrame) has the 4:3 box before the photo arrives, so nothing moves. A listing with no photo, or a photo
// that does not load (its seller or its source removed it), shows the same-size placeholder: a quiet car and the words
// «بدون عکس», never the broken-image icon or the alt text.

export function PhotoPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="flex size-full flex-col items-center justify-center gap-1 text-subtle"
    >
      <Icon icon={CarFront} size={24} />
      <span className="text-meta">{SEARCH_COPY.card.noPhoto}</span>
    </span>
  );
}

type ListingPhotoProps = {
  src: string | null;
  /** Among the first cards the page shows: loaded at once instead of when it scrolls near. */
  eager: boolean;
  /** The frame's width at each breakpoint, for the browser's choice of a request. */
  sizes: string;
};

export function ListingPhoto({ src, eager, sizes }: ListingPhotoProps) {
  // Keyed by the address that failed, so a different photo in the same place gets its own chance.
  const [failed, setFailed] = useState<string | null>(null);
  if (src === null || failed === src) return <PhotoPlaceholder />;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      referrerPolicy="no-referrer"
      loading={eager ? 'eager' : 'lazy'}
      className="object-cover"
      onError={() => {
        setFailed(src);
      }}
    />
  );
}
