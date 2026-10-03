import { STATE_LABELS } from '@/features/search-files/search-files-copy';
import type { SearchFileState } from '@/features/search-files/search-files-rules';

// A file's state in words, tinted only while it means something: watching is the one live state (success), paused is
// a state that needs the buyer to act (warning), closed is quiet. The word is always there; the colour reinforces it.

const TONES = {
  watching: 'bg-success-subtle text-success',
  paused: 'bg-warning-subtle text-warning',
  closed: 'bg-surface-muted text-muted',
} as const satisfies Record<SearchFileState, string>;

export function StateBadge({ state }: { state: SearchFileState }) {
  return (
    <span
      data-file-state={state}
      className={`inline-flex shrink-0 rounded-badge px-2 py-0.5 text-label font-medium ${TONES[state]}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
