'use client';

import { Check, FileSearch } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type SubmitEvent,
} from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { FieldHint, FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ModalSheet, Dialog } from '@/components/ui/modal-sheet';
import { Spinner } from '@/components/ui/spinner';
import {
  createSearchFileAction,
  prepareSearchSaveAction,
} from '@/features/search-files/search-files-actions';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { MAX_NAME_LENGTH, type SearchFileState } from '@/features/search-files/search-files-rules';
import { SEARCH_FILES_PATH, SIGN_IN_PATH, SIGN_UP_PATH, withReturnPath } from '@/lib/return-path';

// «بسپارش به کارشناس» (CS-70, ADR-0030): hands the search it is given to Karshenas as a search file. The button opens a
// dialog (a sheet from the bottom on a phone, a card in the middle on a desktop) and asks the server once what can be
// done: a visitor is asked to sign in or sign up first and comes back to this very search with the dialog open again; a
// buyer who already keeps this search is shown that file instead of a second one; one who has reached the limit is told
// so; every other buyer sees the search as the chips the search page shows, a name to change, and one button. The
// search is passed in its stored form and checked again by the server; the owner is the session's, never this
// component's. It takes the same props wherever it stands (the search page's header and banner, a home row).

const COPY = SEARCH_FILES_COPY.save;

export type SaveSearchButtonProps = {
  /** The search in its stored form (`toStoredSearch`), exactly what the file will keep. */
  search: Record<string, unknown>;
  /** The search as the chips of the search page word it, so the dialog says what is being saved. */
  chips: readonly string[];
  /** The name offered, which the buyer may change. */
  suggestedName: string;
  /** The search page's address for this search: where a visitor returns to after signing in or up. */
  href: string;
  variant: 'button' | 'banner' | 'row';
  /** The button's accessible name where the visible label alone does not say what is saved. */
  accessibleName?: string;
  /** Open on arrival: a visitor came back from signing in to save this search (`?save=1`). */
  openOnArrival?: boolean;
};

type View =
  | { readonly kind: 'preparing' }
  | { readonly kind: 'signed_out' }
  | { readonly kind: 'ready'; readonly message?: string }
  | { readonly kind: 'exists'; readonly file: { id: number; name: string; state: SearchFileState } }
  | { readonly kind: 'limit' }
  | { readonly kind: 'created'; readonly file: { id: number; name: string } }
  | { readonly kind: 'failed' };

const TRIGGER_CLASSES = {
  button: `${actionClasses('secondary')} group relative gap-2`,
  banner: `${actionClasses('primary')} group relative gap-2`,
  row: 'group relative inline-flex min-h-11 max-w-full items-center gap-1 rounded-control px-2 text-control text-link underline',
} as const;

function fileHref(id: number): Route {
  return `${SEARCH_FILES_PATH}/${String(id)}` as Route;
}

export function SaveSearchButton(props: SaveSearchButtonProps) {
  const { variant, accessibleName, openOnArrival = false } = props;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: 'preparing' });
  const [asking, startAsking] = useTransition();
  const arrived = useRef(false);

  function ask() {
    setView({ kind: 'preparing' });
    setOpen(true);
    startAsking(async () => {
      try {
        const answer = await prepareSearchSaveAction(props.search);
        if (answer.status === 'ready') setView({ kind: 'ready' });
        else if (answer.status === 'signed_out') setView({ kind: 'signed_out' });
        else if (answer.status === 'exists') setView({ kind: 'exists', file: answer.file });
        else if (answer.status === 'limit') setView({ kind: 'limit' });
        else setView({ kind: 'failed' });
      } catch {
        setView({ kind: 'failed' });
      }
    });
  }

  // Back from signing in: the address says so (`save=1`), and the dialog opens once, then the address forgets it, so a
  // reload or a shared link does not open it again. It runs once per page; the page it belongs to is the one shown.
  const askOnArrival = useEffectEvent(ask);
  useEffect(() => {
    if (!openOnArrival || arrived.current) return;
    arrived.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('save');
    window.history.replaceState(window.history.state, '', url);
    askOnArrival();
  }, [openOnArrival]);

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open dialog is transient.
  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [],
  );

  return (
    <>
      {variant === 'banner' ? (
        <div className="flex flex-col gap-3 rounded-card border border-divider bg-action-subtle p-4 text-on-action-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-control font-semibold text-balance">{SEARCH_FILES_COPY.banner.title}</p>
            <p className="max-w-reading text-secondary text-pretty">{SEARCH_FILES_COPY.banner.body}</p>
          </div>
          <TriggerButton variant={variant} asking={asking} accessibleName={accessibleName} onPress={ask} />
        </div>
      ) : (
        <TriggerButton variant={variant} asking={asking} accessibleName={accessibleName} onPress={ask} />
      )}
      <ModalSheet open={open} onOpenChange={setOpen} title={titleOf(view)} closeLabel={COPY.close}>
        <DialogBody
          {...props}
          view={view}
          setView={setView}
          close={() => {
            setOpen(false);
          }}
        />
      </ModalSheet>
    </>
  );
}

function titleOf(view: View): string {
  switch (view.kind) {
    case 'signed_out':
      return COPY.signedOutTitle;
    case 'exists':
      return COPY.existsTitle;
    case 'limit':
      return COPY.limitTitle;
    case 'created':
      return COPY.created;
    default:
      return COPY.dialogTitle;
  }
}

type TriggerButtonProps = {
  variant: SaveSearchButtonProps['variant'];
  asking: boolean;
  accessibleName: string | undefined;
  onPress: () => void;
};

function TriggerButton({ variant, asking, accessibleName, onPress }: TriggerButtonProps) {
  return (
    <button
      type="button"
      data-save-search={variant}
      aria-label={accessibleName}
      aria-busy={asking}
      data-pending={asking ? '' : undefined}
      onClick={onPress}
      className={TRIGGER_CLASSES[variant]}
    >
      <Icon icon={FileSearch} />
      <span>{COPY.button}</span>
      <span className="inline-flex w-5 shrink-0">
        <Spinner />
      </span>
    </button>
  );
}

type DialogBodyProps = SaveSearchButtonProps & {
  view: View;
  setView: (view: View) => void;
  close: () => void;
};

function DialogBody({ view, setView, close, search, chips, suggestedName, href }: DialogBodyProps) {
  const returnTo = `${href}${href.includes('?') ? '&' : '?'}save=1`;
  return (
    <>
      {view.kind === 'preparing' ? (
        <div role="status" className="flex min-h-48 flex-col gap-3">
          <span className="sr-only">{COPY.preparing}</span>
          <span aria-hidden className="skeleton-bar h-4 w-5/6" />
          <span aria-hidden className="skeleton-bar h-4 w-2/3" />
          <span aria-hidden className="skeleton-block mt-2 h-12 w-full rounded-control" />
        </div>
      ) : null}
      {view.kind === 'signed_out' ? (
        <>
          <Dialog.Description className="text-body text-pretty text-muted">
            {COPY.signedOutBody}
          </Dialog.Description>
          <ChipList chips={chips} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Link
              href={withReturnPath(SIGN_UP_PATH, returnTo)}
              className={`${actionClasses('primary')} flex-1`}
            >
              {COPY.signUp}
            </Link>
            <Link
              href={withReturnPath(SIGN_IN_PATH, returnTo)}
              className={`${actionClasses('secondary')} flex-1`}
            >
              {COPY.signIn}
            </Link>
          </div>
        </>
      ) : null}
      {view.kind === 'ready' ? (
        <SaveForm
          search={search}
          chips={chips}
          suggestedName={suggestedName}
          message={view.message}
          onResult={setView}
          onCancel={close}
        />
      ) : null}
      {view.kind === 'exists' ? (
        <>
          <Dialog.Description className="text-body text-pretty text-muted">
            {COPY.existsBody(view.file.name, view.file.state)}
          </Dialog.Description>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Link href={fileHref(view.file.id)} className={`${actionClasses('primary')} flex-1`}>
              {COPY.open}
            </Link>
            <button type="button" onClick={close} className={`${actionClasses('secondary')} flex-1`}>
              {COPY.keepSearching}
            </button>
          </div>
        </>
      ) : null}
      {view.kind === 'limit' ? (
        <>
          <Dialog.Description className="text-body text-pretty text-muted">
            {COPY.limitBody}
          </Dialog.Description>
          <Link href={SEARCH_FILES_PATH} className={actionClasses('primary')}>
            {COPY.limitAction}
          </Link>
        </>
      ) : null}
      {view.kind === 'created' ? (
        <>
          <Dialog.Description className="flex items-start gap-3 text-body text-pretty text-muted">
            <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
              <Icon icon={Check} size={16} />
            </span>
            <span>{COPY.createdBody(view.file.name)}</span>
          </Dialog.Description>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Link href={fileHref(view.file.id)} className={`${actionClasses('primary')} flex-1`}>
              {COPY.open}
            </Link>
            <button type="button" onClick={close} className={`${actionClasses('secondary')} flex-1`}>
              {COPY.keepSearching}
            </button>
          </div>
        </>
      ) : null}
      {view.kind === 'failed' ? (
        <>
          <Dialog.Description role="alert" className="text-body text-pretty text-danger">
            {COPY.failed}
          </Dialog.Description>
          <button type="button" onClick={close} className={actionClasses('secondary')}>
            {COPY.close}
          </button>
        </>
      ) : null}
    </>
  );
}

function ChipList({ chips }: { chips: readonly string[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label font-medium text-muted">{COPY.searchLabel}</p>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li
            key={chip}
            className="inline-flex max-w-full items-center rounded-full border border-divider bg-surface-muted px-3 py-1 text-label"
          >
            <bdi className="min-w-0 text-pretty">{chip}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SaveFormProps = {
  search: Record<string, unknown>;
  chips: readonly string[];
  suggestedName: string;
  message: string | undefined;
  onResult: (view: View) => void;
  onCancel: () => void;
};

function SaveForm({ search, chips, suggestedName, message, onResult, onCancel }: SaveFormProps) {
  const nameId = useId();
  const hintId = useId();
  const messageId = useId();
  const [pending, startSaving] = useTransition();

  // onSubmit, not a form action: React resets an action's form, and a name the buyer typed must survive a failure.
  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const typed = new FormData(event.currentTarget).get('name');
    const name = typeof typed === 'string' ? typed : '';
    startSaving(async () => {
      try {
        const result = await createSearchFileAction({ name, search });
        switch (result.status) {
          case 'created':
            onResult({ kind: 'created', file: result.file });
            return;
          case 'exists':
            onResult({ kind: 'exists', file: result.file });
            return;
          case 'limit':
            onResult({ kind: 'limit' });
            return;
          case 'signed_out':
            onResult({ kind: 'signed_out' });
            return;
          case 'invalid':
          case 'failed':
            onResult({ kind: 'ready', message: result.message });
            return;
        }
      } catch {
        onResult({ kind: 'ready', message: COPY.failed });
      }
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Dialog.Description className="text-body text-pretty text-muted">{COPY.dialogLead}</Dialog.Description>
      <ChipList chips={chips} />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={nameId}>{COPY.nameLabel}</FieldLabel>
        <input
          id={nameId}
          name="name"
          type="text"
          required
          maxLength={MAX_NAME_LENGTH}
          defaultValue={suggestedName}
          autoComplete="off"
          aria-describedby={message === undefined ? hintId : `${hintId} ${messageId}`}
          aria-invalid={message === undefined ? undefined : true}
          className={inputClasses}
        />
        <FieldHint id={hintId}>{COPY.nameHint}</FieldHint>
        <FieldMessage id={messageId} tone="danger" role="status">
          {message}
        </FieldMessage>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="submit"
          aria-disabled={pending}
          data-pending={pending ? '' : undefined}
          className={`${actionClasses('primary')} group relative flex-1`}
        >
          {COPY.submit}
          <span className="absolute inset-y-0 inset-e-4 flex items-center">
            <Spinner />
          </span>
        </button>
        <button type="button" onClick={onCancel} className={`${actionClasses('secondary')} flex-1`}>
          {SEARCH_FILES_COPY.actions.cancel}
        </button>
      </div>
    </form>
  );
}
