import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { Kysely } from 'kysely';
import type { DB } from '@carshenas/db/db-types';
import type { ErrorCapture } from '@carshenas/observability/capture';
import { recordBeat, recordStart, recordStop, type WorkerInstance } from '../db/heartbeat-store.ts';

// Tells the database the worker is alive (CS-41 criterion 1, the owner's decision of 2026-09-30): a row when the
// process starts, a beat every 15 seconds, and a stop on a clean shutdown. The superadmin section shows the worker as
// down when no running process beat within 45 seconds: three missed beats, so one slow query never flips it. A beat
// that fails is reported and the next one tries again; it never stops the worker.

export const HEARTBEAT_INTERVAL_MS = 15_000;

export type Heartbeat = { readonly instance: WorkerInstance; stop(): Promise<void> };

export async function startHeartbeat(options: {
  db: Kysely<DB>;
  version: string;
  errors: ErrorCapture;
  intervalMs?: number;
}): Promise<Heartbeat> {
  const instance: WorkerInstance = {
    instanceId: randomUUID(),
    hostname: hostname().slice(0, 255) || 'unknown',
    pid: process.pid,
    version: options.version,
  };
  await recordStart(options.db, instance);
  let beating: Promise<void> = Promise.resolve();
  const timer = setInterval(() => {
    beating = recordBeat(options.db, instance.instanceId).catch((error: unknown) => {
      options.errors.capture(error, {
        message: 'worker heartbeat failed',
        fields: { component: 'heartbeat' },
      });
    });
  }, options.intervalMs ?? HEARTBEAT_INTERVAL_MS);
  // The beat alone never keeps the process running.
  timer.unref();
  return {
    instance,
    async stop() {
      clearInterval(timer);
      await beating;
      await recordStop(options.db, instance.instanceId);
    },
  };
}
