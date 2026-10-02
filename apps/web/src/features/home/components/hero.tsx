import type { ReactNode } from 'react';
import { HeroPhotos } from '@/features/home/components/hero-photos';
import { HERO_SLIDES } from '@/features/home/hero-photos';
import { HOME_COPY } from '@/features/home/home-copy';

// The home page's hero (CS-63; teardown section 6): a photograph of Tehran with the motto, one line saying what the
// site does, and the search box. A grid of two rows with the photograph stretched behind them:
// - On a phone the photograph is the first row only, the band behind the motto (its height is the text's own, so the
//   white text never leaves the photograph, whatever size the reader's text is), and the search card, in the second row,
//   is pulled up over the band's lower edge: the card floats, so it has the overlay shadow.
// - From 64rem the photograph spans both rows, the text and the card sit at the inline start over the scrim, and the
//   credit of the photograph showing is at the bottom.
// The photographs are a client leaf (the slider); the text and the search box (a slot: the page passes it in) are not
// part of it. The text arrives with a short staggered entrance; the photograph never animates in, so the largest
// contentful paint is the photograph itself.

export function HomeHero({ search }: { search: ReactNode }) {
  return (
    <section aria-labelledby="home-title" className="relative isolate grid grid-cols-1">
      <div className="relative z-10 col-start-1 row-start-1 mx-auto flex w-full max-w-7xl flex-col justify-end px-4 pt-12 pb-16 lg:pt-16 lg:pb-8">
        <div className="flex min-h-40 max-w-reading flex-col justify-end gap-2 lg:max-w-xl lg:gap-4">
          <h1 id="home-title" className="hero-enter text-display font-bold text-balance text-on-photo">
            {HOME_COPY.hero.motto}
          </h1>
          <p className="hero-enter-2 text-secondary text-pretty text-on-photo lg:text-body">
            {HOME_COPY.hero.intro}
          </p>
        </div>
      </div>
      <div className="relative z-10 col-start-1 row-start-2 mx-auto -mt-12 w-full max-w-7xl hero-enter-3 px-4 lg:mt-0 lg:pb-16">
        <div className="rounded-card bg-surface p-4 shadow-overlay lg:max-w-2xl lg:p-6">{search}</div>
      </div>
      <HeroPhotos slides={HERO_SLIDES} />
    </section>
  );
}
