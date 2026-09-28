// Routes that fail on purpose, to check on a deployment that errors reach the log with a reference code the
// visitor sees, and that the visitor sees nothing else (ADR-0016, docs/runbooks/logs-and-errors.md). They answer
// 404 unless CARSHENAS_DIAGNOSTICS=1, and e2e/tests/app/observability.spec.ts drives them.

export const DIAGNOSTIC_FAILURES = ['server-render', 'server-action', 'browser'] as const;

export type DiagnosticFailure = (typeof DIAGNOSTIC_FAILURES)[number];

export function isDiagnosticFailure(value: string): value is DiagnosticFailure {
  return (DIAGNOSTIC_FAILURES as readonly string[]).includes(value);
}

/**
 * What the failures throw. It carries a made-up connection string and a made-up mobile number, so a check can see
 * both removed from the log and neither on the page.
 */
export const DIAGNOSTIC_MESSAGE =
  'diagnostic failure on purpose: postgres://diagnostic:not-a-real-secret@db/carshenas, seller 09120000000';

/** How long the slow diagnostics Route Handler takes to answer: long enough for a visitor to leave first. */
export const SLOW_ANSWER_MS = 2_000;
