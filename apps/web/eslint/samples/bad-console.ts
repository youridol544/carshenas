// path: src/server/lint-selftest-console.ts
// expect: no-console
import 'server-only';

export function reportedTheOldWay(error: unknown) {
  console.error('[db] an idle connection failed', error);
}
