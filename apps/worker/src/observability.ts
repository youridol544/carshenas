import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createErrorCapture, type ErrorCapture } from '@carshenas/observability/capture';
import {
  createLogger,
  type LogFormat,
  type Logger,
  type LogLevelSetting,
} from '@carshenas/observability/logger';
import { otlpExporter, registerTracing, type Tracing } from '@carshenas/observability/tracing';

// The worker's logger, error capture and tracing (ADR-0016, docs/runbooks/logs-and-errors.md, "The worker"): one
// of each per process, created before anything else runs.

export const SERVICE = 'carshenas-worker';

/** Stack paths are shown from the repository root, so they read `apps/worker/src/…` like the web app's. */
export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export type ObservabilitySettings = {
  readonly release: string;
  readonly environment: string;
  readonly level: LogLevelSetting;
  readonly format: LogFormat;
  readonly exportTraces: boolean;
};

export type Observability = {
  readonly logger: Logger;
  readonly errors: ErrorCapture;
  /** Undefined when another tracer provider was registered first. */
  readonly tracing: Tracing | undefined;
};

/**
 * The build every log line names: CARSHENAS_RELEASE when the deployment sets it, otherwise the commit, marked -dirty
 * when tracked files had uncommitted changes (as the web app does in next.config.ts).
 */
export function releaseOf(fromEnvironment: string | undefined): string {
  if (fromEnvironment) return fromEnvironment;
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const commit = git('rev-parse', '--short=12', 'HEAD');
    return git('status', '--porcelain', '--untracked-files=no') === '' ? commit : `${commit}-dirty`;
  } catch {
    return 'unknown';
  }
}

export function startObservability(settings: ObservabilitySettings): Observability {
  const logger = createLogger({
    service: SERVICE,
    version: settings.release,
    environment: settings.environment,
    level: settings.level,
    format: settings.format,
    sourceRoot: REPOSITORY_ROOT,
  });
  const tracing = registerTracing({
    service: SERVICE,
    version: settings.release,
    environment: settings.environment,
    exporter: settings.exportTraces ? otlpExporter() : undefined,
  });
  return { logger, errors: createErrorCapture(logger), tracing };
}
