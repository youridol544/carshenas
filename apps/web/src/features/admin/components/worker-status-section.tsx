import { formatDateTime, formatTimeAgo } from '@carshenas/locale/format-date';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import { Card, Code, Stat, WorkerSection } from '@/features/admin/components/worker-section';
import type { WorkerData, WorkerProcess } from '@/features/admin/server/pipeline-queries';

// Whether the worker is alive (CS-41 criterion 1): the state of the whole from its heartbeats, then its latest
// processes, each with its release, since when it ran and when it last beat. A state's colour shows only while it
// holds (craft.md, section 6): green while a process works, red while it is silent, neutral when it shut down cleanly
// or none ever ran.

const BADGE = {
  alive: 'bg-success-subtle text-success',
  silent: 'bg-danger-subtle text-danger',
  stopped: 'bg-surface-hover text-muted',
  never: 'bg-surface-hover text-muted',
} as const satisfies Record<WorkerData['status'], string>;

function StateBadge({ state }: { state: WorkerData['status'] }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center self-start rounded-badge px-2 text-label font-medium ${BADGE[state]}`}
    >
      {WORKER_COPY.status[state]}
    </span>
  );
}

function Process({ process, now }: { process: WorkerProcess; now: string }) {
  const headingId = `process-${process.instanceId}`;
  return (
    <li>
      <Card labelledBy={headingId}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 id={headingId} className="text-control font-semibold">
            <Code>{`${process.hostname}:${String(process.pid)}`}</Code>
          </h4>
          <StateBadge state={process.state} />
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label={WORKER_COPY.version}>
            <Code>{process.version}</Code>
          </Stat>
          <Stat label={process.stoppedAt === null ? WORKER_COPY.runningSince : WORKER_COPY.stoppedAt}>
            {process.stoppedAt === null ? (
              <time dateTime={process.startedAt} title={formatDateTime(process.startedAt)}>
                {formatTimeAgo(process.startedAt, now)}
              </time>
            ) : (
              <time dateTime={process.stoppedAt}>{formatDateTime(process.stoppedAt)}</time>
            )}
          </Stat>
          <Stat label={WORKER_COPY.lastBeat}>
            <time dateTime={process.beatAt} title={formatDateTime(process.beatAt)}>
              {formatTimeAgo(process.beatAt, now)}
            </time>
          </Stat>
        </dl>
      </Card>
    </li>
  );
}

export function WorkerStatusSection({ data }: { data: WorkerData }) {
  return (
    <WorkerSection id="worker-heading" title={WORKER_COPY.worker}>
      <div className="flex flex-col gap-2">
        {/* A status region: the refresh that turns the worker silent says so to a screen reader too. */}
        <p role="status" className="flex">
          <StateBadge state={data.status} />
        </p>
        <p className="max-w-reading text-secondary text-pretty text-muted">
          {WORKER_COPY.statusAdvice[data.status]}
        </p>
      </div>
      {data.processes.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className="text-label font-medium text-muted">{WORKER_COPY.processes}</h3>
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.processes.map((process) => (
              <Process key={process.instanceId} process={process} now={data.now} />
            ))}
          </ul>
        </div>
      )}
    </WorkerSection>
  );
}
