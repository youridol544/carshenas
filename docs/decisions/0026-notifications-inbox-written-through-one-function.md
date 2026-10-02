# ADR-0026: Keep buyers' notifications in one inbox table, written only through one function that honours mutes and deduplicates, with each kind declared once in code

- Status: accepted (2026-09-30) on the recommendation, by the owner's standing instruction of that day to decide ADRs and design questions without asking; the owner may overturn it
- Date: 2026-09-30
- Deciders: Pedrum
- Related: tasks CS-68 (built here), CS-69, CS-71, CS-72, CS-76; ADR-0013, ADR-0014, ADR-0018, ADR-0020, ADR-0023; `docs/design/data-model.md` (layer 8, "Added by CS-68")

## Context

Buyers are told, inside the product, about four things (the owner's plan of 2026-09-29): a marked listing's price drops or the car sells (CS-69), a search file finds new cars (CS-72), and a crawl request they raised is approved or declined (CS-71). Those producers are three tasks and two processes: worker jobs (price events, the matcher) and the superadmin section (approvals, through `carshenas_admin`, ADR-0023). Jobs run at least once, sometimes twice (ADR-0018), so a producer that runs twice must not notify twice. A buyer can mute a kind, and a muted notification must not be created at all, whoever produces it. The data model planned an `alert` table owed to a Telegram saved search (CS-76); accounts now exist (ADR-0020), and the inbox is the first channel.

## Decision

1. **One table, `notification`**: a row is one thing one account is told. It holds the `kind`, an `event_key` that names the event it announces (`price_event:812`), the facts it was built from as a JSON object (`payload`), typed links to what it is about (`listing_id` now; `search_file_id` and `crawl_request_id` arrive with their tables), `created_at` and `read_at`. `UNIQUE (account_id, kind, event_key)` is the deduplication: each event notifies each buyer at most once.
2. **Written only through `create_notification(account, kind, event_key, payload, listing)`**, a SECURITY DEFINER function that inserts unless the account muted the kind, `ON CONFLICT DO NOTHING` on that constraint, and returns the new id or NULL. No role may insert into the table directly, so no producer can skip the mute or the deduplication. Producers call it inside the transaction that records the event they announce (a price event, an approval, a match), so the event and its notification commit or roll back together. The worker and the superadmin section may execute it; the web role may not, until a buyer's own action produces a notification.
3. **Kinds are a curated code table, `notification_kind`, mirrored by a registry in code**, `@carshenas/notifications`: for each kind, a zod schema for its payload, the event key built from the payload, the Farsi text built from the stored facts (ADR-0014's formatters), what it links to, and the label of its mute switch. A test fails when the table and the registry disagree. Adding a kind is one definition, its test, and a migration that inserts its code; its producer calls the shared `createNotification()`, which validates the payload before the database sees it.
4. **Mutes are rows, `notification_mute (account, kind)`**, written by the web role for the signed-in buyer. Muting stops future notifications and keeps the ones already received. A search file's own mute arrives with search files (CS-70, CS-72) as a typed column on the same table and one more condition in the function.
5. **Read state is `read_at`**, which the web role may set and nothing else. "Mark all read" marks only the notifications the buyer was shown (up to the newest id on the page), never one that arrived meanwhile.
6. **Retention**: a daily worker job deletes a notification 90 days after it was read, and any notification a year after it was created. The deduplication key goes with it; no producer revisits events that old.

## Alternatives considered

- **Direct INSERT for each producer's role, with the mute checked in code**: three producers in two processes would each have to remember the mute and the conflict target; one missed check sends a muted buyer a notification. The function is the only way in, as ADR-0023's are.
- **The planned `alert` table, per saved search, with a send status**: it modelled a Telegram message owed to a chat. The inbox needs read state and mutes per account; a bot (CS-76) later reads the same rows and records its own delivery beside them.
- **One table per kind** (price-drop notifications, match notifications, …): the inbox would read a UNION of every kind's table, and each new kind would add a table, grants and a branch to every query.
- **A free-text subject (`listing:812`) instead of typed links**: no foreign key, so a purged listing would leave notifications pointing at nothing. Typed nullable columns cascade with their subject.
- **Kinds as a CHECK list**: works, but a mute's kind would be checked twice, and the registry test has no table to compare against; a code table is the house pattern for a small curated vocabulary (ADR-0013).
- **Farsi text stored in the row**: fixed at write time, it could never follow a glossary change and would be written by jobs that do not know how the page lays it out. The row stores facts; the text is built when shown.

## Consequences

- Positive: a producer is one call inside its own transaction; running it twice is harmless; a mute holds for every producer; the inbox reads one table through one index.
- Negative / risks: a kind whose payload schema changes must still render its older rows (the registry keeps each kind's schema backward-compatible, or a migration rewrites the payloads). The function runs as the owner, so its body is reviewed like a grant.
- Follow-ups: CS-69, CS-71 and CS-72 add their kinds and producers; CS-70 or CS-72 adds the search-file mute; CS-76 delivers the same rows to a chat; CS-64 points a listing notification at the listing page instead of its source.
