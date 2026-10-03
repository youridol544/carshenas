'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

// The photograph of a model tile (CS-97, ADR-0038): the model's own photo from the address the superadmin gave, loaded
// from its own host by the visitor's browser (never stored, downloaded or proxied by us, ADR-0025's spirit; no
// referrer is sent), in the same 4:3 frame the body type's sample photograph has, so the tile never changes size
// whichever one shows. A photo that does not load, or never arrives, leaves the sample photograph and its
// «نمونه» label in its place, handed in as children by the server component so this one stays small. The label is the
// sample's: a model's own photo carries none.

const LOAD_TIMEOUT_MS = 6_000;

type Props = {
  /** The superadmin's https address for the model; null when none was set. */
  photoUrl: string | null;
  /** The sample photograph (with its label), shown when there is no photo or it fails. */
  children: React.ReactNode;
  sizes: string;
};

export function ModelTilePhoto({ photoUrl, children, sizes }: Props) {
  // Keyed by the address that failed, so a changed link in the same place gets its own chance.
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  // A host that never answers leaves a grey frame for ever: after a few seconds the sample comes back, as it does for a
  // photo that fails at once.
  useEffect(() => {
    if (photoUrl === null || loaded === photoUrl) return undefined;
    const timer = setTimeout(() => {
      setFailed(photoUrl);
    }, LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [photoUrl, loaded]);
  if (photoUrl === null || failed === photoUrl) return <>{children}</>;
  return (
    <span
      data-model-photo="remote"
      className="relative block aspect-4/3 w-full overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo"
    >
      <Image
        src={photoUrl}
        alt=""
        fill
        sizes={sizes}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="object-cover"
        // The server's HTML is shown before this script runs, so a photo that already failed has no error event left to
        // hear: a finished load with no pixels is the same failure.
        ref={(image) => {
          if (image?.complete !== true) return;
          if (image.naturalWidth === 0) setFailed(photoUrl);
          else setLoaded(photoUrl);
        }}
        onLoad={() => {
          setLoaded(photoUrl);
        }}
        onError={() => {
          setFailed(photoUrl);
        }}
      />
    </span>
  );
}
