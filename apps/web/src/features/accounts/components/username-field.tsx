'use client';

import { Check } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { hasPersianLetters, normalizeUsername, usernameProblem } from '@carshenas/accounts/username';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ACCOUNT_COPY, FIELD_IDS, usernameErrorMessage } from '@/features/accounts/accounts-copy';
import type { UsernameAvailability, UsernameError } from '@/features/accounts/accounts-types';

// The username field of both forms (docs/research/2026-09-29-sign-in-and-sign-up-ux.md, section 2): Latin, typed left
// to right inside the right-to-left page. On sign-up it says whether the name is free about 400 ms after typing
// stops, cancelling a check that is still out. It says what is wrong with the name once the person leaves the field,
// or at once after an answer found a problem, then again on every key until it is fixed. A Persian letter gets the
// keyboard hint while typing, which becomes the error once the field is left. The server decides on submit either
// way.

type UsernameFieldProps =
  | { purpose: 'sign-in'; defaultValue: string; error?: 'empty'; signInHref?: never }
  | { purpose: 'sign-up'; defaultValue: string; error?: UsernameError; signInHref: Route };

type Check = { status: 'none' } | UsernameAvailability | { status: 'unknown' };

const CHECK_DELAY_MS = 400;
const CHECK_URL = '/api/accounts/username-availability';

function isAvailability(value: unknown): value is UsernameAvailability {
  if (typeof value !== 'object' || value === null || !('status' in value)) return false;
  return ['available', 'taken', 'invalid', 'throttled'].includes(String(value.status));
}

async function askAvailability(username: string, signal: AbortSignal): Promise<Check> {
  const response = await fetch(CHECK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
    signal,
  });
  if (!response.ok) return { status: 'unknown' };
  const answer: unknown = await response.json();
  return isAvailability(answer) ? answer : { status: 'unknown' };
}

export function UsernameField(props: UsernameFieldProps) {
  const { purpose, defaultValue, error } = props;
  const [edited, setEdited] = useState(false);
  const [left, setLeft] = useState(false);
  const [problem, setProblem] = useState<UsernameError | undefined>(undefined);
  const [persianLetters, setPersianLetters] = useState(false);
  const [check, setCheck] = useState<Check>({ status: 'none' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<AbortController | undefined>(undefined);

  // The timer and the request are outside systems: neither may answer after the field is gone.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  function scheduleCheck(username: string) {
    clearTimeout(timer.current);
    inFlight.current?.abort();
    setCheck({ status: 'none' });
    timer.current = setTimeout(() => {
      const controller = new AbortController();
      inFlight.current = controller;
      // A lost connection or an unreadable answer only means the check is not known: sign-up still decides.
      askAvailability(username, controller.signal).then(setCheck, () => {
        if (!controller.signal.aborted) setCheck({ status: 'unknown' });
      });
    }, CHECK_DELAY_MS);
  }

  function handleInput(value: string) {
    setEdited(true);
    setPersianLetters(hasPersianLetters(value));
    const username = normalizeUsername(value);
    const found = usernameProblem(username);
    // A reserved name is the server's to answer, as taken.
    const localProblem = found === 'reserved' ? undefined : found;
    setProblem(localProblem);
    if (purpose !== 'sign-up') return;
    if (localProblem === undefined) {
      scheduleCheck(username);
    } else {
      clearTimeout(timer.current);
      inFlight.current?.abort();
      setCheck({ status: 'none' });
    }
  }

  // After an answer that found a problem, the field is checked on every key, as after leaving it: a first key must
  // not hide an error the name still has.
  const checking = left || error !== undefined;
  const shownError = edited ? (checking ? problem : undefined) : error;
  const id = FIELD_IDS[purpose].username;
  const messageId = `${id}-message`;
  const hintId = `${id}-hint`;

  // A name the live check found taken cannot be used either: it is marked invalid like any error, so the border and
  // the message always agree.
  const taken = shownError === 'taken' || (shownError === undefined && check.status === 'taken');
  const invalid = shownError !== undefined || taken;

  let tone: 'danger' | 'success' | 'warning' | 'neutral' = 'neutral';
  let content: React.ReactNode = null;
  if (taken) {
    tone = 'danger';
    content = (
      <span>
        {ACCOUNT_COPY.username.takenBeforeLink}{' '}
        {props.signInHref === undefined ? null : (
          <Link href={props.signInHref} className="text-link underline">
            {ACCOUNT_COPY.username.takenLink}
          </Link>
        )}
        .
      </span>
    );
  } else if (shownError !== undefined) {
    tone = 'danger';
    content =
      shownError === 'empty' && purpose === 'sign-in'
        ? ACCOUNT_COPY.errors.signInUsernameEmpty
        : usernameErrorMessage(shownError);
  } else if (persianLetters && edited) {
    tone = 'warning';
    content = ACCOUNT_COPY.username.persianKeyboard;
  } else if (check.status === 'available') {
    tone = 'success';
    content = (
      <>
        {/* Centred on the first line, at the size and stroke of the 14 px text beside it. */}
        <span className="flex h-lh shrink-0 items-center">
          <Icon icon={Check} size={16} />
        </span>
        {ACCOUNT_COPY.username.available}
      </>
    );
  } else if (check.status === 'unknown' || check.status === 'throttled') {
    content = ACCOUNT_COPY.username.cannotCheck;
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{ACCOUNT_COPY.username.label}</FieldLabel>
      {purpose === 'sign-up' ? <FieldHint id={hintId}>{ACCOUNT_COPY.username.hint}</FieldHint> : null}
      <input
        id={id}
        name="username"
        type="text"
        dir="ltr"
        defaultValue={defaultValue}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={purpose === 'sign-up' ? `${hintId} ${messageId}` : messageId}
        onInput={(event) => {
          handleInput(event.currentTarget.value);
        }}
        onBlur={(event) => {
          if (event.currentTarget.value.trim() !== '') setLeft(true);
        }}
        className={inputClasses}
      />
      {/* Live from the start (see PasswordField); the field mounts afresh with each answer. */}
      <FieldMessage id={messageId} tone={tone} live>
        {content}
      </FieldMessage>
    </div>
  );
}
