import type { Logger } from './logger.ts';

// For a standalone Node.js process such as the crawler worker. An uncaught exception or an unhandled rejection
// means the process is in an unknown state (Joyent's "programmer errors"): write one fatal line with the error and
// exit, and let the supervisor restart it. The destination is synchronous, so the line is out before the exit.
// Next.js installs its own handlers; the web app does not call this.

export type ProcessHandlerOptions = {
  /** How to end the process; tests pass a spy. */
  exit?: (code: number) => void;
};

/** Logs fatal and exits with 1 on an uncaught exception or unhandled rejection; returns a function to remove them. */
export function installProcessHandlers(logger: Logger, options: ProcessHandlerOptions = {}): () => void {
  const exit =
    options.exit ??
    ((code: number) => {
      process.exit(code);
    });
  const onUncaughtException = (error: Error, origin: string) => {
    logger.fatal('uncaught exception, exiting', { err: error, origin });
    exit(1);
  };
  const onUnhandledRejection = (reason: unknown) => {
    logger.fatal('unhandled promise rejection, exiting', { err: reason });
    exit(1);
  };
  process.on('uncaughtException', onUncaughtException);
  process.on('unhandledRejection', onUnhandledRejection);
  return () => {
    process.off('uncaughtException', onUncaughtException);
    process.off('unhandledRejection', onUnhandledRejection);
  };
}
