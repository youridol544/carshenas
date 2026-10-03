import { Search } from 'lucide-react';
import Link from 'next/link';
import { ActionLink, actionClasses } from '@/components/ui/action-link';
import { inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { formatDate, formatDateTime } from '@carshenas/locale/format-date';
import { formatCount, formatPercent } from '@carshenas/locale/format-number';
import { TrackModelForm } from '@/features/admin/components/track-model-form';
import { TrackedModelControls } from '@/features/admin/components/tracked-model-controls';
import { PRIORITY_LABELS, TRACKED_MODELS_COPY as COPY } from '@/features/admin/tracked-models-admin-copy';
import type {
  AdminTrackedModels,
  RecentChange,
  TrackedCard,
  TrackedChange,
  UntrackedRow,
} from '@/features/admin/server/tracked-model-queries';
import { formatAgeMinutes } from '@/features/admin/worker-format';
import { MAX_UNTRACKED_QUERY_LENGTH, UNTRACKED_LIMIT } from '@/lib/tracked-models-rules';

// The tracked models (CS-53, ADR-0037), for the superadmin: how many models are read in depth and how far their
// details have come, each model as a card with its sync, its origin, its controls and its history, the latest changes,
// and the models not covered yet by their active listings with the one control that covers them. A card is a card on
// every width: its facts are a description list, so a screen reader reads each label with its value. While the crawl
// is paused the screen says so plainly and calls the backfill queued; it never pretends the reading is moving.

const INFO: InfoContent = {
  title: COPY.info.title,
  sections: [
    { id: 'what', paragraphs: [COPY.info.what] },
    { id: 'pause', heading: COPY.info.pauseHeading, paragraphs: [COPY.info.pause] },
    { id: 'remove', heading: COPY.info.removeHeading, paragraphs: [COPY.info.remove] },
    { id: 'budget', heading: COPY.info.budgetHeading, paragraphs: [COPY.info.budget] },
  ],
};

const PRIORITY_INFO: InfoContent = {
  title: COPY.priority.title,
  sections: [{ id: 'priority', paragraphs: [COPY.priority.text] }],
};

const PROGRESS_INFO: InfoContent = {
  title: COPY.progress.infoTitle,
  sections: [{ id: 'progress', paragraphs: [COPY.progress.info] }],
};

function describeChange(change: TrackedChange): string {
  switch (change.action) {
    case 'seeded':
      return COPY.history.seeded;
    case 'tracked':
      return COPY.history.tracked(PRIORITY_LABELS[(change.toValue ?? 'normal') as 'high' | 'normal' | 'low']);
    case 'from_request':
      return COPY.history.from_request;
    case 'paused':
      return COPY.history.paused;
    case 'resumed':
      return COPY.history.resumed;
    case 'priority_changed':
      return COPY.history.priority_changed(
        PRIORITY_LABELS[(change.fromValue ?? 'normal') as 'high' | 'normal' | 'low'],
        PRIORITY_LABELS[(change.toValue ?? 'normal') as 'high' | 'normal' | 'low'],
      );
    case 'untracked':
      return COPY.history.untracked;
    case 'request_withdrawn':
      return COPY.history.request_withdrawn;
  }
}

function ChangeLine({ change, carName }: { change: TrackedChange; carName?: string }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <span className="text-secondary text-pretty">
        {carName === undefined ? null : (
          <>
            <bdi className="font-medium">{carName}</bdi>
            {'، '}
          </>
        )}
        {describeChange(change)}
      </span>
      <span className="text-meta text-muted">
        {change.by === null ? (
          COPY.history.byNone(formatDateTime(change.at))
        ) : (
          <>
            <span dir="ltr">{change.by}</span>
            {'، '}
            {formatDateTime(change.at)}
          </>
        )}
      </span>
    </li>
  );
}

function Fact({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" {...(id === undefined ? {} : { 'data-fact': id })}>
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-control font-medium text-default">{children}</dd>
    </div>
  );
}

function Progress({ card, crawlPaused }: { card: TrackedCard; crawlPaused: boolean }) {
  const { active, withDetails } = card.figures;
  const share = active === 0 ? 0 : withDetails / active;
  const queued = active - withDetails;
  const percent = Math.round(share * 100);
  const status =
    card.state === 'paused'
      ? COPY.progress.modelPaused
      : active === 0
        ? COPY.progress.noListings
        : queued === 0
          ? COPY.progress.complete
          : crawlPaused
            ? COPY.progress.waitingPaused(queued)
            : COPY.progress.waiting(queued);
  return (
    <div className="flex flex-col gap-2" data-backfill={card.key}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center text-label font-medium text-default">
          {COPY.progress.label}
          <InfoPopover label={COPY.progress.infoLabel} closeLabel={COPY.info.close} content={PROGRESS_INFO} />
        </span>
        <span className="text-label text-muted" data-backfill-value>
          {active === 0 ? '' : COPY.progress.value(withDetails, active, formatPercent(share))}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${COPY.progress.label}: ${card.carName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={active === 0 ? COPY.progress.noListings : formatPercent(share)}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-action" style={{ width: `${String(percent)}%` }} />
      </div>
      <p
        className={`text-secondary text-pretty ${
          crawlPaused && card.state === 'tracking' && queued > 0 ? 'text-warning' : 'text-muted'
        }`}
        data-backfill-status={queued === 0 ? 'complete' : crawlPaused ? 'queued-paused' : 'queued'}
      >
        {status}
      </p>
    </div>
  );
}

function OriginLine({ card }: { card: TrackedCard }) {
  if (card.origin === 'seed') return <>{COPY.origin.seed}</>;
  if (card.origin === 'superadmin')
    return <>{COPY.origin.superadmin(card.createdBy ?? '', formatDate(card.createdAt))}</>;
  const decidedBy = card.request?.decidedBy ?? card.createdBy ?? '';
  const decidedAt = card.request?.decidedAt ?? card.createdAt;
  return (
    <>
      {COPY.origin.request(decidedBy, formatDate(decidedAt))}
      {card.request === null ? null : (
        <>
          {'، '}
          {card.request.state === 'fulfilled' ? COPY.origin.requestFulfilled : COPY.origin.requestWaiting}
        </>
      )}
    </>
  );
}

function ModelCard({
  card,
  crawlPaused,
  valuedOn,
}: {
  card: TrackedCard;
  crawlPaused: boolean;
  valuedOn: string | null;
}) {
  const { figures } = card;
  const ratedShare = figures.active === 0 ? null : figures.rated / figures.active;
  const heldByRequest = card.request !== null && card.request.state === 'approved';
  return (
    <li
      data-tracked-model={card.key}
      data-tracked-state={card.state}
      data-tracked-priority={card.priority}
      data-tracked-origin={card.origin}
      className={`flex flex-col gap-4 rounded-card border border-divider p-4 ${
        card.state === 'paused' ? 'bg-surface-muted' : 'bg-surface'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-control font-semibold text-balance">
          <bdi>{card.carName}</bdi>
        </h3>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            data-state-badge={card.state}
            className={`inline-flex rounded-badge px-2 py-0.5 text-label font-medium ${
              card.state === 'tracking' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
            }`}
          >
            {COPY.state[card.state]}
          </span>
        </div>
      </div>
      <p className="-mt-2 text-secondary text-pretty text-muted" data-origin-line>
        <OriginLine card={card} />
      </p>
      <Progress card={card} crawlPaused={crawlPaused} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
        <Fact label={COPY.facts.active} id="active">
          {formatCount(figures.active)}
        </Fact>
        <Fact label={COPY.facts.newInDay} id="new">
          {formatCount(figures.newInDay)}
        </Fact>
        <Fact label={COPY.facts.goneInDay} id="gone">
          {formatCount(figures.goneInDay)}
        </Fact>
        <Fact label={COPY.facts.lastSweep} id="sweep">
          {figures.lastSweepAt === null ? (
            <span className="text-muted">{COPY.facts.lastSweepNone}</span>
          ) : (
            formatDate(figures.lastSweepAt)
          )}
        </Fact>
        <Fact label={COPY.facts.medianAge} id="age">
          {figures.medianAgeMinutes === null ? (
            <span className="text-muted">{COPY.facts.medianAgeNone}</span>
          ) : (
            formatAgeMinutes(figures.medianAgeMinutes)
          )}
        </Fact>
        <Fact label={COPY.facts.rated} id="rated">
          {ratedShare === null ? <span className="text-muted">—</span> : formatPercent(ratedShare)}
        </Fact>
        <Fact label={COPY.facts.valuedOn} id="valued">
          {valuedOn === null || figures.rated === 0 ? (
            <span className="text-muted">{COPY.facts.valuedOnNone}</span>
          ) : (
            COPY.facts.valuedOnDate(formatDate(valuedOn))
          )}
        </Fact>
      </dl>
      <div className="border-t border-divider pt-4">
        <TrackedModelControls
          modelId={card.modelId}
          trimId={card.trimId}
          carName={card.carName}
          state={card.state}
          priority={card.priority}
          heldByRequest={heldByRequest}
        />
      </div>
      <details className="group rounded-inner">
        <summary className="inline-flex min-h-11 items-center text-label font-medium text-link underline">
          {COPY.history.heading}
        </summary>
        {card.history.length === 0 ? (
          <p className="text-secondary text-muted">{COPY.history.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider pt-2">
            {card.history.map((change) => (
              <ChangeLine key={`${change.at}-${change.action}`} change={change} />
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

function Summary({ cards }: { cards: readonly TrackedCard[] }) {
  const tracking = cards.filter((card) => card.state === 'tracking').length;
  const paused = cards.length - tracking;
  const active = cards.reduce((sum, card) => sum + card.figures.active, 0);
  const read = cards.reduce((sum, card) => sum + card.figures.withDetails, 0);
  const share = active === 0 ? 0 : read / active;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3" data-summary>
      <div className="flex flex-col gap-1 rounded-card border border-divider bg-surface px-4 py-3">
        <dt className="text-label text-muted">{COPY.summary.tracking}</dt>
        <dd className="text-title font-bold" data-summary-tracking>
          {formatCount(tracking)}
        </dd>
      </div>
      <div className="flex flex-col gap-1 rounded-card border border-divider bg-surface px-4 py-3">
        <dt className="text-label text-muted">{COPY.summary.paused}</dt>
        <dd className="text-title font-bold" data-summary-paused>
          {formatCount(paused)}
        </dd>
      </div>
      <div className="col-span-2 flex flex-col gap-1 rounded-card border border-divider bg-surface px-4 py-3 md:col-span-1">
        <dt className="text-label text-muted">{COPY.summary.details}</dt>
        <dd className="text-control font-medium">
          {active === 0
            ? COPY.summary.none
            : `${COPY.summary.detailsOf(read, active)} (${formatPercent(share)})`}
        </dd>
      </div>
    </dl>
  );
}

function UntrackedList({ rows, query }: { rows: readonly UntrackedRow[]; query: string }) {
  return (
    <section aria-labelledby="untracked" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="untracked" className="text-heading font-bold">
          {COPY.untracked.heading}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.untracked.lead}</p>
      </div>
      <form
        method="get"
        role="search"
        aria-label={COPY.untracked.search}
        className="flex max-w-reading gap-2"
      >
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">{COPY.untracked.search}</span>
          <span aria-hidden className="pointer-events-none absolute inset-s-3 text-muted">
            <Icon icon={Search} size={20} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={MAX_UNTRACKED_QUERY_LENGTH}
            placeholder={COPY.untracked.searchPlaceholder}
            autoComplete="off"
            className={`${inputClasses} ps-12`}
          />
        </label>
        <button type="submit" className={actionClasses('secondary')}>
          {COPY.untracked.searchSubmit}
        </button>
      </form>
      {query === '' ? null : (
        <div className="-ms-2">
          <Link
            href="/admin/tracked-models"
            prefetch={false}
            className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
          >
            {COPY.untracked.searchClear}
          </Link>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-body text-pretty text-muted">
          {query === '' ? COPY.untracked.emptyAll : COPY.untracked.emptyQuery(query)}
        </p>
      ) : (
        <ul
          className="flex flex-col divide-y divide-divider rounded-card border border-divider bg-surface"
          data-untracked-count={rows.length}
        >
          {rows.map((row) => (
            <li
              key={row.modelId}
              data-untracked-model={row.modelId}
              className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-control font-medium">
                  <bdi>{row.carName}</bdi>
                </span>
                <span className="text-secondary text-muted">{COPY.untracked.active(row.active)}</span>
              </div>
              <div className="lg:w-1/2">
                <TrackModelForm modelId={row.modelId} carName={row.carName} trims={row.trims} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= UNTRACKED_LIMIT ? (
        <p className="text-secondary text-muted">{COPY.untracked.shownOf(rows.length)}</p>
      ) : null}
    </section>
  );
}

function RecentChanges({ changes }: { changes: readonly RecentChange[] }) {
  return (
    <section aria-labelledby="recent" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="recent" className="text-heading font-bold">
          {COPY.recent.heading}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.recent.lead}</p>
      </div>
      {changes.length === 0 ? (
        <p className="text-body text-muted">{COPY.recent.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-card border border-divider bg-surface px-4 py-2">
          {changes.map((change) => (
            <ChangeLine
              key={`${change.at}-${change.carName}-${change.action}`}
              change={change}
              carName={change.carName}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TrackedModelsScreen({ data }: { data: AdminTrackedModels }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-1">
        <div className="-ms-2">
          <ActionLink level="tertiary" href="/admin">
            {COPY.backToDashboard}
          </ActionLink>
        </div>
        <h1 className="text-title font-bold">{COPY.title}</h1>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      {data.crawlPaused ? (
        <p
          role="note"
          data-crawl-paused
          className="max-w-reading rounded-card bg-warning-subtle p-4 text-secondary text-pretty text-warning"
        >
          {COPY.paused}
        </p>
      ) : null}
      <Summary cards={data.tracked} />
      <section aria-labelledby="tracked" className="flex flex-col gap-3">
        <div className="flex items-center gap-1">
          <h2 id="tracked" className="text-heading font-bold">
            {COPY.trackedHeading}
          </h2>
          <InfoPopover label={COPY.info.label} closeLabel={COPY.info.close} content={INFO} />
          <InfoPopover label={COPY.priority.infoLabel} closeLabel={COPY.info.close} content={PRIORITY_INFO} />
        </div>
        {data.tracked.length === 0 ? (
          <p className="max-w-reading text-body text-pretty text-muted">{COPY.trackedEmpty}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:items-start" data-tracked-count={data.tracked.length}>
            {data.tracked.map((card) => (
              <ModelCard key={card.key} card={card} crawlPaused={data.crawlPaused} valuedOn={data.valuedOn} />
            ))}
          </ul>
        )}
      </section>
      <UntrackedList rows={data.untracked} query={data.query} />
      <RecentChanges changes={data.recent} />
    </main>
  );
}
