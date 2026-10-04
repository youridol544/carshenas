'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import { COUNTRIES } from '@carshenas/search/specs';
import { FieldMessage } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { setCountryAction } from '@/features/admin/country-actions';
import type { CountryIntent, CountryState } from '@/features/admin/country-types';
import { SpecPress } from '@/features/admin/components/spec-press';
import { COUNTRY_COPY as COPY } from '@/features/admin/country-admin-copy';

// The country of one scope (CS-103, ADR-0041): a make's (the brand's country), or one model's own where it differs from
// its make's. One list from the closed list of countries and two presses: save (only while the choice differs from what
// is saved) and remove. Every press sends the state it wants (ADR-0023), so a second press changes nothing. The line
// under the form says what happened in a polite live region.

const IDLE: CountryState = { status: 'idle' };

type Props = {
  makeId: number;
  /** Set for a model's own country; null for the make's. */
  modelId: number | null;
  /** The name read by a screen reader with each control: «تویوتا», «تویوتا کرولا». */
  name: string;
  savedCountry: string | null;
  /** The list's empty choice: «نامشخص» for a make, «همان کشور برند» for a model. */
  emptyLabel: string;
  label: string;
  /** What the empty choice means here, under the list. */
  hint?: string | undefined;
};

function describe(
  result: CountryState,
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
      return { message: COPY.result.problem, tone: 'danger' };
    case 'failed':
      return { message: COPY.result.failed, tone: 'danger' };
    case 'invalid':
      return { message: COPY.result.invalid, tone: 'danger' };
  }
}

export function CountryForm({ makeId, modelId, name, savedCountry, emptyLabel, label, hint }: Props) {
  const [result, formAction] = useActionState(setCountryAction, IDLE);
  // Sent by hand, not as the form's action: React resets a form after its action, which would show the list's first
  // option again after every save.
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState<CountryIntent | null>(null);
  // What the person chose since the last answer; null shows what is saved.
  const [chosen, setChosen] = useState<string | null>(null);
  const country = chosen ?? savedCountry ?? '';
  const resultId = useId();
  const canSave = country !== '' && country !== (savedCountry ?? '');
  const answer = describe(result);

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
      data-country-form={modelId === null ? `make:${String(makeId)}` : `model:${String(modelId)}`}
      noValidate
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="makeId" value={makeId} />
      <input type="hidden" name="modelId" value={modelId ?? ''} />
      <span aria-hidden className="text-label font-medium text-default">
        {label}
      </span>
      <SelectField label={`${label}: ${name}`} value={country} onChange={setChosen} name="country">
        <option value="">{emptyLabel}</option>
        {COUNTRIES.map((one) => (
          <option key={one.code} value={one.code}>
            {one.label}
          </option>
        ))}
      </SelectField>
      {hint === undefined ? null : <p className="text-secondary text-pretty text-muted">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <SpecPress
          intent="save"
          pending={pending}
          mine={pending && sending === 'save'}
          level="primary"
          disabled={!canSave}
          describedBy={resultId}
        >
          {COPY.save}
          <span className="sr-only">{` ${name}`}</span>
        </SpecPress>
        {savedCountry === null ? null : (
          <SpecPress
            intent="remove"
            pending={pending}
            mine={pending && sending === 'remove'}
            level="secondary"
            disabled={false}
            describedBy={resultId}
            onPress={() => {
              setChosen(null);
            }}
          >
            {COPY.clear}
            <span className="sr-only">{` ${name}`}</span>
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
