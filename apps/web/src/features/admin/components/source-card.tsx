import { TriangleAlert } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import {
  CHANGE_LABEL,
  CRAWL_STATE_LABEL,
  NOT_CRAWLED_LABEL,
  SOURCES_COPY,
  STOP_REASON_LABEL,
} from '@/features/admin/admin-copy';
import type { CrawlState } from '@/features/admin/admin-types';
import { SourceStateBoundary } from '@/features/admin/components/source-state-boundary';
import { SourceStateForm } from '@/features/admin/components/source-state-form';
import type { AdminSource, SourceChange, SourceStop } from '@/features/admin/server/admin-queries';
import { formatDateTime } from '@carshenas/locale/format-date';

// One source on the sources screen (CS-40): its name and address, its crawl state, the crawler's stop when there is
// one (when and why: ADR-0008 point 6 leaves the resume to a person who has read it), its one control, and who
// changed its state lately, and when. A state's colour shows only while the state holds (ui-design craft.md, section
// 6): green while it is crawled, amber while it is stopped, neutral while it is paused or not crawled at all. The card
// keeps to two weights, 600 for its titles and 400 for the rest; the badge and the button are components of their own.

const BADGE = {
  enabled: 'bg-success-subtle text-success',
  paused: 'bg-surface-hover text-muted',
  stopped_on_block: 'bg-warning-subtle text-warning',
} as const satisfies Record<CrawlState, string>;

/** Read right after the source's name, so the state needs no hidden label; a long label wraps inside the badge. */
function StateBadge({ source }: { source: AdminSource }) {
  const tone = source.crawled ? BADGE[source.crawlState] : BADGE.paused;
  return (
    <p
      className={`inline-flex min-h-8 min-w-0 items-center rounded-badge px-2 text-label font-medium ${tone}`}
    >
      {source.crawled ? CRAWL_STATE_LABEL[source.crawlState] : NOT_CRAWLED_LABEL}
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

function SourceHistory({
  cardHeadingId,
  changes,
}: {
  cardHeadingId: string;
  changes: readonly SourceChange[];
}) {
  const headingId = `${cardHeadingId}-changes`;
  return (
    // Named «تغییرهای اخیر» and the source's name, so each card's region has a name of its own.
    <section
      aria-labelledby={`${headingId} ${cardHeadingId}`}
      className="flex flex-col gap-3 border-t border-divider pt-4"
    >
      <h3 id={headingId} className="text-secondary text-muted">
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
                  {`${SOURCES_COPY.clearedStopFrom} `}
                  <time dateTime={change.clearedStop.stoppedAt}>
                    {formatDateTime(change.clearedStop.stoppedAt)}
                  </time>
                  {` ${SOURCES_COPY.clearedStopLifted}. ${SOURCES_COPY.stopReason}: ${STOP_REASON_LABEL[change.clearedStop.reason]}.`}
                </span>
              )}
              <span className="text-meta text-muted">
                <span dir="ltr" className="wrap-anywhere">
                  {change.changedBy}
                </span>
                {'، '}
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
          <h2 id={headingId} className="text-heading font-semibold">
            <bdi>{source.nameFa}</bdi>
          </h2>
          {/* self-start: a left-to-right span as wide as the column would put its text on the left edge. */}
          <span dir="ltr" lang="en" className="self-start text-meta wrap-anywhere text-muted">
            {new URL(source.baseUrl).host}
          </span>
        </div>
        <StateBadge source={source} />
      </div>
      {source.stop === null ? null : <StopNotice stop={source.stop} />}
      {source.crawled ? (
        <SourceStateBoundary>
          <SourceStateForm
            sourceId={source.id}
            crawlState={source.crawlState}
            stoppedAtText={source.stop?.stoppedAtText ?? null}
            headingId={headingId}
          />
        </SourceStateBoundary>
      ) : null}
      <SourceHistory cardHeadingId={headingId} changes={source.changes} />
    </article>
  );
}
