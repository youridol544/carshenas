// What the crawl-request decision form answers (CS-71): the outcome the database function gave, or that the form was
// not one this screen rendered, or that the database did not answer. `submission` changes with every answer, so the
// status line announces a repeated answer again.

export type DecideOutcome = 'changed' | 'unchanged' | 'stale';

export type DecideCrawlRequestState =
  | { status: 'idle' }
  | { status: DecideOutcome | 'failed'; submission: number; decision: 'approved' | 'declined' }
  | { status: 'invalid'; submission: number };
