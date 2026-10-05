import type { Route } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { ByYearSection } from '@/features/model/components/by-year-section';
import { DealsSection, DealsSectionSkeleton } from '@/features/model/components/deals-section';
import { FactsSection } from '@/features/model/components/facts-section';
import { ModelHero } from '@/features/model/components/model-hero';
import { RatingsSection } from '@/features/model/components/ratings-section';
import { SectionBoundary } from '@/features/model/components/section-boundary';
import { TrendSection, TrendSectionSkeleton } from '@/features/model/components/trend-section';
import { TrimsSection, TrimsSectionSkeleton } from '@/features/model/components/trims-section';
import { YearChips } from '@/features/model/components/year-chips';
import { MODEL_COPY } from '@/features/model/model-copy';
import type { ModelOverview, ModelRef } from '@/features/model/model-types';
import { modalYear } from '@/features/model/model-view';
import { readModelTrims } from '@/features/model/server/model-queries';
import { searchHref } from '@carshenas/search/search';
import { modelHref } from '@/lib/model-address';
import { connection } from 'next/server';

// The model page (CS-67; Torob's product page applied to cars): the model's name and what it costs today, the model year
// chips, the price trend, the best current deals with the search's own cards, the ratings, the price by year, the trims,
// and what the listings say about themselves. The hero is in the first response (the page reads the model and its
// figures before anything streams, so an unknown model is a real 404); the trend, the deals and the trims stream in
// behind it, each in its own frame with its failure in its place. With `?year=` every figure is that model year's;
// without it the page is the whole model, and the trend is drawn for the model year with the most listings, which the
// page says. A model with no listing now, or a year with none, is a designed empty state, not a blank page.

type ModelScreenProps = {
  model: ModelRef;
  overview: ModelOverview;
  /** The model year chosen in the address, or null. */
  year: number | null;
};

async function TrimsLoader({ modelKey, year }: { modelKey: string; year: number | null }) {
  await connection();
  return <TrimsSection trims={await readModelTrims(modelKey, year)} year={year} />;
}

function Empty({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body?: string;
  href: string;
  action: string;
}) {
  return (
    <section
      aria-labelledby="model-empty"
      className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
    >
      <h2 id="model-empty" className="text-heading font-bold">
        {title}
      </h2>
      {body === undefined ? null : <p className="max-w-reading text-body text-pretty text-muted">{body}</p>}
      <Link href={href as Route} className={actionClasses('secondary')}>
        {action}
      </Link>
    </section>
  );
}

export function ModelScreen({ model, overview, year }: ModelScreenProps) {
  const { stats, years, valuedOn } = overview;
  const yearKnown = year === null || years.some((row) => row.year === year);
  const trendYear = year !== null && yearKnown ? year : modalYear(years);
  const chosenYear = year !== null && yearKnown ? year : null;
  const listed = stats.count > 0;
  const total = years.reduce((sum, row) => sum + row.count, 0);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 pt-4 pb-16">
      <ModelHero
        model={model}
        stats={stats}
        valuedOn={valuedOn}
        year={chosenYear}
        modalYear={year === null ? modalYear(years) : null}
      />
      {years.length === 0 ? null : <YearChips model={model} years={years} year={chosenYear} total={total} />}
      {!listed ? (
        year !== null && years.length > 0 ? (
          <Empty
            title={MODEL_COPY.year.emptyTitle(year)}
            href={modelHref(model)}
            action={MODEL_COPY.year.emptyAction}
          />
        ) : (
          <Empty
            title={MODEL_COPY.empty.title}
            body={MODEL_COPY.empty.body}
            href={searchHref({ filters: {} })}
            action={MODEL_COPY.empty.action}
          />
        )
      ) : (
        <>
          {trendYear === null ? null : (
            <SectionBoundary title={MODEL_COPY.trend.error.title}>
              <Suspense fallback={<TrendSectionSkeleton />}>
                <TrendSection modelId={model.id} year={trendYear} chosen={chosenYear !== null} />
              </Suspense>
            </SectionBoundary>
          )}
          <SectionBoundary title={MODEL_COPY.deals.error.title}>
            <Suspense fallback={<DealsSectionSkeleton />}>
              <DealsSection modelKey={model.key} year={chosenYear} />
            </Suspense>
          </SectionBoundary>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-x-8">
            <div className="flex min-w-0 flex-col gap-12">
              <ByYearSection model={model} years={years} year={chosenYear} />
            </div>
            <div className="flex min-w-0 flex-col gap-12">
              <RatingsSection stats={stats} />
              <SectionBoundary title={MODEL_COPY.trims.error.title}>
                <Suspense fallback={<TrimsSectionSkeleton />}>
                  <TrimsLoader modelKey={model.key} year={chosenYear} />
                </Suspense>
              </SectionBoundary>
              <FactsSection stats={stats} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
