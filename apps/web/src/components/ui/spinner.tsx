import { LoaderCircle } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

// The pending indicator of a control (ui-design craft.md, section 3): its slot is always rendered, so the control
// never changes size; it turns and fades in only while an ancestor carries `data-pending`, after the pending delay,
// so a quick answer never flashes it. Under reduced motion it stays still.

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-flex opacity-0 transition-opacity group-data-pending:opacity-100 group-data-pending:delay-pending motion-safe:group-data-pending:animate-spin"
    >
      <Icon icon={LoaderCircle} />
    </span>
  );
}
