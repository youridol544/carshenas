# ADR-0033: Crawl requests are a queue the superadmin decides; an approval queues a model and crawls nothing

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-71 lane)
- Related: CS-71, CS-53, CS-70, CS-72, CS-68; ADR-0017, ADR-0018, ADR-0008, ADR-0023, ADR-0026, ADR-0031

## Context

Carshenas reads every model shallowly and only tracked models in depth, within a daily request budget per source (ADR-0017). A buyer whose search file finds few cars cannot change what is read; only the superadmin chooses it, because capacity is limited. The owner's plan of 2026-09-29 keeps "what Carshenas crawls" (tracked models, CS-53) apart from "what buyers ask for" (search files). CS-53 is not built yet, so there is no tracked-model table to turn a request into, and the owner paused the Divar crawl on 2026-10-01: nothing may be requested from any site.

## Decision

1. **A request is a row of `crawl_request`, one per catalogue scope** (a model, or one of its trims), made unique by `UNIQUE NULLS NOT DISTINCT (model_id, trim_id)`. A buyer's ask inserts it `ON CONFLICT DO NOTHING` and links the file; the second buyer is linked to the first one's request by the key, never by a read before the insert. Demand is the number of distinct accounts among the linked files, never the number of presses.
2. **The buyer asks on purpose.** A file raises no request by being saved. The file's page shows «از کارشناس بخواهید بیشتر بگردد» when fewer than 10 cars match (`FEW_MATCHES_BELOW`, one definition shared by the card, the action and the info control beside its title) and the file names a model or a trim that is neither requested by this file, declined, nor read in depth already (`tracked_model_scope`). The action recomputes the rule on the server.
3. **States**: `pending`, `approved`, `declined` (with a reason the buyer reads), `fulfilled` (set by CS-53 when the crawl has read the model; no buyer or superadmin path sets it). Approved and declined may follow each other (a request is reconsidered when capacity allows); every decision is appended to `crawl_request_decision`, and the request row holds the last one with the superadmin who made it and when. The superadmin changes a request only through `decide_crawl_request()` (ADR-0023): it checks the role, locks the request, compares it with the state the person saw and records the decision.
4. **An approval queues, it does not crawl.** Approval records who and when; CS-53 reads `approved` requests when it builds tracked models, sets `fulfilled`, and replaces the body of the view `tracked_model_scope` (today: the keys of each source's latest freshness measurement, through the catalogue key). While no source is enabled, the buyer's page and the superadmin's screen say so in plain words, and nothing is sent to any site.
5. **Each buyer is told once** per request and decision through `createNotification()` (ADR-0026), in the transaction of the decision: kind `crawl_request_decided`, event key `crawl_request:<id>:<decision>`, to the account of each linked file, linking the account's first such file. A buyer who muted the kind is skipped by the function; a repeated press changes nothing.
6. **Limits are the database's**, by a trigger under a per-account advisory lock: a file asks for at most 3 models or trims, an account has at most 10 requests waiting for an answer, nobody joins a declined request. A pending request whose files were all deleted is not listed for decision.
7. **The web role may only ask**: select requests, insert `(model_id, trim_id)` and a link; never a state or a decision. The superadmin's role reads and decides through the function.

## Alternatives considered

- **Raise a request automatically when a file is saved**: a buyer's casual search would create work for the superadmin and demand nobody meant; a press is consent and the count is honest.
- **A `tracked_model` table now (CS-53's)**: widens this task into the crawler's scheduling; the request queue is what CS-53 consumes.
- **One request per file, not per scope**: loses the aggregate demand per model, which the superadmin needs to choose.
- **Decisions final**: simpler, but a declined model could never be asked for again while capacity grows.

## Consequences

- The superadmin sees demand per model, the files and buyers behind each request, and who approved what; the buyer sees the answer on the file, on its card in the list and in the inbox.
- Until CS-53, "approved" means queued. The page says so while reading is paused.
- A request has no area: ADR-0017's market is Tehran, so the scope is the car.
- Follow-ups: CS-53 turns approved requests into tracked models and sets `fulfilled` (its origin column shows on the superadmin's list); a buyer withdrawing an ask; telling buyers when a fulfilled request's cars arrive (CS-72's matching already does).
