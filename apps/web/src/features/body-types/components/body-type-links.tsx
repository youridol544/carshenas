import type { Route } from 'next';
import Link from 'next/link';
import { BODY_TYPES, type BodyTypeCode } from '@/features/body-types/body-types';
import { BodyTypePhoto } from '@/features/body-types/components/body-type-photo';
import { searchHref } from '@carshenas/search/search';

export type BodyTypeLink = {
  readonly code: BodyTypeCode;
  /** How many listings stand behind it, as it reads («۳٬۲۳۲ آگهی»): the page formats it. */
  readonly count: string;
};

type BodyTypeLinksProps = {
  /** The body types to offer with how their count reads: only those with listings behind them (owner, 2026-09-30). */
  available: readonly BodyTypeLink[];
  /** The photograph's rendered width, for the browser's choice of file. */
  photoSizes?: string;
};

// The body-type selector as links (CS-57's tiles, used by the home page in CS-63): each tile is one link to the search
// page filtered by that body type, so a tap opens the results at once, it can be opened in a new tab, and arrow keys
// are not asked to navigate (BodyTypeSelector, the radio group, is for forms that submit). Same tile as the selector:
// the photograph in its 4:3 frame, the Farsi label, and how many listings stand behind it. Shown in the catalogue's
// order; with none, nothing is shown. Tiles keep a fixed width, so three types are three tiles, not three wide ones.
export function BodyTypeLinks({ available, photoSizes = '9rem' }: BodyTypeLinksProps) {
  const offered = BODY_TYPES.flatMap((bodyType) => {
    const link = available.find((item) => item.code === bodyType.code);
    return link === undefined ? [] : [{ bodyType, count: link.count }];
  });
  if (offered.length === 0) return null;
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,9rem))] gap-3">
      {offered.map(({ bodyType, count }) => (
        <li key={bodyType.code} className="flex">
          <Link
            href={searchHref({ filters: { body_type: [bodyType.code] } }) as Route}
            className="flex w-full touch-manipulation flex-col gap-2 rounded-card border border-divider bg-surface p-2 text-default transition select-none hover:bg-surface-hover motion-safe:active:scale-97"
          >
            <BodyTypePhoto bodyType={bodyType} sizes={photoSizes} decorative />
            <span className="flex flex-col items-center text-center">
              <span className="text-label font-medium">{bodyType.labelFa}</span>
              <span className="text-meta text-muted">{count}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
