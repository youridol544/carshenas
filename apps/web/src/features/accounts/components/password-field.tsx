'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { normalizePassword, PASSWORD_MIN_LENGTH, passwordLength } from '@carshenas/accounts/password-rules';
import { hasPersianLetters } from '@carshenas/accounts/username';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ACCOUNT_COPY, charactersToGo, FIELD_IDS } from '@/features/accounts/accounts-copy';
import { CapsLockText } from '@/features/accounts/components/caps-lock-text';

// The password field of both forms (docs/research/2026-09-29-sign-in-and-sign-up-ux.md, section 2). Typed left to
// right inside the right-to-left page, with the show button at its right edge. It warns, never refuses, when the
// keyboard is on Persian or Caps Lock is on; on sign-up it says how many characters are still missing. A browser's
// password manager finds it by `autocomplete` and fills or offers to save it.

type PasswordFieldProps = {
  purpose: 'new' | 'current';
  /** The last answer's problem with the password, shown until it is changed. */
  error?: string;
};

// The show button works only with JavaScript, so it appears once the page has hydrated, into space the input
// already keeps for it.
function subscribeToNothing() {
  return () => undefined;
}

// A screen reader hears the count after a pause in typing, not on every key (GOV.UK's character count).
const COUNT_ANNOUNCEMENT_DELAY_MS = 1_000;

type LineUnderField = { tone: 'danger' | 'warning' | 'neutral'; content: React.ReactNode };

/** One line under the field, the most urgent thing first: the answer's error, then the keyboard, then the count. */
function lineUnderField(state: {
  error: string | undefined;
  persianLetters: boolean;
  capsLock: boolean;
  missing: number;
}): LineUnderField {
  if (state.error !== undefined) return { tone: 'danger', content: state.error };
  if (state.persianLetters) return { tone: 'warning', content: ACCOUNT_COPY.password.persianKeyboard };
  if (state.capsLock)
    return { tone: 'warning', content: <CapsLockText {...ACCOUNT_COPY.password.capsLock} /> };
  // Seen, not said on every key: the delayed live region below says it after a pause.
  if (state.missing > 0)
    return { tone: 'neutral', content: <span aria-hidden>{charactersToGo(state.missing)}</span> };
  return { tone: 'neutral', content: null };
}

export function PasswordField({ purpose, error }: PasswordFieldProps) {
  const id = FIELD_IDS[purpose === 'new' ? 'sign-up' : 'sign-in'].password;
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [persianLetters, setPersianLetters] = useState(false);
  const [length, setLength] = useState(0);
  const [edited, setEdited] = useState(false);
  const [spokenCount, setSpokenCount] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const countTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A timer is the one outside system here: it must not fire after the field is gone.
  useEffect(
    () => () => {
      clearTimeout(countTimer.current);
    },
    [],
  );

  const missing = purpose === 'new' && length > 0 ? PASSWORD_MIN_LENGTH - length : 0;
  const shownError = edited ? undefined : error;

  function handleInput(value: string) {
    setEdited(true);
    setPersianLetters(hasPersianLetters(value));
    const newLength = passwordLength(normalizePassword(value));
    setLength(newLength);
    if (purpose === 'new') {
      clearTimeout(countTimer.current);
      countTimer.current = setTimeout(() => {
        setSpokenCount(
          newLength > 0 && newLength < PASSWORD_MIN_LENGTH
            ? charactersToGo(PASSWORD_MIN_LENGTH - newLength)
            : '',
        );
      }, COUNT_ANNOUNCEMENT_DELAY_MS);
    }
  }

  // Back to dots before the form is sent, so the browser treats what it saves as a password.
  function hideWhenSent(input: HTMLInputElement | null) {
    const form = input?.form;
    if (form === null || form === undefined) return;
    const hide = () => {
      setVisible(false);
    };
    form.addEventListener('submit', hide);
    return () => {
      form.removeEventListener('submit', hide);
    };
  }

  const hintId = `${id}-hint`;
  const messageId = `${id}-message`;
  const message = lineUnderField({ error: shownError, persianLetters, capsLock, missing });
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{ACCOUNT_COPY.password.label}</FieldLabel>
      {purpose === 'new' ? <FieldHint id={hintId}>{ACCOUNT_COPY.password.hint}</FieldHint> : null}
      <div className="relative">
        <input
          ref={hideWhenSent}
          id={id}
          name="password"
          type={visible ? 'text' : 'password'}
          dir="ltr"
          autoComplete={purpose === 'new' ? 'new-password' : 'current-password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={shownError === undefined ? undefined : true}
          aria-describedby={purpose === 'new' ? `${hintId} ${messageId}` : messageId}
          onInput={(event) => {
            handleInput(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            setCapsLock(event.getModifierState('CapsLock'));
          }}
          onBlur={() => {
            setCapsLock(false);
          }}
          className={`${inputClasses} pe-12`}
        />
        <button
          type="button"
          hidden={!hydrated}
          aria-controls={id}
          aria-label={visible ? ACCOUNT_COPY.password.hide : ACCOUNT_COPY.password.show}
          onClick={() => {
            setVisible(!visible);
            setAnnouncement(visible ? ACCOUNT_COPY.password.hidden : ACCOUNT_COPY.password.shown);
          }}
          className="absolute inset-y-0 inset-s-0 flex w-12 items-center justify-center rounded-control text-muted hover:text-default"
        >
          <Icon icon={visible ? EyeOff : Eye} />
        </button>
      </div>
      <FieldMessage id={messageId} tone={message.tone} live={message.tone === 'warning'}>
        {message.content}
      </FieldMessage>
      <span aria-live="polite" className="sr-only">
        {spokenCount}
      </span>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
