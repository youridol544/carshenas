# Copy rewrite plan

> Generated on 2026-10-04 by `pnpm copy:inventory` (CS-105) from the same file scan as `pnpm copy:lint`. Do not edit by hand: the assignment lives in `tools/copy-lint/areas.mjs` and the scope in `tools/copy-lint/copy-files.mjs`; change them and regenerate. The counts are the state before any rewrite lane has changed a string; the lanes lower them.

## Why, and how the work is split

The owner (2026-10-04) finds the product copy fluffy, repetitive, too technical and not native Farsi, and wants all of it rewritten to a voice guide. CS-104 writes the guide, the `copy-fa` skill and the `copy-reviewer` agent; CS-105 (this document and `pnpm copy:lint`) finds what is objectively wrong and splits the files; CS-106 to CS-110 rewrite, one lane per area, in parallel. The split is by file, so two lanes never edit the same file.

| Area | Lane | Files | Strings | Lint violations | Biggest files |
|---|---|---:|---:|---:|---|
| A: Public pages and the shell | CS-106 | 20 | 382 | 22 | `model-copy.ts` (164), `data-status-copy.ts` (96), `home-copy.ts` (60) |
| B: Search, filters, understanding, the listing page and cards | CS-107 | 21 | 406 | 24 | `listing-copy.ts` (122), `search-copy.ts` (115), `listing-explanation.ts` (49) |
| C: Accounts, notifications and buyer tools | CS-108 | 12 | 385 | 19 | `search-files-copy.ts` (118), `accounts-copy.ts` (72), `marked-copy.ts` (52) |
| D: The superadmin section | CS-109 | 11 | 485 | 37 | `admin-copy.ts` (252), `tracked-models-admin-copy.ts` (116), `crawl-requests-admin-copy.ts` (62) |
| E: Shared definitions and info popovers | CS-110 | 12 | 251 | 8 | `filters.ts` (155), `model-info.ts` (28), `catalogues.ts` (20) |
| Owned by CS-115: Check a link | CS-115 | 3 | 65 | 7 | `check-copy.ts` (59), `pasted-link.ts` (6) |
| **Total** | | **79** | **1,974** | **117** | |

A string is one piece of text a person could read: a string literal, a template literal (its static parts, each `${…}` counted as one hole), a piece of JSX text or a string attribute, with at least one Persian word in it. Vocabulary lists (`words`) are not strings in this sense, and a file that only joins what it shows with « · » counts as a copy file with no strings of its own.

## What counts as a copy file

A source file under `apps/web/src`, `apps/worker/src`, `packages/*/src` is a copy file when it has a string with a Persian word in it (two letters of the Arabic script in a row; punctuation such as «،» and digits do not count) and is not a test, a spec or test support. It is **copy** by one of three routes, and anything else with Persian text is **excluded** with a reason (the last section) or fails `pnpm copy:test`:

1. **By name**: `*-copy.ts` and `*-copy.tsx` under `apps/web/src`: a feature keeps its words in one file.
2. **Shared text**: modules outside the app that print words: `packages/search/src/{filters,catalogues,sorts,kinds,explain,mileage-reading,document,search}.ts`; `packages/search/src/understand/{merge,understand,intents}.ts`; `packages/notifications/src/kinds.ts`; `packages/locale/src/{toman,format-number}.ts`.
3. **Inline**: any other file under `apps/web/src` with an inline Persian string (components, pages, view-model files such as `listing-view.ts` and `gauge-view.ts`, route handlers), and the JSON data files under `apps/web/public` (the hero photographs' alt texts).

## Rules for the parallel lanes

1. **Strings only.** Change the words, never the structure: no new props, components, keys or files, nothing moved or renamed. Ids, keys, enum values, stored forms and notification payloads stay unchanged; every number a buyer sees still comes from the database (the listing explanation keeps its faithfulness test passing).
2. **Your area's files only.** A file in another area is read-only for you, even for a string you dislike: record it in your evidence table and tell the lane that owns it. A string shared through a constant lives with the area that owns the constant (see the notes in the tables).
3. **Merge main often.** CS-111 (smart search), CS-112 (interface polish), CS-113 (model photos), CS-114 (search UX) and CS-115 (check a link) run in parallel and may touch components. Merge main at the start of each slice and before you report. On a conflict keep their structure and re-apply your words.
4. **Tests that match text use the central copy constants** (the exports of the `*-copy.ts` files) and never retype Persian: retyping loses the zero-width non-joiner. Update a test only by switching it to the constant; never weaken an assertion.
5. **The lint.** `pnpm copy:lint <your files>` while you work. When you fix violations, run `pnpm copy:lint --update-baseline` and commit `tools/copy-lint/baseline.json`: it only ever lowers. Do not add an allowlist entry or an ignore comment to get green; fix the text. A conflict in `baseline.json` is resolved by taking either side and running `--update-baseline` again.
6. **Evidence.** A before-and-after table with counts (reviewed, changed, kept) in `docs/evidence/copy/<area>.md`, the voice guide (`docs/design/product-voice.md`) and the `copy-reviewer` pass, and screenshots of the changed screens at 412 and 1440.
7. **A new file with Persian text needs an owner.** Add it to `tools/copy-lint/areas.mjs` in the same commit (a glob that already covers its folder does it by itself); `pnpm copy:test` fails otherwise.

Other tasks that run in parallel and touch some of the same folders:

| Task | What | Touches |
|---|---|---|
| CS-111 | Smart search in one step | features/search-understanding, the hero search box, packages/search understand |
| CS-112 | Interface polish (button labels, scrollbars, filters) | components/ui, catalogue rows and rails, the filter panel |
| CS-113 | Model photos | features/model, the home popular tiles, body-type credits |
| CS-114 | Search UX review | features/search |
| CS-115 | Check a link (owns its copy) | features/check-link, app/(site)/check |

## Area A: Public pages and the shell

**CS-106.** The home page and its hero (with the alt texts of the hero photographs in apps/web/public), the shell (header, footer, credits), the models index and the model pages, the data status page, the not-found and error pages.

20 files, 382 strings, 22 lint violations today. Biggest: `model-copy.ts` (164), `data-status-copy.ts` (96), `home-copy.ts` (60), `body-types.ts` (21).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/public/home/hero/credits.json` | 6 | 5 |  |
| `apps/web/src/app/error.tsx` | 5 | 0 |  |
| `apps/web/src/app/global-error.tsx` | 5 | 0 |  |
| `apps/web/src/app/layout.tsx` | 3 | 0 |  |
| `apps/web/src/app/not-found.tsx` | 6 | 0 |  |
| `apps/web/src/components/layout/error-reference.tsx` | 1 | 0 |  |
| `apps/web/src/components/layout/header-nav.tsx` | 3 | 0 |  |
| `apps/web/src/components/layout/site-header.tsx` | 1 | 0 |  |
| `apps/web/src/features/body-types/body-types.ts` | 21 | 0 | The body-type tiles of the home page and their photo credits (A). The body-type filter options come from the definitions in packages/search (E). |
| `apps/web/src/features/body-types/components/body-type-credits.tsx` | 4 | 0 | The body-type tiles of the home page and their photo credits (A). The body-type filter options come from the definitions in packages/search (E). |
| `apps/web/src/features/data-status/components/source-card.tsx` | 1 | 0 |  |
| `apps/web/src/features/data-status/components/status-overview.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/data-status/data-status-copy.ts` | 96 | 6 |  |
| `apps/web/src/features/data-status/data-status-format.ts` | 4 | 0 |  |
| `apps/web/src/features/home/components/catalogue-row.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/home/components/hero-photos.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/home/home-copy.ts` | 60 | 3 |  |
| `apps/web/src/features/model/components/models-screen.tsx` | 1 | 0 |  |
| `apps/web/src/features/model/model-copy.ts` | 164 | 5 |  |
| `apps/web/src/server/observability/route-errors.ts` | 1 | 0 | The one generic sentence shown when a request to the server fails: assigned with the error pages (A). |

## Area B: Search, filters, understanding, the listing page and cards

**CS-107.** The search page and filter panel, the chips and the results (empty and no-results states), the understanding messages, the listing page (facts, price analysis, explanation templates, condition notes, risks, comparables, history), the result cards and the assumed-mileage notes.

21 files, 406 strings, 24 lint violations today. Biggest: `listing-copy.ts` (122), `search-copy.ts` (115), `listing-explanation.ts` (49), `listing-view.ts` (45).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/src/app/(site)/search/page.tsx` | 1 | 0 |  |
| `apps/web/src/features/listing/components/comparables-section.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/listing/components/listing-screen.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/listing/gauge-view.ts` | 14 | 1 | The rating names («عالی» to «خیلی گران») and the band texts are imported by the listing page and by the check-a-link answer (CS-115). B owns the constants; CS-115 does not edit them. |
| `apps/web/src/features/listing/listing-copy.ts` | 122 | 6 |  |
| `apps/web/src/features/listing/listing-explanation.ts` | 49 | 1 | The explanation templates: rewrite the templates, keep every number sourced from the database and the faithfulness test passing. |
| `apps/web/src/features/listing/listing-view.ts` | 45 | 1 |  |
| `apps/web/src/features/listing/server/figure-check.ts` | 1 | 0 |  |
| `apps/web/src/features/search-understanding/components/plain-search-panel.tsx` | 2 | 2 | Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings. |
| `apps/web/src/features/search-understanding/components/plain-search.tsx` | 24 | 3 | Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings. |
| `apps/web/src/features/search-understanding/server/understand-route.ts` | 2 | 0 | Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings. |
| `apps/web/src/features/search-understanding/understanding-copy.ts` | 1 | 0 | Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings. |
| `apps/web/src/features/search/components/filter-controls.tsx` | 2 | 0 |  |
| `apps/web/src/features/search/components/listing-card.tsx` | 0 | 3 | 3 separators only. |
| `apps/web/src/features/search/components/no-results.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/search/listing-card-view.ts` | 1 | 0 |  |
| `apps/web/src/features/search/search-copy.ts` | 115 | 3 |  |
| `apps/web/src/features/search/server/search-route.ts` | 2 | 0 |  |
| `packages/search/src/understand/intents.ts` | 4 | 0 | The understanding messages (B) live in the package that also holds the vocabulary (excluded). CS-111 may change what is said when words are dropped; keep to strings and merge main first. |
| `packages/search/src/understand/merge.ts` | 14 | 0 | The understanding messages (B) live in the package that also holds the vocabulary (excluded). CS-111 may change what is said when words are dropped; keep to strings and merge main first. |
| `packages/search/src/understand/understand.ts` | 7 | 1 | The understanding messages (B) live in the package that also holds the vocabulary (excluded). CS-111 may change what is said when words are dropped; keep to strings and merge main first. |

## Area C: Accounts, notifications and buyer tools

**CS-108.** Sign in and sign up, the account pages, the notifications inbox and each notification kind (title, detail and settings), the marked listings, the search files and their alerts, the crawl-request card on a file page, the buyer-side messages.

12 files, 385 strings, 19 lint violations today. Biggest: `search-files-copy.ts` (118), `accounts-copy.ts` (72), `marked-copy.ts` (52), `crawl-requests-copy.ts` (49).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/src/features/accounts/accounts-copy.ts` | 72 | 4 |  |
| `apps/web/src/features/marked-listings/components/marked-list.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/marked-listings/marked-copy.ts` | 52 | 0 |  |
| `apps/web/src/features/marked-listings/marked-view.ts` | 1 | 0 |  |
| `apps/web/src/features/marks/marks-copy.ts` | 20 | 1 |  |
| `apps/web/src/features/notifications/notifications-copy.ts` | 32 | 2 |  |
| `apps/web/src/features/search-files/components/search-files-card.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/search-files/search-file-name.ts` | 1 | 0 |  |
| `apps/web/src/features/search-files/search-files-copy.ts` | 118 | 7 |  |
| `apps/web/src/lib/crawl-requests-copy.ts` | 49 | 1 | Shared constants: the buyer-side crawl-request card (C) and the superadmin screen (D) both import these words. C owns them; D rewrites its own crawl-requests-admin-copy.ts and does not edit these. |
| `apps/web/src/lib/crawl-requests-rules.ts` | 4 | 0 | Shared constants: the buyer-side crawl-request card (C) and the superadmin screen (D) both import these words. C owns them; D rewrites its own crawl-requests-admin-copy.ts and does not edit these. |
| `packages/notifications/src/kinds.ts` | 36 | 2 | Straddles C and E: 26 of its 36 strings are the titles and details rendered for the inbox (C); the five `setting` blocks (a label and a description each, ten strings) are the settings texts of E, and C rewrites them in the same pass. E does not touch this file. Payloads and keys stay unchanged. |

## Area D: The superadmin section

**CS-109.** Every superadmin screen: sources, tracked models and their specs, model photos, crawl requests, search files, accounts, the worker and its queue.

11 files, 485 strings, 37 lint violations today. Biggest: `admin-copy.ts` (252), `tracked-models-admin-copy.ts` (116), `crawl-requests-admin-copy.ts` (62), `model-photos-admin-copy.ts` (43).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/src/features/admin/admin-copy.ts` | 252 | 12 | 1 separator only. |
| `apps/web/src/features/admin/components/admin-dashboard.tsx` | 12 | 0 |  |
| `apps/web/src/features/admin/components/crawl-section.tsx` | 0 | 5 | 5 separators only. |
| `apps/web/src/features/admin/components/jobs-section.tsx` | 0 | 5 | 5 separators only. |
| `apps/web/src/features/admin/components/listings-section.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/admin/components/problems-section.tsx` | 0 | 3 | 3 separators only. |
| `apps/web/src/features/admin/components/search-files-screen.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/admin/components/source-card.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/features/admin/crawl-requests-admin-copy.ts` | 62 | 2 |  |
| `apps/web/src/features/admin/model-photos-admin-copy.ts` | 43 | 3 |  |
| `apps/web/src/features/admin/tracked-models-admin-copy.ts` | 116 | 4 |  |

## Area E: Shared definitions and info popovers

**CS-110.** The shared texts that feed many screens: the filter, catalogue, sort and chip definitions in @carshenas/search, the info content builders (mileage reading, deal rating bands, market value, valuation segments, crawl rules), the shared UI primitives and the locale-derived phrases.

12 files, 251 strings, 8 lint violations today. Biggest: `filters.ts` (155), `model-info.ts` (28), `catalogues.ts` (20), `kinds.ts` (12).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/src/features/model/model-info.ts` | 28 | 1 | Builds the info popovers of the model page (price range, market value, ratings, trend): info content is area E, although the file lives in the model feature. Area A leaves it alone. |
| `apps/web/src/lib/mileage-info.ts` | 3 | 0 | The mileage info control's names are used by the listing page and the cards (B) and by the marked list (C); E owns the constants. |
| `packages/locale/src/format-number.ts` | 1 | 0 |  |
| `packages/locale/src/toman.ts` | 6 | 0 |  |
| `packages/search/src/catalogues.ts` | 20 | 0 |  |
| `packages/search/src/document.ts` | 2 | 0 |  |
| `packages/search/src/explain.ts` | 1 | 0 |  |
| `packages/search/src/filters.ts` | 155 | 6 |  |
| `packages/search/src/kinds.ts` | 12 | 0 |  |
| `packages/search/src/mileage-reading.ts` | 9 | 1 | The mileage-reading popover (E). The assumed-mileage notes on cards and the listing page are written in listing-view.ts and the search copy (B). |
| `packages/search/src/search.ts` | 2 | 0 | Chip texts built from the filters («مدل …», «کارکرد …»): E owns them with the definitions, B displays them. |
| `packages/search/src/sorts.ts` | 12 | 0 |  |

## Owned by CS-115: Check a link

**CS-115.** The paste-a-link feature, copy included (CS-115 rewrites it to the voice guide while it rebuilds the answer states): the box, the four answers, the errors.

3 files, 65 strings, 7 lint violations today. Biggest: `check-copy.ts` (59), `pasted-link.ts` (6).

| File | Strings | Violations | Notes |
|---|---:|---:|---|
| `apps/web/src/features/check-link/check-copy.ts` | 59 | 6 |  |
| `apps/web/src/features/check-link/components/check-answer.tsx` | 0 | 1 | 1 separator only. |
| `apps/web/src/lib/pasted-link.ts` | 6 | 0 | The names of other sites for the paste box (CS-115). The search field (B) imports it and does not edit it. |

## Decisions on shared and straddling files

A file that straddles two areas goes to the area that owns most of its strings, and a string shared through a constant lives with the area that owns the constant. The other lane treats such a file as read-only. These are the decisions, and the hot spots that other running tasks also change:

| File | Owner | Why |
|---|---|---|
| `apps/web/src/features/model/model-info.ts` | E | Builds the info popovers of the model page (price range, market value, ratings, trend): info content is area E, although the file lives in the model feature. Area A leaves it alone. |
| `packages/notifications/src/kinds.ts` | C | Straddles C and E: 26 of its 36 strings are the titles and details rendered for the inbox (C); the five `setting` blocks (a label and a description each, ten strings) are the settings texts of E, and C rewrites them in the same pass. E does not touch this file. Payloads and keys stay unchanged. |
| `apps/web/src/lib/crawl-requests-*.ts` | C | Shared constants: the buyer-side crawl-request card (C) and the superadmin screen (D) both import these words. C owns them; D rewrites its own crawl-requests-admin-copy.ts and does not edit these. |
| `apps/web/src/features/listing/gauge-view.ts` | B | The rating names («عالی» to «خیلی گران») and the band texts are imported by the listing page and by the check-a-link answer (CS-115). B owns the constants; CS-115 does not edit them. |
| `apps/web/src/lib/mileage-info.ts` | E | The mileage info control's names are used by the listing page and the cards (B) and by the marked list (C); E owns the constants. |
| `packages/search/src/mileage-reading.ts` | E | The mileage-reading popover (E). The assumed-mileage notes on cards and the listing page are written in listing-view.ts and the search copy (B). |
| `packages/search/src/search.ts` | E | Chip texts built from the filters («مدل …», «کارکرد …»): E owns them with the definitions, B displays them. |
| `apps/web/src/features/body-types/**` | A | The body-type tiles of the home page and their photo credits (A). The body-type filter options come from the definitions in packages/search (E). |
| `apps/web/src/server/observability/route-errors.ts` | A | The one generic sentence shown when a request to the server fails: assigned with the error pages (A). |
| `apps/web/src/features/search-understanding/**` | B | Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings. |
| `packages/search/src/understand/{merge,understand,intents}.ts` | B | The understanding messages (B) live in the package that also holds the vocabulary (excluded). CS-111 may change what is said when words are dropped; keep to strings and merge main first. |
| `apps/web/src/lib/pasted-link.ts` | CS-115 | The names of other sites for the paste box (CS-115). The search field (B) imports it and does not edit it. |

## Persian text that is not copy

These files have strings with Persian words that no buyer or superadmin reads as product text, so no lane rewrites them and the lint skips them. Tests, specs and test support are never copy and are not listed. Data in the database (the name of a source, the catalogue) is data, not copy: migrations are history and are never edited. The reason for each exclusion is in `tools/copy-lint/copy-files.mjs`.

- **The worker reads and parses listings and seeds the catalogue: its Persian is parser vocabulary and catalogue data, never a sentence shown to anyone (notification text is rendered from packages/notifications).**
  - `apps/worker/src/catalogue/codes.ts` (50)
  - `apps/worker/src/catalogue/divar-catalogue.ts` (114)
  - `apps/worker/src/db/mark-store.ts` (1)
  - `apps/worker/src/db/test-database.ts` (1)
  - `apps/worker/src/sources/divar/attributes.ts` (61)
  - `apps/worker/src/sources/divar/post.ts` (3)
  - `apps/worker/src/sources/divar/search.ts` (2)
  - `apps/worker/src/sources/divar/tracked-models.ts` (10)
  - `apps/worker/src/sources/mileage-wording.ts` (15)
  - `apps/worker/src/sources/price.ts` (2)
- **Model instructions, glossaries and worked examples: read by a model, never by a buyer (numbers a buyer sees come from the database, never from model text).**
  - `packages/ai/src/examples/labelled-listings.ts` (12)
  - `packages/ai/src/examples/listing-paint.ts` (1)
  - `packages/ai/src/tasks/listing-facts.ts` (4)
  - `packages/ai/src/tasks/listing-text.ts` (7)
- **Vocabulary the code recognises in the buyer's own sentence: words, fillers, numbers, quantities, patterns and the test lexicon. Never shown. (merge.ts, understand.ts and intents.ts are SHARED_TEXT.)**
  - `packages/search/src/understand/code-pass.ts` (46)
  - `packages/search/src/understand/fillers.ts` (129)
  - `packages/search/src/understand/fixture.ts` (77)
  - `packages/search/src/understand/lexicon.ts` (2)
  - `packages/search/src/understand/numbers.ts` (77)
  - `packages/search/src/understand/phrases.ts` (407)
  - `packages/search/src/understand/quantities.ts` (77)
  - `packages/search/src/understand/text.ts` (1)
- **A list of passwords too common to accept: data the code matches against.**
  - `packages/accounts/src/password.ts` (1)
- **The /design reference page and its demo: samples of type, colour and formats for developers, not product copy (noindex).**
  - `apps/web/src/app/design/page.tsx` (3)
  - `apps/web/src/app/design/plain-search/page.tsx` (3)
- **The /design reference page: samples for developers, not product copy.**
  - `apps/web/src/features/design-language/components/action-levels.tsx` (3)
  - `apps/web/src/features/design-language/components/bidi-samples.tsx` (8)
  - `apps/web/src/features/design-language/components/colour-roles.tsx` (13)
  - `apps/web/src/features/design-language/components/deal-ramp.tsx` (1)
  - `apps/web/src/features/design-language/components/design-language.tsx` (10)
  - `apps/web/src/features/design-language/components/format-samples.tsx` (19)
  - `apps/web/src/features/design-language/components/listing-samples.tsx` (4)
  - `apps/web/src/features/design-language/components/type-roles.tsx` (8)
  - `apps/web/src/features/design-language/design-language-samples.ts` (15)
- **The host of the /design/plain-search demo; no buyer page uses it.**
  - `apps/web/src/features/search-understanding/components/plain-search-demo.tsx` (2)
- **Routes that provoke errors so the error reporting can be tested: developer tooling, not product.**
  - `apps/web/src/app/diagnostics/[failure]/page.tsx` (3)
- **Buttons that provoke errors so the error reporting can be tested: developer tooling, not product.**
  - `apps/web/src/features/diagnostics/components/browser-failures.tsx` (3)
- **Sample listings and search results used by tests and by the design pages.**
  - `apps/web/src/features/listing/listing-fixtures.ts` (12)
  - `apps/web/src/features/search/search-fixtures.ts` (9)
- **Seeds for the integration tests.**
  - `apps/web/src/server/db/listing-test-database.ts` (10)
  - `apps/web/src/server/db/model-test-database.ts` (7)
  - `apps/web/src/server/db/paste-test-database.ts` (1)
  - `apps/web/src/server/db/search-test-database.ts` (8)

## Regenerating

`pnpm copy:inventory` rewrites this file; `pnpm copy:inventory --stdout` prints it instead. `pnpm copy:test` checks that every copy file is in exactly one area (or the CS-115 list) and that no assignment is dead. The lint is documented in `docs/runbooks/copy-lint.md`.
