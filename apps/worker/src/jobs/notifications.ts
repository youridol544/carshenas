import * as z from 'zod';
import { ANY_NOTIFICATION_KEPT_DAYS, READ_NOTIFICATION_KEPT_DAYS } from '@carshenas/notifications/retention';
import { pruneNotificationBatch } from '../db/notification-store.ts';
import { defineJob, type QueueJobDefinition } from '../runtime/job.ts';

// Buyers' inbox upkeep (CS-68, ADR-0026 point 6): every night, notifications read more than 90 days ago and any older
// than a year are deleted, a batch per transaction, until none are left or the job is asked to stop.

export type NotificationJobOptions = {
  /** Whether it runs every night by itself; the tests send it. */
  readonly scheduled: boolean;
  /** Rows deleted per statement. */
  readonly batch?: number;
};

export function notificationJobs(options: NotificationJobOptions): QueueJobDefinition<Record<string, never>> {
  const batch = options.batch ?? 1_000;
  return defineJob({
    name: 'notification.prune',
    payload: z.strictObject({}),
    schedules: options.scheduled ? [{ key: 'nightly', cron: '40 3 * * *', payload: {} }] : [],
    async run(_payload, context) {
      const rules = {
        readKeptDays: READ_NOTIFICATION_KEPT_DAYS,
        anyKeptDays: ANY_NOTIFICATION_KEPT_DAYS,
        batch,
      };
      for (;;) {
        if (context.signal.aborted) return;
        const deleted = await pruneNotificationBatch(context.db, rules);
        context.count('deleted', deleted);
        if (deleted < batch) return;
      }
    },
  });
}
