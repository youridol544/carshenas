# Gorilla, monkey and model-based testing on the Playwright harness

- Date: 2026-09-21 (research pass and spike on 2026-09-17 and 2026-09-18; the engine built, measured and corrected on 2026-09-21)
- Asked by / for: Pedrum ("reserch on how to setup gorilla tests for ui/ux too now that we have playwright")
- Outcome: a seeded, time-boxed gorilla in `e2e/gorilla/` and `e2e/tests/chaos/` run by `pnpm gorilla`; a lab page with eight planted defects and a self-check that proves every oracle; a deterministic stress matrix in `e2e/tests/app/layout-stress.spec.ts`; a fixed-seed CI job on pull requests and a random-seed nightly workflow. One new dependency: `fast-check` 4.10.2 (MIT).

## Questions

1. What do gorilla, monkey, fuzz, random, model-based, property-based, chaos and exploratory testing mean, according to sources that define them?
2. Which tools do random UI testing with Playwright, and do they find real defects in a Farsi, right-to-left page?
3. What decides that a random run failed (the oracle problem), and which oracles have signal rather than noise?
4. How is a random failure reproduced, shrunk and kept out of flaky territory in CI?
5. What can random testing not tell us?

## Method and limits

A research pass over definitions (ISTQB glossary API and PDFs, primary tool documentation, repositories and issues, papers) and a hands-on spike in a scratch project on 2026-09-17/18: the same lab widget with the same oracles attacked by gremlins.js and by a Playwright-native gorilla driven by fast-check, plus the fixture site and a copy of the real app. On 2026-09-21 the engine was rebuilt in the repo, run against the lab page, the fixture site and the production build of the app, and corrected where the measurements disagreed with the design (below). Web search ran out part-way through the first pass, so some practitioner reports rest on direct fetches; items without a recorded URL say so. Pseudo-localisation was not researched: Farsi is the source language, and text inflation covers the same risk.

## Sources and why they are credible

| Source | Why credible | What was used |
|---|---|---|
| ISTQB glossary | The testing profession's standard vocabulary | [Glossary API](https://api.glossary.istqb.org/v1/terms) (1,128 terms, current); "monkey testing" from [glossary 2.3](https://www.astqb.org/assets/documents/ISTQB_glossary_of_testing_terms_2.3.pdf) and [3.1](https://www.ctqb.org/files/content/ctqb/downloads/istqb/ISTQB%20Glossary%20of%20Testing%20Terms%203.1.pdf) because the current glossary dropped it |
| Andy Hertzfeld | Built the original Macintosh "Monkey" | ["Monkey Lives"](https://www.folklore.org/Monkey_Lives.html) (story of October 1983) |
| Android team | Ships the best-known seeded monkey | [UI/Application Exerciser Monkey](https://developer.android.com/studio/test/other-testing-tools/monkey) (updated 2023-04-12) |
| Google Testing Blog | Field report at scale | ["How the Google+ Team Tests Mobile Apps"](https://testing.googleblog.com/2013/08/how-google-team-tests-mobile-apps.html) (2013-08-30) |
| Ministry of Testing | Practitioner community glossary | ["Gorilla testing"](https://www.ministryoftesting.com/software-testing-glossary/gorilla-testing) (Michael Close, 2025-06-27) |
| James Bach and Michael Bolton | Authors of the testing/checking distinction | [ET 3.0](https://www.satisfice.com/blog/archives/1509) (2015), ["Testing and Checking Refined"](https://www.satisfice.com/blog/archives/856) |
| Principles of Chaos Engineering | The chaos-engineering definition | [principlesofchaos.org](https://principlesofchaos.org/) (updated 2019-03) |
| marmelab | Authors of gremlins.js | [gremlins.js](https://github.com/marmelab/gremlins.js) source, README and issues #182, #185, #199; ["gremlins.js 2.0"](https://marmelab.com/blog/2020/06/02/gremlins-2.html) (2020-06-02) |
| Antithesis (Oskar Wickström) | Property-based web testing research and tooling | [Bombadil](https://antithesishq.github.io/bombadil/) v0.7.5 docs; ["There and back again"](https://wickstrom.tech/2026-01-28-there-and-back-again-from-quickstrom-to-bombadil.html) (2026-01-28); Quickstrom paper [arXiv 2203.11532](https://arxiv.org/abs/2203.11532) |
| Nicolas Dubien | Author of fast-check | [fast-check](https://github.com/dubzzz/fast-check) 4.10 docs (model-based testing, `commands`, replay by seed and path) and issue #253 (2018-12-22) |
| Stately | XState authors | [xstate/graph](https://stately.ai/docs/graph) (path generation, `@xstate/test` deprecated) |
| Anthropic | Measured agents as QA | ["Harness design for long-running apps"](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24) |
| Kent C. Dodds | Testing Library author | ["The Testing Trophy and Testing Classifications"](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) (2021-06-03) |
| Choudhary, Gorla and Orso | Academic comparison of Android input generators | [arXiv 1503.07217](https://arxiv.org/abs/1503.07217) (2015) |
| Max Woolf | Big List of Naughty Strings | [BLNS](https://github.com/minimaxir/big-list-of-naughty-strings) (515 strings, last content commit 2021-04-17; counted on 2026-09-22: 13 with right-to-left or bidi characters, 1 with letters specific to Persian, 2 with a zero-width non-joiner) |
| W3C, web.dev | Standards and platform guidance | WCAG 2.2 SC 1.4.4 and 1.4.10; Arabic and Persian layout requirements (alreq, 2025-10-02); web.dev on INP ("Poor values are greater than 500 milliseconds") |
| Other reports | Named, but URL not recorded in the pass | Facebook Sapienz (2018-05-02: "75 percent of Sapienz reports are actionable"); Stuart Thomas on gremlins.js and multi-page apps (2022-07-17); Thoughtworks Technology Radar, November 2025; Sentry's dead-click definition |
| Hands-on | This machine, Chromium 153, Playwright 1.63.0 | Every measurement marked "measured" below |

## Findings: definitions

| Term | Definition and source |
|---|---|
| Monkey testing | "Testing by means of a random selection from a large range of inputs and by randomly pushing buttons, ignorant of how the product is being used" (ISTQB glossary 2.3 and 3.1; absent from the current glossary). The name comes from Hertzfeld's 1983 Monkey, which fed "random events to the current application". Android's Monkey adds the property that matters: "If you re-run the Monkey with the same seed value, it will generate the same sequence of events." |
| Gorilla testing | Not in any ISTQB edition. Ministry of Testing: repeatedly and intensively testing one module or feature. In practice: hammering one feature with repeated, random and extreme input. That is what `--scope` does. |
| Fuzz testing | "A test technique in which high volumes of random data are used to generate test inputs" (ISTQB). |
| Random testing | "A black-box test technique in which input values are randomly generated" (ISTQB). |
| Property-based testing | "Test results are verified using specified relations between inputs and expected results" (ISTQB). |
| Model-based testing | "Testing based on or involving models" (ISTQB). fast-check's docs: "Model-based testing can also be referred to as Monkey testing to some extent." |
| Chaos engineering | "The practice of randomly injecting failures to gather information about system resilience" (ISTQB); "experimenting on a system in order to build confidence in the system's capability to withstand turbulent conditions" (principlesofchaos.org). The network and text-size conditions in the stress matrix are this idea applied to one page. |
| Exploratory testing | "Tests are dynamically designed and executed based on tester's knowledge, exploration of a test item, and previous test results" (ISTQB). Bach and Bolton: "Testing cannot be automated." Everything built here is machine checking, not testing. |
| Test oracle problem | "The challenge of determining whether a test has passed or failed for a given set of test inputs and state" (ISTQB). It decides the whole design. |

## Findings: tools

- **gremlins.js** (2.2.0, 2020-07-21; last master commit 2022-01-26): rejected. On the same lab widget with the same oracles, it caught **0 of 3** planted defects in six 120-second runs of about 5,700 actions each (measured 2026-09-18). Its clicker dispatches untrusted synthetic events at random pixels; instrumented, it made one click that opened a modal and then stayed behind the backdrop for the rest of the run. Its form filler is ASCII only (no Persian), its `dblclick` is one event, a full navigation destroys the horde, and its fps mogwai logs errors that trip a console guard.
- **Bombadil** (Antithesis, 0.7.5, "new and experimental"): a standalone Chromium fuzzer with LTL specifications and default properties (uncaught exceptions, error logs, 4xx/5xx). Promising for nightly runs once there are real flows; "Reproductions are not guaranteed to succeed". Not now.
- **fast-check** (4.10, MIT, maintained daily): chosen as the engine. Seeded generation, shrinking to a minimal counterexample, and replay by seed and path. On the spike's lab it found all four rule defects with shrunk counterexamples such as `[type("۱۹")]` and `[doublePressAdd]`.
- **XState graph**: path generation from a state machine, useful only if the app adopts XState.
- **Playwright** itself: trusted input with real actionability (`click`, `dblclick`, `fill`, `keyboard`, `mouse.wheel`, `setViewportSize`, history), `page.route` for network faults, CDP for font size and throttling. No Playwright-native monkey library exists (npm search found only gremlins forks).
- **AI exploratory agents**: Anthropic reports that "Out of the box, Claude is a poor QA agent" and still missed "small layout issues" after tuning. Useful at review time (the `design-reviewer` agent), never as a CI oracle.

## Findings: oracles, ranked by signal

From the spike (3,000 random actions on the clean widget gave 0 false positives once tuned) and today's runs:

1. Uncaught exceptions and console errors: high signal.
2. Horizontal overflow: high; only valid as a page-level measure (on an overflowing phone page, mobile emulation zooms out and every element "escapes").
3. Error screen, empty page, garbage text (`NaN`, «ناعدد», `undefined`, `[object Object]`, `Invalid Date`): high. «ناعدد» is how `Intl` formats `NaN` for `fa-IR`, so it is the Persian-digit bug's signature.
4. Accessibility after chaos (axe on the final state) and lost focus (the focused control disappeared and focus fell to the page): high and deterministic.
5. Failed requests: high once cancellations by navigation are excluded.
6. Main-thread stalls (Long Tasks over 1 s): crisp for real stalls (the planted 1.5 s stall is caught every time), with a limit far above the 66–84 ms tasks a clean page shows at load.
7. Slow paint after an interaction (Event Timing): **demoted to a warning on 2026-09-21**. A clean page measured 1,288 ms once and shrinking never reproduced it (0 shrinks), which is exactly what a seeded, replayable finding must not be.
8. Dead clicks, CLS during hammering, rAF latency: noisy or blind (CLS ignores shifts within 500 ms of input); not used.

## Findings: reproducibility, measured on 2026-09-21

- **Time budgets must not interrupt a run.** fast-check's `interruptAfterTimeLimit` returns while the run in flight keeps driving the page in the background (seen as an axe scan failing with "Test ended" after the result was reported). The runner now enforces its own deadlines between runs, so every run finishes before the next step.
- **A time budget makes a fixed seed machine-dependent**: a slower machine executes fewer runs of the same sequence. The PR job accepts that (it explores a fixed prefix); the self-check counts runs instead of seconds, so it does the same thing everywhere.
- **Trace the replay, not the search.** Playwright's `retain-on-failure` trace of a whole search was 33 MB for 36 runs. The gorilla now replays its minimal failure once from seed and path with tracing on: 0.75 MB, a few actions long, and proof that the finding reproduces ("the replay failed the same way").
- **The replay command must carry everything that shapes generation**: `--actions` (the maximum sequence length) is printed with the seed and path.
- **Every run starts from the same state**: storage and cookies cleared, viewport restored, a fresh load. Otherwise a replay would not match.
- **No retries** for chaos projects and the self-check: a retry repeats the same failure or, with a new seed, hides it.
- **"Reproduced" means the same problem**, digits aside, not merely another failure; a replay that fails differently says so.
- **Errors while the page loads count**: the oracles are reset before each load, not after it (the first version dropped them, found in review).
- **Focus that falls back after a navigation is not "lost focus"**: Next.js leaves focus where it was on client navigation, so a link that replaces its page would otherwise be flagged on every click.
- **The deny-list covers the keyboard**: Enter or Space on a focused control named like delete, pay or sign out is skipped, and names come from Playwright's accessibility snapshot (labels, `aria-labelledby`, button values), the same names `getByRole` uses.
- **No suite-wide time limit for gorilla runs** (`--global-timeout=0`): each test is time-boxed by its budget, and the 30-minute CI limit would kill a long nightly run in the middle of shrinking. A replay started by hand writes to `test-results-replay/` so the original log and trace survive.
- `@axe-core/playwright` opens a blank helper page per scan; with video on this produced one empty video per run, so chaos projects record no video.

## Design chosen

- `pnpm gorilla [url] [--scope css] [--seed n|random] [--path p] [--budget s] [--runs n] [--actions n] [--project mobile|desktop|both]` prints the seed first; a failure prints the problems, the minimal sequence, the action log path, the replay trace and the replay command.
- Actions: tap and double tap (hit-tested, so controls behind a modal are skipped; shadow DOM skipped; controls named like delete, pay or sign out never pressed), typing hostile strings (Persian corpus in `gorilla/strings.ts`, because only one of BLNS's 515 strings uses letters specific to Persian and two contain a zero-width non-joiner), keys, scroll, resize, back, forward, reload, pause. The origin is fenced (outside navigations get a 204); pop-ups are closed.
- Oracles as ranked above; axe on the final state of every run.
- `e2e/site/lab/` plants eight defects (`throw`, `request`, `overflow`, `garbage`, `focus`, `stall`, `a11y`, `load`); `pnpm gorilla --selfcheck` proves each is found by its oracle and replayed, and that the clean page survives 20 runs. Measured on 2026-09-21: the first seven found within 3–13 runs, whole self-check 1.8 minutes. Re-measured on 2026-09-26 with all eight: found within 2–19 runs, whole self-check 1.3 minutes.
- The deterministic stress matrix runs in `pnpm e2e`: widths 320–1920 px, text inflated to long Farsi, the browser's default font size doubled through CDP (text must grow, WCAG 1.4.4), a slow network, failing scripts, and a keyboard walk that judges focus indicators by change against each control's unfocused look. Negative controls on the fixture site prove each check fires.
- CI: `e2e.yml` gains a `gorilla` job (self-check, then seed 20260921 for a fixed 40 runs per page on phone and desktop, so every machine plays the same sequences; the budget is only a safety net); `gorilla-nightly.yml` runs 300 s per page with a new seed at 02:00 Tehran time and on demand, phone and desktop as two parallel jobs. Both run their steps under bash (container jobs default to `sh`, where the nightly script's array was a syntax error, found in review and confirmed with dash).

## Limits

- Random testing finds crashes, broken states and layout breakage. It cannot judge whether the UX is good, whether copy is right, or whether a flow makes sense (Bach and Bolton: this is checking, not testing).
- Rules are cheaper to test as properties of pure functions in Vitest (Dodds: return on investment); the browser gorilla is for integration defects.
- Today the app has one page with no controls, so the gorilla mostly scrolls, resizes and presses keys there; its value grows with every feature added to `fixtures/app-pages.ts`.
- Not built yet: data-level hostility for server-rendered pages (a hostile fixture dataset once `server/*-queries.ts` exist), network chaos on Server Actions, a duplicate-submit oracle, multiple tabs, click-before-hydration under CPU throttling, and a model-based test per stateful widget (filter sheet, comparison tray, OTP). Each belongs with the feature that needs it.
- The CI jobs have not run on GitHub yet (the repository has no remote yet, CS-21); both workflow files pass actionlint 1.7.12, the nightly step was syntax-checked under bash and dash and dry-run, and the commands they run were run locally with `CI=1`. The stress matrix ran on WebKit inside the official container.

## Recommendation

Keep the Playwright-native, fast-check-seeded gorilla with explicit oracles, the planted-defect self-check as its guard, and the deterministic stress matrix in the normal suite. Revisit Bombadil for nightly runs when real multi-page flows exist, and add model-based tests per stateful widget as those widgets are built. What would change this: a maintained Playwright-native monkey with trusted input and replay (none exists as of 2026-09-18), or Bombadil reaching reliable reproduction.
