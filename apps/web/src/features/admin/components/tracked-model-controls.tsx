'use client';

import Link from 'next/link';
import { useActionState, useLayoutEffect, useId, useState } from 'react';
import { RovingGroup } from '@/components/ui/roving-group';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldMessage } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { changeTrackedModelAction } from '@/features/admin/tracked-model-actions';
import type { ChangeTrackedState } from '@/features/admin/tracked-model-types';
import { PRIORITY_LABELS, TRACKED_MODELS_COPY as COPY } from '@/features/admin/tracked-models-admin-copy';
import { TRACKED_PRIORITIES, type TrackedIntent, type TrackedPriority } from '@/lib/tracked-models-rules';

// The controls of one tracked model (CS-53): its priority, pause or resume, and removal. Every press sends the state it
// wants (never a toggle), so the screen changes nothing the person has not seen and a second press changes nothing.
// Removing asks once, in place, before it sends; a model that an approved crawl request made and that is not read yet is
// taken back by declining the request, so its removal is replaced by the way there. The line under the controls says
// what happened, politely, in a live region that announces a repeated answer again.

const IDLE: ChangeTrackedState = { status: 'idle' };

type Props = {
  modelId: number;
  trimId: number | null;
  carName: string;
  state: 'tracking' | 'paused';
  priority: TrackedPriority;
  /** An approved request made it and its model has not been read yet: it is declined, not removed. */
  heldByRequest: boolean;
};

function describe(
  result: ChangeTrackedState,
): { message: string; tone: 'success' | 'neutral' | 'warning' | 'danger' } | undefined {
  switch (result.status) {
    case 'idle':
      return undefined;
    case 'changed': {
      const kind = result.intent.startsWith('priority:')
        ? 'priority'
        : (result.intent as 'track' | 'pause' | 'resume' | 'untrack');
      return { message: COPY.result.changed[kind], tone: 'success' };
    }
    case 'unchanged':
      return { message: COPY.result.unchanged, tone: 'neutral' };
    case 'missing':
      return { message: COPY.result.missing, tone: 'warning' };
    case 'blocked':
      return { message: COPY.result.blocked, tone: 'warning' };
    case 'failed':
      return { message: COPY.result.failed, tone: 'danger' };
    case 'invalid':
      return { message: COPY.result.invalid, tone: 'danger' };
  }
}

function IntentButton({
  intent,
  className,
  pressed,
  describedBy,
  children,
}: {
  intent: TrackedIntent;
  className: string;
  pressed?: boolean;
  describedBy: string;
  children: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  // Only the button that was pressed turns its spinner; the others of the form wait quietly.
  const mine = pending && data.get('intent') === intent;
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      aria-pressed={pressed}
      aria-describedby={describedBy}
      aria-disabled={pending || pressed === true}
      data-pending={mine ? '' : undefined}
      {...(intent.startsWith('priority:') ? { 'data-roving-item': '' } : {})}
      data-intent={intent}
      onClick={(event) => {
        // The state it already is in, or a press still being answered, sends nothing.
        if (pending || pressed === true) event.preventDefault();
      }}
      className={`group relative ${className}`}
    >
      {children}
      <span className="absolute inset-e-2 top-1/2 -translate-y-1/2">
        <Spinner />
      </span>
    </button>
  );
}

const SEGMENT =
  'inline-flex min-h-11 flex-1 items-center justify-center px-4 text-label font-medium text-default transition-colors hover:bg-surface-hover aria-pressed:bg-action-subtle aria-pressed:text-on-action-subtle';

export function TrackedModelControls({ modelId, trimId, carName, state, priority, heldByRequest }: Props) {
  const [result, formAction] = useActionState(async (previous: ChangeTrackedState, formData: FormData) => {
    const next = await changeTrackedModelAction(previous, formData);
    // The card is about to leave the page: focus goes to the list's heading, not to the top of the document.
    if (next.status === 'changed' && next.intent === 'untrack') {
      setTimeout(() => {
        document.getElementById('tracked')?.focus();
      }, 200);
    }
    return next;
  }, IDLE);
  const [confirming, setConfirming] = useState(false);
  // An answer closes the confirmation (adjusting state while rendering, not in an effect: react-patterns).
  const [lastAnswer, setLastAnswer] = useState(result);
  if (result !== lastAnswer) {
    setLastAnswer(result);
    if (confirming) setConfirming(false);
  }
  const resultId = useId();
  const groupId = useId();
  const answer = describe(result);

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open confirmation is
  // transient, so it closes with its page instead of greeting the superadmin on the way back.
  useLayoutEffect(
    () => () => {
      setConfirming(false);
    },
    [],
  );

  return (
    <form
      action={formAction}
      data-tracked-controls={`${String(modelId)}:${String(trimId ?? 0)}`}
      className="flex flex-col items-stretch gap-3"
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="trimId" value={trimId ?? ''} />
      {/* A name for the group that says whose priority it is, for a screen reader moving through the cards. */}
      <div className="flex flex-col gap-1">
        <span id={groupId} aria-hidden className="text-label font-medium text-muted">
          {COPY.priority.label}
          <span className="sr-only">{` ${carName}`}</span>
        </span>
        <RovingGroup
          label={`${COPY.priority.label} ${carName}`}
          className="flex divide-x divide-divider overflow-hidden rounded-control border border-control divide-x-reverse"
        >
          {TRACKED_PRIORITIES.map((value) => (
            <IntentButton
              key={value}
              intent={`priority:${value}`}
              pressed={priority === value}
              describedBy={resultId}
              className={SEGMENT}
            >
              {PRIORITY_LABELS[value]}
            </IntentButton>
          ))}
        </RovingGroup>
      </div>
      {confirming ? (
        <div
          role="group"
          tabIndex={-1}
          ref={(node) => {
            node?.focus();
          }}
          aria-label={COPY.controls.untrack}
          className="flex flex-col gap-3 rounded-card border border-danger bg-danger-subtle p-3 outline-none"
        >
          <p className="text-secondary text-pretty text-default">{COPY.controls.confirmUntrack(carName)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <IntentButton
              intent="untrack"
              describedBy={resultId}
              className="inline-flex min-h-12 items-center justify-center rounded-control bg-danger px-6 text-control font-semibold text-on-danger"
            >
              {COPY.controls.confirm}
            </IntentButton>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
              className={actionClasses('tertiary')}
            >
              {COPY.controls.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {heldByRequest ? null : (
            <IntentButton
              intent={state === 'tracking' ? 'pause' : 'resume'}
              describedBy={resultId}
              className={`${actionClasses(state === 'paused' ? 'primary' : 'secondary')} min-w-0 flex-1 sm:flex-none`}
            >
              <span>
                {state === 'tracking' ? COPY.controls.pause : COPY.controls.resume}
                <span className="sr-only">{` ${carName}`}</span>
              </span>
            </IntentButton>
          )}
          {heldByRequest ? null : (
            <button
              type="button"
              data-untrack-open
              onClick={() => {
                setConfirming(true);
              }}
              className={actionClasses('tertiary')}
            >
              {COPY.controls.untrack}
              <span className="sr-only">{` ${carName}`}</span>
            </button>
          )}
        </div>
      )}
      {heldByRequest ? (
        <p className="text-meta text-pretty text-muted">
          {COPY.controls.blocked}{' '}
          <Link href="/admin/crawl-requests?state=approved" prefetch={false} className="text-link underline">
            {COPY.controls.blockedLink}
          </Link>
        </p>
      ) : null}
      <FieldMessage id={resultId} tone={answer?.tone ?? 'neutral'} role="status">
        {/* A new node per answer, so the same answer twice is announced twice. */}
        {answer === undefined || result.status === 'idle' ? null : (
          <span key={result.submission}>{answer.message}</span>
        )}
      </FieldMessage>
    </form>
  );
}
