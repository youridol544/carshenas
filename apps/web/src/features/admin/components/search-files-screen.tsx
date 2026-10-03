import { MatchingRuns } from '@/features/admin/components/matching-runs';
import type { MatchingRun } from '@/features/admin/server/matching-queries';
import { ActionLink } from '@/components/ui/action-link';
import { formatDate } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { SEARCH_FILES_ADMIN_COPY as COPY } from '@/features/admin/admin-copy';
import { ADMIN_FILES_LIMIT, type AdminSearchFiles } from '@/features/admin/server/search-file-queries';

// Every buyer's search files, for the superadmin (CS-70 #5): one row each, the buyer by username, the search as chips,
// its state, how many cars match it and when it was made. A table from a tablet up, cards on a phone, each one a
// description list so a screen reader reads the label with the value. Crawl requests join each file with CS-71.

const STATE_TONES = {
  watching: 'bg-success-subtle text-success',
  paused: 'bg-warning-subtle text-warning',
  closed: 'bg-surface-muted text-muted',
} as const;

const MAX_CHIPS = 4;

function Chips({ chips, unreadable }: { chips: readonly string[]; unreadable: boolean }) {
  if (unreadable) return <span className="text-warning">{COPY.unreadable}</span>;
  const shown = chips.slice(0, MAX_CHIPS);
  return (
    <ul className="flex flex-wrap gap-2">
      {shown.map((chip) => (
        <li
          key={chip}
          className="inline-flex max-w-full items-center rounded-full border border-divider bg-surface-muted px-3 py-0 text-label"
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

function Matches({ file }: { file: AdminSearchFiles['files'][number] }) {
  if (!file.readable) return <span className="text-muted">—</span>;
  if (file.counts === null) return <span className="text-muted">{COPY.countFailed}</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">
        {COPY.matchesOf(file.counts.matches.count, file.counts.matches.exact)}
      </span>
      {file.counts.newCount > 0 ? (
        <span className="rounded-badge bg-action-subtle px-2 text-label font-medium text-on-action-subtle">
          {COPY.newOf(file.counts.newCount)}
        </span>
      ) : null}
    </span>
  );
}

/** The file's own name, only when the buyer changed it: the chips already say what the default name says. */
function ownName(file: AdminSearchFiles['files'][number]): string | null {
  return file.name === file.chips.join('، ') ? null : file.name;
}

function State({ state }: { state: AdminSearchFiles['files'][number]['state'] }) {
  return (
    <span className={`inline-flex rounded-badge px-2 text-label font-medium ${STATE_TONES[state]}`}>
      {COPY.states[state]}
    </span>
  );
}

export function SearchFilesAdminScreen({
  data,
  matchingRuns,
}: {
  data: AdminSearchFiles;
  matchingRuns: readonly MatchingRun[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <div className="flex flex-col gap-1">
        <div className="-ms-2">
          <ActionLink level="tertiary" href="/admin">
            {COPY.backToDashboard}
          </ActionLink>
        </div>
        <h1 className="text-title font-bold">{COPY.title}</h1>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      <MatchingRuns runs={matchingRuns} />
      {data.files.length === 0 ? (
        <p className="text-body text-pretty text-muted">{COPY.empty}</p>
      ) : (
        <section aria-labelledby="admin-files" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="admin-files" className="text-heading font-bold">
              {COPY.list}
            </h2>
            <p data-admin-file-totals className="text-secondary text-muted">
              {COPY.totals(data.totalFiles, data.totalBuyers)}
              {data.totalFiles > ADMIN_FILES_LIMIT
                ? ` · ${COPY.shownLatest(data.files.length, data.totalFiles)}`
                : ''}
            </p>
          </div>
          {/* From a tablet up: one table, one line a file. */}
          <table className="hidden w-full border-collapse text-secondary md:table">
            <thead>
              <tr className="border-b border-divider text-start text-label text-muted">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {COPY.buyer}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {COPY.search}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {COPY.matches}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  {COPY.state}
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  {COPY.created}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((file) => (
                <tr
                  key={file.id}
                  data-admin-search-file={file.id}
                  className="border-b border-divider align-top"
                >
                  <td className="py-2 pe-4">
                    <span dir="ltr" className="wrap-anywhere">
                      {file.buyer}
                    </span>
                  </td>
                  <td className="py-2 pe-4">
                    <Chips chips={file.chips} unreadable={!file.readable} />
                    {ownName(file) === null ? null : (
                      <bdi className="mt-1 block text-meta text-muted">{ownName(file)}</bdi>
                    )}
                  </td>
                  <td className="py-2 pe-4">
                    <Matches file={file} />
                  </td>
                  <td className="py-2 pe-4">
                    <State state={file.state} />
                  </td>
                  <td className="py-2 text-muted">{formatDate(file.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* On a phone: two lines a file. */}
          <ul className="flex flex-col md:hidden">
            {data.files.map((file) => (
              <li
                key={file.id}
                data-admin-search-file={file.id}
                className="flex flex-col gap-2 border-b border-divider py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span dir="ltr" className="min-w-0 text-control wrap-anywhere">
                    {file.buyer}
                  </span>
                  <State state={file.state} />
                </div>
                <Chips chips={file.chips} unreadable={!file.readable} />
                <div className="flex items-center justify-between gap-3 text-secondary">
                  <Matches file={file} />
                  <span className="text-meta text-muted">{formatDate(file.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
