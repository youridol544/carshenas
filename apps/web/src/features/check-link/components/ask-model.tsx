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
import type {
  AskedModel,
  AskModelResult,
  ChoosableModel,
  ModelRequest,
} from '@/features/check-link/check-link-types';
import { SEARCH_FILES_PATH, SIGN_IN_PATH, SIGN_UP_PATH, withReturnPath } from '@/lib/return-path';

// «درخواست افزودن این مدل» (CS-115, ADR-0046): the one way forward of an answer for a car Carshenas does not read. A
// signed-in buyer presses once and the request is placed (their file for the model holds it, CS-71); a visitor is told why
// they must sign in, goes, and comes back to this very answer, where the request is placed once by the press they made
// before (ask-intent.ts); the answer then shows where the request stands (placed, accepted, declined with its reason)
// and never offers the action again for that model. When only the make of the car was told, the buyer picks the model among
// the make's (the ones already answered are shown with their state and are not in the list). The press is a transition,
// so the button says it is working and cannot be pressed twice; a failure that trying again can help is said in a message
// with the way to try again, and a limit in the line under the button, where the note was.

const COPY = CHECK_COPY.outside;
/** The key of the one model of an answer that names its model. */
const NAMED = '';

type AskModelProps = {
  /** The canonical address of the link: what the server reads the car from again. */
  link: string;
  signedIn: boolean;
  target:
    | { readonly kind: 'model'; readonly name: string; readonly request: ModelRequest }
    | {
        readonly kind: 'make';
        readonly models: readonly ChoosableModel[];
        readonly asked: readonly AskedModel[];
      };
};

type Answered = {
  readonly key: string;
  readonly name: string | null;
  readonly request: ModelRequest;
  readonly fileId: number | null;
};

/** Where one model's request stands, as the answer says it; a `name` says which model when several are shown. */
function PlacedState({
  name,
  request,
  fileId,
}: {
  name: string | null;
  request: ModelRequest;
  fileId: number | null;
}) {
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
      {name === null ? null : (
        <p className="text-control font-semibold text-default">
          <bdi>{name}</bdi>
        </p>
      )}
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

/** The models whose requests the answer says something about: what the server read, then what this press changed. */
function answeredOf(
  target: AskModelProps['target'],
  placedNow: ReadonlyMap<string, number>,
  declinedNow: ReadonlyMap<string, string | null>,
): Answered[] {
  const answered: Answered[] = [];
  if (target.kind === 'model') {
    const placed = placedNow.get(NAMED);
    const declined = declinedNow.get(NAMED);
    const { request } = target;
    if (declined !== undefined) {
      answered.push({
        key: NAMED,
        name: null,
        request: { ...request, status: 'declined', reason: declined },
        fileId: request.fileId,
      });
    } else if (placed !== undefined || request.mine) {
      answered.push({
        key: NAMED,
        name: null,
        request: placed === undefined ? request : { ...request, status: 'pending', mine: true },
        fileId: placed ?? request.fileId,
      });
    } else if (request.status === 'declined') {
      answered.push({ key: NAMED, name: null, request, fileId: null });
    }
    return answered;
  }
  for (const model of target.asked) {
    answered.push({ key: model.key, name: model.name, request: model.request, fileId: model.request.fileId });
  }
  for (const model of target.models) {
    const placed = placedNow.get(model.key);
    const declined = declinedNow.get(model.key);
    if (declined !== undefined) {
      answered.push({
        key: model.key,
        name: model.name,
        request: { status: 'declined', mine: false, reason: declined, fileId: null },
        fileId: null,
      });
    } else if (placed !== undefined) {
      answered.push({
        key: model.key,
        name: model.name,
        request: { status: 'pending', mine: true, reason: null, fileId: placed },
        fileId: placed,
      });
    }
  }
  return answered;
}

export function AskModel({ link, signedIn, target }: AskModelProps) {
  const chooserId = useId();
  const messageId = useId();
  const signInId = useId();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  // What this press changed, until the page is read again: the models asked for now, and the ones found declined.
  const [placedNow, setPlacedNow] = useState<ReadonlyMap<string, number>>(new Map());
  const [declinedNow, setDeclinedNow] = useState<ReadonlyMap<string, string | null>>(new Map());
  const returnTo = `/check?link=${encodeURIComponent(link)}`;
  const isMake = target.kind === 'make';

  const answered = answeredOf(target, placedNow, declinedNow);
  const answeredKeys = new Set(answered.map((one) => one.key));
  const models = target.kind === 'make' ? target.models.filter((model) => !answeredKeys.has(model.key)) : [];
  const offering = target.kind === 'model' ? !answeredKeys.has(NAMED) : models.length > 0;
  const modelKey = isMake ? chosen : undefined;

  function handle(result: AskModelResult, key: string | undefined) {
    const at = key ?? NAMED;
    switch (result.status) {
      case 'asked':
      case 'already':
        setPlacedNow((before) => new Map(before).set(at, result.fileId));
        return;
      case 'declined':
        setDeclinedNow((before) => new Map(before).set(at, result.reason));
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
        if (result.retry) {
          setNotice({
            message: result.message,
            actionLabel: COPY.errors.retry,
            onAction: () => {
              ask(key);
            },
          });
        } else {
          // A limit: trying again would meet it again, so the message stands where the note was.
          setMessage(result.message);
        }
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
    if (isMake && chosen === '') {
      setMessage(COPY.chooseFirst);
      document.getElementById(chooserId)?.focus();
      return;
    }
    if (!signedIn) {
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
  const waiting = signedIn && offering;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      placeRemembered();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [waiting]);

  return (
    <div data-ask-model className="flex w-full flex-col gap-3">
      {answered.map((one) => (
        <PlacedState key={one.key} name={one.name} request={one.request} fileId={one.fileId} />
      ))}
      {!offering ? null : (
        <>
          {!isMake ? null : (
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
              {isMake ? COPY.askChosen : COPY.ask}
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
        </>
      )}
      {showSignIn && offering ? (
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
