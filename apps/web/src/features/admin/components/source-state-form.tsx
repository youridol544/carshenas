'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { Spinner } from '@/components/ui/spinner';
import { changeSourceStateAction } from '@/features/admin/admin-actions';
import { SOURCE_STATE_RESULT, SOURCES_COPY } from '@/features/admin/admin-copy';
import type { ChangeSourceStateState, ChosenCrawlState, CrawlState } from '@/features/admin/admin-types';

// A source's one control (CS-40): pause an enabled source, resume a paused or stopped one. The form carries what the
// page showed, the state and the stop as the database's text, so the section changes nothing the person has not seen,
// and it sends the chosen state, never a toggle. The button stays the same element in every state, so focus stays on
// it when the page comes back with the new state; the line under it says what happened, politely.

type SourceStateFormProps = {
  sourceId: string;
  crawlState: CrawlState;
  /** The stop the page shows, as the database's text; null when the source is not stopped. */
  stoppedAtText: string | null;
};

const IDLE: ChangeSourceStateState = { status: 'idle' };

// The colours of components/ui/field.tsx's message line: a state's colour only while it holds.
const TONE = {
  neutral: 'text-muted',
  danger: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
} as const;

type Tone = keyof typeof TONE;

function describe(state: ChangeSourceStateState): { message: string; tone: Tone } | undefined {
  switch (state.status) {
    case 'idle':
      return undefined;
    case 'changed':
      return { message: SOURCE_STATE_RESULT.changed[state.chosen], tone: 'success' };
    case 'unchanged':
      return { message: SOURCE_STATE_RESULT.unchanged[state.chosen], tone: 'neutral' };
    case 'stale':
      return { message: SOURCE_STATE_RESULT.stale, tone: 'warning' };
    case 'not_crawled':
      return { message: SOURCE_STATE_RESULT.not_crawled, tone: 'danger' };
    case 'invalid':
      return { message: SOURCE_STATE_RESULT.invalid, tone: 'danger' };
  }
}

/**
 * While the answer is on its way the button keeps its label and width, says so with aria-disabled (focus stays on it),
 * ignores another press, and turns the spinner in its reserved slot after the pending delay.
 */
function ChoiceButton({ chosen }: { chosen: ChosenCrawlState }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="chosen"
      value={chosen}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group gap-2 ${actionClasses('secondary')}`}
    >
      {chosen === 'paused' ? SOURCES_COPY.pause : SOURCES_COPY.resume}
      <Spinner />
    </button>
  );
}

export function SourceStateForm({ sourceId, crawlState, stoppedAtText }: SourceStateFormProps) {
  const [state, formAction] = useActionState(changeSourceStateAction, IDLE);
  const result = describe(state);
  const toneClass = TONE[result === undefined ? 'neutral' : result.tone];
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="seenState" value={crawlState} />
      <input type="hidden" name="seenStoppedAt" value={stoppedAtText ?? ''} />
      <ChoiceButton chosen={crawlState === 'enabled' ? 'paused' : 'enabled'} />
      {/* A status message, so a polite live region; always one line tall, so an answer never pushes the history
          down. A new node per answer, so the same answer twice is announced twice. */}
      <p role="status" className={`min-h-lh text-secondary text-pretty ${toneClass}`}>
        {result === undefined || state.status === 'idle' ? null : (
          <span key={state.submission}>{result.message}</span>
        )}
      </p>
    </form>
  );
}
