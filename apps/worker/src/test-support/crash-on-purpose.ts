// A worker that crashes on purpose, for observability.test.ts: set up as main.ts sets up the real one, then an
// uncaught exception on the line below the marker.
import { installProcessHandlers } from '@carshenas/observability/process';
import { startObservability } from '../observability.ts';

const { logger } = startObservability({
  release: 'test',
  environment: 'test',
  level: 'info',
  format: 'json',
  exportTraces: false,
});
installProcessHandlers(logger);
logger.info('worker started');
setTimeout(() => {
  // crash-marker
  throw new TypeError('snapshot.price is undefined');
}, 0);
