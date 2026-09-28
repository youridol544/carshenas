// path: src/server/lint-selftest-log-message.ts
// expect: no-restricted-syntax
// expect-message: A log message is a constant sentence
import 'server-only';
import { logger } from '@/server/observability/logger';

export function logWithValuesInTheMessage(listingId: number, source: string) {
  logger.info(`snapshot ${String(listingId)} stored`);
  logger.warn('fetch from ' + source + ' was slow');
}
