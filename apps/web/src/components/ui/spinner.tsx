import { LoaderCircle } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

// The pending indicator of a control (ui-design craft.md, section 3). It is always rendered and fades in, turning, only
// while an ancestor that has the `group` class also carries `data-pending`, after the pending delay, so a quick answer
// never flashes it; under reduced motion it stays still.
//
// In a button it is an overlay (the default): it sits in the button's inline-end padding, out of the row, so the label
// is the only thing in the flow and stays exactly where it is idle, pending and disabled; a centred label stays
// centred (owner, 2026-10-04). `actionClasses` (action-link.tsx) holds the button's side of it: the anchor
// (`relative`) and the room (`pending-slot`, 2rem of padding when a spinner is inside). Put it as a direct child of
// the button, after the label. A control that is not a centred button, a chip whose slot also takes a check mark,
// asks for `inline`: it then takes its own 16 px slot in the row.

type SpinnerProps = {
  /** In the row, as a slot of its own, instead of overlaying the padding of a button. */
  inline?: boolean;
};

export function Spinner({ inline = false }: SpinnerProps) {
  return (
    <span
      aria-hidden
      data-spinner={inline ? undefined : ''}
      className={`${inline ? 'inline-flex' : 'absolute inset-y-0 inset-e-2 flex items-center'} opacity-0 transition-opacity group-data-pending:opacity-100 group-data-pending:delay-pending`}
    >
      <span className="inline-flex motion-safe:group-data-pending:animate-spin">
        <Icon icon={LoaderCircle} size={16} />
      </span>
    </span>
  );
}
