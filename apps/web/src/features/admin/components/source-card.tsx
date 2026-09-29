import { TriangleAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import {
  CHANGE_LABEL,
  CRAWL_STATE_LABEL,
  SOURCES_COPY,
  STOP_REASON_LABEL,
} from '@/features/admin/admin-copy';
import type { CrawlState } from '@/features/admin/admin-types';
import { SourceStateForm } from '@/features/admin/components/source-state-form';
import type { AdminSource, SourceChange, SourceStop } from '@/features/admin/server/admin-queries';
import { formatDateTime } from '@/lib/format-date';

// One source on the sources screen (CS-40): its name and address, its crawl state, the crawler's stop when there is
// one (when and why: ADR-0008 point 6 leaves the resume to a person who has read it), its one control, and who
// changed its state lately, and when. A state's colour shows only while the state holds (ui-design craft.md, section
// 6): green while it is crawled, amber while it is stopped, neutral while it is paused.

const BADGE = {
  enabled: 'bg-success-subtle text-success',
  paused: 'bg-surface-hover text-muted',
  stopped_on_block: 'bg-warning-subtle text-warning',
} as const satisfies Record<CrawlState, string>;

function StateBadge({ state }: { state: CrawlState }) {
  return (
    <p className="shrink-0">
      <span className="sr-only">{`${SOURCES_COPY.state}: `}</span>
      <span
        className={`inline-flex min-h-8 items-center rounded-badge px-2 text-label font-medium ${BADGE[state]}`}
      >
        {CRAWL_STATE_LABEL[state]}
      </span>
    </p>
  );
}

function StopNotice({ stop }: { stop: SourceStop }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-2 text-control font-semibold text-warning">
        <Icon icon={TriangleAlert} />
        {SOURCES_COPY.stopped}
      </p>
      <p className="text-secondary text-default">
        {`${SOURCES_COPY.stoppedAt}: `}
        <time dateTime={stop.stoppedAt}>{formatDateTime(stop.stoppedAt)}</time>
      </p>
      <p className="text-secondary text-default">{`${SOURCES_COPY.stopReason}: ${STOP_REASON_LABEL[stop.reason]}`}</p>
      <p className="max-w-reading text-secondary text-pretty text-muted">{SOURCES_COPY.stopAdvice}</p>
    </div>
  );
}

function changeLabel(change: SourceChange): string {
  if (change.toState === 'enabled') return CHANGE_LABEL.enabled;
  return change.fromState === 'stopped_on_block' ? CHANGE_LABEL.keptPaused : CHANGE_LABEL.paused;
}

function SourceHistory({ sourceId, changes }: { sourceId: string; changes: readonly SourceChange[] }) {
  const headingId = `source-${sourceId}-changes`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t border-divider pt-4">
      <h3 id={headingId} className="text-label font-medium text-muted">
        {SOURCES_COPY.changes}
      </h3>
      {changes.length === 0 ? (
        <p className="text-secondary text-pretty text-muted">{SOURCES_COPY.noChanges}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {changes.map((change) => (
            <li key={change.id} className="flex flex-col">
              <span className="text-control text-default">{changeLabel(change)}</span>
              {change.clearedStop === null ? null : (
                <span className="text-secondary text-muted">
                  {`${SOURCES_COPY.clearedStop}: `}
                  <time dateTime={change.clearedStop.stoppedAt}>
                    {formatDateTime(change.clearedStop.stoppedAt)}
                  </time>
                  {`، ${STOP_REASON_LABEL[change.clearedStop.reason]}`}
                </span>
              )}
              <span className="text-meta text-muted">
                <span dir="ltr" className="wrap-anywhere">
                  {change.changedBy}
                </span>
                {' · '}
                <time dateTime={change.changedAt}>{formatDateTime(change.changedAt)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SourceCard({ source }: { source: AdminSource }) {
  const headingId = `source-${source.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-4 rounded-card border border-divider p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 id={headingId} className="text-heading font-bold">
            <bdi>{source.nameFa}</bdi>
          </h2>
          <span dir="ltr" lang="en" className="text-meta wrap-anywhere text-muted">
            {new URL(source.baseUrl).host}
          </span>
        </div>
        <StateBadge state={source.crawlState} />
      </div>
      {source.stop === null ? null : <StopNotice stop={source.stop} />}
      {source.crawled ? (
        <SourceStateForm
          sourceId={source.id}
          crawlState={source.crawlState}
          stoppedAtText={source.stop?.stoppedAtText ?? null}
        />
      ) : (
        <p className="text-secondary text-pretty text-muted">{SOURCES_COPY.notCrawled}</p>
      )}
      <SourceHistory sourceId={source.id} changes={source.changes} />
    </article>
  );
}
