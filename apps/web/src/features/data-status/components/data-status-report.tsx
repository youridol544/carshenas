import { ExtractionSection } from '@/features/data-status/components/extraction-section';
import { FreshnessTargets } from '@/features/data-status/components/freshness-targets';
import { SourceCard } from '@/features/data-status/components/source-card';
import { StatusOverview, StatusOverviewSkeleton } from '@/features/data-status/components/status-overview';
import { ValuationSection } from '@/features/data-status/components/valuation-section';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';
import { judgeTargets } from '@/features/data-status/data-status-rules';
import type { DataStatus } from '@/features/data-status/data-status-types';

// The figures of the data-status page (CS-66), in the order a visitor asks: is it live, how much is there, are the
// promises kept, which sources, how good are the market values, how well is text read.

export function DataStatusReport({ data }: { data: DataStatus }) {
  const { figures } = data.index;
  return (
    <>
      <StatusOverview state={data.index.state} figures={figures} measuredAt={data.measuredAt} />
      <FreshnessTargets
        results={judgeTargets({
          sources: data.sources,
          shownCheckMedianMinutes: figures.shownCheckMedianMinutes,
          valuation: data.valuation,
          tehranToday: data.tehranToday,
        })}
        valuationDate={data.valuation?.asOfDate ?? null}
        shown={figures.shown}
        trackedActive={figures.trackedActive}
      />
      <section aria-labelledby="sources" className="flex flex-col gap-4">
        <h2 id="sources" className="text-heading font-bold">
          {STATUS_COPY.sourcesTitle}
        </h2>
        {/* Sources one after another, a rule between two; each is a heading, its facts and its chart. */}
        {data.sources.length === 0 ? (
          <p className="text-secondary text-muted">{STATUS_COPY.noSources}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {data.sources.map((source) => (
              <SourceCard key={source.id} source={source} measuredAt={data.measuredAt} />
            ))}
          </div>
        )}
      </section>
      <ValuationSection valuation={data.valuation} />
      <ExtractionSection evaluation={data.extraction} />
    </>
  );
}

/**
 * While the figures load: the overview's own frame, its headline saying they are being read and bars for its figures.
 * The sections under it have no placeholder: they are below the first screen on a phone, and nothing sits under them.
 */
export function DataStatusSkeleton() {
  return (
    <div className="flex flex-col gap-12">
      <StatusOverviewSkeleton />
    </div>
  );
}
