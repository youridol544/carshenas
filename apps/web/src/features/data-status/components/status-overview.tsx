import { CircleCheck, CirclePause, Clock } from 'lucide-react';
import { formatDate, formatDateTime, formatTimeAgo } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { Icon } from '@/components/ui/icon';
import { NumericText } from '@/components/ui/numeric-text';
import { INDEX_STATE_HEADLINE, STATUS_COPY } from '@/features/data-status/data-status-copy';
import { formatHours, formatMinutes } from '@/features/data-status/data-status-format';
import { FIGURES_WINDOW_HOURS } from '@/features/data-status/data-status-rules';
import type { ListingFigures, UpdateState } from '@/features/data-status/data-status-types';

// The top of the data-status page (CS-66 criterion 1, the whole index): whether listings are being updated, when a
// source was last read, and four figures. OverviewFrame holds the geometry, so the skeleton and the real overview are
// the same boxes (ui-design craft.md, section 3) and nothing moves when the figures arrive.

const STATE_ICON = { live: CircleCheck, delayed: Clock, not_updating: CirclePause } as const;
/** A standalone mark in a tinted circle, so its stroke answers to no label beside it (craft.md, icons). */
const STATE_MARK = {
  live: 'bg-success-subtle text-success',
  delayed: 'bg-warning-subtle text-warning',
  not_updating: 'bg-surface-hover text-muted',
} as const;

type Tile = { key: string; label: string; value: React.ReactNode; hint: string };

function OverviewFrame({
  named,
  mark,
  banner,
  tiles,
}: {
  named: boolean;
  mark: React.ReactNode;
  banner: React.ReactNode;
  tiles: readonly Tile[];
}) {
  return (
    // Named by the state headline once it is there; the skeleton has none to point at.
    <section aria-labelledby={named ? 'status-overview' : undefined} className="flex flex-col gap-4">
      <div className="flex items-start gap-4 rounded-card bg-surface-muted p-4 sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full">{mark}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">{banner}</div>
      </div>
      <dl className="grid grid-cols-1 gap-3 min-[22.5rem]:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex min-w-0 flex-col gap-1 rounded-card border border-divider p-4">
            <dt className="text-label font-medium text-muted">{tile.label}</dt>
            <dd className="min-h-lh min-w-0 text-title font-bold">{tile.value}</dd>
            <dd className="text-meta text-pretty text-muted">{tile.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function tilesOf(figures: ListingFigures | null): Tile[] {
  const window = formatHours(FIGURES_WINDOW_HOURS);
  const value = (text: string | null) =>
    figures === null || text === null ? <SkeletonLine /> : <NumericText>{text}</NumericText>;
  return [
    {
      key: 'active',
      label: STATUS_COPY.active,
      value: value(figures && formatCount(figures.active)),
      hint: STATUS_COPY.activeHint,
    },
    {
      key: 'posted',
      label: STATUS_COPY.posted,
      value: value(figures && formatCount(figures.postedLast24h)),
      hint: STATUS_COPY.postedHint(window),
    },
    {
      key: 'gone',
      label: STATUS_COPY.gone,
      value: value(figures && formatCount(figures.goneLast24h)),
      hint: STATUS_COPY.goneHint(window),
    },
    {
      key: 'check-age',
      label: STATUS_COPY.checkAge,
      value:
        figures === null ? (
          <SkeletonLine />
        ) : figures.shownCheckMedianMinutes === null ? (
          <span className="text-control font-normal text-muted">{STATUS_COPY.noShown}</span>
        ) : (
          formatMinutes(figures.shownCheckMedianMinutes)
        ),
      hint: STATUS_COPY.checkAgeHint,
    },
  ];
}

/** A bar centred in one line box of the text it stands for. */
function SkeletonLine() {
  return (
    <span aria-hidden className="flex h-lh w-24 items-center">
      <span className="h-3 w-full rounded-badge bg-skeleton" />
    </span>
  );
}

export function StatusOverview({
  state,
  figures,
  measuredAt,
}: {
  state: UpdateState;
  figures: ListingFigures;
  measuredAt: string;
}) {
  const banner = (
    <>
      <h2 id="status-overview" className="text-heading font-bold text-balance">
        {INDEX_STATE_HEADLINE[state]}
      </h2>
      {figures.lastReadAt === null ? (
        <p className="text-secondary text-muted">{STATUS_COPY.noData}</p>
      ) : (
        <p className="text-secondary text-pretty text-muted">
          {state === 'live' ? STATUS_COPY.lastRead : STATUS_COPY.latestData}{' '}
          <time dateTime={figures.lastReadAt} className="font-semibold text-default">
            {formatTimeAgo(figures.lastReadAt, measuredAt)}
          </time>
          {' · '}
          {formatDateTime(figures.lastReadAt)}
        </p>
      )}
      <ul className="flex flex-col text-meta text-muted sm:flex-row sm:flex-wrap sm:gap-x-4">
        <li>
          {STATUS_COPY.measuredAt} <time dateTime={measuredAt}>{formatDateTime(measuredAt)}</time>
        </li>
        {figures.firstStoredAt === null ? null : (
          <li>
            {STATUS_COPY.indexSince}{' '}
            <time dateTime={figures.firstStoredAt}>{formatDate(figures.firstStoredAt)}</time>
          </li>
        )}
      </ul>
    </>
  );
  const mark = (
    <span className={`flex size-12 items-center justify-center rounded-full ${STATE_MARK[state]}`}>
      <Icon icon={STATE_ICON[state]} size={24} />
    </span>
  );
  return <OverviewFrame named mark={mark} banner={banner} tiles={tilesOf(figures)} />;
}

/** The overview before its figures arrive: the same frame, with a bar where each figure will be. */
export function StatusOverviewSkeleton() {
  const banner = (
    <>
      {/* The headline's own line box, saying what is happening instead of a bar. */}
      <p role="status" className="text-heading font-bold text-subtle">
        {STATUS_COPY.loading}
      </p>
      <span aria-hidden className="flex h-lh items-center text-secondary">
        <span className="h-3 w-80 max-w-full rounded-badge bg-skeleton" />
      </span>
      <span aria-hidden className="flex h-lh items-center text-meta">
        <span className="h-2 w-48 max-w-full rounded-badge bg-skeleton" />
      </span>
    </>
  );
  return (
    <OverviewFrame
      named={false}
      mark={<span aria-hidden className="size-12 rounded-full bg-skeleton" />}
      banner={banner}
      tiles={tilesOf(null)}
    />
  );
}
