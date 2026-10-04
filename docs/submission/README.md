# The reviewer package

What Torob's reviewers open, and what the owner needs to record once: the repository (the root [README](../../README.md) first), the five-minute video and the optional notes field of the form (`docs/product/challenge.md`). Prepared in CS-120; the recording and the submission are CS-75, which the owner does. Scope is Divar only.

| File | What it is | Used by |
|---|---|---|
| [`notes.md`](notes.md) | The text for the form's «توضیحات تکمیلی», in Farsi and English, full and short | the submission |
| [`demo-script.md`](demo-script.md) | The timed five-minute script: what is on screen, what is said in Farsi, the English cue, the numbers each scene quotes, the order of the decisions (the data decision first), what to cut if it runs long | the recording |
| [`shot-list.md`](shot-list.md) | The exact sentences, links and listings for each scene, with alternates, and how to pick fresh ones on the day | the recording, the rehearsal |
| [`numbers.md`](numbers.md) | Every number the script, the notes and the README quote, each with the command that regenerates it and the file it comes from | everything |
| [`recording-day.md`](recording-day.md) | The pre-recording checklist (data state, a clean database, accounts, browser profile and window, network, noindex, the rehearsal) and the recovery plan | the recording |
| [`open-items.md`](open-items.md) | The markers that wait for other tasks, the owner's decisions (the licence among them), findings from preparing the package, the repository's state seen from outside, how to retake the screenshots | the final pass |
| [`pick-examples.sql`](pick-examples.sql) | Read-only: candidate listings for the scenes, from the database the product shows | the shot list |
| [`clean-check.sql`](clean-check.sql) | Read-only: is the crawl healthy, and are test rows left in the database | the checklist |

The rehearsal is one command, `pnpm e2e:demo` (`e2e/tests/demo/demo-walk.spec.ts`, configured by `e2e/playwright.demo.config.ts`). It walks the demo path with the exact sentences and listings, saves the screenshots to `e2e/demo-shots/<time>/` and writes `walk-report.md`. It is outside `pnpm e2e` on purpose: it runs against real data and seeds nothing. It was written and typechecked, and not run, in CS-120.

## Conventions

- **`TODO-nn`** marks text that waits for another task. `open-items.md` lists every marker with what replaces it. `git grep -nE "TODO-[0-9]{2}" -- README.md docs/submission` finds them.
- **`[[…]]`** in the script marks a figure to read off the screen on the day. The 2026-10-04 value stands in the brackets.
- **`N01` to `N31`** are the rows of `numbers.md`.
- **Dated.** Everything with a value was checked on 2026-10-04. Listings, counts and times change by the hour: the files say which values vary.
- **Voice.** The Farsi follows `docs/design/product-voice.md`: calm, plain, no hype, «شما» when addressing the viewer, and no thresholds or internals a buyer cannot check.
- **No personal data.** Nothing here quotes a listing's title or description, a phone number or a name; listings appear as ids, Divar's public ad tokens, models, years, kilometres and prices.

## Order of work for the final pass

1. CS-48, CS-113, CS-115 to CS-119 and the copy rewrite merge (`open-items.md`, section 1).
2. CS-121 walks the path once (`pnpm e2e:demo`), fixes what is rough, cleans the database.
3. Replace the markers, retake the README screenshots, decide the licence, make the repository public (`open-items.md`).
4. The owner follows `recording-day.md`, records, uploads and submits.
