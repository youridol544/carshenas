import { formatCountOf } from '@carshenas/locale/format-number';
import { ActionLink } from '@/components/ui/action-link';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { AutoRefresh } from '@/features/admin/components/auto-refresh';
import { CrawlSection } from '@/features/admin/components/crawl-section';
import { JobsSection } from '@/features/admin/components/jobs-section';
import { ListingsSection } from '@/features/admin/components/listings-section';
import { ProblemsSection } from '@/features/admin/components/problems-section';
import { WindowSwitcher } from '@/features/admin/components/window-switcher';
import { WorkerStatusSection } from '@/features/admin/components/worker-status-section';
import type {
  CrawlData,
  JobsData,
  ListingsData,
  ProblemsData,
  WorkerData,
} from '@/features/admin/server/pipeline-queries';

// The worker screen of the superadmin section (CS-41; the owner's layout of 2026-09-30): one page, with the window
// switcher at the top and five sections in the order a person checks them: is the worker alive, what its jobs do,
// what each source's crawl spent and got back, listings in and out, and what went wrong at a source. Every time is
// measured against the database's clock, which the worker section reads.

export type WorkerScreenData = {
  worker: WorkerData;
  jobs: JobsData;
  crawl: CrawlData;
  listings: ListingsData;
  problems: ProblemsData;
};

/**
 * Near the top, what a person must not miss further down: how many sources the crawler holds stopped, with the way to
 * their problems. Amber only while one is stopped.
 */
function StoppedSummary({ data }: { data: ProblemsData }) {
  const stopped = data.sources.filter((source) => source.stop !== null).length;
  if (stopped === 0) return <p className="text-secondary text-muted">{WORKER_COPY.noStopped}</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-3 rounded-control bg-warning-subtle ps-4 pe-2 text-secondary text-warning">
      <span className="py-2">{formatCountOf(stopped, WORKER_COPY.stoppedSummary)}</span>
      <a
        href="#problems-heading"
        className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
      >
        {WORKER_COPY.seeProblems}
      </a>
    </p>
  );
}

export function WorkerScreen({ data }: { data: WorkerScreenData }) {
  const now = data.worker.now;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 pt-8 pb-16">
      <AutoRefresh />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {/* The link's own padding widens its target; pulled back so its text lines up with the heading. */}
          <div className="-ms-2">
            <ActionLink level="tertiary" href="/admin">
              {WORKER_COPY.backToDashboard}
            </ActionLink>
          </div>
          <h1 className="text-title font-bold">{WORKER_COPY.title}</h1>
          <p className="max-w-reading text-secondary text-pretty text-muted">{WORKER_COPY.lead}</p>
        </div>
        <WindowSwitcher current={data.crawl.window} />
        <StoppedSummary data={data.problems} />
      </div>
      <WorkerStatusSection data={data.worker} />
      <JobsSection data={data.jobs} now={now} />
      <CrawlSection data={data.crawl} now={now} />
      <ListingsSection data={data.listings} now={now} />
      <ProblemsSection data={data.problems} />
    </main>
  );
}
