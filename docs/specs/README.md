# Feature specs

Product/feature definitions that are bigger than a single task: user flows, rules, edge cases, and the acceptance criteria that later tasks inherit. Named `SNN-kebab-slug.md` (e.g. `S01-deal-ratings.md`).

A spec answers: who is this for, what can they do, what are the rules (thresholds, statuses, money, freshness, sources), what is explicitly out of scope, and how we will know it works. It does not contain implementation plans — those live in the Backlog tasks that reference the spec (`--doc docs/specs/S01-....md`).

## Index

| Spec | What it settles | Tasks |
|---|---|---|
| [S01: Market value and deal ratings](S01-deal-ratings.md) | The comparables, the price model, the five ratings and the reasons for none, the accuracy report | CS-51, CS-64, CS-65, CS-67, CS-73 |
| [S02: Search filters and catalogues](S02-filters-and-catalogues.md) | Every filter and catalogue as one definition, with its rule, its URL form and its explanation | CS-58, CS-59, CS-61, CS-62, CS-63, CS-70, CS-72 |
| [S03: The search page](S03-search-page.md) | The page's parts, the card, paging, focus, the states | CS-61, CS-62, CS-64, CS-111 |
| [S04: Plain-Farsi search](S04-plain-farsi-search.md) | A sentence into filters in one step, code first, the model behind a switch, what is said about the words left | CS-61, CS-62, CS-63, CS-93, CS-111 |

Template:

```markdown
# SNN: <capability>

- Status: draft | approved | superseded
- Date: YYYY-MM-DD
- Tasks: CS-...
- Related: ADR-..., docs/research/...

## Users and goal
## Flows (step by step, with the Farsi copy that matters)
## Rules (thresholds, statuses, money, dates, sources, edge cases)
<!-- Testable rules read well in EARS form: WHEN <condition> THE SYSTEM SHALL <behaviour>. -->
## What we are NOT doing (explicitly deferred, so nobody re-scopes it by accident)
## Success criteria
- Automated (tests, checks an agent can run):
- Manual (what a human verifies in the In Review column):
## Open questions
```

The `/plan` skill writes a spec here when a request is too large for one task, then creates the parent task and subtasks in the backlog.
