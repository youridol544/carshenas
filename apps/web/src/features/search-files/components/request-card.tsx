import { formatDate } from '@carshenas/locale/format-date';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { AskCrawlButton } from '@/features/search-files/components/ask-crawl-button';
import { RequestStateBadge } from '@/components/ui/request-state-badge';
import { CRAWL_REQUESTS_COPY } from '@/lib/crawl-requests-copy';
import type { CrawlPanel, PanelScope } from '@/lib/crawl-requests-types';

// The quiet card on a search file's page (CS-71 #1, #4): when few cars match and the file names a model, it offers
// «از کارشناس بخواهید بیشتر بگردد»; once the file has asked, it shows each model's state («در انتظار تأیید», «تأیید شد»,
// «رد شد») and what that means for the buyer, and never a button again for what is answered. The rule that offers it
// is OFFER_RULE (crawl-requests-rules.ts), set out in the info control beside the title, never written twice. A file
// with many cars and no request shows nothing: the card is for the buyer who needs it.

const COPY = CRAWL_REQUESTS_COPY.card;

const INFO: InfoContent = {
  title: COPY.title,
  sections: [
    { id: 'what', paragraphs: [COPY.info.what] },
    { id: 'when', heading: COPY.info.whenHeading, paragraphs: COPY.info.when },
    { id: 'limits', heading: COPY.info.limitsHeading, paragraphs: COPY.info.limits },
  ],
};

function noteOf(scope: PanelScope, panel: CrawlPanel): string {
  switch (scope.status) {
    case 'none':
      return COPY.notes.none;
    case 'pending':
      return scope.linked ? COPY.notes.pending : COPY.notes.pendingJoin;
    case 'approved':
      return panel.crawlPaused ? COPY.notes.approvedPaused : COPY.notes.approved;
    case 'declined':
      return COPY.notes.declined(scope.reason);
    case 'fulfilled':
      return COPY.notes.fulfilled;
    case 'tracked':
      return COPY.notes.tracked;
  }
}

export function shouldShowRequestCard(panel: CrawlPanel): boolean {
  const asked = panel.scopes.some((scope) => scope.linked);
  if (asked) return true;
  if (!panel.fewMatches) return false;
  return panel.needsModel || panel.tooMany || panel.scopes.length > 0;
}

export function RequestCard({
  panel,
  fileId,
  matches,
}: {
  panel: CrawlPanel;
  fileId: number;
  /** How many cars match the file now (counted to a cap), for the card's sentence. */
  matches: number | null;
}) {
  const asked = panel.scopes.some((scope) => scope.linked);
  const canAsk = panel.fewMatches && !panel.tooMany && panel.askable.length > 0;
  return (
    <section
      aria-labelledby="file-crawl-request"
      data-crawl-card
      className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="file-crawl-request" className="text-control font-semibold text-balance">
          {COPY.title}
        </h2>
        <span className="-my-2 -me-2 shrink-0">
          <InfoPopover label={COPY.infoLabel} closeLabel={COPY.infoClose} content={INFO} />
        </span>
      </div>
      {canAsk && matches !== null && !asked ? (
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead(matches)}</p>
      ) : null}
      {panel.needsModel ? (
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.needsModel}</p>
      ) : null}
      {panel.tooMany ? (
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.tooMany}</p>
      ) : null}
      {panel.scopes.length === 0 ? null : (
        <ul aria-label={COPY.scopesLabel} className="flex flex-col divide-y divide-divider">
          {panel.scopes.map((scope) => (
            <li
              key={scope.key}
              data-crawl-scope={scope.key}
              className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-control font-medium">
                  <bdi>{scope.carName}</bdi>
                </span>
                {scope.status === 'none' ? null : <RequestStateBadge status={scope.status} />}
              </div>
              <p className="max-w-reading text-secondary text-pretty text-muted">
                {noteOf(scope, panel)}
                {scope.status === 'declined' && scope.decidedAt !== null
                  ? ` (${formatDate(scope.decidedAt)})`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canAsk ? <AskCrawlButton fileId={fileId} count={panel.askable.length} /> : null}
    </section>
  );
}
