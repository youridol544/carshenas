import type { TrackedIntent } from '@/lib/tracked-models-rules';

// What the tracked-model forms answer (CS-53): the outcome the database function gave, that the form was not one this
// screen rendered, or that the database did not answer. `submission` changes with every answer, so the status line
// announces a repeated answer again.

export type ChangeOutcome = 'changed' | 'unchanged' | 'missing' | 'blocked';

export type ChangeTrackedState =
  | { status: 'idle' }
  | { status: ChangeOutcome | 'failed'; submission: number; intent: TrackedIntent }
  | { status: 'invalid'; submission: number };
