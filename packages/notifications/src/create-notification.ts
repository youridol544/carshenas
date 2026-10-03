import type { DB } from '@carshenas/db/db-types';
import { sql, type Kysely } from 'kysely';
import { NOTIFICATION_KINDS, type NotificationKind, type NotificationPayload } from './kinds.ts';

// The one way a producer notifies a buyer (ADR-0026 point 2): its payload is checked against its kind's schema, its
// event key is built by the kind, and the database function create_notification() does the rest: it creates nothing
// for a buyer who muted the kind, and nothing twice for one event. Pass the executor of the transaction that records
// the event (a price event, a crawl request's decision, a match), so both commit or neither does.

export type NotificationInput<Kind extends NotificationKind> = {
  readonly accountId: number;
  readonly kind: Kind;
  readonly payload: NotificationPayload[Kind];
  /** The listing it is about, for the kinds about a listing. */
  readonly listingId?: number;
  /** The search file it is about, for the kinds about a file: a muted file is notified of nothing. */
  readonly searchFileId?: number;
};

export type NotificationOutcome = { status: 'created'; id: number } | { status: 'skipped' };

/**
 * Notifies one account of one event. `skipped` when the account muted the kind or was already told of the event,
 * which is the normal answer when a job runs twice. A payload that does not fit its kind throws: that is a bug in the
 * producer, never something to store.
 */
export async function createNotification<Kind extends NotificationKind>(
  db: Kysely<DB>,
  input: NotificationInput<Kind>,
): Promise<NotificationOutcome> {
  const definition = NOTIFICATION_KINDS[input.kind];
  const payload = definition.payload.parse(input.payload);
  const eventKey = definition.eventKey(payload);
  const { rows } = await sql<{ id: number | null }>`
    SELECT create_notification(${input.accountId}, ${input.kind}, ${eventKey}, ${JSON.stringify(payload)}::jsonb,
                               ${input.listingId ?? null}, ${input.searchFileId ?? null}) AS id`.execute(db);
  const id = rows[0]?.id ?? null;
  return id === null ? { status: 'skipped' } : { status: 'created', id };
}
