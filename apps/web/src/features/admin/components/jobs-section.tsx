import { formatDateTime, formatTimeAgo } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { DEAD_LETTER_QUEUE_LABEL, JOB_STATE_LABEL, WORKER_COPY } from '@/features/admin/admin-copy';
import { JobStateForm } from '@/features/admin/components/job-state-form';
import { StableFailureList } from '@/features/admin/components/stable-failure-list';
import { Card, Code, WorkerSection } from '@/features/admin/components/worker-section';
import type { DeadLetter, FailedJob, JobError, JobsData } from '@/features/admin/server/pipeline-queries';
import type { JobState } from '@/server/db/pgboss-types';

// The worker's jobs (CS-41 criterion 2): every queue with its jobs by state, the latest failures with their error and
// trace id and the one thing a person can do about each (retry a job out of attempts, cancel one waiting to run
// again), the jobs set aside in the dead-letter queue, and who retried or cancelled what lately.

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

const STATES = [
  'created',
  'active',
  'retry',
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly JobState[];

function QueueName({ queue }: { queue: string }) {
  return queue === 'dead-letter' ? <>{DEAD_LETTER_QUEUE_LABEL}</> : <Code>{queue}</Code>;
}

function ErrorLines({ error }: { error: JobError }) {
  return (
    <div className="flex flex-col gap-1">
      {error.type === null && error.message === null ? (
        <p className="text-secondary text-muted">{WORKER_COPY.noMessage}</p>
      ) : (
        <p className="text-secondary text-danger">
          <Code>{[error.type, error.message].filter((part) => part !== null).join(': ')}</Code>
        </p>
      )}
      <p className="text-meta text-muted">
        {error.traceId === null ? (
          WORKER_COPY.noTraceId
        ) : (
          <>
            {`${WORKER_COPY.traceId}: `}
            <Code>{error.traceId}</Code>
          </>
        )}
      </p>
    </div>
  );
}

function Failure({ job, now }: { job: FailedJob; now: string }) {
  const lineId = `job-${job.id}`;
  return (
    <>
      <div id={lineId} className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-control font-semibold">
          <Code>{job.kind ?? job.queue}</Code>
          <span className="rounded-badge bg-surface-hover px-2 text-label font-medium text-muted">
            {JOB_STATE_LABEL[job.state]}
          </span>
        </p>
        <p className="text-meta text-muted">
          <QueueName queue={job.queue} />
          {` · ${WORKER_COPY.attempt} ${formatCount(job.attempts)} ${WORKER_COPY.of} ${formatCount(job.attemptsAllowed)}`}
          {job.failedAt === null ? null : (
            <>
              {' · '}
              <time dateTime={job.failedAt} title={formatDateTime(job.failedAt)}>
                {formatTimeAgo(job.failedAt, now)}
              </time>
            </>
          )}
        </p>
      </div>
      <ErrorLines error={job.error} />
      {job.internal ? (
        <p className="text-secondary text-muted">{WORKER_COPY.internalQueue}</p>
      ) : (
        <JobStateForm queue={job.queue} jobId={job.id} seenState={job.state} describedBy={lineId} />
      )}
    </>
  );
}

function DeadLetterItem({ job, now }: { job: DeadLetter; now: string }) {
  return (
    <li className="flex flex-col gap-2 border-t border-divider pt-4 first:border-t-0 first:pt-0">
      <p className="text-control font-semibold">
        <Code>{job.kind ?? '—'}</Code>
      </p>
      <p className="text-meta text-muted">
        {`${WORKER_COPY.fromQueue} `}
        {job.fromQueue === null ? '—' : <Code>{job.fromQueue}</Code>}
        {' · '}
        <time dateTime={job.deadLetteredAt} title={formatDateTime(job.deadLetteredAt)}>
          {formatTimeAgo(job.deadLetteredAt, now)}
        </time>
      </p>
      <ErrorLines error={job.error} />
    </li>
  );
}

export function JobsSection({ data, now }: { data: JobsData; now: string }) {
  return (
    <WorkerSection id="jobs-heading" title={WORKER_COPY.jobs}>
      {data.queues.length === 0 ? (
        <p className="text-body text-pretty text-muted">{WORKER_COPY.noJobs}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-divider p-4">
          <h3 id="queues-caption" className="text-control font-semibold">
            {WORKER_COPY.queuesCaption}
          </h3>
          {/* A phone lists each queue on its own lines; from 640 px one table holds them all. */}
          <ul aria-labelledby="queues-caption" className="flex flex-col divide-y divide-divider sm:hidden">
            {data.queues.map((queue) => (
              <li key={queue.queue} className="flex flex-col gap-1 py-2">
                <span className="text-control">
                  <QueueName queue={queue.queue} />
                </span>
                <span className="text-meta text-muted tabular-nums">
                  {STATES.map(
                    (state) =>
                      `${JOB_STATE_LABEL[state]}${NO_BREAK_SPACE}${formatCount(queue.counts[state] ?? 0)}`,
                  ).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <table aria-labelledby="queues-caption" className="hidden w-full text-secondary sm:table">
            <thead>
              <tr className="border-b border-divider">
                <th scope="col" className="py-2 pe-3 text-start text-label font-medium text-muted">
                  {WORKER_COPY.queue}
                </th>
                {STATES.map((state) => (
                  <th
                    key={state}
                    scope="col"
                    className="px-3 py-2 text-end text-label font-medium text-muted"
                  >
                    {JOB_STATE_LABEL[state]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {data.queues.map((queue) => (
                <tr key={queue.queue}>
                  <th scope="row" className="py-2 pe-3 text-start font-normal">
                    <QueueName queue={queue.queue} />
                  </th>
                  {STATES.map((state) => (
                    <td key={state} className="px-3 py-2 text-end tabular-nums">
                      {formatCount(queue.counts[state] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card labelledBy="failures-heading" holdRefresh>
          <StableFailureList
            heading={
              <h3 id="failures-heading" className="text-control font-semibold">
                {WORKER_COPY.failures}
              </h3>
            }
            empty={WORKER_COPY.noFailures}
            items={data.failures.map((job) => ({ id: job.id, node: <Failure job={job} now={now} /> }))}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card labelledBy="dead-letters-heading">
            <div className="flex flex-col gap-1">
              <h3 id="dead-letters-heading" className="text-control font-semibold">
                {WORKER_COPY.deadLetters}
              </h3>
              <p className="text-secondary text-pretty text-muted">{WORKER_COPY.deadLettersLead}</p>
            </div>
            {data.deadLetters.length === 0 ? (
              <p className="text-secondary text-pretty text-muted">{WORKER_COPY.noDeadLetters}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {data.deadLetters.map((job) => (
                  <DeadLetterItem key={job.id} job={job} now={now} />
                ))}
              </ul>
            )}
          </Card>
          <Card labelledBy="job-changes-heading">
            <h3 id="job-changes-heading" className="text-control font-semibold">
              {WORKER_COPY.jobChanges}
            </h3>
            {data.changes.length === 0 ? (
              <p className="text-secondary text-pretty text-muted">{WORKER_COPY.noJobChanges}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.changes.map((change) => (
                  <li key={change.id} className="flex flex-col">
                    <span className="text-control">
                      {change.action === 'retry' ? WORKER_COPY.retried : WORKER_COPY.cancelled}
                      {': '}
                      <QueueName queue={change.queue} />
                    </span>
                    <span className="text-meta text-muted">
                      <Code>{change.changedBy}</Code>
                      {' · '}
                      <time dateTime={change.changedAt}>{formatDateTime(change.changedAt)}</time>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </WorkerSection>
  );
}
