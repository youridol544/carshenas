'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { RAIL_COPY } from '@/components/ui/scroll-rail-copy';
import { railReach, railStep, type RailDirection, type RailReach } from '@/components/ui/scroll-rail-math';

// A row that scrolls sideways (owner, 2026-10-04: no scrollbar on any row; look at how Jabama does it: the < and > buttons
// do the job, with a scroll effect). One pattern for every catalogue row, chip strip and year row:
//
// - No scrollbar (`scrollbar-none`); a finger swipes it natively, and a keyboard moves focus along it, which scrolls the
//   focused item into view. A fade on the side that has more (`scroll-fade-inline`) says there is more to see.
// - A mouse, which cannot swipe and has no scrollbar to drag, gets «قبلی» and «بعدی» buttons that move the row by most of
//   a screenful with a smooth scroll (instantly under reduced motion). They show only for a fine pointer, and only
//   where the row has more to show: a row whose items fit has no button and cannot scroll. They are ordinary buttons, in
//   the Tab order; a button that cannot move says so with aria-disabled instead of vanishing under the focus.
// - In a right-to-left page `scrollLeft` is 0 at the start of the row (the right edge) and negative towards the end, and
//   the arrows point the way the content moves, so «بعدی» is the left-hand arrow (scroll-rail-math.ts).
//
// Two shapes. `ScrollRail` is the whole row with its buttons laid over its two ends, for strips of chips. A row with a
// heading, such as the home page's catalogues, places the buttons in its heading row: it takes `useScrollRail` and
// `RailButtons` and puts the control's `attach` as the `ref` of its own list.

export type ScrollRailControl = {
  /** The `ref` of the element that scrolls. */
  readonly attach: (element: HTMLElement | null) => void;
  /** The element that scrolls, once it is on the page. */
  readonly element: HTMLElement | null;
  /** Which ways the row can still move. */
  readonly reach: RailReach;
  /** Moves the row by most of a screenful. */
  readonly move: (direction: RailDirection) => void;
};

const NOTHING: RailReach = { previous: false, next: false };

export function useScrollRail(): ScrollRailControl {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [reach, setReach] = useState<RailReach>(NOTHING);

  useEffect(() => {
    if (element === null) return;
    const measure = () => {
      const now = railReach(element);
      setReach((before) => (before.previous === now.previous && before.next === now.next ? before : now));
    };
    // The row changes size, items come and go (a chip removed, a row filled in) and a font arrives late: watch the row
    // and each of its items, and look again at each scroll.
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(element);
      for (const item of element.children) sizes.observe(item);
    };
    watch();
    const items = new MutationObserver(watch);
    items.observe(element, { childList: true });
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      sizes.disconnect();
      items.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [element]);

  function move(direction: RailDirection) {
    if (element === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rightToLeft = getComputedStyle(element).direction === 'rtl';
    element.scrollBy({
      left: railStep(direction, element.clientWidth, rightToLeft),
      behavior: reduced ? 'instant' : 'smooth',
    });
  }

  return { attach: setElement, element, reach, move };
}

// The arrows point the way the content moves, which mirrors: toward the start is to the right.
const ARROW = { previous: ChevronRight, next: ChevronLeft } as const;

function RailButton({
  direction,
  available,
  onPress,
  className,
}: {
  direction: RailDirection;
  available: boolean;
  onPress: (direction: RailDirection) => void;
  /** Where it sits and how it shows: display and position. */
  className: string;
}) {
  return (
    <button
      type="button"
      data-rail-button={direction}
      aria-label={RAIL_COPY[direction]}
      aria-disabled={!available}
      onClick={() => {
        if (available) onPress(direction);
      }}
      className={`size-11 items-center justify-center rounded-full border border-control bg-surface text-default transition-colors hover:bg-surface-hover aria-disabled:border-divider aria-disabled:text-subtle ${className}`}
    >
      <Icon icon={ARROW[direction]} />
    </button>
  );
}

/**
 * The two buttons for a row that places them itself, in its heading row: a group named for the row. They take their
 * room for a fine pointer from the first frame and show only while the row has more to show, so nothing beside them
 * moves when they appear; the one that cannot move is dimmed and says so with aria-disabled.
 */
export function RailButtons({ label, rail }: { label: string; rail: ScrollRailControl }) {
  const fits = !rail.reach.previous && !rail.reach.next;
  return (
    <div
      role="group"
      aria-label={label}
      className={`hidden items-center gap-2 pointer-fine:flex ${fits ? 'invisible' : ''}`}
    >
      <RailButton
        direction="previous"
        available={rail.reach.previous}
        onPress={rail.move}
        className="inline-flex"
      />
      <RailButton direction="next" available={rail.reach.next} onPress={rail.move} className="inline-flex" />
    </div>
  );
}

type ScrollRailProps = {
  /** The wrapper: where the row sits in the page and how far it bleeds past the page's padding (`-mx-4 lg:mx-0`). */
  className?: string;
  /** The element that scrolls: how its items are laid out (`flex gap-2 px-4 pb-1`). */
  scrollerClassName?: string;
  /** A list when the items are `<li>`s, otherwise a plain box. */
  as?: 'ul' | 'div';
  /** The scroller's own name, for a list that no landmark around it names. */
  listLabel?: string;
  /** Brings the item that matches `selector` to the middle of the row, on arrival and whenever `key` changes. */
  current?: { readonly selector: string; readonly key: string | number | null };
  /** False for a row whose own controls move it (a gallery's thumbnails follow its photo). */
  buttons?: boolean;
  children: ReactNode;
};

// Over the two ends of the row, centred on it from top to bottom, above its fade; for a mouse only.
const OVERLAY = 'absolute inset-y-0 z-10 my-auto hidden shadow-raised pointer-fine:inline-flex';

export function ScrollRail({
  className = '',
  scrollerClassName = '',
  as = 'div',
  listLabel,
  current,
  buttons = true,
  children,
}: ScrollRailProps) {
  const { attach, element, reach, move } = useScrollRail();
  const wrapper = useRef<HTMLDivElement>(null);
  const currentSelector = current?.selector;
  const currentKey = current?.key;

  // The chosen item is brought to the middle of the row: on a phone it may be past the edge. The row is scrolled, never
  // scrollIntoView, which would move the page too and, in Chrome, move the keyboard's starting point so that the next
  // Tab skips everything before the item.
  useEffect(() => {
    const chosen = currentSelector === undefined ? null : element?.querySelector(currentSelector);
    if (element === null || chosen === null || chosen === undefined) return;
    const [around, inside] = [element.getBoundingClientRect(), chosen.getBoundingClientRect()];
    element.scrollBy({
      left: inside.left + inside.width / 2 - (around.left + around.width / 2),
      behavior: 'instant',
    });
  }, [element, currentSelector, currentKey]);

  // A button that goes away under the keyboard's focus (the row reached its end) hands the focus to the other one.
  useLayoutEffect(() => {
    const root = wrapper.current;
    const active = document.activeElement;
    if (root === null || !(active instanceof HTMLElement) || !root.contains(active)) return;
    const side = active.dataset.railButton;
    if (side !== 'previous' && side !== 'next') return;
    const other = side === 'previous' ? 'next' : 'previous';
    if (!reach[side] && reach[other]) {
      root.querySelector<HTMLElement>(`[data-rail-button="${other}"]`)?.focus({ preventScroll: true });
    }
  }, [reach]);

  const scrollerProps = {
    ref: attach,
    'aria-label': listLabel,
    className: `scroll-fade-inline overflow-x-auto overscroll-x-contain scrollbar-none ${scrollerClassName}`,
  };
  return (
    <div ref={wrapper} className={`relative ${className}`}>
      {buttons ? (
        <RailButton
          direction="previous"
          available={reach.previous}
          onPress={move}
          className={`${OVERLAY} inset-s-0 ${reach.previous ? '' : 'invisible'}`}
        />
      ) : null}
      {as === 'ul' ? <ul {...scrollerProps}>{children}</ul> : <div {...scrollerProps}>{children}</div>}
      {buttons ? (
        <RailButton
          direction="next"
          available={reach.next}
          onPress={move}
          className={`${OVERLAY} inset-e-0 ${reach.next ? '' : 'invisible'}`}
        />
      ) : null}
    </div>
  );
}
