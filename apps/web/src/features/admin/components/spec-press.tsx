'use client';

import { actionClasses } from '@/components/ui/action-link';
import { Spinner } from '@/components/ui/spinner';

// A press of a superadmin spec form (CS-99, CS-103): one submit button that sends the state it wants (never a toggle),
// shows its own spinner while the form is on its way, and sends nothing a second time while it is.

type Props = {
  intent: 'save' | 'remove';
  pending: boolean;
  /** This press is the one on its way. */
  mine: boolean;
  level: 'primary' | 'secondary';
  disabled: boolean;
  describedBy: string;
  onPress?: () => void;
  children: React.ReactNode;
};

export function SpecPress({ intent, pending, mine, level, disabled, describedBy, onPress, children }: Props) {
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      formNoValidate={intent === 'remove'}
      disabled={disabled && !pending}
      aria-describedby={describedBy}
      aria-disabled={pending}
      data-pending={mine ? '' : undefined}
      data-intent={intent}
      onClick={(event) => {
        if (pending) event.preventDefault();
        else onPress?.();
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
