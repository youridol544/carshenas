# e2e — browser tests for Carshenas

Playwright Test in its own workspace package. `tests/app/` tests the real application (`apps/web`): by default the config builds it for production and starts it on port 3100, or it uses whatever `E2E_BASE_URL` points at. `tests/harness/` are the harness's own self-tests and always run against the Farsi RTL fixture site in `site/`, a mock used-car listings page (`pnpm fixture` serves it on port 4173). `.env.example` lists the local overrides. Decision record: `docs/decisions/0002-*`. Conventions for writing tests: `.claude/rules/e2e.md`.

Every context emulates **fa-IR** and **Asia/Tehran**. App projects: `mobile` (Pixel 7, the default target, buyers are phone-first), `desktop`, and `iphone` (WebKit) with `E2E_WEBKIT=1`; `pnpm browsers` installs only Chromium, so install WebKit once with `pnpm exec playwright install webkit` (add `--with-deps` on a fresh Linux machine). Harness projects: `fixture-mobile`, `fixture-desktop`. Gorilla projects: `chaos-mobile`, `chaos-desktop`, switched on only by `pnpm gorilla`.

## Commands

From the repo root use the short forms `pnpm e2e [args]`, `pnpm e2e:ui`, `pnpm e2e:failed`, `pnpm e2e:visual`, `pnpm e2e:typecheck`, `pnpm fixture`. Everything else below runs inside `e2e/` (or with `pnpm --dir e2e <script>`).

| Need | Command |
|---|---|
| Install once (repo root) | `pnpm install && pnpm browsers` |
| Run everything, headless | `pnpm test` |
| One project / one file / one title | `pnpm test:mobile` · `pnpm test tests/harness/smoke.spec.ts` · `pnpm test -g "saves a listing"` |
| Re-run only what failed | `pnpm test:failed` |
| Only tests touched since `main` | `pnpm test:changed` |
| Watch and time-travel in the UI | `pnpm test:ui` |
| Step through with the inspector | `pnpm test:debug` (or put `await page.pause()` in a test) |
| See the browser | `pnpm test:headed` |
| Record a new test by clicking | `pnpm codegen http://127.0.0.1:4173` (start `pnpm site` first) |
| Open the last HTML report | `pnpm report` |
| Open a trace in the viewer | `pnpm trace test-results/<test>/trace.zip` |
| Inspect a trace without a GUI (agents) | `npx playwright trace open <trace.zip>`, then `trace actions --errors-only`, `trace console`, `trace requests --failed`, `trace close` |
| Step through a test from the terminal (agents) | `pnpm test tests/app/x.spec.ts --project=mobile --debug=cli` in the background, then `npx playwright cli attach <session>` |
| Visual comparisons | `pnpm test:visual` · update baselines: `pnpm test:visual:update` (both run in the official container) |
| Only the harness self-tests (no app build) | `pnpm test:fixture` |
| Against a running dev server (fast loop) | `E2E_BASE_URL=http://127.0.0.1:3000 pnpm test tests/app --project=mobile` |
| Prove the failure path works | `pnpm selfcheck` (must exit 1 and leave a trace, screenshot and report) |
| Seeded random abuse of the app (repo root) | `pnpm gorilla` · replay: the command it prints · prove the oracles: `pnpm gorilla --selfcheck` |
| Rehearse the five-minute demo on the running app and its real data (repo root) | `pnpm e2e:demo`: `tests/demo/demo-walk.spec.ts` under `playwright.demo.config.ts`, outside `pnpm e2e`, seeding nothing; screenshots and `walk-report.md` in `e2e/demo-shots/<time>/` (gitignored); the inputs are `DEMO_*` variables listed at the top of the spec; `docs/submission/recording-day.md` |
| Typecheck the tests | `pnpm typecheck` |

## What a failure leaves behind

`test-results/<test>/` holds `error-context.md` (the error, the received value and the page's ARIA snapshot: read this first), `test-failed-1.png`, `trace.zip`, and `browser-log.txt` when the page logged errors. `playwright-report/` holds the HTML report. All of it is gitignored.

## Fixtures (`fixtures/test.ts`)

Import `test` and `expect` from `../../fixtures/test`, never from `@playwright/test`.

- **browserLog** (automatic): console errors, uncaught exceptions and failed or 4xx/5xx requests fail the test. Silence a known-noisy third party with `test.use({ ignoreBrowserErrors: [/pattern/] })`, never by deleting the assertion.
- **a11y.check()**: axe scan, WCAG 2.x A and AA.
- **rtl**: `expectDocumentRtl()`, `expectNoHorizontalOverflow()`, `expectPersianDigits(locator)`, `expectInlineOrder(first, second)`.

Two helpers measure what a screenshot cannot show (CS-112), both plain functions of a `page`:

- **`fixtures/button-centring.ts`** (`measureButtonCentring`, `measureControlCentring`): how far the centre of what a button shows (its text and drawn icons, never an overlay such as the pending spinner or an invisible slot) sits from the centre of the button. `tests/app/button-labels.spec.ts` holds the shared button to 1 px in every state and every centred action on every page.
- **`fixtures/scroll-regions.ts`** (`scanScrollRegions`): every element that scrolls, with the room a scrollbar took, whether it can scroll now and whether another scroll area sits around it. Headless Chromium draws no scrollbars (`--hide-scrollbars`, and a phone profile overlays them), so a test that looks for one sets `launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }` and `isMobile: false` (`tests/app/no-scrollbars.spec.ts`).

## Pointing somewhere else

```bash
E2E_BASE_URL=http://127.0.0.1:3000 pnpm test tests/app                  # an already running `pnpm dev`
E2E_BASE_URL=https://preview.example.ir pnpm test tests/app             # a deployed preview
E2E_WEB_SERVER_CMD="node node_modules/next/dist/bin/next dev --port 3100" pnpm test   # custom start command (cwd: apps/web)
```

## Visual baselines

Screenshots differ between machines because fonts and rasterisation differ, so `@visual` tests are skipped unless `E2E_VISUAL=1`, and baselines in `tests/<folder>/__screenshots__/` (`tests/harness/` for the fixture, `tests/app/` for the app's `/design` and 404 pages) are only ever written by `pnpm test:visual:update` (`--update-snapshots=all`: a bare `--update-snapshots` keeps any image within the 1% tolerance), which runs in `mcr.microsoft.com/playwright:v<installed version>-noble` (a 2.5 GB image). CI runs in the same image. That image has no Persian UI font (it falls back to FreeSerif), so the app self-hosts its typeface and visual tests wait for `document.fonts.ready`. The container builds and serves the app from the mounted workspace, so the licensed font must be in place first (`docs/runbooks/licensed-font.md`).

## Gorilla: seeded random abuse (`tests/chaos/`, `gorilla/`)

Scripted tests walk the paths someone thought of. The gorilla taps, double-taps, types hostile strings (`gorilla/strings.ts`: Persian digits in three scripts, zero-width non-joiners, Arabic yeh and kaf, bidi controls, very long words), presses keys, scrolls, resizes, goes back and forward and pauses, in random but seeded order, on every page in `fixtures/app-pages.ts`. After every run the oracles in `gorilla/oracles.ts` decide whether something broke: uncaught exceptions, console errors, failed requests (network errors, 5xx, own 4xx), native `alert`, `confirm` and `prompt` dialogs, sideways overflow, garbage text (`NaN`, «ناعدد», `undefined`, `[object Object]`, `Invalid Date`), an error screen, an empty page, broken images, focus lost when the focused control disappeared, main-thread stalls over 1 s, a page that stops responding, a run that crashes, and axe on the final state. Slow paints after an interaction are only warnings: they do not replay reliably.

```bash
pnpm gorilla                                   # every app page, random seed, phone, 60 s of searching per page
pnpm gorilla / --scope main --budget 120       # one page, only controls inside <main>, two minutes
pnpm gorilla --seed 20260921 --runs 40 --project both   # fixed seed and run count on phone and desktop (CI on pull requests)
pnpm gorilla '/' --seed 42 --actions 30 --path '7:1:0'   # replay a failure exactly as printed (writes to test-results-replay/)
pnpm gorilla --selfcheck                       # prove every oracle on the lab page with planted defects
```

A failure is shrunk to a short action sequence, replayed once from its seed and path to prove it reproduces the same problem, and reported with the problems, the sequence and the replay command. `test-results/<test>/` then holds `gorilla-seed-<seed>.json` (the action log) and `gorilla-seed-<seed>-trace.zip` (the trace of that replay, a few actions long). Runs are never retried: a retry repeats the same failure, and a new seed would hide it. A finding becomes a scripted regression test in `tests/app/` once it is fixed.

The gorilla never presses controls named like deleting, paying or signing out, by tap or by Enter and Space on the focused control (`DEFAULT_DENY` in `gorilla/actions.ts`; names come from the accessibility snapshot, as `getByRole` sees them), never leaves the page's origin (outside navigations get an empty 204), and closes pop-ups. Test destructive flows with scripts.

`site/lab/` is a small installment-and-comparison widget with nine planted defects behind `?defect=` (`throw`, `request`, `overflow`, `garbage`, `focus`, `focus-query`, `stall`, `a11y`, `load`). `tests/harness/gorilla-selfcheck.spec.ts` proves that the clean page survives 20 runs and that each defect is found and replayed. It counts runs, not seconds, so the same seed does the same thing on every machine. `pnpm e2e` leaves it out (it takes about two minutes); CI runs it in the gorilla job.

The deterministic half is `tests/app/layout-stress.spec.ts`, part of `pnpm e2e`: every app page at each width of the project (320 to 1920 px), with every string inflated to long Farsi, with the browser font size doubled (text must grow: WCAG 1.4.4), on a slow network, with its scripts failing to load, and walked with Tab (visible focus, names, no trap). `tests/harness/layout-selfcheck.spec.ts` breaks the fixture site on purpose to prove those checks notice.

## CI

`.github/workflows/e2e.yml` runs on pushes to `main` and on pull requests, inside the same container: it builds the app, runs `tests/app` on `mobile`, `desktop` and `iphone` (WebKit) and `tests/harness` on the fixture projects, and uploads `playwright-report/` and `test-results/` as the `playwright-report` artifact. Its `gorilla` job runs `pnpm gorilla --selfcheck`, then `pnpm gorilla` with a fixed seed and a fixed number of runs on phone and desktop, and uploads the action logs and replay traces as `gorilla-pr`. `.github/workflows/gorilla-nightly.yml` runs a longer pass with a new random seed every night at 02:00 Tehran time (and on demand with a chosen seed, page or budget); a red run prints the seed to replay. When the suite grows past a few minutes, add `--shard` with the blob reporter and a `merge-reports` job.

## Upgrading Playwright

Bump both catalog entries in `pnpm-workspace.yaml`, then from the repo root: `pnpm install`, `pnpm browsers`, `pnpm skills:sync` (refreshes the bundled agent skills), `pnpm e2e:visual --update-snapshots=all`, and review the screenshot diff. The CI image tag follows the catalog automatically.
