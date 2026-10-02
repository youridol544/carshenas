import { LayoutGrid } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
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
  /** The last tile, which opens the search page with every body type (teardown pattern 6): its words. */
  all?: { readonly label: string; readonly hint: string };
};

// The body-type selector as links (CS-57's tiles, used by the home page in CS-63): each tile is one link to the search
// page filtered by that body type, so a tap opens the results at once, it can be opened in a new tab, and arrow keys
// are not asked to navigate (BodyTypeSelector, the radio group, is for forms that submit). Same tile as the selector:
// the photograph in its 4:3 frame, the Farsi label, and how many listings stand behind it. Shown in the catalogue's
// order; with none, nothing is shown. On a phone the tiles fill four columns (the last is «همه»), so three types never leave an orphan; from 40rem they keep a fixed width.
export function BodyTypeLinks({ available, photoSizes = '9rem', all }: BodyTypeLinksProps) {
  const offered = BODY_TYPES.flatMap((bodyType) => {
    const link = available.find((item) => item.code === bodyType.code);
    return link === undefined ? [] : [{ bodyType, count: link.count }];
  });
  if (offered.length === 0) return null;
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,9rem))] sm:gap-3">
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
      {all === undefined ? null : (
        <li className="flex">
          <Link
            href={searchHref({ filters: {} }) as Route}
            className="flex w-full touch-manipulation flex-col gap-2 rounded-card border border-divider bg-surface p-2 text-default transition select-none hover:bg-surface-hover motion-safe:active:scale-97"
          >
            <span className="flex aspect-4/3 w-full items-center justify-center rounded-inner bg-surface-muted text-muted">
              <Icon icon={LayoutGrid} size={24} />
            </span>
            <span className="flex flex-col items-center text-center">
              <span className="text-label font-medium">{all.label}</span>
              <span className="text-meta text-muted">{all.hint}</span>
            </span>
          </Link>
        </li>
      )}
    </ul>
  );
}
