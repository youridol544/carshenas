'use client';

import { Tabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { HOME_COPY } from '@/features/home/home-copy';

// The hero card's two ways in (CS-63, CS-65), one card, one box at a time: «جست‌وجو» (the plain-Farsi search) and
// «ارزیابی لینک» (the box that takes a listing's link). A switch at the top of the card keeps both above the fold on a
// phone, where two stacked boxes pushed the second below it. Both panels stay mounted, so a half-typed sentence is still
// there when the buyer comes back from the other tab; Left and Right move between the tabs, as for any tab list. The
// panels are slots, so the home feature imports neither the search nor the link feature.
//
// The card never changes height when the tab does: both panels sit in one grid cell, the hidden one kept in the layout
// but invisible (and so out of the tab order and the accessibility tree), so the cell is as tall as the taller panel.
// The card's height sets the hero's, and the hero photograph and the whole page below it would otherwise jump by the
// difference (145 px on a phone) at every switch. Base UI hides a panel with the `hidden` attribute, which Tailwind's
// reset turns into display: none !important; `.hero-panel` in globals.css wins from a layer ahead of Tailwind's.

const PANEL = 'hero-panel col-start-1 row-start-1 data-hidden:invisible';

const TAB =
  'min-h-11 rounded-inner px-3 text-control font-medium text-muted transition-colors hover:text-default data-active:bg-surface data-active:font-semibold data-active:text-default data-active:shadow-raised';

export function HeroModes({ search, paste }: { search: ReactNode; paste: ReactNode }) {
  const COPY = HOME_COPY.hero.modes;
  return (
    <Tabs.Root defaultValue="search" className="flex flex-col gap-4">
      <Tabs.List
        aria-label={COPY.label}
        className="grid grid-cols-2 gap-1 rounded-control bg-surface-pressed p-1"
      >
        <Tabs.Tab value="search" className={TAB}>
          {COPY.search}
        </Tabs.Tab>
        <Tabs.Tab value="paste" className={TAB}>
          {COPY.paste}
        </Tabs.Tab>
      </Tabs.List>
      <div className="grid">
        <Tabs.Panel value="search" keepMounted className={PANEL}>
          {search}
        </Tabs.Panel>
        <Tabs.Panel value="paste" keepMounted className={PANEL}>
          {paste}
        </Tabs.Panel>
      </div>
    </Tabs.Root>
  );
}
