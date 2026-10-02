import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

// One row of a checkbox or radio list: the whole row, 44 px high, is the control. The native input covers the row,
// invisible, so a tap anywhere on it answers, a screen reader meets a real checkbox or radio, and arrows and the space
// bar work as they do everywhere; the box and its mark are drawn beside it from the input's state (group-has-*). The
// focus ring is drawn on the box, because the input itself is invisible. Nothing changes size or weight when it is
// chosen: the fill and the mark change.

type CheckRowProps = {
  type: 'checkbox' | 'radio';
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The option's words. */
  children: React.ReactNode;
  /** What sits at the row's inline end: a count. */
  trailing?: React.ReactNode;
  name?: string;
  value?: string;
  disabled?: boolean;
};

const BOX =
  'relative inline-flex size-6 shrink-0 items-center justify-center border border-control bg-canvas transition-colors group-has-checked/check:border-action group-has-focus-visible/check:outline-2 group-has-focus-visible/check:outline-offset-2 group-has-focus-visible/check:outline-focus';

export function CheckRow({
  type,
  checked,
  onChange,
  children,
  trailing,
  name,
  value,
  disabled,
}: CheckRowProps) {
  return (
    <label className="group/check relative flex min-h-11 touch-manipulation items-center gap-3 rounded-control px-2 transition-colors select-none hover:bg-surface-hover">
      <input
        type={type}
        checked={checked}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
        className="absolute inset-0 m-0 appearance-none opacity-0"
      />
      {type === 'radio' ? (
        <span aria-hidden="true" className={`${BOX} rounded-full`}>
          <span className="size-3 rounded-full bg-action opacity-0 transition-opacity group-has-checked/check:opacity-100" />
        </span>
      ) : (
        <span aria-hidden="true" className={`${BOX} rounded-badge group-has-checked/check:bg-action`}>
          <span className="inline-flex text-on-action opacity-0 transition-opacity group-has-checked/check:opacity-100">
            <Icon icon={Check} size={16} />
          </span>
        </span>
      )}
      <span className="min-w-0 flex-1 text-control text-pretty">{children}</span>
      {trailing}
    </label>
  );
}
