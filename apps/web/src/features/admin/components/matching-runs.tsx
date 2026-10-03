import { formatDateTime } from '@carshenas/locale/format-date';
import { SEARCH_FILES_ADMIN_COPY as COPY } from '@/features/admin/admin-copy';
import type { MatchingRun } from '@/features/admin/server/matching-queries';

// The matching job's latest runs (CS-72 #4): the time it took, the files it read, the buyers it told and what it held
// back. A phone sees one line a run; nothing here changes anything.

export function MatchingRuns({ runs }: { runs: readonly MatchingRun[] }) {
  return (
    <section aria-labelledby="admin-matching" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="admin-matching" className="text-heading font-bold">
          {COPY.matching.heading}
        </h2>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.matching.lead}</p>
      </div>
      {runs.length === 0 ? (
        <p data-matching-empty className="text-secondary text-muted">
          {COPY.matching.empty}
        </p>
      ) : (
        <ol className="flex flex-col rounded-card border border-divider bg-surface">
          {runs.map((run) => (
            <li
              key={run.at}
              data-matching-run
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-divider px-4 py-3 last:border-b-0"
            >
              <time dateTime={run.at} className="text-secondary text-muted">
                {formatDateTime(run.at)}
              </time>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary">
                <span data-matching-notified={run.notified} className="font-semibold">
                  {COPY.matching.notified(run.notified)}
                </span>
                <span>{COPY.matching.read(run.files, run.newListings, run.drops)}</span>
                {run.deferred > 0 ? (
                  <span className="text-muted">{COPY.matching.deferred(run.deferred)}</span>
                ) : null}
                <span className="text-muted">{COPY.matching.took(run.milliseconds)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
