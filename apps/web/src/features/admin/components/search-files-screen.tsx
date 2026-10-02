import { ActionLink } from '@/components/ui/action-link';
import { formatDate } from '@carshenas/locale/format-date';
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

function Chips({ chips, unreadable }: { chips: readonly string[]; unreadable: boolean }) {
  if (unreadable) return <span className="text-warning">{COPY.unreadable}</span>;
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip}
          className="inline-flex max-w-full items-center rounded-full border border-divider bg-surface-muted px-3 py-0.5 text-label"
        >
          <bdi className="min-w-0 text-pretty">{chip}</bdi>
        </li>
      ))}
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
        <span className="rounded-badge bg-action-subtle px-2 py-0.5 text-label font-medium text-on-action-subtle">
          {COPY.newOf(file.counts.newCount)}
        </span>
      ) : null}
    </span>
  );
}

export function SearchFilesAdminScreen({ data }: { data: AdminSearchFiles }) {
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
          <ul className="flex flex-col gap-3">
            {data.files.map((file) => (
              <li
                key={file.id}
                data-admin-search-file={file.id}
                className="grid gap-x-6 gap-y-3 rounded-card border border-divider bg-surface p-4 md:grid-cols-[12rem_minmax(0,1fr)_10rem_9rem]"
              >
                <dl className="contents">
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-meta text-muted">{COPY.buyer}</dt>
                    <dd className="text-control">
                      <span dir="ltr" className="wrap-anywhere">
                        {file.buyer}
                      </span>
                    </dd>
                    <dd className="text-secondary text-muted">
                      <bdi>{file.name}</bdi>
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-meta text-muted">{COPY.search}</dt>
                    <dd>
                      <Chips chips={file.chips} unreadable={!file.readable} />
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-meta text-muted">{COPY.matches}</dt>
                    <dd className="text-control">
                      <Matches file={file} />
                    </dd>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <dt className="text-meta text-muted">{COPY.state}</dt>
                    <dd className="flex flex-col items-start gap-1">
                      <span
                        className={`inline-flex rounded-badge px-2 py-0.5 text-label font-medium ${STATE_TONES[file.state]}`}
                      >
                        {COPY.states[file.state]}
                      </span>
                      <span className="text-meta text-muted">
                        {COPY.created} {formatDate(file.createdAt)}
                      </span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
