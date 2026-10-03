import { ActionLink } from '@/components/ui/action-link';
import { RequestStateBadge } from '@/components/ui/request-state-badge';
import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { CrawlRequestDecisionForm } from '@/features/admin/components/crawl-request-decision-form';
import { CrawlRequestFilter } from '@/features/admin/components/crawl-request-filter';
import { CRAWL_REQUESTS_ADMIN_COPY as COPY } from '@/features/admin/crawl-requests-admin-copy';
import type { AdminCrawlRequest, AdminCrawlRequests } from '@/features/admin/server/crawl-request-queries';

// Crawl requests (CS-71, ADR-0036), for the superadmin: how many buyers want each model (the aggregate demand, most
// wanted first), then every request, the queue first, with the search files that depend on it (each buyer by username,
// the search as chips), who decided and when, and the one control: approve, or decline with a reason the buyer reads.
// Last, the models read in depth and how each came to be. A request is a card on every width: its facts are a
// description list, so a screen reader reads each label with its value.

function Chips({ chips }: { chips: readonly string[] }) {
  if (chips.length === 0) return null;
  const shown = chips.slice(0, 4);
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((chip) => (
        <li
          key={chip}
          className="inline-flex max-w-full items-center rounded-full border border-divider bg-surface-muted px-3 text-label"
        >
          <bdi className="min-w-0 text-pretty">{chip}</bdi>
        </li>
      ))}
      {chips.length > shown.length ? (
        <li className="inline-flex items-center px-1 text-label text-muted">{`+${formatCount(chips.length - shown.length)}`}</li>
      ) : null}
    </ul>
  );
}

function DemandStrip({ demand }: { demand: AdminCrawlRequests['demand'] }) {
  if (demand.length === 0) return null;
  const most = Math.max(...demand.map((row) => row.buyers), 1);
  return (
    <section aria-labelledby="crawl-demand" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="crawl-demand" className="text-heading font-bold">
          {COPY.demandHeading}
        </h2>
        <p className="text-secondary text-muted">{COPY.demandLead}</p>
      </div>
      <ol className="grid gap-2 md:grid-cols-2">
        {demand.map((row, index) => (
          <li
            key={row.modelId}
            data-demand-model={row.modelId}
            className="relative flex items-center gap-3 overflow-hidden rounded-card border border-divider bg-surface px-3 py-2"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 inset-s-0 bg-action-subtle"
              style={{ width: `${String(Math.max(6, Math.round((row.buyers / most) * 100)))}%` }}
            />
            <span className="relative w-6 shrink-0 text-center text-label text-muted">
              {formatCount(index + 1)}
            </span>
            <span className="relative min-w-0 flex-1 text-control font-medium">
              <bdi>{row.carName}</bdi>
            </span>
            <span className="relative shrink-0 text-secondary text-muted">
              {COPY.demandRow(row.buyers, row.requests)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RequestCard({ request, crawlPaused }: { request: AdminCrawlRequest; crawlPaused: boolean }) {
  const more = request.fileCount - request.files.length;
  return (
    <li
      data-crawl-request={request.id}
      data-request-state={request.state}
      className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-control font-semibold text-balance">
          <bdi>{request.carName}</bdi>
        </h3>
        <RequestStateBadge status={request.state} />
      </div>
      <p className="text-secondary text-muted">
        <span className="font-medium text-default">{COPY.demand(request.buyers)}</span>
        {' · '}
        {COPY.filesOf(request.fileCount)}
        {' · '}
        {COPY.asked(formatDate(request.createdAt))}
      </p>
      {request.files.length === 0 ? null : (
        <section aria-label={`${COPY.filesLabel}: ${request.carName}`} className="flex flex-col gap-2">
          <h4 className="text-label font-medium text-muted">{COPY.filesLabel}</h4>
          <ul className="flex flex-col divide-y divide-divider">
            {request.files.map((file) => (
              <li
                key={file.id}
                data-request-file={file.id}
                className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span dir="ltr" className="text-control wrap-anywhere">
                    {file.buyer}
                  </span>
                  <span className="text-meta text-muted">{COPY.stateOfFile[file.state]}</span>
                </div>
                <Chips chips={file.chips} />
                <bdi className="text-meta text-muted">{file.name}</bdi>
              </li>
            ))}
          </ul>
          {more > 0 ? <p className="text-meta text-muted">{COPY.moreFiles(more)}</p> : null}
        </section>
      )}
      {request.decidedAt !== null && request.decidedBy !== null ? (
        <p className="text-secondary text-muted">
          <span className="font-medium text-default">{COPY.decidedLabel}:</span>{' '}
          <span dir="ltr">{request.decidedBy}</span> · {formatDate(request.decidedAt)}
          {request.reason === null ? null : (
            <>
              <br />
              <span className="font-medium text-default">{COPY.reasonLabel}:</span>{' '}
              <bdi>{request.reason}</bdi>
            </>
          )}
        </p>
      ) : null}
      {request.state === 'fulfilled' ? null : (
        <div className="border-t border-divider pt-3">
          <CrawlRequestDecisionForm requestId={request.id} state={request.state} carName={request.carName} />
          {request.state === 'approved' && crawlPaused ? (
            <p className="mt-2 text-meta text-muted">{COPY.paused}</p>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function CrawlRequestsScreen({ data }: { data: AdminCrawlRequests }) {
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
          className="max-w-reading rounded-card bg-warning-subtle p-4 text-secondary text-pretty text-warning"
        >
          {COPY.paused}
        </p>
      ) : null}
      <DemandStrip demand={data.demand} />
      <section aria-labelledby="crawl-requests" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="crawl-requests" className="text-heading font-bold">
            {COPY.requestsHeading}
          </h2>
          <p className="text-secondary text-muted">{COPY.requestsOrder}</p>
        </div>
        <CrawlRequestFilter current={data.filter} counts={data.counts} />
        {data.requests.length === 0 ? (
          <p className="text-body text-pretty text-muted">{COPY.empty[data.filter]}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:items-start" data-requests-count={data.requests.length}>
            {data.requests.map((request) => (
              <RequestCard key={request.id} request={request} crawlPaused={data.crawlPaused} />
            ))}
          </ul>
        )}
        {data.counts[data.filter] > data.requests.length ? (
          <p className="text-secondary text-muted">{`${formatCount(data.requests.length)} / ${formatCount(data.counts[data.filter])}`}</p>
        ) : null}
      </section>
      <section aria-labelledby="crawl-tracked" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="crawl-tracked" className="text-heading font-bold">
            {COPY.trackedHeading}
          </h2>
          <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.trackedLead}</p>
        </div>
        {data.tracked.length === 0 ? (
          <p className="text-body text-muted">{COPY.trackedEmpty}</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {data.tracked.map((row) => (
              <li
                key={row.key}
                data-tracked-model={row.key}
                className="flex flex-col gap-0.5 rounded-card border border-divider bg-surface px-3 py-2"
              >
                <span className="text-control font-medium">
                  <bdi>{row.carName}</bdi>
                </span>
                <span className="text-secondary text-muted">
                  {row.fromRequest === null
                    ? COPY.trackedOwner
                    : COPY.trackedRequest(
                        row.fromRequest.decidedBy ?? '—',
                        row.fromRequest.decidedAt === null ? '—' : formatDate(row.fromRequest.decidedAt),
                      )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
