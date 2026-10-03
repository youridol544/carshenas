'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// The row of model-year chips (CS-67) scrolls sideways on a phone, and choosing a year reloads the page with the row
// back at its start: the chosen chip, the twelfth of a very wide row, would sit off screen. After each render the chip
// marked aria-current is brought to the middle of the row (the row only: the page does not move).
export function CurrentIntoView({
  year,
  className,
  children,
}: {
  year: number | null;
  className: string;
  children: ReactNode;
}) {
  const row = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = row.current;
    const chip = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list === null || chip === null || chip === undefined) return;
    const listBox = list.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    list.scrollLeft += chipBox.left + chipBox.width / 2 - (listBox.left + listBox.width / 2);
  }, [year]);
  return (
    <ul ref={row} className={className}>
      {children}
    </ul>
  );
}
