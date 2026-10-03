import { SCOPE_STATUS_LABELS } from '@/lib/crawl-requests-copy';
import type { ScopeStatus } from '@/lib/crawl-requests-types';

// A request's state in words, tinted only while it means something (the file state badge's rule): the word is always
// there; the colour reinforces it. Waiting is the one state that asks for patience (warning), approved is good news
// (success), declined is danger-quiet, the rest are neutral.

const TONES = {
  pending: 'bg-warning-subtle text-warning',
  approved: 'bg-success-subtle text-success',
  declined: 'bg-danger-subtle text-danger',
  fulfilled: 'bg-success-subtle text-success',
  tracked: 'bg-surface-muted text-muted',
  none: 'bg-surface-muted text-muted',
} as const satisfies Record<ScopeStatus, string>;

export function RequestStateBadge({ status }: { status: ScopeStatus }) {
  return (
    <span
      data-request-state={status}
      className={`inline-flex shrink-0 rounded-badge px-2 py-0.5 text-label font-medium ${TONES[status]}`}
    >
      {SCOPE_STATUS_LABELS[status]}
    </span>
  );
}
