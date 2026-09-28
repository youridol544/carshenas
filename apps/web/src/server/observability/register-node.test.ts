// @vitest-environment node
import { expect, test } from 'vitest';
import { isReportedRequestErrorPrint } from '@/server/observability/register-node';

// Next.js 16 prints an error it also hands to onRequestError from these two places (next-server.js and
// route-module.js); every other print of an error must still be logged.
const AFTER_THE_HOOK = [
  'Error',
  '    at isReportedRequestErrorPrint (register-node.js:1:1)',
  '    at console.error (console.js:1:1)',
  '    at prefixedLog (log.js:1:1)',
  '    at error (log.js:1:1)',
  '    at NextNodeServer.logError (base-server.js:1:1)',
  '    at NextNodeServer.instrumentationOnRequestError (next-server.js:1411:22)',
].join('\n');
const BEFORE_THE_HOOK = [
  'Error',
  '    at isReportedRequestErrorPrint (register-node.js:1:1)',
  '    at console.error (console.js:1:1)',
  '    at AppRouteRouteModule.onRequestError (route-module.js:307:25)',
].join('\n');
const FALLBACK_PAGE_FAILURE = [
  'Error',
  '    at isReportedRequestErrorPrint (register-node.js:1:1)',
  '    at console.error (console.js:1:1)',
  '    at NextNodeServer.logError (base-server.js:1:1)',
  '    at NextNodeServer.renderErrorToResponseImpl (base-server.js:1905:22)',
].join('\n');

test("Next.js's own print of an error it reports to onRequestError is recognised, before or after the hook", () => {
  const error = new Error('listing 42 has no price');
  expect(isReportedRequestErrorPrint(['⨯', error], AFTER_THE_HOOK)).toBe(true);
  expect(isReportedRequestErrorPrint([error], BEFORE_THE_HOOK)).toBe(true);
});

test('an error Next.js only prints, and a print without an error, are kept', () => {
  expect(
    isReportedRequestErrorPrint(['⨯', new Error('rendering the 500 page failed')], FALLBACK_PAGE_FAILURE),
  ).toBe(false);
  expect(isReportedRequestErrorPrint(['⚠ a warning'], AFTER_THE_HOOK)).toBe(false);
});

test("Next.js's print of a failure of the hook itself is kept", () => {
  expect(
    isReportedRequestErrorPrint(
      ['Error in instrumentation.onRequestError:', new Error('the hook failed')],
      AFTER_THE_HOOK,
    ),
  ).toBe(false);
});
