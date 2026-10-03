# ADR-0037: Tracked models are a table the superadmin changes through a function; tracking decides where requests and the paid step are spent, never what stays on screen

- Status: accepted by delegation (2026-10-03; the owner asked that lane decisions be taken without him, "decide yourself based on best you recommend")
- Date: 2026-10-03
- Deciders: Pedrum (delegated to the CS-53 lane)
- Related: CS-53, CS-71, CS-33, CS-35, CS-51, CS-52, CS-59, CS-66; ADR-0017 (point 4), ADR-0018, ADR-0023, ADR-0028, ADR-0036

## Context

ADR-0017 point 4 has the superadmin choose the models Carshenas reads in depth, starting with the ten most listed, and see each one's sync. Until now the ten were a list in code (`tracked-models.ts`), the view `tracked_model_scope` read the keys of the latest freshness measurement (CS-71), and approved crawl requests (ADR-0036) had nothing to turn into. The owner paused the Divar crawl on 2026-10-01, so nothing built here may send a request, and the backfill must be shown as waiting.

CS-53's fifth criterion says detail requests, extraction, valuations and search results "cover tracked models only", and a paused model "keeps its last data, shown with its date". Read literally it would delete data: ADR-0028 (as revised on 2026-10-02) made search show every listing whose details were read and that was seen in 48 hours, because a tracked list that lives in code and an empty list had deleted every row; a market value is a fact about the listings we hold, and a pasted link (CS-65) reads one listing of any model.

## Decision

1. **`tracked_model` is a table**, one row per catalogue scope (a model, or one of its trims; `UNIQUE NULLS NOT DISTINCT (model_id, trim_id)`), with `state` (`tracking`, `paused`), `priority` (`high`, `normal`, `low`), `origin` (`seed`: the owner's first ten, made by a migration from the ten models of the first measurement; `superadmin`: chosen in the section; `request`: made by an approved crawl request) and who created it. Untracking deletes the row. The view `tracked_model_scope` keeps its name and columns and now selects the rows in state `tracking`, so a buyer may ask again for a model that was paused.
2. **Every change is recorded by the database.** The superadmin's role cannot write the table. `change_tracked_model()` (SECURITY DEFINER, ADR-0023) tracks, pauses, resumes, sets the priority of or untracks a model, states the target (never a toggle) and appends `tracked_model_change` (append-only, kept after the row is gone) with who and when. The seed writes its own `seeded` rows.
3. **An approval tracks, a decline of an approved request takes the model back.** `decide_crawl_request()` calls `track_for_approved_request()` in the same transaction: a new row of origin `request` (the approver and the request recorded), a paused row resumed, or nothing when the model is tracked already. Declining an approved request deletes the row that approval made (never an owner's). A model made by an approved request that is not fulfilled yet cannot be untracked by hand (`blocked`): declining is how it is taken back, because that is what tells its buyers.
4. **Fulfilled means read.** `fulfil_crawl_requests()`, run by the worker's planning job every five minutes (the worker's role may call only it), sets an approved request `fulfilled` when a `tracking` row covers it and an active listing of its scope has had its own page read. With the crawl paused a freshly approved model therefore stays «queued»; a model whose listings were read before the approval is fulfilled at the next run.
5. **What tracking decides, and what it never removes.**
   - **Detail requests**: only tracked models' listings are discovered, swept, backfilled and re-checked on the worker's own schedule; the untracked sweep only marks listings gone. The worker reads the table when a job runs (and fixes a discovery round's models when it starts, since a cursor only fits its search), so a change applies to the next round. A buyer's re-check and a pasted link (ADR-0017 points 3 and 8) stay open for any model.
   - **Extraction** (the paid step, switched off by default): only active listings of a `tracking` model are read.
   - **Valuations** are unchanged: they use every listing with details, so a model that is paused or untracked keeps its market value and rating, with the run's date, which the model page and the listing page show.
   - **Search** is unchanged (ADR-0028 as revised): it shows listings whose details were read and that were seen in 48 hours. A paused model is no longer refreshed, so its listings leave results as they age past the window, while their pages, the model page and the last market value keep their dates. This is the honest reading of "keeps its last data, shown with its date" and of ADR-0017 point 9.
6. **The backfill is a planner, not a loop.** The queue job `divar.plan-backfill` runs every five minutes: it fulfils requests, then, when fewer than 150 backfill jobs wait in the source's lane (`crawl.divar-backfill`, budget tier 20 to 29), sends the details of tracked models' active listings that no read has covered yet, newest posted first (each batch is chosen newest first; the jobs of one batch start in no set order), a model's share of the room by its priority (weights 3, 2, 1; jobs at priority 22, 21, 20 inside the tier), never a token already queued. The lane and the daily budget decide how fast they are read, and while the source is paused they simply wait: the queue stays at its target however many listings wait. Progress is read from the listings (details read of active listings), so nothing needs a counter that can drift.
7. **The section shows it as it is.** A page `/admin/tracked-models` lists each tracked model with its sync (active listings, new and gone in 24 hours and the median age of the last check from the latest hourly measurement, the last sweep, the date of the market value, the share of listings with details and with a rating), its origin and last change, the controls, the untracked models by their active listings, and says in plain words that the crawl is paused when it is.

## Alternatives considered

- **Delete everything outside the tracked models from search, extraction and valuations** (the literal criterion 5): it would empty the demo of listings of models nobody tracks, remove a market value the moment a model is paused (the opposite of "keeps its last data"), and repeat the failure the coordinator corrected on 2026-10-02.
- **A counter of backfilled listings per model**: it drifts when a listing leaves the market or a page is read for another reason; the listings' own `last_checked_at` is the progress.
- **Enqueue every unread listing at tracking time**: thousands of jobs in the queue for one click, and a hard dependence on the pg-boss retention; the planner keeps a bounded queue and survives a restart.
- **Approvals only queue, and the superadmin tracks by hand afterwards** (ADR-0036 point 4's wording): two steps for one decision, and a request the superadmin approved would sit approved with no model. The approval is the decision to read it.
- **A paused model's status as a column on the catalogue**: the model's reading is a decision about capacity with its own history, not a fact about the car.

## Consequences

- The ten models the owner chose are rows from the first migration, with their origin shown as the owner's.
- Untracking a model that a fulfilled request made leaves the request `fulfilled`: the buyer's file shows an answered request, and a new ask for that model joins it. Reopening a fulfilled request is a follow-up if the owner wants it.
- Extraction covers fewer listings until a model is tracked: a pasted link of an untracked model (CS-65) gets code-parsed facts and no model-read ones, unless that task decides otherwise.
- Follow-ups: tell the buyers when a fulfilled request's cars arrive (CS-72 already matches them); a daily budget share per model if one model starves the others in practice.
