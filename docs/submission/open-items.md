# Open items

What the README and the notes wait for, what the owner must decide, what was found while preparing them, and the state of the repository seen from outside. Written 2026-10-04 with CS-120. The video is designed elsewhere (CS-122, CS-123) and nothing here plans it. A final pass (CS-121, then the owner) replaces the markers and closes this file.

Find every marker (the README keeps one of them, `TODO-08`, in an HTML comment, which GitHub does not draw):

```bash
git grep -nE "TODO-[0-9]{2}" -- README.md docs/submission docs/evidence/README.md
```

## 1. Markers that wait for other work

A marker is `TODO-` and two digits, written where the text will change. Each row says what replaces it and what it waits for.

| Marker | Where it sits | What replaces it | Waits for |
|---|---|---|---|
| `TODO-01` | README header; notes | the address of the unlisted deployment | CS-37: the owner chooses the host; CS-119 delivers the kit and a draft ADR comparing three hosts |
| `TODO-02` | README clone line; notes | the repository's address, and «private until the submission» deleted | the owner makes the repository public after section 4 |
| `TODO-03` | README header; notes | the video: the form's upload, or an Aparat link | the video (CS-75) |
| `TODO-04` | README (the extraction row, the limits); `numbers.md` N16 to N20 | the report and the one command of CS-48's harness (200 labelled listings, per-field precision and recall, cost); the figures in the README table and the notes change with it | CS-48 (lane `cs-48-evaluation-harness`) |
| `TODO-05` | README (the ranking row); `numbers.md` N25 | the 95th percentiles of search, home, listing and model page data at 100,000 listings, and the link to `docs/evidence/performance/` | CS-118 (with CS-116 in lane `cs-116-freshness-and-speed`) |
| `TODO-06` | README limits («searchable is a fraction») | the window that follows the last good crawl: delete the sentence that search empties after two days, and say the pages show the age of the data | CS-116 |
| `TODO-07` | README «What it looks like» | screenshots of the home page's model tiles and the model pages with their photos; `pick-examples.sql` block 7 shows which tracked models have a photo link | CS-113 and the owner entering the links in the superadmin section |
| `TODO-08` | README «Paste a link» (an HTML comment) | the sentence for an ad the index has not read, now read at once by the worker, and a screenshot of its waiting state | CS-117 (it follows CS-115, which is merged) |
| `TODO-09` | README «What it looks like»; every Farsi name the README quotes (chip, section and button names) | the screenshots retaken (section 6) and every quoted name compared with the new copy | the copy rewrite, CS-106 to CS-110 |
| `TODO-10` | README «Run it locally» | the command that restores a data release into an empty database, and the deployment runbook's link | CS-119 |
| `TODO-11` | `numbers.md` N13; README; notes | the valuation report: `pnpm valuation:evaluate --as-of <date> --cut-days 7 --write`, then 6.77 %, 306 and 69.0 % replaced; drop the sentence about listing age if weeks of price history now make it a real time test; add CS-73 and CS-74 if they are done | the next time the figures are quoted |
| `TODO-12` | README «Licence and credits» | the licence line (section 5) | the owner |
| `TODO-13` | notes | the contact details | the owner |

## 2. Decisions for the owner

- **D1. The licence.** Section 5 recommends MIT and holds the text. No `LICENSE` file was added.
- **D2. The sentence about Divar's terms**, in the notes and in the README's «Honest limits». They say the terms are recorded and, for this demo, not followed (ADR-0008, the owner's decision of 2026-09-28), and that a partner feed is the route a product would take. This is the honest statement and the one a reviewer cannot hold against a claim. The owner may reword it; neither text may say the opposite, and CS-75's note forbids claiming that the crawl follows robots.txt or the terms.
- **D3. Which address the commits carry.** Every commit is authored `youridol544 <78654088+youridol544@users.noreply.github.com>`. Once the repository is public that address is public. A no-reply address from now on is a git setting; the old commits keep theirs unless the history is rewritten, which is not recommended after a push.
- **D4. Real photos or stand-ins in the README.** The screenshots show drawn stand-ins so that no seller's photograph is stored in the repository (ADR-0025). The product itself shows Divar's own photos, loaded from Divar's addresses. Keep both.

## 3. Findings made while preparing the package

For CS-121 (the walk on real data) and the coordinator. None was fixed here: this lane writes documents.

- **F1. The status page counts a different set from search.** Its line «… آگهیِ فعالِ مدل‌های پوشش‌داده‌شده … در نتایج می‌آیند» said 12,336 of 26,229 on 2026-10-04: listings seen in 48 hours. Search shows only those whose details were read, 4,242 at the time (`search_document` held 4,236). Count the same set, or reword the line, before anyone quotes it. (`apps/web/src/features/data-status/server/data-status-queries.ts`, `shown`.)
- **F2. The hero's first example finds one listing.** «۲۰۶ تیپ ۵ بدون رنگ زیر ۷۰۰ میلیون» returned 1 listing on 2026-10-04 (a 206 type 5 under 700 million tomans is rare now). The example is the first thing a reviewer clicks. «زیر ۱٫۳ میلیارد» returns 13, and `۲۰۶ تیپ ۲ بدون رنگ زیر ۱ میلیارد` 44. (`home-copy.ts`, and `SMART_COPY.examples` in the e2e fixtures; the copy rewrite lane CS-106 owns the file.)
- **F3. Main's database holds the tests' leftovers.** 228 accounts beside the owner's own (170 `e2e_…`, 13 `e2e_superadmin_…`, 16 `files_…`, 8 `alerts_…`, 11 `mmmm…_…`, 10 `ali_`, `kian_`, `sara_`, `neda_`), 44 notifications (most of them theirs) and one wanted link. The 17 waiting re-checks and the 316 open review items are ordinary queues, not junk. The browser tests that run against the dev server (`E2E_BASE_URL=http://127.0.0.1:3000`) write to main's database. Run that suite against a scratch database, and clean this one with `pnpm db:psql < docs/submission/clean-check.sql` to see what is left. The deletions are the owner's to run by hand (the database guard hook refuses commands that destroy data, and rightly). A candidate, to read first, in a transaction, with `rollback` if a count surprises you:

  ```sql
  begin;
  -- buyers made by tests and lanes; their sessions, marks, notifications and search files go with them (ON DELETE CASCADE)
  delete from account
   where role = 'buyer'
     and username ~ '^(e2e|files|alerts|ali|kian|sara|neda)_[0-9a-z]+$|^m{5,}_[0-9a-z]+$';
  -- links pasted that the crawler has not read
  delete from wanted_link;
  select role, count(*) from account group by 1;   -- buyers: only the ones you meant to keep
  commit;
  ```

- **F4. A data release must not carry accounts.** The 13 test superadmins cannot be deleted while a change log names them (`tracked_model_change`, `model_spec_change`, `job_state_change` and the others are `ON DELETE RESTRICT` and append-only), so a release cut from main would put superadmin accounts into the deployed copy. Cut it without `account` and the tables that hang from it, and make the deployed superadmin with `pnpm account:superadmin`. CS-119 and CS-37 must know.
- **F5. Main's worker restarts every few seconds.** `clean-check.sql` block 1 counted 85 starts in ten minutes at 13:33 Tehran time on 2026-10-04, beside the one process that has run since 06:25. A second supervisor loop, or a held health port (3101), would explain it. The crawl itself was healthy (2,106 requests of 12,000, no cool-down).
- **F6. A reviewer cannot start the worker without a Metis key**, although `extraction.read` is not scheduled. The job is registered with `callsModels: true`, so `startModels` demands `METIS_API_KEY` at start (`apps/worker/src/models.ts`). Any non-empty value works and the README says so, but the worker could skip the layer when extraction is off.
- **F7. A clone cannot run without a font file.** `next dev` and `next build` stop without `YekanBakh-VF.woff2`. The README says any variable `woff2` will do. A free fallback face, committed, loaded when the licensed file is absent, would make the repository runnable for every reviewer; ADR-0015 chose to fail loudly, and the owner may revisit it for the public repository.
- **F8. The root template is `example.env`, not `.env.example`.** The name is deliberate (agents may not read `.env.*` files, and must be able to keep the template current: its header says so). The README names it. `e2e/.env.example` exists beside it and was not opened here (settings deny it): check that it lists `E2E_BASE_URL`.
- **F9. Opening a listing last checked over six hours ago queues a re-check**, and a pasted link adds a «paste» demand to its model. Both are the product working, and both showed in this lane's screenshot run on main: one re-check of listing 89002 (the worker has read it since) and three paste counts for the Peugeot 206 on 2026-10-04 (one from a probe of `/check`, two from the two screen sizes). They are real demand data, not junk.
- **F10. The README was rewritten.** Its contributor sections (first start in detail, the editor, every check, gorilla testing, site capture, working with Claude Code, work tracking, CI) moved to `docs/runbooks/development.md`, with the rows for the app, the packages and Claude Code brought up to date. A lane that edited the old README will conflict: put its row in `development.md` or in the new README's tables.
- **F11. ADR numbers 0022 and 0024 were never used.** The index now says so. The duplicated rows of 0033 and 0035 in `docs/decisions/README.md` were removed.

## 4. The repository seen from outside

Checked on 2026-10-04 on this branch, after merging main (commit `728a2e0`).

| Check | Result |
|---|---|
| Tracked files | about 2,100; no `.env`, key, certificate, dump, font or scratch file; the largest is a saved model run of 784 KB (`git ls-files -z \| xargs -0 du -k \| sort -rn \| head`) |
| Secret patterns in the working tree (keys of Metis, OpenAI, Anthropic, AWS, GitHub, Slack, Google; private-key headers; bearer tokens; URLs with passwords) | only test placeholders: `tpsg-test-key-never-real` and its kin, a PEM header over a repeated constant in a redaction test, `hunter2` and `p4ss` in redaction tests |
| The same over the whole history (about 600 commits, `git log --all -G'<pattern>'`) | no real key; two hits are the PEM test constant and the commented `# METIS_API_KEY=tpsg-...` in `example.env`. The only `.env`-like files ever added are `example.env` and `e2e/.env.example` |
| Personal data | no phone number outside test fixtures; the e-mail addresses are vendors', placeholders' and entries of a public common-passwords list; six evidence and research lines hold the owner's local paths (`/home/pedrum/…`) |
| `example.env` against the code | the variables the code reads and the file did not list are now there as comments: `CARSHENAS_RELEASE`, `CARSHENAS_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_SDK_DISABLED`. CS-119 will add a template for production |
| `.gitignore` | added `*.pem` and `*.key`; fonts, `.env*` (not `example.env`), traces, captures and `node_modules` were already ignored |
| Indexes | `docs/decisions/README.md` (duplicates removed), `docs/runbooks/README.md` (notifications and development added), `docs/specs/README.md` (S01 to S04 listed), `docs/evidence/README.md` (new), AGENTS.md's map names `docs/evidence/` and `docs/submission/` and stays at 149 lines |
| Branches | lanes are local branches. `origin` holds `main` and `cs-36-github-repo` (the first push's branch): delete the second, or keep it on purpose, before the repository is public |

Before the repository is made public (CS-36's checks, repeated):

1. Rerun the secret patterns over the tree and the history (the commands above), and `git ls-files | grep -Ei '\.(env|pem|key|woff2?|ttf|otf|dump|sqlite)$'`.
2. Read the README top to bottom as a stranger: every `TODO-` gone, every link opens.
3. Decide D1 and D3.
4. In GitHub: the description and topics, Actions off until CS-38 (or on, with CS-119's workflow), no wiki, no packages.
5. Open the public address in a private window.

## 5. The licence

The decision is the owner's. **Recommendation: MIT**, for the code and the documents, with the exclusions below. No `LICENSE` file was added.

| Option | For | Against |
|---|---|---|
| **MIT** | the usual choice for a portfolio; a reviewer may clone, run and reuse it; the owner holds the copyright and can license later versions otherwise | anyone may reuse the code commercially, the crawler included; no patent grant |
| Apache-2.0 | MIT's openness plus a patent grant | a longer text with a NOTICE file, and the same reuse |
| PolyForm Noncommercial 1.0.0 | reading, running and personal use allowed; commercial use not | not an open-source licence; whether a company evaluating a candidate counts as noncommercial is arguable |
| No file (all rights reserved) | keeps every right; GitHub still lets people view and fork | looks unfinished; nobody may legally run or reuse the code, a reviewer included |

Why MIT: the goal is the application, and what the code is worth to others is small beside the data, the judgement and the evidence around it. The crawler's exposure comes from running it, not from publishing it, and a licence changes neither. Reuse is bounded by what the grant does not cover:

- the typeface (Yekan Bakh 4, never in the repository), the photographs on the home page and the body-type selector (each under its own licence, in `credits.json`), the skill files copied from open projects (their licences are beside them), and Divar's content and name;
- nothing from a source's listings is committed, so there is none to license.

To adopt it, add a `LICENSE` file with the standard MIT text and `Copyright (c) 2026 <the owner's name>`, replace `TODO-12` in the README with «Licence: MIT. The typeface and the photographs are not covered; see Credits below», and record the decision in `docs/learnings.md` or a short ADR.

## 6. Retaking the README screenshots

Needed after the copy rewrite and the model photos (`TODO-07`, `TODO-09`). CS-123 captures a fuller set with its own script and a manifest; reuse it when it lands. The images in `docs/assets/readme/` were taken on 2026-10-04 from main's dev server with one throwaway Playwright script, not kept:

- **The screens.** Chromium, locale `fa-IR`, time zone `Asia/Tehran`, service workers blocked. Phone: the Pixel 7 profile at a device scale factor of 2 (412 × 915). Desktop: 1440 × 900 at 1.
- **Nothing reaches a listing site.** Every request to Divar's photo host (`*.divarcdn.com`) is answered with the drawn stand-ins of `stubSourcePhotos` (`e2e/fixtures/source-photos.ts`), and every other external host is aborted. The Next.js development badge is hidden (`nextjs-portal{display:none!important}`), the focus is blurred and the fonts are ready before each shot.
- **The moves.** `/` for the home page. The sentence typed in the hero's box (the `searchbox` named «چه ماشینی …»), Enter, wait for `a[href^="/listings/"]`, for the search. A great deal's page, `/listings/<id>` (`pick-examples.sql` block 1), wait for `[data-price]` (and for `[data-recheck="queued"]` when it was last checked over six hours ago), then the price scrolled to 150 px from the top on the phone, and the region «تحلیل قیمت» as an element screenshot. `/check` with a real paste event of `https://divar.ir/v/<token>` into its box, wait for `[data-check-answer] [data-price]`. `/status` once its figures arrive, and the region «ارزش بازار» as an element screenshot.
- **The files.** `convert in.png -quality 80 out.webp`, each under 300 KB, named as in the README (`home-desktop`, `home-phone`, `search-*`, `listing-desktop`, `listing-phone`, `listing-explanation-desktop`, `check-*`, `status-accuracy-desktop`).

Open every image before committing: no personal data, no development badge, no focus ring left on a heading.
