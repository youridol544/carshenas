import type { SpecProblem } from '@/lib/model-spec-rules';

// What the model-spec form answers (CS-99): the outcome the database function gave, a problem with a value, that the
// form was not one this screen rendered, or that the database did not answer. `submission` changes with every answer,
// so the status line announces a repeated answer again.

export type SpecOutcome = 'changed' | 'unchanged' | 'missing';
export type SpecIntent = 'save' | 'remove';

export type ModelSpecState =
  | { status: 'idle' }
  | { status: SpecOutcome | 'failed'; submission: number; intent: SpecIntent }
  | { status: 'problem'; submission: number; problem: SpecProblem }
  | { status: 'invalid'; submission: number };
