import { errorFingerprint, serializeError, type SerializedError } from './errors.ts';
import { redactAndTruncate } from './redact.ts';
import { newReference } from './reference.ts';

// Browser errors, sent to the app's own intake so they land in the same log as the server's (ADR-0016). Uncaught
// errors and unhandled rejections arrive as window events; Next.js dispatches hydration mismatches and errors that
// reach the root layout the same way (window.reportError). An error caught by an error boundary never reaches window,
// so error.tsx reports it itself. Reporting never throws and never writes to the console, which is how the e2e
// harness and the gorilla detect a broken page, and a page sends only a few reports however often it fails.

export type BrowserErrorKind = 'uncaught' | 'unhandledrejection' | 'boundary';

export type BrowserErrorReport = {
  kind: BrowserErrorKind;
  /** The code the error screen shows, so a visitor's report leads to this log line. */
  reference: string;
  /** The page's path and query when the error happened. */
  path: string;
  error: SerializedError;
};

export type BrowserReportingOptions = {
  /** The app's intake route. */
  endpoint: string;
  /** Reports one page load may send; later errors are dropped. */
  maxReports?: number;
  /** Where the error events are heard: the page's window, or an EventTarget in tests. */
  target?: EventTarget;
  /** Sends one report body: sendBeacon, falling back to a keepalive fetch. */
  send?: (endpoint: string, body: string) => void;
  /** The page address to report: location.pathname and location.search. */
  currentPath?: () => string;
};

type Reporting = Required<Omit<BrowserReportingOptions, 'target'>> & {
  sent: number;
  fingerprints: Set<string>;
  reported: WeakSet<object>;
};

// Stack and message limits that keep a report well under the intake's size limit.
const MAX_MESSAGE = 1_000;
const MAX_STACK = 6_000;
const MAX_BODY = 12_000;
const DEFAULT_MAX_REPORTS = 10;
// Noise every error tracker filters: errors from browser extensions, a cross-origin script's blank "Script error.",
// the benign ResizeObserver loop warning and fetches aborted by a navigation.
const EXTENSION_FRAME = /(?:chrome|moz|safari|safari-web)-extension:\/\//;
const NOISE_MESSAGE =
  /^(?:Script error\.?|ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?)$/;

let reporting: Reporting | undefined;
const references = new WeakMap<object, string>();

/**
 * The reference code for an error the page shows: the same code for the same error object every time, so the
 * error screen and the report it sends agree.
 */
export function browserErrorReference(error: unknown): string {
  if (typeof error !== 'object' || error === null) return newReference();
  let reference = references.get(error);
  if (reference === undefined) {
    reference = newReference();
    references.set(error, reference);
  }
  return reference;
}

function isNoise(error: SerializedError): boolean {
  return (
    error.type === 'AbortError' ||
    NOISE_MESSAGE.test(error.message) ||
    (error.stack !== undefined && EXTENSION_FRAME.test(error.stack))
  );
}

function trim(error: SerializedError, depth: number): SerializedError {
  // Cut after redacting, never before: a phone number cut in two is no longer recognised on the server.
  const trimmed: SerializedError = { ...error, message: redactAndTruncate(error.message, MAX_MESSAGE) };
  if (error.stack !== undefined) trimmed.stack = redactAndTruncate(error.stack, MAX_STACK);
  if (error.cause && depth < 2) trimmed.cause = trim(error.cause, depth + 1);
  else delete trimmed.cause;
  if (error.errors && depth < 2)
    trimmed.errors = error.errors.slice(0, 3).map((member) => trim(member, depth + 1));
  else delete trimmed.errors;
  return trimmed;
}

function body(report: BrowserErrorReport): string {
  const full = JSON.stringify({ ...report, error: trim(report.error, 0) });
  if (full.length <= MAX_BODY) return full;
  const { type, message, stack } = report.error;
  return JSON.stringify({
    ...report,
    error: {
      type,
      message: redactAndTruncate(message, MAX_MESSAGE),
      stack: stack === undefined ? undefined : redactAndTruncate(stack, MAX_BODY / 2),
    },
  });
}

function beacon(endpoint: string, payload: string): void {
  const blob = new Blob([payload], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon(endpoint, blob)) return;
  }
  fetch(endpoint, {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

function pagePath(): string {
  return typeof location === 'undefined' ? '' : location.pathname + location.search;
}

/**
 * Reports one browser error, unless this page already reported it or the same bug, reached its report limit, or
 * the error is known noise. Returns the reference code the report carries.
 */
export function reportBrowserError(error: unknown, kind: BrowserErrorKind): string {
  const reference = browserErrorReference(error);
  try {
    const state = reporting;
    if (!state) return reference;
    if (typeof error === 'object' && error !== null) {
      if (state.reported.has(error)) return reference;
      state.reported.add(error);
    }
    const serialized = serializeError(error);
    if (isNoise(serialized)) return reference;
    const fingerprint = errorFingerprint(serialized);
    if (state.fingerprints.has(fingerprint) || state.sent >= state.maxReports) return reference;
    state.fingerprints.add(fingerprint);
    state.sent += 1;
    state.send(state.endpoint, body({ kind, reference, path: state.currentPath(), error: serialized }));
  } catch {
    // A report that cannot be built or sent is dropped: reporting must never break the page it reports on.
  }
  return reference;
}

/** Starts listening for uncaught errors and unhandled rejections; later calls change nothing. */
export function installBrowserErrorReporting(options: BrowserReportingOptions): void {
  if (reporting) return;
  reporting = {
    endpoint: options.endpoint,
    maxReports: options.maxReports ?? DEFAULT_MAX_REPORTS,
    send: options.send ?? beacon,
    currentPath: options.currentPath ?? pagePath,
    sent: 0,
    fingerprints: new Set(),
    reported: new WeakSet(),
  };
  const target = options.target ?? globalThis;
  target.addEventListener('error', (event) => {
    // ErrorEvent types `error` as any; it is whatever was thrown.
    const error: unknown = (event as ErrorEvent).error;
    const { message } = event as ErrorEvent;
    // A failed <img> or <script> load also fires `error`, but only on the element: it has no error or message.
    if (error !== undefined && error !== null) reportBrowserError(error, 'uncaught');
    else if (typeof message === 'string' && message !== '') reportBrowserError(message, 'uncaught');
  });
  target.addEventListener('unhandledrejection', (event) => {
    reportBrowserError((event as PromiseRejectionEvent).reason, 'unhandledrejection');
  });
}

/** Forgets the installed reporter; for tests only. */
export function resetBrowserErrorReportingForTests(): void {
  reporting = undefined;
}
