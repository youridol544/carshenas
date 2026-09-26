---
id: CS-1
title: Adapt the AI-first repository foundation for Carshenas
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 09:21'
updated_date: '2026-09-26 10:38'
labels:
  - docs
  - dx
milestone: m-0
dependencies: []
references:
  - docs/product/vision.md
  - docs/decisions/0006-used-cars-modeled-on-cargurus.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Carshenas starts from the owner's AI-first repository template: the Backlog.md workflow, Claude Code skills, agents, hooks and rules, a lint-enforced Next.js 16 shell, a Playwright end-to-end and gorilla harness, and a site-capture tool. Everything describing the template's previous product had to be replaced by Carshenas's product, research and decisions, and the harness had to stay green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A repository-wide search finds no name, task ID or domain term of the previous product
- [x] #2 README, AGENTS.md, the product brief, the glossary and the challenge summary describe Carshenas: used cars in Iran modeled on CarGurus and Autolist
- [x] #3 The research behind the product (Torob, US analogues, the Iranian market, listing sources and their rules) is recorded as cited notes in docs/research
- [x] #4 ADR-0006 records the product decision; ADR-0007 (data stack) and ADR-0008 (crawl policy) are recorded as proposed
- [x] #5 pnpm check, pnpm e2e, pnpm capture:test, pnpm e2e:visual and pnpm gorilla --selfcheck pass, with visual baselines regenerated in the official container for the new fixture
- [x] #6 The backlog holds milestones m-0 to m-6 with the roadmap tasks
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Copy the template's tracked files, leaving out its backlog tasks and milestones, generated output and old screenshot baselines.
2. Rename packages, CLI tags and tool identifiers mechanically.
3. Rewrite everything with product meaning: README, AGENTS.md, product brief, glossary, challenge summary, ADR context, research notes, skills, rules, agents, the app shell, the e2e fixture and lab, and the capture tool's tests.
4. Record the research (Torob, US analogues, Iranian market, listing sources and their rules) and ADR-0006 to ADR-0008.
5. Seed milestones m-0 to m-6 and the roadmap tasks through the CLI.
6. Verify with every check the harness has, regenerating visual baselines in the official container.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Kept from the template on purpose: the Backlog.md workflow, every Claude Code skill, agent, hook and rule (with car-domain examples), the lint-enforced Next.js 16 shell, the Playwright e2e, visual and gorilla harness and the site-capture tool. Replaced: all product docs, ADR context, research framing, the fixture site (now a mock used-car listings page) and the lab widget (installments and comparison, same eight planted defects).

react-patterns examples were translated into the car domain on 2026-09-26 without changing the patterns; the skill says they have not been re-linted since.

Verification on 2026-09-26: pnpm check exit 0 (lint, lint self-test 8 samples, typecheck web and e2e, unit tests, Prettier); pnpm e2e 50 passed, 4 skipped (the deliberate-failure self-checks that only run through pnpm selfcheck); pnpm capture:test 11 of 11; pnpm e2e:visual --update-snapshots in mcr.microsoft.com/playwright:v1.63.0-noble wrote listings.png for fixture-mobile and fixture-desktop, a clean pnpm e2e:visual then passed 2 of 2, and the mobile baseline was opened and shows the Carshenas listings fixture; pnpm gorilla --selfcheck 12 passed (every planted defect caught, clean lab page without findings); pnpm gorilla on the home page 85 runs, no findings; repository-wide search for the previous product's name and task IDs: no hits (its domain vocabulary was only fully removed later, see below); secrets scan: none.

Review before Done on 2026-09-26, asked by Pedrum: does the dev server come up easily, do gorilla tests and site capture (CarGurus: API map, UI screenshots, flows) work, does the README explain everything; then commit and mark Done. Two read-only reviews (acceptance criteria and docs wiring) ran first, and a third reviewed the fixes.

Run on the final tree:
- `./scripts/init.sh` exit 0: frozen-lockfile install, Chromium, `pnpm check`, then it reused the running dev server, which answers with `dir="rtl"`.
- `./scripts/init.sh --serve`: the checks, then Next.js on http://localhost:3000, ready in 354 ms, `<html lang="fa" dir="rtl">`.
- `pnpm dev`: ready in 372 ms, `GET /` 200.
- `pnpm check` exit 0 (lint, lint self-test 8 samples, typecheck web and e2e, unit tests, Prettier).
- `pnpm e2e`: 50 passed, 4 skipped (the deliberate-failure self-checks), on a fresh production build.
- `pnpm --dir e2e selfcheck`: exit 1 as required, leaving error-context.md, a screenshot, a trace and now `browser-log.txt`.
- `pnpm e2e:visual`: 2 passed in mcr.microsoft.com/playwright:v1.63.0-noble.
- `pnpm capture:test`: 17 of 17, twice.
- `pnpm gorilla --selfcheck`: 12 passed in 1.2 min. Each of the eight planted defects was found within 2–19 runs and replayed; the clean lab page survives 20 runs.
- `pnpm gorilla` on a production build: seed 466114310, 98 runs, no findings.
- The CI command `pnpm gorilla --seed 20260921 --runs 40 --budget 300 --project both`: 2 passed, no findings (one slow-paint warning of 1.4 s, which by design does not fail a run).
- CarGurus home page, `pnpm capture https://www.cargurus.com/ --name cargurus-home`:
  - captured phone and desktop in 73 s; the screenshots were opened and show the real page
  - reported Astro, React 19.2.4, Remix and Radix UI; CloudFront and Fastly; DataDome and Cloudflare signals
  - reduced 632 requests to 84 hosts to 5 first-party endpoints
- `pnpm capture https://www.cargurus.com/details/123456789` is refused before any browser starts.

What the CarGurus results page showed:
- A `--flow` capture of `/Cars/l-Used-Toyota-Camry-d292` hit a DataDome challenge on the phone right after load. The tool did not notice.
- The fixes below came out of that run.
- Its desktop capture, taken 8 s after the challenge, was discarded (ADR-0008 rule 6).
- CarGurus is not captured again from this machine; CS-25 has two comments with the details.

Fixed in tools/site-capture:
1. robots.txt was fetched through the phone preset's request context. CarGurus answers that with 406, which counted as "no robots.txt", so `/details` and other disallowed pages would have been captured.
   - It is now read with a plain client before the browser starts, once per origin, so a redirect is judged by the robots.txt of where it lands.
   - It is matched as RFC 9309 says (`lib/robots.mjs`): groups, comments, any line ending, Allow, the longest match, and percent-encoding, so Farsi rules match.
   - Anything but a 2xx, 404 or 410 disallows every path.
2. `--flow` could navigate anywhere. A top-level navigation to a disallowed path or another site, pop-ups included, now gets an empty 204 and is listed in the summary. The fence fails closed and cannot crash on a pop-up's frameless first request.
3. A stop can now arrive late, and the tool catches it at a checkpoint that runs after load, after the wait, after scrolling, before every flow screenshot and after the flow. The capture stops there, before any photo. Late arrivals covered:
   - a challenge overlaid after load (`lib/challenge.mjs`: challenge titles, challenge-only hosts such as `captcha-delivery.com`, short block pages)
   - a redirect or in-page navigation to a disallowed page, which the fence cannot see coming
   - a page view the site refuses with 401, 403, 429 or 503

Also:
- The summary prints the robots verdict, and says when a flow ended early.
- The tile list says when `--tiles` stops short of the page's end.
- `--help` lists `--out` and `--timeout`.
- A `--cdp` run closes its tab even after a stop.
- The header comment no longer suggests `--cdp` to get past a block.
- Eleven tests prove the fixes against a local site that mimics CarGurus. The robots and flow tests failed on the old code.

Previous product removed completely (AC #1), on the owner's instruction that nothing from it may remain:
- Its domain vocabulary is gone from code, tests, fixtures, rules, skills and docs, in English and Farsi. The examples now use cars: the lint sample, the capture test's GraphQL sample, the lab widget and its element IDs, the fixture's counter, and the UI form and RTL references. The gorilla's deny-list names only deleting, paying and signing out.
- Research evidence that came from it is gone: the reference site studied for it (that site's stack, terms and lawsuit), the Iranian shop sites captured for it, the sandbox's feature names, and statistics and citations about shop flows. Tooling findings that stand on their own are kept, in neutral wording.
- A repository-wide search over its name, task IDs and domain vocabulary, in English and Farsi, finds nothing. What still matches such a search is unrelated to it: Torob's shops and products in the challenge research, ordinary words such as reading order and the product brief, third-party licence and guideline text, and the Playwright skill that `pnpm skills:sync` generates.

Docs and wiring:
- **README rewritten.** It covers quick start, the repo map, what each check proves, gorilla testing, site capture with flows and boundaries, the Claude Code kit, CI and status.
- **e2e/README.** Paths, projects, WebKit install, the oracle list, eight defects and `browser-log.txt` fixed.
- **tools/site-capture/README.** Run from the repo root, `--out`, a Flows section with what the fence cannot see coming, and the robots and challenge behaviour.
- **Research index** added to `docs/research/README.md`, with a step in `/research` that keeps it current.
- **Factual corrections.** Source counts in `vision.md` and the landscape note; the eight-defect count in the gorilla note, with its original measurement kept.
- **ADR-0001 and ADR-0006, although accepted, were corrected in place before Done.** Both were written in this task, and each correction fixes a factual error: "CS-1 to CS-25", and ADR-0006's claim that loans are the only living Bay Area unicorn match, when Thumbtack is the second one.
- **Wiring.**
  - The CI e2e job timeout went from 20 to 35 min. This is not a timeout raised to get green. The Playwright config's 30-minute CI limit was meant to end an over-running suite with a report, but the 20-minute job killed it first. A comment in `e2e.yml` says so.
  - `init.sh --serve` now serves on 3000, or the next free port, as the docs say.
  - `browser-log.txt` is now written to test-results, as documented.
  - `vite-tsconfig-paths` is replaced by Vite 8's `resolve.tsconfigPaths`, so `pnpm check` no longer prints a warning. A throwaway test importing through `@/` proved it, since no test imports that way yet.
  - Paths and names fixed in `verify-ui`, `project-manager-backlog`, `pnpm-workspace.yaml` and `.prettierignore`.
- **docs/learnings.md** gained one line: a capture can succeed and still be a block page.

Backlog: CS-16 now depends on CS-25, because the teardown comes before the UI work, as CS-25 says.

Claude moved this task to Done on Pedrum's explicit instruction ("review it and then commit and mark as done"). Normally only a human does that.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adapted the owner's AI-first template into Carshenas, a used-car search engine for Iran modeled on CarGurus and Autolist:
- Rewrote the product docs, ADR context, research framing, Claude Code skills, rules and agents, the app shell and the e2e fixture.
- Added four cited research notes, ADR-0006 (accepted), and ADR-0007 and ADR-0008 (proposed).
- Seeded milestones m-0 to m-6 with CS-2 to CS-25.

A review before Done:
- Removed the last leftovers of the previous product.
- Fixed site capture's boundaries, all found on CarGurus:
  - robots.txt was read through the phone preset, so a 406 counted as "no robots.txt"
  - flows could open any page
  - bot challenges that arrived after load went unnoticed, as did redirects and 403s
- The capture tool now stops before photographing anything robots.txt, a refusal or a challenge rules out.
- Made the README cover setup, every check, gorilla testing, site capture with flows, the Claude Code kit and CI.
- Corrected stale docs and wiring.

Verified on the final tree:
- `./scripts/init.sh`, including `--serve` on :3000
- `pnpm check`
- `pnpm e2e`: 50 passed
- `pnpm capture:test`: 17 passed
- `pnpm e2e:visual`: 2 passed
- `pnpm gorilla --selfcheck`: 12 passed
- `pnpm gorilla` on a production build and with the CI seed on phone and desktop: no findings
- a CarGurus home-page capture
<!-- SECTION:FINAL_SUMMARY:END -->
