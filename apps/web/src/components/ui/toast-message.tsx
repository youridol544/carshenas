'use client';

import { X } from 'lucide-react';
import { useRef, type FocusEvent } from 'react';
import { Icon } from '@/components/ui/icon';

// One overlay line for a message that must not move the page (ui-design craft.md, section 4): the rollback of an
// optimistic control, with a way to try again. Always mounted, so a screen reader announces what appears in it; it
// stays until it is acted on or dismissed, never on a timer. Pressing one of its buttons removes it, so focus goes
// back to where it came from instead of falling to the page (react-patterns, ui-craft.md section 3).

export type ToastNotice = { message: string; actionLabel: string; onAction: () => void };

type ToastMessageProps = {
  notice: ToastNotice | null;
  dismissLabel: string;
  onDismiss: () => void;
  /** `above-bar`: on a phone, clear of a bar that stays at the bottom of the page (the listing page's). */
  position?: 'default' | 'above-bar';
};

export function ToastMessage({ notice, dismissLabel, onDismiss, position = 'default' }: ToastMessageProps) {
  const returnFocusTo = useRef<HTMLElement | null>(null);

  function rememberOrigin(event: FocusEvent<HTMLButtonElement>) {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.parentElement?.contains(from)) {
      returnFocusTo.current = from;
    }
  }

  function close(then?: () => void) {
    const target = returnFocusTo.current;
    onDismiss();
    then?.();
    if (target?.isConnected) target.focus();
  }

  return (
    <div
      role="status"
      className={`pointer-events-none fixed inset-x-4 flex justify-center ${position === 'above-bar' ? 'bottom-24 z-40 lg:bottom-4' : 'bottom-4 z-10'}`}
    >
      {notice === null ? null : (
        <div className="pointer-events-auto flex max-w-reading items-center gap-2 rounded-card border border-divider bg-surface py-2 ps-4 pe-2 shadow-overlay">
          <p className="text-secondary text-pretty text-danger">{notice.message}</p>
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-control font-semibold text-link transition-colors hover:bg-surface-hover"
            onFocus={rememberOrigin}
            onClick={() => {
              close(notice.onAction);
            }}
          >
            {notice.actionLabel}
          </button>
          <button
            type="button"
            aria-label={dismissLabel}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-hover"
            onFocus={rememberOrigin}
            onClick={() => {
              close();
            }}
          >
            <Icon icon={X} />
          </button>
        </div>
      )}
    </div>
  );
}
