import 'server-only';
import type { LogFields, Logger, LogLevel } from '@carshenas/observability/logger';

// For unit tests: a Logger that keeps each line, with its bindings, instead of writing it. A test replaces the app's
// logger module with it (vi.mock) and reads `recordedLines`.

export type RecordedLine = { level: LogLevel; message: string; fields: Record<string, unknown> };

export const recordedLines: RecordedLine[] = [];

export function recordingLogger(bindings: LogFields = {}): Logger {
  const write = (level: LogLevel) => (message: string, fields?: LogFields) => {
    recordedLines.push({ level, message, fields: { ...bindings, ...fields } });
  };
  return {
    trace: write('trace'),
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    fatal: write('fatal'),
    child: (more) => recordingLogger({ ...bindings, ...more }),
    isLevelEnabled: () => true,
    flush: () => Promise.resolve(),
  };
}
