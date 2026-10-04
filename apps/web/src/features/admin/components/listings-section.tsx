import { formatCount } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { FreshnessChart } from '@/features/admin/components/freshness-chart';
import { Code, WorkerSection } from '@/features/admin/components/worker-section';
import type { ListingFlow, ListingsData, SourceListings } from '@/features/admin/server/pipeline-queries';
import { formatAgeMinutes } from '@/features/admin/worker-format';

// Listings in and out (CS-41 criterion 4): for each crawled source and each of its tracked models, how many there are,
// how many are active, and how many came in, changed price and left the market in the window, with the median time
// since an active listing was last checked; then the source's freshness chart. One table from 640 px; a phone gives
// each row its own lines, since seven columns do not fit it.

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

type Figure = { label: string; value: (flow: ListingFlow) => string };

const FIGURES: readonly Figure[] = [
  { label: WORKER_COPY.total, value: (flow) => formatCount(flow.total) },
  { label: WORKER_COPY.active, value: (flow) => formatCount(flow.active) },
  { label: WORKER_COPY.added, value: (flow) => formatCount(flow.added) },
  { label: WORKER_COPY.changed, value: (flow) => formatCount(flow.changed) },
  { label: WORKER_COPY.gone, value: (flow) => formatCount(flow.gone) },
  {
    label: WORKER_COPY.lastCheck,
    value: (flow) =>
      flow.lastCheckMedianMinutes === null
        ? WORKER_COPY.noActive
        : formatAgeMinutes(flow.lastCheckMedianMinutes),
  },
];

function FlowName({ flow }: { flow: ListingFlow }) {
  return flow.model === null ? (
    <>{WORKER_COPY.wholeSource}</>
  ) : (
    <span className="flex flex-col">
      <bdi>{flow.model.nameFa}</bdi>
      <span className="text-meta text-muted">
        <Code>{flow.model.key}</Code>
      </span>
    </span>
  );
}

function SourceFlows({ source }: { source: SourceListings }) {
  const captionId = `flows-${source.id}`;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-divider p-4">
      <h4 id={captionId} className="text-control font-semibold">
        {WORKER_COPY.flowsCaption}
      </h4>
      <ul aria-labelledby={captionId} className="flex flex-col divide-y divide-divider sm:hidden">
        {source.flows.map((flow) => (
          <li key={flow.model?.key ?? 'all'} className="flex flex-col gap-1 py-2">
            <span className="text-control">
              <FlowName flow={flow} />
            </span>
            <span className="text-meta text-muted tabular-nums">
              {FIGURES.map((figure) => `${figure.label}${NO_BREAK_SPACE}${figure.value(flow)}`).join('، ')}
            </span>
          </li>
        ))}
      </ul>
      <table aria-labelledby={captionId} className="hidden w-full text-secondary sm:table">
        <thead>
          <tr className="border-b border-divider">
            <th scope="col" className="py-2 pe-3 text-start text-label font-medium text-muted">
              {WORKER_COPY.tracked}
            </th>
            {FIGURES.map((figure) => (
              <th
                key={figure.label}
                scope="col"
                className="px-3 py-2 text-end text-label font-medium text-muted"
              >
                {figure.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {source.flows.map((flow) => (
            <tr key={flow.model?.key ?? 'all'}>
              <th scope="row" className="py-2 pe-3 text-start font-normal">
                <FlowName flow={flow} />
              </th>
              {FIGURES.map((figure) => (
                <td key={figure.label} className="px-3 py-2 text-end tabular-nums">
                  {figure.value(flow)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListingsSection({ data, now }: { data: ListingsData; now: string }) {
  return (
    <WorkerSection id="listings-heading" title={WORKER_COPY.listings}>
      {data.sources.length === 0 ? (
        <p className="text-body text-pretty text-muted">{WORKER_COPY.noSources}</p>
      ) : (
        data.sources.map((source) => (
          <section key={source.id} aria-labelledby={`listings-${source.id}`} className="flex flex-col gap-4">
            <h3 id={`listings-${source.id}`} className="text-control font-semibold">
              <bdi>{source.nameFa}</bdi>
            </h3>
            <SourceFlows source={source} />
            <div className="rounded-card border border-divider p-4">
              <FreshnessChart
                points={source.chart}
                chartHours={data.chartHours}
                now={now}
                label={WORKER_COPY.chart}
              />
            </div>
          </section>
        ))
      )}
    </WorkerSection>
  );
}
