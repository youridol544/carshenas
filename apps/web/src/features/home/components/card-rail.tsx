'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { HOME_COPY } from '@/features/home/home-copy';

// A sideways row of cards with its heading (CS-63; teardown pattern 9): a rail that scrolls and snaps natively
// (scroll-snap-type x mandatory; touch needs nothing else), a fade only on the side that has more, the next card
// peeking so the buyer sees there is more, and, for a mouse, «قبلی» and «بعدی» buttons beside the heading. In a
// right-to-left page scrollLeft is 0 at the start (the right edge) and negative towards the end, so «بعدی» scrolls by
// a negative amount; the arrows point the way the content moves, which mirrors. The buttons that cannot move are
// disabled, and shown only from 64rem: a phone swipes. The heading and the see-all link are server-rendered slots.

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

const EDGE = 2;

export function CardRail({ heading, seeAll, label, children }: CardRailProps) {
  const rail = useRef<HTMLUListElement>(null);
  const [reach, setReach] = useState({ previous: false, next: false });

  useEffect(() => {
    const element = rail.current;
    if (element === null) return;
    const measure = () => {
      const travelled = Math.abs(element.scrollLeft);
      const previous = travelled > EDGE;
      const next = travelled + element.clientWidth < element.scrollWidth - EDGE;
      setReach((now) => (now.previous === previous && now.next === next ? now : { previous, next }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, []);

  function move(direction: 1 | -1) {
    const element = rail.current;
    if (element === null) return;
    // «بعدی» goes towards the end: negative in a right-to-left scroller. A little less than a screenful keeps the
    // card that was last in view in view as the first.
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    element.scrollBy({ left: -direction * element.clientWidth * 0.85, behavior: motion });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">{heading}</div>
        <div className="flex max-w-full items-center gap-2">
          {seeAll}
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              aria-label={HOME_COPY.rows.previous}
              disabled={!reach.previous}
              onClick={() => {
                move(-1);
              }}
              className="inline-flex size-11 items-center justify-center rounded-full border border-control bg-surface text-default transition-colors hover:bg-surface-hover disabled:border-divider disabled:text-subtle"
            >
              <Icon icon={ChevronRight} />
            </button>
            <button
              type="button"
              aria-label={HOME_COPY.rows.next}
              disabled={!reach.next}
              onClick={() => {
                move(1);
              }}
              className="inline-flex size-11 items-center justify-center rounded-full border border-control bg-surface text-default transition-colors hover:bg-surface-hover disabled:border-divider disabled:text-subtle"
            >
              <Icon icon={ChevronLeft} />
            </button>
          </div>
        </div>
      </div>
      <ul
        ref={rail}
        aria-label={label}
        className="-mx-4 flex scroll-fade-inline snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2"
      >
        {children}
      </ul>
    </div>
  );
}
