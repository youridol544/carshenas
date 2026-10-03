'use client';

import { ClipboardPaste, Link2, X } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { InfoPopover } from '@/components/ui/info-popover';
import { Spinner } from '@/components/ui/spinner';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { problemOf } from '@/features/check-link/link-problem';
import { canonicalDivarAddress, MAX_PASTE_LENGTH, readPastedLink } from '@/features/check-link/link-parse';

// The box that takes a listing's link (CS-65): on the home page's hero, under the search page's title and on /check. It is a
// real GET form to /check (so a submit before the script has loaded still goes to the answer), made quicker once it has: a paste
// that is a link is checked at once, a paste that is not one is answered at once, the clipboard button pastes in one tap
// where the browser allows reading it, and the wait for the answer is a spinner in the button and a spoken status line.
// The same reader as the server's (link-parse.ts) decides what the text is, so a wrong paste never makes a round trip;
// the server reads it again and trusts nothing. What is wrong is derived from the text last sent, not stored: typing again
// clears it.

const COPY = CHECK_COPY;

const subscribeNothing = () => () => undefined;
const canReadClipboard = () => 'clipboard' in navigator && typeof navigator.clipboard.readText === 'function';
const cannotReadClipboard = () => false;

type PasteLinkFormProps = {
  /** The link the address already carries (the answer page); empty elsewhere. */
  initial?: string;
  /** A line under the label that says why to paste; the answer page has its own. */
  lead?: string | undefined;
  /** The search page's form: no label above the box (the placeholder says what it takes and is its accessible name), the info control sits beside the box and the status line takes no room until it has something to say. */
  compact?: boolean;
  /** The button is the page's solid primary action (the answer page); elsewhere another action holds that place, so it is outlined. */
  primary?: boolean;
};

export function PasteLinkForm({ initial = '', lead, compact = false, primary = false }: PasteLinkFormProps) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [sent, setSent] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [pending, startTransition] = useTransition();
  const clipboard = useSyncExternalStore(subscribeNothing, canReadClipboard, cannotReadClipboard);
  const problem = sent === null ? null : problemOf(readPastedLink(sent));

  function send(value: string) {
    setSent(value);
    setDenied(false);
    const reading = readPastedLink(value);
    if (reading.kind !== 'divar_listing') {
      input.current?.focus();
      return;
    }
    startTransition(() => {
      router.push(`/check?link=${encodeURIComponent(canonicalDivarAddress(reading.token))}` as Route);
    });
  }

  function take(value: string) {
    setText(value);
    send(value);
  }

  return (
    <form
      action="/check"
      method="get"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) send(text);
      }}
      className="flex flex-col gap-2"
    >
      {compact ? null : (
        <div className="flex items-center gap-1">
          <label htmlFor={id} className="text-label font-semibold text-default">
            {COPY.label}
          </label>
          <InfoPopover label={COPY.info.label} closeLabel={COPY.info.close} content={COPY.info.content} />
        </div>
      )}
      {lead === undefined ? null : <p className="-mt-1 text-secondary text-pretty text-muted">{lead}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex min-w-0 flex-1 basis-48 items-center">
          <span aria-hidden="true" className="pointer-events-none absolute inset-s-3 inline-flex text-muted">
            <Icon icon={Link2} />
          </span>
          <input
            ref={input}
            id={id}
            aria-label={compact ? COPY.label : undefined}
            name="link"
            type="text"
            // The address is read left to right and sits at the reading start of a right-to-left page.
            dir="ltr"
            inputMode="url"
            value={text}
            readOnly={pending}
            maxLength={MAX_PASTE_LENGTH}
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={compact ? COPY.label : COPY.placeholder}
            aria-invalid={problem === null ? undefined : true}
            aria-describedby={`${id}-message`}
            onChange={(event) => {
              setText(event.currentTarget.value);
              setSent(null);
              setDenied(false);
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text');
              if (readPastedLink(pasted).kind === 'empty') return;
              event.preventDefault();
              take(pasted.trim());
            }}
            className={`min-h-12 w-full min-w-0 rounded-control border border-control bg-canvas ps-12 pe-12 text-end text-control text-default placeholder:text-subtle aria-invalid:border-danger ${compact ? 'lg:min-h-11' : ''}`}
          />
          {text !== '' ? (
            <button
              type="button"
              aria-label={COPY.clear}
              onClick={() => {
                setText('');
                setSent(null);
                input.current?.focus();
              }}
              className="absolute inset-e-1 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
            >
              <Icon icon={X} />
            </button>
          ) : clipboard ? (
            <button
              type="button"
              aria-label={COPY.pasteLabel}
              onClick={() => {
                navigator.clipboard.readText().then(
                  (value) => {
                    if (readPastedLink(value).kind === 'empty') input.current?.focus();
                    else take(value.trim());
                  },
                  () => {
                    // Reading the clipboard was refused: the box is where the buyer pastes, as always.
                    setDenied(true);
                    input.current?.focus();
                  },
                );
              }}
              className="absolute inset-e-1 inline-flex size-11 items-center justify-center rounded-full text-link transition-colors hover:bg-surface-hover"
            >
              <Icon icon={ClipboardPaste} />
            </button>
          ) : null}
        </div>
        {compact ? (
          <InfoPopover label={COPY.info.label} closeLabel={COPY.info.close} content={COPY.info.content} />
        ) : null}
        <button
          type="submit"
          data-pending={pending ? '' : undefined}
          aria-disabled={pending}
          className={`${actionClasses(primary ? 'primary' : 'secondary')} group w-full gap-2 sm:w-auto ${compact ? 'lg:min-h-11' : ''}`}
        >
          {COPY.submit}
          <Spinner />
        </button>
      </div>
      {/* The status line answers what was just done; in the compact form it takes no room until it has something to say. */}
      <p
        id={`${id}-message`}
        role="status"
        className={`flex items-start gap-2 text-secondary text-pretty ${compact ? 'empty:hidden' : 'min-h-lh'} ${problem === null && !denied ? 'text-muted' : 'text-danger'}`}
      >
        {pending ? COPY.busy : (problem ?? (denied ? COPY.pasteDenied : null))}
      </p>
    </form>
  );
}
