import type { PhotoLinkProblem } from '@/lib/model-photo-link-rules';

// What the model-photo form answers (CS-97): the outcome the database function gave, a problem with the address, that the
// form was not one this screen rendered, or that the database did not answer. `submission` changes with every answer.

export type PhotoOutcome = 'changed' | 'unchanged' | 'missing';

export type ModelPhotoState =
  | { status: 'idle' }
  | { status: PhotoOutcome | 'failed'; submission: number; intent: 'set' | 'clear' }
  | { status: 'problem'; submission: number; problem: PhotoLinkProblem }
  | { status: 'invalid'; submission: number };
