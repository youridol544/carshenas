'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldMessage } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { Spinner } from '@/components/ui/spinner';
import { changeTrackedModelAction } from '@/features/admin/tracked-model-actions';
import type { ChangeTrackedState } from '@/features/admin/tracked-model-types';
import { PRIORITY_LABELS, TRACKED_MODELS_COPY as COPY } from '@/features/admin/tracked-models-admin-copy';
import type { TrimChoice } from '@/features/admin/server/tracked-model-queries';
import { TRACKED_PRIORITIES, type TrackedPriority } from '@/lib/tracked-models-rules';

// Covering one model that is not covered yet (CS-53): an optional trim (the whole model by default), a priority
// (normal by default) and one button that sends the state it wants. A press that works makes the row leave this list
// and a card appear in the covered one, so the answer that stays in this line is the failure.

const IDLE: ChangeTrackedState = { status: 'idle' };

function Submit({ describedBy, carName }: { describedBy: string; carName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value="track"
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group relative ${actionClasses('secondary')} w-full sm:w-auto`}
    >
      <span>
        {COPY.untracked.track}
        <span className="sr-only">{` ${carName}`}</span>
      </span>
      <span className="absolute inset-e-3 top-1/2 -translate-y-1/2">
        <Spinner />
      </span>
    </button>
  );
}

export function TrackModelForm({
  modelId,
  carName,
  trims,
}: {
  modelId: number;
  carName: string;
  trims: readonly TrimChoice[];
}) {
  const [result, formAction] = useActionState(changeTrackedModelAction, IDLE);
  const [trimId, setTrimId] = useState('');
  const [priority, setPriority] = useState<TrackedPriority>('normal');
  const resultId = useId();
  const failed = result.status === 'failed' || result.status === 'invalid';
  const message =
    result.status === 'unchanged'
      ? COPY.result.unchanged
      : result.status === 'failed'
        ? COPY.result.failed
        : result.status === 'invalid'
          ? COPY.result.invalid
          : null;

  return (
    <form action={formAction} data-track-form={modelId} className="flex flex-col gap-2">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="trimId" value={trimId} />
      <input type="hidden" name="priority" value={priority} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {trims.length === 0 ? null : (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span aria-hidden className="text-meta text-muted">
              {COPY.untracked.trim}
            </span>
            <SelectField label={`${COPY.untracked.trim}: ${carName}`} value={trimId} onChange={setTrimId}>
              <option value="">{COPY.untracked.allTrims}</option>
              {trims.map((trim) => (
                <option key={trim.id} value={String(trim.id)}>
                  {trim.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span aria-hidden className="text-meta text-muted">
            {COPY.untracked.priority}
          </span>
          <SelectField
            label={`${COPY.untracked.priority}: ${carName}`}
            value={priority}
            onChange={(value) => {
              setPriority(value as TrackedPriority);
            }}
          >
            {TRACKED_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>
        <Submit describedBy={resultId} carName={carName} />
      </div>
      <FieldMessage id={resultId} tone={failed ? 'danger' : 'neutral'} role="status">
        {message === null || result.status === 'idle' ? null : <span key={result.submission}>{message}</span>}
      </FieldMessage>
    </form>
  );
}
