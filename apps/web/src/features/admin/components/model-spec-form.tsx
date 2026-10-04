'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import { toPersianDigits } from '@carshenas/locale/digits';
import { ORIGIN_DEFINITIONS } from '@carshenas/search/specs';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { SpecPress } from '@/features/admin/components/spec-press';
import { setModelSpecAction } from '@/features/admin/model-spec-actions';
import type { ModelSpecState, SpecIntent } from '@/features/admin/model-spec-types';
import { MODEL_SPECS_COPY as COPY } from '@/features/admin/model-specs-admin-copy';
import { readVolumeText } from '@/lib/model-spec-rules';

// One scope's engine volume and origin (CS-99): the volume field, the origin list and two presses: save (only while
// what is typed differs from what is saved and says something) and remove. Every press sends the state it wants
// (ADR-0023), so a second press changes nothing. The line under the form says what happened in a polite live region.

const IDLE: ModelSpecState = { status: 'idle' };

type Props = {
  modelId: number;
  trimId: number | null;
  /** The name read by a screen reader with each control: «پژو ۲۰۶ تیپ ۵». */
  carName: string;
  savedVolumeCc: number | null;
  savedOrigin: string | null;
  /** What shows when the field stays empty: the model's values for a trim, so a person sees what is inherited. */
  inheritedNote?: string;
};

function describe(
  result: ModelSpecState,
): { message: string; tone: 'success' | 'neutral' | 'warning' | 'danger' } | undefined {
  switch (result.status) {
    case 'idle':
      return undefined;
    case 'changed':
      return { message: COPY.result.changed[result.intent], tone: 'success' };
    case 'unchanged':
      return { message: COPY.result.unchanged, tone: 'neutral' };
    case 'missing':
      return { message: COPY.result.missing, tone: 'warning' };
    case 'problem':
      return { message: COPY.problems[result.problem], tone: 'danger' };
    case 'failed':
      return { message: COPY.result.failed, tone: 'danger' };
    case 'invalid':
      return { message: COPY.result.invalid, tone: 'danger' };
  }
}

export function ModelSpecForm({
  modelId,
  trimId,
  carName,
  savedVolumeCc,
  savedOrigin,
  inheritedNote,
}: Props) {
  const [result, formAction] = useActionState(setModelSpecAction, IDLE);
  // The form is sent by hand, not as the form's action: React resets a form after its action, which showed a controlled
  // list's first option again after every save. The same pending state drives the presses.
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState<SpecIntent | null>(null);
  const savedVolumeText = savedVolumeCc === null ? '' : toPersianDigits(String(savedVolumeCc));
  // What the person typed since the last answer; null shows what is saved, so a saved or removed spec is shown at once.
  const [edited, setEdited] = useState<{ volume: string; origin: string } | null>(null);
  const volume = edited?.volume ?? savedVolumeText;
  const origin = edited?.origin ?? savedOrigin ?? '';
  const volumeId = useId();
  const hintId = useId();
  const resultId = useId();
  const read = readVolumeText(volume);
  const problem = read.ok ? null : read.problem;
  const typedVolume = read.ok ? read.cc : null;
  const empty = typedVolume === null && origin === '';
  const changed = typedVolume !== savedVolumeCc || origin !== (savedOrigin ?? '');
  const canSave = problem === null && !empty && changed;
  const answer = describe(result);
  const scope = trimId === null ? 'model' : 'trim';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const { submitter } = event.nativeEvent;
        const data = new FormData(event.currentTarget, submitter);
        setSending(data.get('intent') === 'remove' ? 'remove' : 'save');
        startTransition(() => {
          formAction(data);
        });
      }}
      data-spec-form={trimId === null ? String(modelId) : `${String(modelId)}:${String(trimId)}`}
      data-spec-scope={scope}
      noValidate
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="trimId" value={trimId ?? ''} />
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel htmlFor={volumeId}>
            {COPY.form.volume}
            <span className="sr-only">{`: ${carName}`}</span>
          </FieldLabel>
          <input
            id={volumeId}
            name="volume"
            type="text"
            inputMode="numeric"
            value={volume}
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            placeholder={COPY.form.volumePlaceholder}
            aria-invalid={problem === null ? undefined : true}
            aria-describedby={hintId}
            onChange={(event) => {
              setEdited({ volume: event.currentTarget.value, origin });
            }}
            className={`${inputClasses} text-start`}
          />
          {problem === null ? (
            <FieldHint id={hintId}>{COPY.form.volumeHint}</FieldHint>
          ) : (
            <FieldMessage id={hintId} tone="danger" role="status">
              {COPY.problems[problem]}
            </FieldMessage>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span aria-hidden className="text-label font-medium text-default">
            {COPY.form.origin}
          </span>
          <SelectField
            label={`${COPY.form.origin}: ${carName}`}
            value={origin}
            onChange={(value) => {
              setEdited({ volume, origin: value });
            }}
            name="origin"
          >
            <option value="">{COPY.form.originUnknown}</option>
            {ORIGIN_DEFINITIONS.map((definition) => (
              <option key={definition.value} value={definition.value}>
                {definition.label}
              </option>
            ))}
          </SelectField>
          {inheritedNote === undefined ? null : (
            <p className="text-secondary text-pretty text-muted">{inheritedNote}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SpecPress
          intent="save"
          pending={pending}
          mine={pending && sending === 'save'}
          level="primary"
          disabled={!canSave}
          describedBy={resultId}
        >
          {COPY.form.save}
          <span className="sr-only">{` ${carName}`}</span>
        </SpecPress>
        {savedVolumeCc === null && savedOrigin === null ? null : (
          <SpecPress
            pending={pending}
            mine={pending && sending === 'remove'}
            intent="remove"
            level="secondary"
            disabled={false}
            describedBy={resultId}
            onPress={() => {
              setEdited(null);
            }}
          >
            {COPY.form.clear}
            <span className="sr-only">{` ${carName}`}</span>
          </SpecPress>
        )}
      </div>
      <FieldMessage id={resultId} tone={answer?.tone ?? 'neutral'} role="status">
        {answer === undefined || result.status === 'idle' ? null : (
          <span key={result.submission}>{answer.message}</span>
        )}
      </FieldMessage>
    </form>
  );
}
