# The submission package

What Torob's reviewers open first: the repository, which starts at the root [README](../../README.md), and the optional notes field of the form (`docs/product/challenge.md`). Prepared in CS-120. The video is designed elsewhere (CS-122, CS-123); nothing here plans it. Scope is Divar only.

| File | What it is | Used by |
|---|---|---|
| [`notes.md`](notes.md) | The text for the form's «توضیحات تکمیلی», in Farsi and English, full and short | the submission |
| [`numbers.md`](numbers.md) | Every number the README and the notes quote, each with the command that regenerates it and the file it comes from. Raw material for anything else that quotes the product's figures | the README, the notes, CS-123 |
| [`open-items.md`](open-items.md) | The markers that wait for other tasks, the owner's decisions (the licence among them), findings from preparing the package, the repository's state seen from outside, how to retake the README screenshots | the final pass |
| [`pick-examples.sql`](pick-examples.sql) | Read-only: real listings to show, from the database the product shows: a great deal, an expensive one, an unrated one with its reason, a price drop, links to paste, and the shape of what has no rating | whoever needs real examples: screenshots, QA, the video's material |
| [`clean-check.sql`](clean-check.sql) | Read-only: is the crawl healthy, is the worker alive and not restarting, and which test rows (accounts, notifications, wanted links) are left in the database | CS-121's clean-up, any deployment |

Run the two scripts from the main checkout: `pnpm db:psql < docs/submission/pick-examples.sql`, `pnpm db:psql < docs/submission/clean-check.sql`. Both only read.

## Conventions

- **`TODO-nn`** marks text that waits for another task. `open-items.md` lists every marker with what replaces it. `git grep -nE "TODO-[0-9]{2}" -- README.md docs/submission` finds them.
- **`N01` to `N31`** are the rows of `numbers.md`.
- **Dated.** Every value was checked on 2026-10-04. Listings, counts and times change by the hour: `numbers.md` says which values vary.
- **Voice.** The Farsi follows `docs/design/product-voice.md`: calm, plain, no hype, and no thresholds or internals a buyer cannot check.
- **No personal data.** Nothing here quotes a listing's title or description, a phone number or a name: listings appear as ids, Divar's public ad tokens, models, years, kilometres and prices.

## What the final pass does

1. CS-48, CS-113, CS-115 to CS-119 and the copy rewrite merge (`open-items.md`, section 1).
2. CS-121 walks the product on real data and cleans the database (`clean-check.sql`).
3. Replace the markers, retake the README screenshots, decide the licence, make the repository public (`open-items.md`).
