// A tiny worker for process.test.ts, run by plain Node as the crawler will be: it logs one line, installs the
// process handlers, and then fails the way the first argument says.
import { createLogger } from '../logger.ts';
import { installProcessHandlers } from '../process.ts';

const logger = createLogger({ service: 'carshenas-worker', version: 'test', environment: 'test' });
installProcessHandlers(logger);
// A second copy of the package installing its handlers too must not log the crash twice.
installProcessHandlers(logger);
logger.info('worker started');

if (process.argv[2] === 'rejection') {
  void Promise.reject(new Error('the source answered 429'));
} else {
  setTimeout(() => {
    throw new TypeError('snapshot.price is undefined');
  }, 0);
}
