# Buyers' notifications (CS-68, ADR-0026)

What a signed-in buyer is told inside Carshenas, in their inbox at `/account/notifications`, with the unread count on the account button. The model is `docs/design/data-model.md`, "Added by CS-68".

## Add a kind (CS-69, CS-71, CS-72)

1. A migration that inserts the kind's row: `INSERT INTO notification_kind (id, description) VALUES ('crawl_request_approved', '…');`. A kind about a listing also joins the list in `notification_listing_kind_has_listing` (replace the CHECK `NOT VALID`, then validate it in the next file).
2. Its definition in `packages/notifications/src/kinds.ts`: the payload's zod schema (facts only, never personal data), `eventKey` (unique per event, such as `crawl_request:31:approved`), `subject`, `icon`, `render` (the Farsi, from the stored facts, through `@carshenas/locale`) and the mute switch's `setting`; a test beside it in `kinds.test.ts`. The web app's `db:check` test fails until the table and the registry agree.
3. The producer calls `createNotification(trx, { accountId, kind, payload, listingId })` from `@carshenas/notifications/create-notification` with the executor of the transaction that records the event. It answers `skipped` when the buyer muted the kind or was already told: the normal answer when a job runs twice.
4. A kind about something other than a listing (a crawl request) adds its typed column to `notification` and its link in `notification-queries.ts` (`linkOf`). A search file's digest did it with `search_file_id`; its mute is the file's own `muted_at`, which `create_notification()` checks (CS-72).

5. Its glyph: a new value in `NotificationIcon` (`packages/notifications/src/kinds.ts`) and its Lucide icon in `ICONS` (`apps/web/src/features/notifications/components/inbox-list.tsx`); the `satisfies` there fails the typecheck until it has one.

## Search file digests (CS-72, ADR-0032)

The worker's `search.match` job runs every five minutes. For each watching, unmuted file it tells the buyer once per run what became searchable (and which matches dropped their price) since the file's watermark `search_file.matched_through`: «۳ آگهی تازه برای «پژو ۲۰۶ تیپ ۵»», opening `/account/searches/<id>`.

- **Run it by hand** (the lane or a development database; no request leaves the machine): `pnpm --filter @carshenas/worker exec node --env-file-if-exists=../../.env --experimental-strip-types --no-warnings=ExperimentalWarning -e "import('./src/jobs/search-match.ts').then(async m => { const { createDatabase } = await import('@carshenas/db/database'); const { env } = await import('./src/env.ts'); const db = createDatabase({ connectionString: env.databaseUrl, applicationName: 'match', max: 2 }); console.log(await m.matchSearchFiles(db)); await db.destroy(); })"` prints the run's counts. To see a digest without waiting for new listings, move a file's watermark back and its listings' `indexed_at` forward in the database, then run it.
- **The rules** (numbers in `@carshenas/notifications/search-file-alerts`, explained on the file page): a file is told at most every two hours, an account at most eight digests a Tehran day; what arrives in between is told in the next digest. A paused, closed or muted file is never told and never gets a backlog.
- **Reading a run**: the job's completion line and stored output carry `files`, `candidates`, `skippedByKeys`, `notified`, `quiet`, `deferred`, `unreadable`, `newListings`, `drops`, `milliseconds` (the superadmin's job list shows them).
- **A file's mute** is the switch on its page («هشدار آگهی تازه»): `search_file.muted_at`, honoured by `create_notification()` whoever calls it. The kind-level switch in the inbox settings mutes every file's digests.

## Try it locally

`CARSHENAS_SAMPLE_NOTIFICATIONS=development pnpm notifications:sample <username> [--count 5] [--skip 0]` notifies an existing account of the most recent real price drops through the same function, and prints `{"created": …, "skipped": …}`. Development and browser tests only, never on a production database, where buyers would be told about listings they never marked: the command refuses with `NODE_ENV=production`, and otherwise runs only on a database named `*_dev`, `*_test` or `*_check` or with that variable set (local databases are all named `carshenas`).

## Retention

The worker's `notification.prune` runs every night at 03:40 Tehran and deletes, a thousand at a time, notifications read more than 90 days ago and any older than a year (`packages/notifications/src/retention.ts`).
