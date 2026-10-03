'use client';

import { ImageOff } from 'lucide-react';
import Image from 'next/image';
import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { setModelPhotoAction } from '@/features/admin/model-photo-actions';
import type { ModelPhotoState } from '@/features/admin/model-photo-types';
import { MODEL_PHOTOS_COPY as COPY } from '@/features/admin/model-photos-admin-copy';
import { MAX_PHOTO_LINK_LENGTH, photoLinkProblem } from '@/lib/model-photo-link-rules';

// One model's photo link (CS-97, ADR-0038): the address field, a live preview of what the tile will show, and the two
// presses: save (only once the preview has loaded, so the superadmin has seen the picture) and remove. The preview is a
// plain <img> in the tile's own 4:3 frame, loaded by this browser from the photo's own host with no referrer; nothing
// goes through our server. The line under the form says what happened, politely, in a live region.

const IDLE: ModelPhotoState = { status: 'idle' };

type PreviewStatus = 'loading' | 'loaded' | 'failed';

type Props = { modelId: number; carName: string; savedUrl: string | null };

function describe(
  result: ModelPhotoState,
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

function Press({
  intent,
  level,
  disabled,
  describedBy,
  children,
}: {
  intent: 'set' | 'clear';
  level: 'primary' | 'secondary';
  disabled: boolean;
  describedBy: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      formNoValidate={intent === 'clear'}
      disabled={disabled && !pending}
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      data-intent={intent}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group relative ${actionClasses(level)} disabled:opacity-50`}
    >
      {children}
      <span className="absolute inset-e-3 top-1/2 -translate-y-1/2">
        <Spinner />
      </span>
    </button>
  );
}

export function ModelPhotoEditor({ modelId, carName, savedUrl }: Props) {
  const [result, formAction] = useActionState(setModelPhotoAction, IDLE);
  const [url, setUrl] = useState(savedUrl ?? '');
  // What the preview of an address reported; a status of another address counts as «loading».
  const [reported, setReported] = useState<{ url: string; status: PreviewStatus } | null>(null);
  const fieldId = useId();
  const hintId = useId();
  const resultId = useId();
  const typed = url.trim();
  const problem = typed === '' ? null : photoLinkProblem(typed);
  const showing = typed !== '' && problem === null ? typed : null;
  const status: PreviewStatus | null =
    showing === null ? null : reported?.url === showing ? reported.status : 'loading';
  const answer = describe(result);
  const canSave = showing !== null && status === 'loaded' && showing !== savedUrl;
  // One solid button per row at most, and only while the address differs from what is saved: twelve rows of pale
  // primary buttons would hide the one that matters.
  const changed = typed !== '' && typed !== (savedUrl ?? '');
  const savedFailed = savedUrl !== null && showing === savedUrl && status === 'failed';

  return (
    <form action={formAction} data-photo-form={modelId} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex w-full max-w-48 flex-col gap-1 self-start sm:w-48 sm:shrink-0">
          <span className="text-meta text-muted">{COPY.preview.label}</span>
          <span
            data-photo-preview={status ?? 'empty'}
            className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-inner bg-surface-muted outline-1 -outline-offset-1 outline-photo"
          >
            {showing === null ? (
              <span
                aria-hidden
                className="flex flex-col items-center gap-1 px-2 text-center text-meta text-subtle"
              >
                <Icon icon={ImageOff} size={24} />
              </span>
            ) : (
              // Keyed by the address, so a new address starts a new load with its own result.
              <Image
                key={showing}
                src={showing}
                alt=""
                fill
                sizes="12rem"
                referrerPolicy="no-referrer"
                className="object-cover"
                ref={(image) => {
                  if (image?.complete === true) {
                    const status = image.naturalWidth === 0 ? 'failed' : 'loaded';
                    if (reported?.url !== showing || reported.status !== status)
                      setReported({ url: showing, status });
                  }
                }}
                onLoad={() => {
                  setReported({ url: showing, status: 'loaded' });
                }}
                onError={() => {
                  setReported({ url: showing, status: 'failed' });
                }}
              />
            )}
          </span>
          <span role="status" className="text-meta text-pretty text-muted">
            {status === null
              ? problem === null
                ? COPY.preview.empty
                : COPY.preview.invalid
              : status === 'loading'
                ? COPY.preview.loading
                : status === 'loaded'
                  ? COPY.preview.loaded
                  : savedFailed
                    ? COPY.preview.savedFailed
                    : COPY.preview.failed}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <FieldLabel htmlFor={fieldId}>
            {COPY.field}
            <span className="sr-only">{`: ${carName}`}</span>
          </FieldLabel>
          <input
            id={fieldId}
            name="url"
            type="url"
            inputMode="url"
            dir="ltr"
            value={url}
            maxLength={MAX_PHOTO_LINK_LENGTH + 100}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={COPY.placeholder}
            aria-invalid={problem === null ? undefined : true}
            aria-describedby={hintId}
            onChange={(event) => {
              setUrl(event.currentTarget.value);
            }}
            className={`${inputClasses} text-start`}
          />
          {problem === null ? (
            <FieldHint id={hintId}>{COPY.hint}</FieldHint>
          ) : (
            <FieldMessage id={hintId} tone="danger" role="status">
              {COPY.problems[problem]}
            </FieldMessage>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {changed ? (
              <Press intent="set" level="primary" disabled={!canSave} describedBy={resultId}>
                {savedUrl === null ? COPY.save : COPY.replace}
                <span className="sr-only">{` ${carName}`}</span>
              </Press>
            ) : null}
            {savedUrl === null ? null : (
              <Press intent="clear" level="secondary" disabled={false} describedBy={resultId}>
                {COPY.clear}
                <span className="sr-only">{` ${carName}`}</span>
              </Press>
            )}
          </div>
        </div>
      </div>
      <FieldMessage id={resultId} tone={answer?.tone ?? 'neutral'} role="status">
        {answer === undefined || result.status === 'idle' ? null : (
          <span key={result.submission}>{answer.message}</span>
        )}
      </FieldMessage>
    </form>
  );
}
