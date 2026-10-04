'use client';

import { useActionState, useId, useLayoutEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { decideCrawlRequestAction } from '@/features/admin/crawl-request-actions';
import { CRAWL_REQUESTS_ADMIN_COPY as COPY } from '@/features/admin/crawl-requests-admin-copy';
import type { DecideCrawlRequestState } from '@/features/admin/crawl-request-types';
import { MAX_DECLINE_REASON_LENGTH } from '@/lib/crawl-requests-rules';

// The one control of a crawl request (CS-71): approve, or decline with a reason the buyer reads. The form carries the
// state the page showed, so the screen changes nothing the person has not seen, and sends the chosen state, never a
// toggle. Approving a request someone declined is a reconsideration («تأیید دوباره»). Declining opens the reason field
// in place (no dialog to lose a half-written reason in); while it is open the approve button is gone, because the
// form would otherwise send a reason with an approval. The line under it says what happened, politely.

const IDLE: DecideCrawlRequestState = { status: 'idle' };

type Props = { requestId: number; state: 'pending' | 'approved' | 'declined'; carName: string };

type Result = { message: string; tone: 'neutral' | 'danger' | 'success' | 'warning' };

function describe(state: DecideCrawlRequestState): Result | undefined {
  switch (state.status) {
    case 'idle':
      return undefined;
    case 'changed':
      return { message: COPY.result.changed[state.decision], tone: 'success' };
    case 'unchanged':
      return { message: COPY.result.unchanged[state.decision], tone: 'neutral' };
    case 'stale':
      return { message: COPY.result.stale, tone: 'warning' };
    case 'failed':
      return { message: COPY.result.failed, tone: 'danger' };
    case 'invalid':
      return { message: COPY.result.invalid, tone: 'danger' };
  }
}

function SubmitButton({
  decision,
  level,
  describedBy,
  children,
}: {
  decision: 'approved' | 'declined';
  level: 'primary' | 'secondary';
  describedBy: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      data-decide={decision}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={actionClasses(level)}
    >
      {children}
      <Spinner />
    </button>
  );
}

export function CrawlRequestDecisionForm({ requestId, state, carName }: Props) {
  const [result, formAction] = useActionState(decideCrawlRequestAction, IDLE);
  const [declining, setDeclining] = useState(false);
  const [missingReason, setMissingReason] = useState(false);
  // An answer closes the reason field (adjusting state while rendering, not in an effect: react-patterns).
  const [lastAnswer, setLastAnswer] = useState(result);
  if (result !== lastAnswer) {
    setLastAnswer(result);
    if (declining) setDeclining(false);
  }
  const reasonId = useId();
  const hintId = useId();
  const resultId = useId();
  const answer = describe(result);

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open reason field is
  // transient, so it closes with its page instead of greeting the superadmin on the way back.
  useLayoutEffect(
    () => () => {
      setDeclining(false);
    },
    [],
  );

  return (
    <form
      action={formAction}
      data-decision-form={requestId}
      noValidate
      onSubmit={(event) => {
        // An empty reason is told in Farsi beside the field, not by the browser's own bubble.
        const reason = event.currentTarget.elements.namedItem('reason');
        if (reason instanceof HTMLInputElement && reason.value.trim() === '') {
          event.preventDefault();
          setMissingReason(true);
          reason.focus();
        }
      }}
      className="flex flex-col items-start gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="seenState" value={state} />
      {declining ? (
        <div className="flex w-full max-w-reading flex-col gap-2">
          <FieldLabel htmlFor={reasonId}>{COPY.reasonField}</FieldLabel>
          <input
            id={reasonId}
            name="reason"
            type="text"
            aria-invalid={missingReason ? true : undefined}
            onChange={() => {
              setMissingReason(false);
            }}
            maxLength={MAX_DECLINE_REASON_LENGTH}
            autoComplete="off"
            aria-describedby={hintId}
            // The person just chose to decline: the reason is next, so focus goes to it as it appears.
            ref={(node) => {
              node?.focus();
            }}
            className={inputClasses}
          />
          {missingReason ? (
            <FieldMessage id={hintId} tone="danger" role="status">
              {COPY.reasonEmpty}
            </FieldMessage>
          ) : (
            <FieldHint id={hintId}>{COPY.reasonHint}</FieldHint>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton decision="declined" level="primary" describedBy={resultId}>
              {COPY.declineSubmit}
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setDeclining(false);
              }}
              className={actionClasses('tertiary')}
            >
              {COPY.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {state === 'approved' ? null : (
            <SubmitButton
              decision="approved"
              level={state === 'pending' ? 'primary' : 'secondary'}
              describedBy={resultId}
            >
              <span>
                {state === 'declined' ? COPY.reconsider : COPY.approve}
                <span className="sr-only">{` ${carName}`}</span>
              </span>
            </SubmitButton>
          )}
          {state === 'declined' ? null : (
            <button
              type="button"
              data-decline-open
              onClick={() => {
                setDeclining(true);
              }}
              className={actionClasses('secondary')}
            >
              {COPY.decline}
              <span className="sr-only">{` ${carName}`}</span>
            </button>
          )}
        </div>
      )}
      {declining ? null : <p className="text-meta text-muted">{COPY.approveNotifies}</p>}
      <FieldMessage id={resultId} tone={answer?.tone ?? 'neutral'} role="status">
        {/* A new node per answer, so the same answer twice is announced twice. */}
        {answer === undefined || result.status === 'idle' ? null : (
          <span key={result.submission}>{answer.message}</span>
        )}
      </FieldMessage>
    </form>
  );
}
