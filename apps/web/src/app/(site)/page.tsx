import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClosingCta } from '@/features/home/components/closing-cta';
import { BrowseBoundary } from '@/features/home/components/browse-boundary';
import { HeroSearch } from '@/features/home/components/hero-search';
import { HomeBrowse, HomeBrowseSkeleton } from '@/features/home/components/home-browse';
import { HomeHero } from '@/features/home/components/hero';
import { HowItWorks } from '@/features/home/components/how-it-works';
import { TrustBoundary } from '@/features/home/components/trust-boundary';
import { TrustFigures, TrustFiguresSkeleton } from '@/features/home/components/trust-figures';
import { HOME_COPY } from '@/features/home/home-copy';

export const metadata: Metadata = {
  title: { absolute: HOME_COPY.title },
  description: HOME_COPY.description,
};

// The home page (CS-63; teardown section 6): the hero with the search box, the body types, the premade catalogues as
// rows of cards, how it works with the measured numbers, a closing call to action. The hero and the three steps are
// the prerendered shell and paint at once (the photograph is the largest contentful paint); what comes from the
// database streams in from a one-minute cache inside its own boundary, each with its failure in its place.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <HomeHero search={<HeroSearch />} />
      <BrowseBoundary>
        <Suspense fallback={<HomeBrowseSkeleton />}>
          <HomeBrowse />
        </Suspense>
      </BrowseBoundary>
      <HowItWorks
        figures={
          <TrustBoundary>
            <Suspense fallback={<TrustFiguresSkeleton />}>
              <TrustFigures />
            </Suspense>
          </TrustBoundary>
        }
      />
      <ClosingCta />
    </main>
  );
}
