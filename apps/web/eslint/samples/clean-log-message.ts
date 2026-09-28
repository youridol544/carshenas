// path: src/server/lint-selftest-clean-log-message.ts
// expect: (none)
import 'server-only';
import { logger } from '@/server/observability/logger';

export function logWithValuesInFields(listingId: number, source: string) {
  const log = logger.child({ source });
  log.info('snapshot stored', { listingId });
  logger.warn(`fetch was slow`, { source });
}
