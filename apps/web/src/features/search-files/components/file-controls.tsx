'use client';

import { Menu } from '@base-ui/react/menu';
import { Ellipsis, Pause, Play } from 'lucide-react';
import { useId, useLayoutEffect, useOptimistic, useState, useTransition, type SubmitEvent } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { FieldLabel, FieldMessage, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { Spinner } from '@/components/ui/spinner';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { StateBadge } from '@/features/search-files/components/state-badge';
import {
  deleteSearchFileAction,
  renameSearchFileAction,
  setSearchFileStateAction,
} from '@/features/search-files/search-files-actions';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import { MAX_NAME_LENGTH, type SearchFileState } from '@/features/search-files/search-files-rules';
import type { FileActionResult } from '@/features/search-files/search-files-types';

// What a buyer does with one file (CS-70 #2): pause and resume at one press, optimistically (the badge changes at once,
// a failure puts it back with a message and a retry; no confirmation for what is reversible), and in a menu: rename (a
// dialog with the name), close the file or open it again, and delete (a dialog that says what goes). Every action sets
// a target state, so a double press or a retry changes nothing twice. The page refreshes after each one.

const COPY = SEARCH_FILES_COPY.actions;

const ITEM_CLASSES =
  'flex min-h-11 w-full items-center rounded-control px-3 text-control text-default data-highlighted:bg-surface-hover';

type FileControlsProps = {
  id: number;
  name: string;
  state: SearchFileState;
  /** Show the state badge: not in a list that is grouped by state, where the group's heading says it. */
  showBadge?: boolean;
};

export function FileControls({ id, name, state, showBadge = true }: FileControlsProps) {
  const [shown, setShown] = useOptimistic(state);
  const [failure, setFailure] = useState<ToastNotice | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, startMoving] = useTransition();

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open dialog is transient.
  useLayoutEffect(
    () => () => {
      setRenaming(false);
      setDeleting(false);
    },
    [],
  );

  function move(target: SearchFileState) {
    setFailure(null);
    startMoving(async () => {
      setShown(target);
      const retry = () => {
        move(target);
      };
      try {
        const result = await setSearchFileStateAction({ id, state: target });
        if (result.status !== 'done')
          setFailure({ message: result.message, actionLabel: COPY.retry, onAction: retry });
      } catch {
        setFailure({ message: COPY.failed, actionLabel: COPY.retry, onAction: retry });
      }
    });
  }

  const toggle =
    shown === 'watching'
      ? { label: COPY.pause, icon: Pause, target: 'paused' as const }
      : { label: shown === 'paused' ? COPY.resume : COPY.reopen, icon: Play, target: 'watching' as const };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showBadge ? <StateBadge state={shown} /> : null}
      <button
        type="button"
        data-file-toggle={toggle.target}
        aria-busy={moving}
        onClick={() => {
          move(toggle.target);
        }}
        className={`${actionClasses('secondary')} gap-2`}
      >
        <Icon icon={toggle.icon} />
        {toggle.label}
      </button>
      <Menu.Root>
        <Menu.Trigger
          aria-label={COPY.menu}
          className="inline-flex size-12 items-center justify-center rounded-control border border-control bg-surface text-default transition-colors hover:bg-surface-hover data-popup-open:bg-surface-pressed"
        >
          <Icon icon={Ellipsis} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="start">
            <Menu.Popup className="flex max-w-(--available-width) min-w-56 flex-col gap-1 rounded-card border border-divider bg-surface p-2 shadow-overlay">
              <Menu.Item
                onClick={() => {
                  setRenaming(true);
                }}
                className={ITEM_CLASSES}
              >
                {COPY.rename}
              </Menu.Item>
              {shown === 'closed' ? null : (
                <Menu.Item
                  onClick={() => {
                    move('closed');
                  }}
                  className={ITEM_CLASSES}
                >
                  {COPY.close}
                </Menu.Item>
              )}
              <Menu.Separator className="my-1 h-px bg-surface-pressed" />
              <Menu.Item
                onClick={() => {
                  setDeleting(true);
                }}
                className={`${ITEM_CLASSES} text-danger`}
              >
                {COPY.delete}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <RenameDialog id={id} name={name} open={renaming} onOpenChange={setRenaming} />
      <DeleteDialog id={id} name={name} open={deleting} onOpenChange={setDeleting} />
      <ToastMessage
        notice={failure}
        dismissLabel={COPY.dismiss}
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </div>
  );
}

type DialogProps = { id: number; name: string; open: boolean; onOpenChange: (open: boolean) => void };

function RenameDialog({ id, name, open, onOpenChange }: DialogProps) {
  const nameId = useId();
  const messageId = useId();
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, startSaving] = useTransition();

  function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const typed = new FormData(event.currentTarget).get('name');
    const next = typeof typed === 'string' ? typed : '';
    startSaving(async () => {
      let result: FileActionResult;
      try {
        result = await renameSearchFileAction({ id, name: next });
      } catch {
        setMessage(COPY.failed);
        return;
      }
      if (result.status === 'done') {
        setMessage(undefined);
        onOpenChange(false);
      } else setMessage(result.message);
    });
  }

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setMessage(undefined);
        onOpenChange(next);
      }}
      title={COPY.renameTitle}
      closeLabel={SEARCH_FILES_COPY.save.close}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={nameId}>{SEARCH_FILES_COPY.save.nameLabel}</FieldLabel>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            maxLength={MAX_NAME_LENGTH}
            defaultValue={name}
            autoComplete="off"
            aria-describedby={messageId}
            aria-invalid={message === undefined ? undefined : true}
            className={inputClasses}
          />
          <FieldMessage id={messageId} tone="danger" role="status">
            {message}
          </FieldMessage>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            aria-disabled={pending}
            data-pending={pending ? '' : undefined}
            className={`${actionClasses('primary')} flex-1`}
          >
            {COPY.renameSubmit}
            <Spinner />
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
            }}
            className={`${actionClasses('secondary')} flex-1`}
          >
            {COPY.cancel}
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}

function DeleteDialog({ id, name, open, onOpenChange }: DialogProps) {
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, startDeleting] = useTransition();

  function confirm() {
    if (pending) return;
    startDeleting(async () => {
      try {
        // On success the action sends the buyer back to the list; nothing returns here.
        const result = await deleteSearchFileAction({ id });
        if (result.status !== 'done') setMessage(result.message);
      } catch {
        setMessage(COPY.failed);
      }
    });
  }

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setMessage(undefined);
        onOpenChange(next);
      }}
      title={COPY.deleteTitle(name)}
      closeLabel={SEARCH_FILES_COPY.save.close}
    >
      <p className="text-body text-pretty text-muted">{COPY.deleteBody}</p>
      <FieldMessage id="delete-file-message" tone="danger" role="status">
        {message}
      </FieldMessage>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          aria-disabled={pending}
          data-pending={pending ? '' : undefined}
          onClick={confirm}
          className="group relative inline-flex min-h-12 flex-1 items-center justify-center rounded-control bg-danger pending-slot px-6 text-control font-semibold text-on-danger transition-colors"
        >
          {COPY.deleteConfirm}
          <Spinner />
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
          }}
          className={`${actionClasses('secondary')} flex-1`}
        >
          {COPY.keep}
        </button>
      </div>
    </ModalSheet>
  );
}
