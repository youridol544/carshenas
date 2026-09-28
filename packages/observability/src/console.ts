import { format } from 'node:util';
import { isError } from './errors.ts';
import type { Logger, LogLevel } from './logger.ts';

// Routes console output into the logger, so that in production every line a process writes is one JSON object,
// including what a framework or a library prints through console (Next.js's own warnings and errors, a driver's
// notices). Without it those lines stay plain text, and a multi-line stack trace becomes many log events.

export type ConsoleRoutingOptions = {
  /** Calls to drop entirely, such as a framework's print of an error that is already reported elsewhere. */
  ignore?: (args: readonly unknown[]) => boolean;
};

const METHODS = {
  debug: 'debug',
  log: 'info',
  info: 'info',
  warn: 'warn',
  error: 'error',
  trace: 'debug',
} as const satisfies Record<string, LogLevel>;

type Method = keyof typeof METHODS;

// Next.js bundles server code into several module graphs, so this module can be loaded more than once in one
// process; a process-wide flag keeps a second copy from wrapping console twice (formbricks #8770 hit that).
const ROUTED = Symbol.for('carshenas.observability.console-routed');
type Flagged = typeof globalThis & { [ROUTED]?: boolean };

/**
 * Replaces console.log, info, debug, warn, error and trace; returns a function that puts the originals back. A
 * second call while console is routed changes nothing and returns a function that does nothing.
 */
export function routeConsoleToLogger(logger: Logger, options: ConsoleRoutingOptions = {}): () => void {
  const flagged = globalThis as Flagged;
  if (flagged[ROUTED]) return () => undefined;
  flagged[ROUTED] = true;
  const consoleLogger = logger.child({ logger: 'console' });
  const originals = new Map<Method, (...args: unknown[]) => void>();
  let writing = false;
  for (const method of Object.keys(METHODS) as Method[]) {
    // Read through the descriptor, as Next.js's own console patches do, to keep the exact function for restoring.
    const original = Object.getOwnPropertyDescriptor(console, method)?.value as (...args: unknown[]) => void;
    originals.set(method, original);
    console[method] = (...args: unknown[]) => {
      // A console call made while this one is being logged goes straight to the original: no recursion.
      if (writing) {
        original.apply(console, args);
        return;
      }
      if (options.ignore?.(args)) return;
      writing = true;
      try {
        const error = args.find(isError);
        const rest = error === undefined ? args : args.filter((arg) => arg !== error);
        const message = rest.length > 0 ? format(...rest) : (error?.message ?? '');
        consoleLogger[METHODS[method]](message, error === undefined ? undefined : { err: error });
      } catch {
        original.apply(console, args);
      } finally {
        writing = false;
      }
    };
  }
  return () => {
    for (const [method, original] of originals) console[method] = original;
    flagged[ROUTED] = false;
  };
}
