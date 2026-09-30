import { formatDateTime, formatTimeAgo } from '@carshenas/locale/format-date';
import { formatCount, formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import {
  CRAWL_KIND_LABEL,
  FETCH_OUTCOME_LABEL,
  RUN_COUNT_LABEL,
  RUN_STATUS_LABEL,
  WORKER_COPY,
} from '@/features/admin/admin-copy';
import { Card, Code, Stat, WorkerSection } from '@/features/admin/components/worker-section';
import type { CrawlData, FetchOutcome, SourceCrawl } from '@/features/admin/server/pipeline-queries';
import { formatRunSeconds } from '@/features/admin/worker-format';

// Each crawled source's crawl in the window (CS-41 criterion 3): today's requests against its daily budget, its runs
// by kind and state with their average duration, what its requests came back with, and its latest runs. A run's
// counts are the worker's own names, shown as it wrote them.

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

const OUTCOMES = [
  'ok',
  'not_modified',
  'not_found',
  'gone',
  'blocked',
  'rate_limited',
  'challenge',
  'error',
] as const satisfies readonly FetchOutcome[];

/** The day's spend as a bar: a filled share of the frame, with the numbers written beside it. */
function Budget({ source }: { source: SourceCrawl }) {
  const share =
    source.dailyBudget === null || source.dailyBudget === 0 ? null : source.spentToday / source.dailyBudget;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-secondary tabular-nums">
        {`${WORKER_COPY.budget}: ${formatCount(source.spentToday)} `}
        {source.dailyBudget === null
          ? `(${WORKER_COPY.noBudget})`
          : `${WORKER_COPY.budgetOf} ${formatCount(source.dailyBudget)} (${formatPercent(Math.min(share ?? 0, 1))})`}
      </p>
      {share === null ? null : (
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-action"
            style={{ inlineSize: `${Math.min(share, 1) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SourceCrawlCard({ source, now }: { source: SourceCrawl; now: string }) {
  const headingId = `crawl-${source.id}`;
  return (
    <Card labelledBy={headingId}>
      <h3 id={headingId} className="text-control font-semibold">
        <bdi>{source.nameFa}</bdi>
      </h3>
      <Budget source={source} />
      <div className="flex flex-col gap-2">
        <h4 className="text-label font-medium text-muted">{WORKER_COPY.runs}</h4>
        {source.runGroups.length === 0 ? (
          <p className="text-secondary text-muted">{WORKER_COPY.noRuns}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {source.runGroups.map((group) => (
              <li
                key={`${group.kind}-${group.status}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="text-secondary">
                  {`${CRAWL_KIND_LABEL[group.kind]} · ${RUN_STATUS_LABEL[group.status]}`}
                </span>
                <span className="text-secondary text-muted tabular-nums">
                  {formatCountOf(group.runs, WORKER_COPY.runUnit)}
                  {group.averageSeconds === null
                    ? null
                    : ` · ${WORKER_COPY.averageDuration} ${formatRunSeconds(group.averageSeconds)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-label font-medium text-muted">{WORKER_COPY.outcomes}</h4>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {OUTCOMES.map((outcome) => (
            <Stat key={outcome} label={FETCH_OUTCOME_LABEL[outcome]}>
              {formatCount(source.outcomes[outcome] ?? 0)}
            </Stat>
          ))}
        </dl>
      </div>
      <details>
        <summary className="flex min-h-11 items-center text-control text-link">
          {WORKER_COPY.recentRuns}
        </summary>
        <ol className="flex flex-col divide-y divide-divider">
          {source.recentRuns.map((run) => (
            <li key={run.id} className="flex flex-col gap-1 py-2">
              <span className="text-secondary">
                {`${CRAWL_KIND_LABEL[run.kind]} · ${RUN_STATUS_LABEL[run.status]}`}
                {run.seconds === null ? null : ` · ${formatRunSeconds(run.seconds)}`}
              </span>
              <span className="text-meta text-muted">
                <time dateTime={run.startedAt} title={formatDateTime(run.startedAt)}>
                  {formatTimeAgo(run.startedAt, now)}
                </time>
                {Object.entries(run.counts).map(([name, count]) => (
                  <span key={name}>
                    {' · '}
                    {RUN_COUNT_LABEL[name] ?? <Code>{name}</Code>}
                    {`${NO_BREAK_SPACE}${formatCount(count)}`}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

export function CrawlSection({ data, now }: { data: CrawlData; now: string }) {
  return (
    <WorkerSection id="crawl-heading" title={WORKER_COPY.crawl}>
      {data.sources.length === 0 ? (
        <p className="text-body text-pretty text-muted">{WORKER_COPY.noSources}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.sources.map((source) => (
            <li key={source.id}>
              <SourceCrawlCard source={source} now={now} />
            </li>
          ))}
        </ul>
      )}
    </WorkerSection>
  );
}
