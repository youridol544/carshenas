# ADR-0023: The superadmin section works through its own database role, and changes a curated row only through a function that records which superadmin changed it, and when

- Status: accepted (2026-09-29) on the recommendation, by the owner's standing instruction of that day to decide ADRs and design questions without asking; the owner may overturn it
- Date: 2026-09-29
- Deciders: Pedrum
- Related: tasks CS-40 (built here), CS-41, CS-48, CS-52, CS-53, CS-55, CS-71; ADR-0008 point 6, ADR-0013, ADR-0018 point 6, ADR-0020 point 10; `docs/design/data-model.md` (roles and grants, open question 14)

## Context

The superadmin section is the first place a person changes curated rows from the web app. Today that means a source's crawl state; soon it will mean tracked models (CS-53), evaluation labels (CS-48), review decisions (CS-52, CS-55) and crawl requests (CS-71). Until now a person made these changes at `psql` as the container's superuser, which records nothing. The web app's role, `carshenas_web`, serves every public page. Giving it UPDATE on `source` would let a bug or an injected query on any public page switch the crawler on. The data model's open question 14 asked which role the section writes through. CS-40 asks that every change record who made it and when. A resume of a source stopped on a block must also clear its stop, as `source_stop_recorded` requires, because ADR-0008 point 6 leaves that decision to a person.

## Decision

The section connects as its own login role, `carshenas_admin`. It gets a second, small pool in the web app: two connections, `application_name` carshenas-admin, and the web role's timeouts. Only `src/features/admin` may import that pool (lint). The section's pages, queries and actions all use it; `requireSuperadmin()` still reads the session through `carshenas_web`.

The role reads what the section's screens show: SELECT table by table, never a password hash. It holds no INSERT, UPDATE or DELETE on a mutable curated table. It changes one only by calling a SECURITY DEFINER function. The function checks that the account is a superadmin, locks the row and compares it with what the person saw. It then applies the change and appends a history row naming the account, all in one transaction. An append-only table whose rows are themselves decisions (labels, review verdicts) may instead take a direct INSERT that carries its account and time.

The first function is `change_source_state(source, seen state, seen stop, new state, account)`. A person enables or pauses a source; only the crawler stops one. The function answers:
- `changed`;
- `unchanged`, for a repeated press;
- `stale`, when the page no longer matches the row, so nobody clears a stop they have not seen.

A change away from a stop clears it on the source, and `source_state_change` keeps it. Public pages keep SELECT on `source` alone and never see the history.

## Alternatives considered

- **UPDATE on `source` for `carshenas_web`, with the history written in code**: every public page would share the right to switch the crawler, and the history would hold only as long as every code path remembered it.
- **Column grants to `carshenas_admin`, with a history insert in the same transaction**: a bug could still change a source without a history row. With the function, the history is the only way in.
- **A trigger on `source` that records every change, the crawler's stops included**: complete, but it would fire inside the worker's `stop_source()` and in every test that stops or deletes a source, while CS-33 is changing that function. The crawler's stops are already on the source row and in `fetch_log`, and each resume keeps the stop it cleared.
- **A separate admin app or process**: a second deployable on a 4 GB server for one person's pages. The owner placed the section in the Next.js app (2026-09-28).
- **An integer version column for the optimistic check**: a new column and a trigger on `source`. Whether a choice still holds depends only on the state and the stop the person saw, and those can be compared exactly, the stop as the database's own text.

## Consequences

- Positive:
  - No public page can change what the crawler reads, even through a bug.
  - Every change a person makes in the section says who made it and when.
  - A stale page cannot clear a stop nobody has seen.
  - The next curated tables follow the same pattern.
- Negative / risks:
  - One more role, password and connection string (`pnpm db:roles`, and the server's secret store in CS-37).
  - Each new kind of curated change needs its function or an append-only table.
  - A change made at `psql` as the owner records nothing unless it calls the function.
  - A second pool in the web process.
- Follow-ups:
  - CS-41 grants `carshenas_admin` the reads its screens need (lanes, jobs, `fetch_log`) and retries or cancels a job through a function.
  - CS-53, CS-48, CS-52 and CS-55 extend the role in their own migrations.
  - CS-37 sets the role's password on the server.
