// The parts of a form field (ui-design SKILL.md, points 7 and 12; mobile-forms.md): a visible label above the input,
// the input 48 px tall with 16 px text, and lines under it for help and for what went wrong. A message line keeps
// one line of height even when empty, so a message appearing never pushes the button down.

/** Classes for an `<input>`: the control border at 3:1, the danger border once validation has run. */
export const inputClasses =
  'min-h-12 w-full rounded-control border border-control bg-canvas px-4 text-control text-default placeholder:text-muted aria-invalid:border-danger';

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-label font-medium text-default">
      {children}
    </label>
  );
}

export function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-secondary text-pretty text-muted">
      {children}
    </p>
  );
}

type FieldMessageProps = {
  id: string;
  tone: 'neutral' | 'danger' | 'success' | 'warning';
  /** Said to screen readers as it changes, without interrupting (warnings and live checks). */
  live?: boolean;
  /** A status message, the answer to what the person just did: a polite live region by its role. */
  role?: 'status';
  children?: React.ReactNode;
};

const TONE = {
  neutral: 'text-muted',
  danger: 'text-danger',
  success: 'text-success',
  warning: 'text-warning',
} as const satisfies Record<FieldMessageProps['tone'], string>;

export function FieldMessage({ id, tone, live = false, role, children }: FieldMessageProps) {
  return (
    <p
      id={id}
      role={role}
      aria-live={live && role === undefined ? 'polite' : undefined}
      className={`flex min-h-lh items-start gap-2 text-secondary text-pretty ${TONE[tone]}`}
    >
      {children}
    </p>
  );
}
