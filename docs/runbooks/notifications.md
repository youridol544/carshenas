# Buyers' notifications (CS-68, ADR-0026)

What a signed-in buyer is told inside Carshenas, in their inbox at `/account/notifications`, with the unread count on the account button. The model is `docs/design/data-model.md`, "Added by CS-68".

## Add a kind (CS-69, CS-71, CS-72)

1. A migration that inserts the kind's row: `INSERT INTO notification_kind (id, description) VALUES ('crawl_request_approved', '…');`. A kind about a listing also joins the list in `notification_listing_kind_has_listing` (replace the CHECK `NOT VALID`, then validate it in the next file).
2. Its definition in `packages/notifications/src/kinds.ts`: the payload's zod schema (facts only, never personal data), `eventKey` (unique per event, such as `crawl_request:31:approved`), `subject`, `icon`, `render` (the Farsi, from the stored facts, through `@carshenas/locale`) and the mute switch's `setting`; a test beside it in `kinds.test.ts`. The web app's `db:check` test fails until the table and the registry agree.
3. The producer calls `createNotification(trx, { accountId, kind, payload, listingId })` from `@carshenas/notifications/create-notification` with the executor of the transaction that records the event. It answers `skipped` when the buyer muted the kind or was already told: the normal answer when a job runs twice.
4. A kind about something other than a listing (a search file, a crawl request) adds its typed column to `notification` (and, for a search file's mute, to `notification_mute` and one condition in `create_notification()`), and its link in `notification-queries.ts` (`linkOf`).

5. Its glyph: a new value in `NotificationIcon` (`packages/notifications/src/kinds.ts`) and its Lucide icon in `ICONS` (`apps/web/src/features/notifications/components/inbox-list.tsx`); the `satisfies` there fails the typecheck until it has one.

## Marked listings (CS-69)

A buyer's marks (`listing_mark`) are followed by the worker job `marks.notify`, every two minutes: a price drop, a listing that leaves the market (sold, expired, gone) and one that comes back each become one notification (`listing_price_drop`, `listing_off_market`, `listing_relisted`), idempotently. `pnpm marks:notify` runs one pass now and prints what it told as JSON; it sends no request to any source. A notification leads to the listing's page on Carshenas. The cap is 200 marks per account (database trigger). To try it: mark listings as a buyer, change a listing's price or status as the crawl would (see `e2e/fixtures/marks.ts`), run `pnpm marks:notify`, open the inbox.

## Try it locally

`CARSHENAS_SAMPLE_NOTIFICATIONS=development pnpm notifications:sample <username> [--count 5] [--skip 0]` notifies an existing account of the most recent real price drops through the same function, and prints `{"created": …, "skipped": …}`. Development and browser tests only, never on a production database, where buyers would be told about listings they never marked: the command refuses with `NODE_ENV=production`, and otherwise runs only on a database named `*_dev`, `*_test` or `*_check` or with that variable set (local databases are all named `carshenas`).

## Retention

The worker's `notification.prune` runs every night at 03:40 Tehran and deletes, a thousand at a time, notifications read more than 90 days ago and any older than a year (`packages/notifications/src/retention.ts`).
