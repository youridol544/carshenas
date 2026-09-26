# UI/UX design knowledge and tooling for Claude Code on a Farsi, right-to-left product

- Date: 2026-09-18
- Asked by / for: Pedrum ("setup claude code for any skills and any kind of things that help with ui/ux design")
- Outcome: a project skill (`.claude/skills/ui-design/`) with eight references and four vendored MIT guideline files, a path-scoped rule (`.claude/rules/ui.md`), a read-only `design-reviewer` agent, and vision-limit additions to `/verify-ui`. No design plugin, no design SaaS, no design tool installed.

## Questions

1. Which design skills, plugins and tools available to Claude Code help produce non-generic, correct interfaces, and which should be rejected for this product?
2. What design knowledge must be written for this project because nothing published covers it (right-to-left, Persian typography and formatting, phone-first, listings and prices)?
3. How do practitioners run the loop from reference capture to implementation to verification, and what can and cannot be automated?

## Method and limits

Thirteen parallel research passes over primary sources on 2026-09-18 (official docs, repositories at pinned commits, npm and GitHub APIs, W3C and WCAG texts, NN/g and Baymard public articles), plus hands-on checks in Chromium 153 and Node 22 for every Persian claim (bidi ordering, `Intl` output, font features, input patterns), one hands-on install of each candidate CLI in a scratch directory, and a test of what model vision can see (a 2 px shift). The session's web-search quota ran out part-way, so practitioner reports from Hacker News and X are thin and Reddit was not reachable; those items are marked as such rather than guessed. Reachability of any host from an Iranian IP could not be verified from this machine. Nothing was carried over from other projects.

## Sources and why they are credible

| Who | Why credible | What was read |
|---|---|---|
| Anthropic | Makers of the model and of Claude Code | "Improving frontend design through Skills" (2025-11-12); Claude Opus 4.8 prompting guide; harness design post (2026-03-24); Claude Code best practices; `anthropics/skills` and `claude-plugins-official` at their 2026-09 commits |
| Vercel Labs (one Vercel engineer) | Web-platform rules used across Vercel products | `vercel-labs/web-interface-guidelines` `AGENTS.md` at `e3d624b` (2026-08-18); issues #11, #26, #30, #91, #316; the `skills` CLI 1.7.0 source |
| Emil Kowalski | Designer-engineer (Sonner, Vaul, formerly Vercel/Linear) | `emilkowalski/skills` at `85e8e23` (2026-09-15) |
| Jakub Krehel | Design engineer | `jakubkrehel/make-interfaces-feel-better` at `35545ea` (2026-08-29) |
| Julien Thibeaut (ibelick) | Design engineer | `ibelick/ui-skills` at `c5bcd86` (2026-09-15) |
| Rauno Freiberg | Design engineer (Vercel) | "Invisible Details of Interaction Design" (2023-07); `raunofreiberg/interfaces` |
| Adam Wathan and Steve Schoger | Refactoring UI, Tailwind | "7 Practical Tips" (2018-02-20), refactoringui.com previews, "Redesigning Laravel.io" (2017-10-04), dated tweets |
| Ahmad Shadeed | Front-end engineer, the reference on RTL CSS | RTL Styling 101 (rtlstyling.com) |
| W3C | Standards | Internationalization articles on structural and inline bidi markup (2021-06-25), Arabic and Persian Layout Requirements (alreq), WCAG 2.2 (2024-12-12), WCAG 3 Working Draft (2026-09-10), ARIA Authoring Practices |
| Material Design 2 and 3, Apple HIG | Platform guidelines with explicit RTL and touch rules | Bidirectionality, touch targets, navigation bar, bottom sheets, tokens; HIG layout and RTL |
| Nielsen Norman Group | Usability research | Ten heuristics, F-pattern in RTL (reviewed 2026-08-19), filters, steppers (2026-03-19), bottom sheets (2023-06-11), response times, empty states, form labels |
| Baymard Institute | Large-sample usability research (public articles only) | Result lists, mobile loading, applied filters (2026-05-13), no-results, inline validation (2024-01-09) |
| Luke Wroblewski, Steven Hoober | Form and mobile research | Label placement (2007), inline validation (2009), "Obvious Always Wins" (2015); phone grip study (2013, n=1,333) |
| GOV.UK Design System | Tested error-message guidance | Error message and error summary patterns |
| web.dev, MDN | Platform documentation | SMS one-time codes (2020-12-09), `inputmode` (2026-04-17), `prefers-reduced-motion`, `light-dark()`, `oklch()`, Baseline data |
| CarGurus and Autolist help pages (added 2026-09-26) | The listing and deal mechanics being cloned | Market value, deal ratings, price history, days on market, saved-search alerts |
| Deque | axe authors | Automated coverage of WCAG ("on average 57 %") |
| Nathan Curtis | Design-systems practitioner (EightShapes) | Token naming; "Don't Globalize Decisions Prematurely" |
| RubSE (arXiv 2608.24138); arXiv 2503.15885 | Measurements on visual repair loops and tool feedback | One repair per round; tool feedback beats prompting for accessibility |
| Hands-on | This machine | Every Persian and vision claim below marked "verified" |

## Findings: tools and skills

**No published skill covers right-to-left or Persian.** Grep over Anthropic `frontend-design`, the Vercel guidelines, Emil Kowalski's skills and ui-ux-pro-max found zero or near-zero RTL content; Impeccable has one logical-properties paragraph and Jakub Krehel's `icons.md` one flipping table. The project's own skill is therefore the main deliverable, not an add-on.

**Anthropic's guidance favours concrete specification over taste words.** The frontend-design post explains the "safe design choices … dominate web training data" convergence, and the Opus 4.8 guide says generic negatives ("make it clean and minimal") "shift the model to a different fixed palette". The skill therefore locks tokens and roles first (CS-3) and forbids taste words as briefs.

| Candidate | Verdict | Why |
|---|---|---|
| Anthropic `frontend-design` plugin | **rejected** | Silent auto-update (the local cache moved from v2 to v3 with no notice; pinning is an open request, claude-plugins-official #4364); framed as giving "every client a distinct visual identity", the opposite of one consistent product; physical layout wording; one sentence on accessibility; no RTL. Its useful idea, "propose several directions, implement one", is a prompt, not a plugin. |
| Vercel Web Interface Guidelines | **vendored** at a pinned commit | About 105 web-platform MUST/SHOULD/NEVER rules on forms, touch, focus, URL state and performance; MIT. Three rules overridden for Farsi (curly quotes, Title Case, "prefer APCA": WCAG 3's contrast method is undecided, WCAG 2.2 ratios are the requirement). The `web-design-guidelines` skill as shipped re-fetches from an unpinned `main` URL on every run, so the file was copied instead. |
| Emil Kowalski `emil-design-eng` | **vendored** | Motion frequency table, easing rules, duration table, gestures; MIT, actively maintained. Its "Initial Response" block that scripts the agent's first reply was removed. |
| Jakub Krehel `make-interfaces-feel-better` | **vendored** | Concentric radius, optical alignment, shadows versus borders, hit areas, icon flipping. `antialiased` advice is macOS-specific. |
| ibelick `fixing-accessibility` | **vendored** | Compact fix list. |
| `skills` CLI (skills.sh) | **rejected** as installer | Sends telemetry to `add-skill.vercel.sh` by default and calls `skills.sh`; verified install writes only `SKILL.md` and `skills-lock.json`, so `curl` at a pinned SHA does the same without a dependency. Trail of Bits (2026-06-03): "We strongly discourage the use of skills.sh, ClawHub, and similar marketplaces… pin to specific versions". |
| ui-ux-pro-max | **rejected** | Hands-on RTL query: "Found: 0 results"; a Persian user's issue #409 confirms no RTL; 92–97 % of its palettes are Tailwind default hex; it recommended a "youth-focused, gaming" style with Google Fonts for a business-focused Farsi brief; a bundled `settings.local.json` overwrote users' permissions (#15); a generator "silently overwrites `tailwind.config.ts`" (#496); about 13.5k tokens per activation. |
| `taste-skill`, `superdesign`, Impeccable plugin, Chromatic, Claude Design `/design-sync`, `chrome-devtools-mcp` | **rejected** | Respectively: an 87 KB single load tied to shadcn; SaaS login; run-time binary download and telemetry ping; SaaS; uploads code to a SaaS preview; telemetry on by default and Playwright already covers it. |
| shadcn skill and MCP, React Aria and Ark MCPs, Storybook `addon-mcp` | **deferred** with the primitives (ADR-0005) | Each runs `@latest` code or needs its docs host at run time; Storybook's telemetry is on by default and its addon is "preview". Reopen when the first primitive or the gallery is needed (CS-3). |
| Playwright story gallery (`playwright-component-testing` skill in `node_modules`) | **deferred** to CS-3 | Stable since Playwright 1.62 and bundler-agnostic, but no Next.js guidance exists and it was not run here. `@playwright/experimental-ct-react` was removed on 2026-08-07. |
| Penpot (Figma alternative) | **rejected** for now | Layout is not RTL-aware ("We currently do not support `start` or `end`"), images only on Docker Hub (which blocks Iranian IPs), telemetry on by default. Designing in code with a gallery needs no design tool. |
| Google `DESIGN.md` format and CLI | **optional**, not adopted | A sensible format for the locked language, but version `alpha` and no direction tokens; CS-3 may adopt the format without the CLI. |

**Vercel hosts and Iran**: Vercel staff wrote in 2021 that they "cannot guarantee the deliverability for countries under US sanctions"; there are unanswered 403 reports from Iran (2025-06, 2026-05) and one `shadcn init` failure (#8202). GitHub, including raw.githubusercontent.com, is licensed for Iran (GitHub, 2021-01-05). Pinned copies in the repo avoid every run-time fetch.

## Findings: knowledge that had to be written

Verified hands-on (2026-09-18, Chromium 153 and Node 22):

- An unisolated `+98 912 345 6789` renders as `6789 345 912 98+`; `3-5` renders as `5-3` inside Persian text.
- `Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' })` prints «۱۴۰۵ شهریور ۲۷, جمعه» (CLDR pattern `y MMMM d, EEEE`; identical on Node 22 with CLDR 46 and on Chromium 153); `long` prints «۲۷ شهریور ۱۴۰۵».
- The IRR `currency` style prints «ریال ۱۲٬۵۰۰٬۰۰۰», unit first; the Toman has no ISO code.
- web.dev's OTP `pattern="\d{6}"` rejects «۱۲۳۴۵۶»; `<input type="number">` drops Persian digits; `Number('۱۲۳')` is `NaN`; `NaN` formats as «ناعدد».
- Vazirmatn's Farsi-digit stylistic set `ss01` is missing from the fontsource subsets; `tnum` survives.
- Vazirmatn's natural line height is 1.56; Material classes Persian as a "tall" script; alreq notes its ascenders and descenders "extend much further than those of the Latin script".
- Model vision: a 2 px shift of a 160 × 60 box changed 0.07 % of pixels and was invisible in the image; a 412 × 6000 full-page screenshot is downscaled about 0.26×.

Corrections found along the way: Tailwind `start-*`/`end-*` are deprecated (4.2.0, 2026-02-18) in favour of `inset-s-*`/`inset-e-*`, and models trained on older data emit the old names (the lint's `no-deprecated-classes` catches it); shadcn/ui's default base is Base UI since 2026-07-02 with open RTL bugs (InputOTP #11201, Switch #10274, `migrate rtl` #9734, Dialog #8454); `<ViewTransition>` is stable only from React 19.3.0 (2026-09-09) while the scaffold pins 19.2; Vaul is unmaintained ("This repo is unmaintained"); Baymard's mobile filter and list-loading numbers are in the listing-patterns reference with their dates.

Where sources disagree, the references say so and pick: validation timing (Wroblewski, Baymard and GOV.UK differ; the synthesis is submit by default, blur only for non-empty format-constrained fields, clear on the fixing keystroke); the Refactoring UI 45–75 character line rule was not found in any author source and is not used.

## Findings: workflow

Practitioners converge on: lock the design language before screens (Jakub Krehel: "The first thing I do… is create a set of rules for the codebase"); build a component gallery as the working surface (Armin Ronacher: "you absolutely need to tell it to make a component library"); ask for states first (Mitchell Hashimoto: "views that can show the various states"); make the model actually look ("look at screenshots", Simon Willison); feed tool results back (arXiv 2503.15885: tool feedback "significantly outperforms" prompting alone for accessibility); keep a separate skeptical reviewer (Anthropic, 2026-03-24) but expect it to over-report; and leave taste to a human (Every: "Code review does not tell you the toggle looks off or the empty state reads cold"). Failure reports: a model that said "I can only make visual estimations" and then claimed "pixel-perfect accuracy"; a numeric loop that "copied the screenshot in as the background image". RubSE recommends one repair target per round.

What is deliberately not automated: a pass/fail pixel gate against a left-to-right reference, agent-run baseline updates, aesthetic sign-off by the authoring model, accessibility sign-off (axe finds about 57 % of issues), and Farsi copy.

## Recommendation

Write and own the knowledge; vendor four small MIT files at pinned commits; install nothing that auto-updates, phones home or needs a SaaS. Concretely, what the design harness ships:

- `.claude/skills/ui-design/SKILL.md`: twelve non-negotiables first (they survive context compaction), then the workflow and a reference table; `references/{rtl-bidi, persian-type-formatting, mobile-forms, listing-patterns, states-a11y, motion, tokens, anti-slop-review}.md`, each rule tied to its source; `references/vendor/` with `VENDORED.md` recording source, commit, licence and edits.
- `.claude/rules/ui.md` for `apps/web/src/**/*.tsx` and `*.css`: the invariants only, so they load whenever a UI file is open.
- `.claude/agents/design-reviewer.md`: read-only, fresh context, scores the rubric with measured numbers, names one repair.
- `/verify-ui` additions: measure with `snapshot --boxes` and `eval`, viewport-sized or element crops at or below 2000 px, side-by-side comparison, one repair per round, about three rounds, then the reviewer.

Trade-off accepted: vendored files go stale until someone re-copies them (a dated table makes that a one-line diff); the reviewer will sometimes report nitpicks on sound work (its prompt says a clean report is a valid report). What would change this: a published skill with real RTL and Persian coverage; Anthropic shipping pinnable plugins; a Figma-free design tool with logical layout that is reachable from Iran.

## Deliberately not done

| Item | Trigger |
|---|---|
| `docs/design/design-language.md` (palette, type roles, spacing, radii, font) | CS-3; until then the skill builds neutral structure and says so |
| Component gallery (Playwright story gallery or a dev-only route) | CS-3, with the first shared primitive |
| Token-drift lint (`no-restricted-classes` on arbitrary colour and size values) | CS-3, once token names exist |
| `playground` plugin for tuning tokens by eye | only if CS-3 wants it; marketplace auto-update applies |
| A PostToolUse hook that lints UI files on edit | reconsider when ESLint runs under 2 s per file; `pnpm check` covers it now |
