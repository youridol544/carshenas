import { ChevronDown } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

// A native <select>, styled as one of our controls: 48 px tall, 16 px text (so a phone never zooms), the control border
// at 3:1, and a chevron drawn over the inline end. A native select is the right control for a short list of steps on a
// phone (the platform's own picker) and on a desktop (arrow keys, type-ahead), costs no script, and is one Tab stop.
// The chevron is decoration; the select's own name says what it chooses. The optional prefix is a word drawn inside the
// start of the field («از», «تا», or an icon), part of the control's look, never its name.

type SelectFieldProps = {
  /** The accessible name: what this select chooses. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  prefix?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  /** For a visible label above the field (`<label htmlFor>`), and for the message line that describes it. */
  id?: string;
  describedBy?: string;
};

export function SelectField({
  label,
  value,
  onChange,
  children,
  prefix,
  disabled,
  name,
  id,
  describedBy,
}: SelectFieldProps) {
  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      {prefix === undefined ? null : (
        <span aria-hidden="true" className="pointer-events-none absolute inset-s-3 text-control text-muted">
          {prefix}
        </span>
      )}
      <select
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        className={`min-h-12 w-full min-w-0 touch-manipulation appearance-none rounded-control border border-control bg-canvas pe-12 text-control text-default ${
          prefix === undefined ? 'ps-3' : 'ps-12'
        }`}
      >
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute inset-e-3 inline-flex text-muted">
        <Icon icon={ChevronDown} />
      </span>
    </span>
  );
}
