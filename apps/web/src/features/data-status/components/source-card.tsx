import { formatDateTime, formatTimeAgo } from '@carshenas/locale/format-date';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';
import { NumericText } from '@/components/ui/numeric-text';
import { FreshnessChart } from '@/features/data-status/components/freshness-chart';
import { SOURCE_STATE_LABEL, STATUS_COPY } from '@/features/data-status/data-status-copy';
import { formatHours, formatMinutes } from '@/features/data-status/data-status-format';
import { FIGURES_WINDOW_HOURS } from '@/features/data-status/data-status-rules';
import type { SourceStatus } from '@/features/data-status/data-status-types';

// One source on the data-status page (CS-66 criteria 1 and 2): its state, when it was last read, its listings and
// its hourly freshness. A paused or blocked source says it is not being updated and gives the date of its latest
// data, never why (ADR-0017 point 9): the reason is the superadmin's to read.

const STATE_BADGE = {
  live: 'bg-success-subtle text-success',
  delayed: 'bg-warning-subtle text-warning',
  not_updating: 'bg-surface-hover text-muted',
} as const;

export function SourceCard({ source, measuredAt }: { source: SourceStatus; measuredAt: string }) {
  const { figures } = source;
  const window = formatHours(FIGURES_WINDOW_HOURS);
  const note = source.state === 'not_updating' ? STATUS_COPY.sourceNotUpdating : STATUS_COPY.sourceDelayed;
  const facts: { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: 'last-read',
      label: STATUS_COPY.sourceLastRead,
      value:
        figures.lastReadAt === null ? (
          '—'
        ) : (
          <time dateTime={figures.lastReadAt}>{formatTimeAgo(figures.lastReadAt, measuredAt)}</time>
        ),
    },
    {
      key: 'active',
      label: STATUS_COPY.sourceActive,
      value: <NumericText>{formatCount(figures.active)}</NumericText>,
    },
    {
      key: 'posted',
      label: STATUS_COPY.sourcePosted(window),
      value: <NumericText>{formatCount(figures.postedLast24h)}</NumericText>,
    },
    {
      key: 'gone',
      label: STATUS_COPY.sourceGone(window),
      value: <NumericText>{formatCount(figures.goneLast24h)}</NumericText>,
    },
    {
      key: 'check-age',
      label: STATUS_COPY.sourceCheckAge,
      value: figures.shownCheckMedianMinutes === null ? '—' : formatMinutes(figures.shownCheckMedianMinutes),
    },
    ...(source.dailyRequestBudget === null
      ? []
      : [
          {
            key: 'budget',
            label: STATUS_COPY.sourceBudget,
            value: <NumericText>{formatCountOf(source.dailyRequestBudget, 'درخواست')}</NumericText>,
          },
        ]),
  ];
  return (
    <article
      aria-labelledby={`source-${source.id}`}
      className="flex flex-col gap-4 rounded-card border border-divider p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={`source-${source.id}`} className="text-heading font-bold">
          <bdi>{source.nameFa}</bdi>
        </h3>
        <span
          className={`inline-flex min-h-7 max-w-full items-center rounded-badge px-2 text-label font-medium ${STATE_BADGE[source.state]}`}
        >
          {SOURCE_STATE_LABEL[source.state]}
        </span>
      </header>
      {source.state === 'live' || figures.lastReadAt === null ? null : (
        <p className="text-secondary text-pretty">
          <bdi>{source.nameFa}</bdi> {note.before}{' '}
          <time dateTime={figures.lastReadAt} className="font-semibold">
            {formatDateTime(figures.lastReadAt)}
          </time>{' '}
          {note.after}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.key} className="flex min-w-0 flex-col">
            <dt className="text-meta text-muted">{fact.label}</dt>
            <dd className="text-control font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <FreshnessChart points={source.series} now={measuredAt} />
    </article>
  );
}
