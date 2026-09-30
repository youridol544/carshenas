import { TriangleAlert } from 'lucide-react';
import { formatDateTime } from '@carshenas/locale/format-date';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { ActionLink } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import {
  CRAWL_KIND_LABEL,
  FETCH_OUTCOME_LABEL,
  STOP_REASON_LABEL,
  UNPARSED_FIELD_LABEL,
  WORKER_COPY,
} from '@/features/admin/admin-copy';
import { Card, Code, WorkerSection } from '@/features/admin/components/worker-section';
import type { ProblemsData, SourceProblems } from '@/features/admin/server/pipeline-queries';

// What went wrong at each source (CS-41 criterion 5): the crawler's stop with the way to resume it on the sources
// screen (CS-40), a cooldown and the last 429, every refused request with its time, answer and address as evidence,
// and the values the parser could not read, most common first. Amber only while a stop or a cooldown holds.

function SourceProblemsCard({ source }: { source: SourceProblems }) {
  const headingId = `problems-${source.id}`;
  return (
    <Card labelledBy={headingId}>
      <h3 id={headingId} className="text-control font-semibold">
        <bdi>{source.nameFa}</bdi>
      </h3>
      {source.stop === null ? null : (
        <div role="alert" className="flex flex-col gap-2 rounded-control bg-warning-subtle p-4">
          <p className="flex items-center gap-2 text-control font-semibold text-warning">
            <Icon icon={TriangleAlert} />
            {WORKER_COPY.stopped}
          </p>
          <p className="text-secondary">
            <time dateTime={source.stop.stoppedAt}>{formatDateTime(source.stop.stoppedAt)}</time>
            {`؛ ${STOP_REASON_LABEL[source.stop.reason]}`}
          </p>
          <div className="-ms-2">
            <ActionLink level="tertiary" href="/admin/sources">
              {WORKER_COPY.resumeOnSources}
            </ActionLink>
          </div>
        </div>
      )}
      {source.cooldown === null ? null : (
        <p className="rounded-control bg-warning-subtle p-4 text-secondary text-warning">
          {`${WORKER_COPY.cooldown} `}
          <time dateTime={source.cooldown.until}>{formatDateTime(source.cooldown.until)}</time>
          {`؛ ${WORKER_COPY.cooldownReason[source.cooldown.reason]}`}
        </p>
      )}
      {source.rateLimitedAt === null ? null : (
        <p className="text-secondary text-muted">
          {`${WORKER_COPY.rateLimitedAt}: `}
          <time dateTime={source.rateLimitedAt}>{formatDateTime(source.rateLimitedAt)}</time>
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h4 className="text-label font-medium text-muted">{WORKER_COPY.refused}</h4>
        {source.fetches.length === 0 ? (
          <p className="text-secondary text-muted">{WORKER_COPY.noRefused}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-divider">
            {source.fetches.map((fetch) => (
              <li key={fetch.id} className="flex flex-col gap-1 py-2">
                <span className="text-secondary">
                  <time dateTime={fetch.requestedAt}>{formatDateTime(fetch.requestedAt)}</time>
                  {` · ${FETCH_OUTCOME_LABEL[fetch.outcome]}`}
                  {fetch.httpStatus === null ? null : ` · ${formatCount(fetch.httpStatus)}`}
                  {` · ${CRAWL_KIND_LABEL[fetch.runKind]}`}
                </span>
                <span className="text-meta text-muted">
                  <Code>{fetch.url}</Code>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-label font-medium text-muted">{WORKER_COPY.unparsed}</h4>
        {source.unparsed.length === 0 ? (
          <p className="text-secondary text-muted">{WORKER_COPY.noUnparsed}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {source.unparsed.map((value) => (
              <li
                key={`${value.field}-${value.rawText}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="text-secondary">
                  {`${UNPARSED_FIELD_LABEL[value.field] ?? value.field}: `}
                  <bdi>{value.rawText}</bdi>
                </span>
                <span className="text-secondary text-muted tabular-nums">
                  {formatCountOf(value.listings, WORKER_COPY.listingsWithIt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function ProblemsSection({ data }: { data: ProblemsData }) {
  return (
    <WorkerSection id="problems-heading" title={WORKER_COPY.problems}>
      {data.sources.length === 0 ? (
        <p className="text-body text-pretty text-muted">{WORKER_COPY.noSources}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.sources.map((source) => (
            <li key={source.id}>
              <SourceProblemsCard source={source} />
            </li>
          ))}
        </ul>
      )}
    </WorkerSection>
  );
}
