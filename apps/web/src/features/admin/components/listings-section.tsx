import { formatCount } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { FreshnessChart } from '@/features/admin/components/freshness-chart';
import { Card, Code, Stat, WorkerSection } from '@/features/admin/components/worker-section';
import type { ListingFlow, ListingsData } from '@/features/admin/server/pipeline-queries';
import { formatAgeMinutes } from '@/features/admin/worker-format';

// Listings in and out (CS-41 criterion 4): for each crawled source and each of its tracked models, how many there are,
// how many are active, and how many came in, changed price and left the market in the window, with the median time
// since an active listing was last checked; then the source's freshness chart.

function Flow({ sourceId, flow }: { sourceId: string; flow: ListingFlow }) {
  const headingId = `flow-${sourceId}-${flow.model?.key.replaceAll(' ', '-') ?? 'all'}`;
  return (
    <li>
      <Card labelledBy={headingId}>
        <h4 id={headingId} className="flex flex-col text-control font-semibold">
          {flow.model === null ? (
            WORKER_COPY.wholeSource
          ) : (
            <>
              <bdi>{flow.model.nameFa}</bdi>
              <span className="text-meta font-normal text-muted">
                <Code>{flow.model.key}</Code>
              </span>
            </>
          )}
        </h4>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
          <Stat label={WORKER_COPY.total}>{formatCount(flow.total)}</Stat>
          <Stat label={WORKER_COPY.active}>{formatCount(flow.active)}</Stat>
          <Stat label={WORKER_COPY.added}>{formatCount(flow.added)}</Stat>
          <Stat label={WORKER_COPY.changed}>{formatCount(flow.changed)}</Stat>
          <Stat label={WORKER_COPY.gone}>{formatCount(flow.gone)}</Stat>
          <Stat label={WORKER_COPY.lastCheck}>
            {flow.lastCheckMedianMinutes === null
              ? WORKER_COPY.noActive
              : formatAgeMinutes(flow.lastCheckMedianMinutes)}
          </Stat>
        </dl>
      </Card>
    </li>
  );
}

export function ListingsSection({ data, now }: { data: ListingsData; now: string }) {
  return (
    <WorkerSection id="listings-heading" title={WORKER_COPY.listings}>
      {data.sources.length === 0 ? (
        <p className="text-body text-pretty text-muted">{WORKER_COPY.noSources}</p>
      ) : (
        data.sources.map((source) => (
          <div key={source.id} className="flex flex-col gap-4">
            <h3 className="text-control font-semibold">
              <bdi>{source.nameFa}</bdi>
            </h3>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {source.flows.map((flow) => (
                <Flow key={flow.model?.key ?? 'all'} sourceId={source.id} flow={flow} />
              ))}
            </ul>
            <div className="rounded-card border border-divider p-4">
              <FreshnessChart
                points={source.chart}
                chartHours={data.chartHours}
                now={now}
                label={WORKER_COPY.chart}
              />
            </div>
          </div>
        ))
      )}
    </WorkerSection>
  );
}
