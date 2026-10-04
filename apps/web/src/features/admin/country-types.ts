// What the country form answers (CS-103): the outcome the database function gave, that nothing was chosen to save, that
// the form was not one this screen rendered, or that the database did not answer. `submission` changes with every
// answer, so the status line announces a repeated answer again.

export type CountryOutcome = 'changed' | 'unchanged' | 'missing';
export type CountryIntent = 'save' | 'remove';

export type CountryState =
  | { status: 'idle' }
  | { status: CountryOutcome | 'failed'; submission: number; intent: CountryIntent }
  | { status: 'problem'; submission: number }
  | { status: 'invalid'; submission: number };
