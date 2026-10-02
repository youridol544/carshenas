'use client';

import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';

// A group of related controls that is one Tab stop, with the arrow keys moving inside it (WAI-ARIA's toolbar pattern;
// ui-design craft.md, section 5: each group of related controls is one Tab stop). Without it a strip of ten chips with
// an info button each would be twenty stops to Tab past. In a right-to-left page the left arrow means "next". The
// items mark themselves with `data-roving-item`; the group keeps exactly one of them at tabindex 0 (the last one that
// had focus), and until a script runs every item keeps its natural place in the Tab order, so nothing is unreachable.

const ITEM = '[data-roving-item]';

function reachableItems(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>(ITEM)].filter(
    (item) => item.getClientRects().length > 0 && !item.hasAttribute('disabled'),
  );
}

type RovingGroupProps = {
  /** What the group is: its accessible name. */
  label: string;
  children: ReactNode;
  className?: string;
};

export function RovingGroup({ label, children, className }: RovingGroupProps) {
  const group = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement | null>(null);

  // After every render: the items may have changed (a catalogue's count, a chip that came or went).
  useLayoutEffect(() => {
    const element = group.current;
    if (element === null) return;
    const items = reachableItems(element);
    const keep = current.current !== null && items.includes(current.current) ? current.current : items[0];
    for (const item of items) item.tabIndex = item === keep ? 0 : -1;
    current.current = keep ?? null;
  });

  function rememberFocused(event: FocusEvent<HTMLDivElement>) {
    const element = group.current;
    if (element === null || !(event.target instanceof HTMLElement)) return;
    const items = reachableItems(element);
    if (!items.includes(event.target)) return;
    current.current = event.target;
    for (const item of items) item.tabIndex = item === event.target ? 0 : -1;
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const element = group.current;
    if (element === null || !(event.target instanceof HTMLElement)) return;
    const items = reachableItems(element);
    const index = items.indexOf(event.target);
    if (index === -1) return;
    const rightToLeft = getComputedStyle(element).direction === 'rtl';
    const [next, previous] = rightToLeft ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
    let target: HTMLElement | undefined;
    if (event.key === next) target = items[Math.min(index + 1, items.length - 1)];
    else if (event.key === previous) target = items[Math.max(index - 1, 0)];
    else if (event.key === 'Home') target = items[0];
    else if (event.key === 'End') target = items.at(-1);
    else return;
    event.preventDefault();
    target?.focus();
  }

  return (
    <div
      ref={group}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      onFocus={rememberFocused}
      onKeyDown={moveFocus}
      className={className}
    >
      {children}
    </div>
  );
}
