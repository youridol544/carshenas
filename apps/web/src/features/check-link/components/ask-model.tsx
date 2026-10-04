'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useEffectEvent, useId, useState, useTransition } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { RequestStateBadge } from '@/components/ui/request-state-badge';
import { SelectField } from '@/components/ui/select-field';
import { Spinner } from '@/components/ui/spinner';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { rememberAsk, takeAsk } from '@/features/check-link/ask-intent';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { askToAddModelAction } from '@/features/check-link/check-link-actions';
import type { AskModelResult, ChoosableModel, ModelRequest } from '@/features/check-link/check-link-types';
import { SEARCH_FILES_PATH, SIGN_IN_PATH, SIGN_UP_PATH, withReturnPath } from '@/lib/return-path';

// «درخواست افزودن این مدل» (CS-115, ADR-0046): the one way forward of an answer for a car Carshenas does not read. A
// signed-in buyer presses once and the request is placed (their file for the model holds it, CS-71); a visitor is told why
// they must sign in, goes, and comes back to this very answer, where the request is placed once by the press they made
// before (ask-intent.ts); the answer then shows where the request stands (placed, accepted, declined with its reason)
// and never offers the action again. When only the make of the car was told, the buyer picks the model among the make's.
// The press is a transition, so the button says it is working and cannot be pressed twice; a failure that trying again can
// help is said beside the button with the way to try again, and the others in the line under it.

const COPY = CHECK_COPY.outside;

type AskModelProps = {
  /** The canonical address of the link: what the server reads the car from again. */
  link: string;
  request: ModelRequest;
  /** The models to choose among when only the make is told; null when the answer names the model. */
  models: readonly ChoosableModel[] | null;
};

function PlacedState({ request, fileId }: { request: ModelRequest; fileId: number | null }) {
  const status = request.status === 'approved' || request.status === 'declined' ? request.status : 'pending';
  const sentence =
    status === 'declined'
      ? [COPY.request.declined, request.reason === null ? null : COPY.request.reason(request.reason)]
          .filter((part) => part !== null)
          .join(' ')
      : COPY.request[status];
  return (
    <div
      data-ask-state={status}
      className="flex flex-col items-start gap-2 rounded-inner border border-divider bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <RequestStateBadge status={status} />
        <p role="status" className="text-control font-medium text-pretty text-default">
          <bdi>{sentence}</bdi>
        </p>
      </div>
      {fileId === null ? null : (
        <Link
          href={`${SEARCH_FILES_PATH}/${String(fileId)}` as Route}
          prefetch={false}
          className="inline-flex min-h-11 items-center text-control text-link underline"
        >
          {COPY.request.file}
        </Link>
      )}
    </div>
  );
}

export function AskModel({ link, request, models }: AskModelProps) {
  const chooserId = useId();
  const messageId = useId();
  const signInId = useId();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [placed, setPlaced] = useState<{ fileId: number } | null>(null);
  const [declined, setDeclined] = useState<{ reason: string | null } | null>(null);
  const modelKey = models === null ? undefined : chosen;
  const returnTo = `/check?link=${encodeURIComponent(link)}`;

  function handle(result: AskModelResult, key: string | undefined) {
    switch (result.status) {
      case 'asked':
      case 'already':
        setPlaced({ fileId: result.fileId });
        return;
      case 'declined':
        setDeclined({ reason: result.reason });
        return;
      case 'signed_out':
        setShowSignIn(true);
        return;
      case 'covered':
        setMessage(COPY.errors.covered);
        return;
      case 'unreadable':
        setMessage(result.message);
        return;
      case 'refused':
        setNotice({
          message: result.message,
          actionLabel: COPY.errors.retry,
          onAction: () => {
            ask(key);
          },
        });
        return;
    }
  }

  function ask(key: string | undefined) {
    setNotice(null);
    setMessage(null);
    start(async () => {
      try {
        const result = await askToAddModelAction({
          link,
          ...(key === undefined || key === '' ? {} : { modelKey: key }),
        });
        handle(result, key);
      } catch {
        setNotice({
          message: COPY.errors.failed,
          actionLabel: COPY.errors.retry,
          onAction: () => {
            ask(key);
          },
        });
      }
    });
  }

  function press() {
    if (pending) return;
    if (models !== null && chosen === '') {
      setMessage(COPY.chooseFirst);
      document.getElementById(chooserId)?.focus();
      return;
    }
    if (!request.signedIn) {
      setMessage(null);
      setShowSignIn(true);
      return;
    }
    ask(modelKey);
  }

  // Back from signing in: the press this tab made before is placed once. Deferred by a tick: in development React mounts,
  // unmounts and mounts every effect once more, and only the last schedule runs; the note is taken (and forgotten) there.
  const placeRemembered = useEffectEvent(() => {
    const remembered = takeAsk(link);
    if (remembered === null) return;
    if (remembered.modelKey !== null) setChosen(remembered.modelKey);
    ask(remembered.modelKey ?? undefined);
  });
  const waiting = request.signedIn && !request.mine && request.status !== 'declined';
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      placeRemembered();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [waiting]);

  if (declined !== null || request.status === 'declined') {
    return (
      <PlacedState
        request={{ ...request, status: 'declined', reason: declined?.reason ?? request.reason }}
        fileId={request.fileId}
      />
    );
  }
  if (placed !== null || request.mine) {
    return (
      <PlacedState
        request={request.mine ? request : { ...request, status: 'pending' }}
        fileId={placed?.fileId ?? request.fileId}
      />
    );
  }

  return (
    <div data-ask-model className="flex w-full flex-col gap-3">
      {models === null ? null : (
        <div className="flex max-w-sm flex-col gap-1">
          <label htmlFor={chooserId} className="text-label font-medium text-default">
            {COPY.chooser}
          </label>
          <SelectField
            id={chooserId}
            label={COPY.chooser}
            value={chosen}
            describedBy={messageId}
            onChange={(value) => {
              setChosen(value);
              setMessage(null);
            }}
          >
            <option value="">{COPY.choosePlaceholder}</option>
            {models.map((model) => (
              <option key={model.key} value={model.key}>
                {model.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          data-ask-model-button
          aria-busy={pending}
          aria-disabled={pending}
          data-pending={pending ? '' : undefined}
          onClick={press}
          className={`${actionClasses('primary')} group relative w-full sm:w-auto`}
        >
          <span className="absolute inset-e-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
          {models === null ? COPY.ask : COPY.askChosen}
        </button>
        {/* The note and the message share one line box: a refusal replaces the note, so nothing moves when it arrives. */}
        <p
          id={messageId}
          role="status"
          className={`min-h-lh text-secondary text-pretty ${message === null ? 'text-muted' : 'text-danger'}`}
        >
          {message ?? COPY.answerComes}
        </p>
      </div>
      {showSignIn ? (
        <div
          role="group"
          aria-labelledby={signInId}
          data-ask-sign-in
          className="flex flex-col gap-3 rounded-inner border border-divider bg-surface p-4"
        >
          <h3 id={signInId} className="text-control font-semibold text-balance">
            {COPY.signIn.title}
          </h3>
          <p className="text-secondary text-pretty text-muted">{COPY.signIn.body}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={withReturnPath(SIGN_IN_PATH, returnTo)}
              onClick={() => {
                rememberAsk(link, modelKey ?? null);
              }}
              className={`${actionClasses('secondary')} sm:flex-1`}
            >
              {COPY.signIn.signIn}
            </Link>
            <Link
              href={withReturnPath(SIGN_UP_PATH, returnTo)}
              onClick={() => {
                rememberAsk(link, modelKey ?? null);
              }}
              className={`${actionClasses('secondary')} sm:flex-1`}
            >
              {COPY.signIn.signUp}
            </Link>
          </div>
        </div>
      ) : null}
      <ToastMessage
        notice={notice}
        dismissLabel={COPY.errors.dismiss}
        onDismiss={() => {
          setNotice(null);
        }}
      />
    </div>
  );
}
