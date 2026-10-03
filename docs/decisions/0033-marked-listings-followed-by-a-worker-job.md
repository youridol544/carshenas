# ADR-0033: Keep a buyer's marked listings in one table with a database cap, and tell them of changes from a worker job that writes through the notification function

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-69 lane)
- Related: CS-69, CS-68, CS-35, CS-64, CS-70; ADR-0026, ADR-0013, ADR-0018; `docs/design/data-model.md` ("Added by CS-69")

## Context

A buyer marks a listing to follow it (teardown pattern 34: CarGurus's heart, without its one-search-per-model limit). The product must show the mark on result cards and on the listing page, list the marks with the price now beside the price when marked, and tell the buyer in the inbox when a marked listing's price falls, when it leaves the market (sold, expired, gone) and when it comes back. Crawls and derivations write price events and statuses in other processes; no request to any source may be involved.

## Decision

1. **One table, `listing_mark (account_id, listing_id)`**, primary key on that pair (a listing is marked once), both foreign keys CASCADE. It stores the asking price when marked, and three bookkeeping values the worker moves: `seen_status`, `status_version`, `price_event_seen_id`. The web role may insert (five columns) and delete its own rows and read; it cannot update. Every query filters on the session's account.
2. **The cap is the database's**: at most 200 marks per account, an AFTER INSERT trigger counting under a per-account advisory lock, raising check_violation `listing_mark_account_cap`, which the app maps to a Farsi message. AFTER, so a double press that conflicts does nothing instead of tripping the cap; locked, so two tabs cannot both take the last place (tested).
3. **Producers are a worker job**, `marks.notify`, every two minutes, and `pnpm marks:notify` for one pass by hand. Per mark: events of the listing after `price_event_seen_id` (a drop is an asking price below the listing's last asking price) and a listing status that differs from `seen_status`. Each notification goes through `createNotification()` in the transaction that moves the bookkeeping, so a crash rolls back whole and a repeat finds the event already told (ADR-0026's unique key). Price drops key on the price event; status changes on `(listing, status_version)`, so a listing that leaves twice is announced twice. Off-market to off-market and changes to or from `removed` move the status and tell nobody.
4. **Two new kinds**: `listing_off_market` and `listing_relisted`, each with its own mute switch; a listing's notification now leads to its page on Carshenas, not to the source.
5. **The control draws nothing without a provider**, and the marks of the page are read at request time apart from the prerendered shell (a promise created during prerender would bake the visitor's answer into the shell). A visitor's press explains why and offers sign-in or sign-up; the wish is kept in `sessionStorage` for 30 minutes and honoured only on the page it was made on.

## Alternatives considered

- **Per-account counter instead of a trigger**: a second place to keep right. A trigger that reads the rows it limits is the data-model rule's stated use of triggers.
- **A job that reads all events since a clock watermark**: events commit out of order across listings; a per-mark, per-listing id watermark is safe because one listing's events commit in id order (`listing_price_event_fill_previous` holds its row).
- **Triggers on `listing` and `listing_price_event` that notify**: puts notification work in the crawl's transaction and in the hot path of every price change; a two-minute job costs the crawl nothing.
- **A status history table**: the mark's own `seen_status` is the only history the notification needs.

## Consequences

- Accepted risk: ownership of a mark is enforced in the app, not by the database. The web role has no per-session identity (the same holds for search files, notifications and accounts), so every statement names the session's account and `marks-scope.test.ts` fails when one does not. A follow-up could move marking into SECURITY DEFINER functions or row-level security.
- Positive: the cap and the once-only rules are the database's; producing is idempotent; no crawl or request involved.
- Negative / risks: a notification can be up to two minutes late; each run joins every mark to its listing's newer events (index range per marked listing), fine into the tens of thousands of marks, to be revisited with a measurement beyond that. A buyer who unmarks and marks again gets a fresh price baseline.
- Follow-ups: external channels (Telegram, CS-76) deliver the same notification rows.
