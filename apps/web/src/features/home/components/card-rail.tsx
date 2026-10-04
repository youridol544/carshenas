'use client';

import type { ReactNode } from 'react';
import { RailButtons, useScrollRail } from '@/components/ui/scroll-rail';

// A sideways row of cards with its heading (CS-63; teardown pattern 9): a rail that scrolls and snaps natively
// (scroll-snap-type x mandatory; touch needs nothing else), with no scrollbar (CS-112), a fade only on the side that has
// more, the next card peeking so the buyer sees there is more, and, for a mouse, «قبلی» and «بعدی» buttons beside the
// heading, the way Jabama places them. The row and its buttons are the shared pattern of components/ui/scroll-rail.tsx;
// this component only places the buttons in the heading row. The heading and the see-all link are server-rendered slots.

type CardRailProps = {
  /** The heading block: the title with its info control, and the line under it. */
  heading: ReactNode;
  /** The link to everything in the row, at the inline end of the heading. */
  seeAll: ReactNode;
  /** The row's name for assistive technology. */
  label: string;
  /** The cards, as `<li>`s that are `snap-start` and fixed in width. */
  children: ReactNode;
};

export function CardRail({ heading, seeAll, label, children }: CardRailProps) {
  const { attach, element, reach, move } = useScrollRail();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">{heading}</div>
        <div className="flex max-w-full items-center gap-2">
          {seeAll}
          <RailButtons label={label} rail={{ attach, element, reach, move }} />
        </div>
      </div>
      <ul
        ref={attach}
        aria-label={label}
        className="-mx-4 scrollbar-none flex scroll-fade-inline snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2"
      >
        {children}
      </ul>
    </div>
  );
}
