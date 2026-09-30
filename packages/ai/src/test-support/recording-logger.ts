import type { LogFields, Logger, LogLevel } from '@carshenas/observability/logger';

// A Logger that keeps each line with its bindings instead of writing it: the fields exactly as the layer wrote them,
// before the real logger's redaction, so a test sees what the layer itself put in a line.

export type RecordedLine = { level: LogLevel; message: string; fields: Record<string, unknown> };

export function recordingLogger(
  lines: RecordedLine[] = [],
  bindings: LogFields = {},
): Logger & { readonly lines: RecordedLine[] } {
  const write = (level: LogLevel) => (message: string, fields?: LogFields) => {
    lines.push({ level, message, fields: { ...bindings, ...fields } });
  };
  return {
    lines,
    trace: write('trace'),
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    fatal: write('fatal'),
    child: (more) => recordingLogger(lines, { ...bindings, ...more }),
    isLevelEnabled: () => true,
    flush: () => Promise.resolve(),
  };
}
