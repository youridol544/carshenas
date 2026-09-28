import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  browserErrorReference,
  installBrowserErrorReporting,
  reportBrowserError,
  resetBrowserErrorReportingForTests,
  type BrowserErrorReport,
} from './browser.ts';

afterEach(() => {
  resetBrowserErrorReportingForTests();
});

function install(options: { maxReports?: number } = {}) {
  const target = new EventTarget();
  const sent: { endpoint: string; report: BrowserErrorReport }[] = [];
  installBrowserErrorReporting({
    endpoint: '/api/client-errors',
    target,
    send: (endpoint, body) => sent.push({ endpoint, report: JSON.parse(body) as BrowserErrorReport }),
    currentPath: () => '/listings/42?from=search',
    ...options,
  });
  return { target, sent };
}

function errorEvent(error: unknown, message = '') {
  return Object.assign(new Event('error'), { error, message });
}

test('an uncaught error is sent with its kind, reference, page and serialised error', () => {
  const { target, sent } = install();
  const error = new TypeError("Cannot read properties of undefined (reading 'price')");
  target.dispatchEvent(errorEvent(error, error.message));
  assert.equal(sent.length, 1);
  const [{ endpoint, report }] = sent as [{ endpoint: string; report: BrowserErrorReport }];
  assert.equal(endpoint, '/api/client-errors');
  assert.equal(report.kind, 'uncaught');
  assert.equal(report.path, '/listings/42?from=search');
  assert.equal(report.reference, browserErrorReference(error));
  assert.match(report.reference, /^\d{10}$/);
  assert.equal(report.error.type, 'TypeError');
  assert.match(report.error.stack ?? '', /at /);
});

test('an unhandled rejection is sent with its reason', () => {
  const { target, sent } = install();
  target.dispatchEvent(
    Object.assign(new Event('unhandledrejection'), { reason: new Error('search failed') }),
  );
  const [first] = sent;
  assert.ok(first);
  assert.equal(first.report.kind, 'unhandledrejection');
  assert.equal(first.report.error.message, 'search failed');
});

test('an error caught by an error boundary is sent once, with the reference the screen shows', () => {
  const { sent } = install();
  const error = new Error('listing card crashed');
  const shown = browserErrorReference(error);
  assert.equal(reportBrowserError(error, 'boundary'), shown);
  assert.equal(reportBrowserError(error, 'boundary'), shown);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.report.reference, shown);
});

test('an error the boundary reported is not sent again when it also reaches window', () => {
  const { target, sent } = install();
  const error = new Error('root layout crashed');
  reportBrowserError(error, 'boundary');
  target.dispatchEvent(errorEvent(error, error.message));
  assert.equal(sent.length, 1);
});

test('the same bug happening again on the page is sent once', () => {
  const { target, sent } = install();
  for (let listing = 1; listing <= 5; listing += 1) {
    target.dispatchEvent(errorEvent(new Error(`listing ${listing} has no price`)));
  }
  assert.equal(sent.length, 1);
});

test('a page stops sending after its report limit', () => {
  const { sent } = install({ maxReports: 3 });
  for (const message of ['one', 'two', 'three', 'four', 'five'])
    reportBrowserError(new Error(message), 'uncaught');
  assert.deepEqual(
    sent.map(({ report }) => report.error.message),
    ['one', 'two', 'three'],
  );
});

test('noise is not sent: extensions, cross-origin script errors, ResizeObserver and aborted fetches', () => {
  const { target, sent } = install();
  const fromExtension = new Error('extension broke');
  fromExtension.stack = 'Error: extension broke\n    at x (chrome-extension://abcdef/content.js:1:1)';
  target.dispatchEvent(errorEvent(fromExtension));
  target.dispatchEvent(errorEvent(null, 'Script error.'));
  target.dispatchEvent(
    errorEvent(undefined, 'ResizeObserver loop completed with undelivered notifications.'),
  );
  target.dispatchEvent(
    Object.assign(new Event('unhandledrejection'), {
      reason: Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }),
    }),
  );
  assert.equal(sent.length, 0);
});

test('a failed image load, which has no error and no message, is not sent', () => {
  const { target, sent } = install();
  target.dispatchEvent(new Event('error'));
  assert.equal(sent.length, 0);
});

test('a huge stack is trimmed so the report fits the intake limit', () => {
  const { sent } = install();
  const error = new Error('deep recursion');
  error.stack = `Error: deep recursion\n${'    at recurse (https://carshenas.ir/_next/static/chunks/app.js:1:1)\n'.repeat(2_000)}`;
  reportBrowserError(error, 'uncaught');
  assert.ok(JSON.stringify(sent[0]?.report).length <= 12_000);
});

test('reporting before installation, or a sender that throws, never throws', () => {
  assert.match(reportBrowserError(new Error('early'), 'uncaught'), /^\d{10}$/);
  installBrowserErrorReporting({
    endpoint: '/api/client-errors',
    target: new EventTarget(),
    send: () => {
      throw new Error('offline');
    },
    currentPath: () => '/',
  });
  assert.doesNotThrow(() => reportBrowserError(new Error('while offline'), 'uncaught'));
});
