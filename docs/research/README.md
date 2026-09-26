# Research notes

Executed investigations that inform decisions. One topic per file, named `YYYY-MM-DD-kebab-slug.md`. The `/research` skill adds a row to the index when it writes a note.

## Index

| Note | Question | Outcome |
|---|---|---|
| [2026-09-17 AI-first task management](2026-09-17-ai-first-task-management.md) | How to run project management inside the repo when building AI-first | ADR-0001: Backlog.md in the repo |
| [2026-09-17 Playwright with coding agents](2026-09-17-playwright-with-coding-agents.md) | Browser verification, end-to-end tests, CI and reference-site capture | ADR-0002; `e2e/`, `tools/site-capture/`, the `verify-ui` and `capture-site` skills |
| [2026-09-18 Next.js project structure](2026-09-18-nextjs-project-structure.md) | Project structure and frontend architecture for Next.js 16 App Router | ADR-0004 (proposed) |
| [2026-09-18 Styling and component primitives](2026-09-18-styling-system-and-component-primitives.md) | Styling system and primitives for a Farsi right-to-left app | ADR-0005 (proposed) |
| [2026-09-18 UI/UX design for agents](2026-09-18-ui-ux-design-for-agents.md) | Design knowledge and tooling for Claude Code on a right-to-left product | The `ui-design` skill, the `ui.md` rule, the `design-reviewer` agent |
| [2026-09-21 Gorilla testing](2026-09-21-gorilla-testing-with-playwright.md) | Gorilla, monkey and model-based testing on the Playwright harness | `pnpm gorilla`, the lab self-check, the layout stress matrix, CI and nightly runs |
| [2026-09-21 React 19 and Next.js 16 knowledge](2026-09-21-react-19-nextjs-16-knowledge-for-agents.md) | What makes agents write standard, performant React and Next.js code | The lint stack and its self-test, five rule packs, the `react-patterns` skill |
| [2026-09-26 Torob's product and playbook](2026-09-26-torob-product-and-playbook.md) | What Torob does and which mechanics "Torob for X" must reproduce | The five-step playbook behind the product brief and the milestones |
| [2026-09-26 US vertical search analogues](2026-09-26-us-vertical-search-analogs.md) | Which US startup is the exact product match, vertical by vertical | CarGurus, with Autolist (ADR-0006) |
| [2026-09-26 Iran vertical market landscape](2026-09-26-iran-vertical-market-landscape.md) | Where a Torob-style engine is most valuable and feasible to build in a week | Used cars; villas are the fallback (ADR-0006) |
| [2026-09-26 Car listing sources and crawl policy](2026-09-26-car-listing-sources-and-crawl-policy.md) | Which used-car sources Carshenas can read, and under what rules | ADR-0008 (proposed); each source's terms are read in CS-5 |
| [2026-09-26 UI craft details](2026-09-26-ui-craft-details.md) | Which small interface details make a product feel good, who says so, and how they apply to a Farsi RTL phone-first app | The `ui-design` craft checklist and its wiring into rules, lint, review and browser checks (CS-26); appendix with six passes and a font lab |

Template (queries first, findings later, so the note is useful even half-finished):

```markdown
# <Question being answered>

- Date: YYYY-MM-DD
- Asked by / for: task CS-..., or "exploratory"
- Outcome: (fill in last) decision taken / ADR written / no action

## Questions
1. ...

## Sources
- <URL> — who, when, why credible

## Findings
...

## Recommendation
...
```

Write the note with the `/research` skill. Findings must cite sources; mark anything unverified as such.
