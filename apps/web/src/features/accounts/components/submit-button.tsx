'use client';

import { useFormStatus } from 'react-dom';
import { actionClasses } from '@/components/ui/action-link';
import { Spinner } from '@/components/ui/spinner';

// The form's one solid action, full width and 48 px tall (ui-design mobile-forms.md). While the action runs it keeps
// its label and width, says so with aria-disabled (focus stays on it), ignores a second press, and shows the spinner
// in a slot that was always there, at its inline end, so the label stays centred. The slot is as tall as the button
// and centres the icon in it; on a line of text the icon would sit on the baseline, above the middle.
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className={`group relative w-full ${actionClasses('primary')}`}
    >
      {children}
      <span className="absolute inset-y-0 inset-e-4 flex items-center">
        <Spinner />
      </span>
    </button>
  );
}
