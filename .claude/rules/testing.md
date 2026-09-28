---
paths:
  - "apps/web/src/**/*.test.ts"
  - "apps/web/src/**/*.test.tsx"
  - "apps/web/vitest.config.mts"
  - "apps/web/vitest.setup.ts"
---

# Unit and component tests (Vitest 5, Testing Library)

Lint on test files already enforces Testing Library queries, `userEvent` over `fireEvent`, jest-dom matchers and no focused or skipped tests. Browser tests live in `e2e/` and follow `.claude/rules/e2e.md`. Sources: Kent C. Dodds, "Write tests. Not too many. Mostly integration.", "Common mistakes with React Testing Library", "Avoid Nesting when you're Testing" (paraphrased; his posts are GPL); Dominik Dorfmeister, tkdodo.eu (2026-03-23); the Next.js 16 Vitest guide (bundled docs); Vitest 5 types and migration notes; lab runs on 2026-09-17.

## What goes where

| Layer | What | Tool |
|---|---|---|
| Static | types and lint | `pnpm check` |
| Unit | schemas, digit and money helpers, date formatting, pure domain rules, Server Actions called as functions | Vitest with `// @vitest-environment node` |
| Component | client components and forms: states and interactions | Vitest, Testing Library, jsdom |
| Browser | pages, async Server Components, layout, direction, focus, accessibility, anything visual | Playwright in `e2e/` |

- "Vitest currently does not support" async Server Components; the Next guide recommends E2E tests for them. A leaf async component can be rendered as `render(await Leaf(props))`; anything that composes async children is tested in Playwright.
- jsdom has no layout and does not resolve logical properties under `dir="rtl"` (hands-on: `padding-inline-start` reads back as `paddingRight: "0"`; a browser returns the value). Never assert layout, direction or CSS visibility in Vitest.
- Do not write tests for what the type system already guarantees.
- A test that keeps a CPU busy for seconds (PGlite replaying the migrations, a compiler) matches `HEAVY` in `apps/web/vitest.config.mts`, which runs it after the rest: beside twenty other files its setup passed Vitest's 10-second limit (2026-09-28). Never raise the limit instead.

## How to write them

- Test what a user perceives: render, find by role and accessible name, act with `userEvent`, assert on what appears. A refactor that keeps behaviour must not break a test (Dodds: the more tests resemble how the software is used, the more confidence they give).
- Query order: `getByRole` with `name`, then `getByLabelText`, then `getByText`; `findBy*` for what appears later. If a role query cannot find an element, some users cannot either (TkDodo).
- Farsi names: import the message constant the component renders instead of retyping it. Retyped Persian loses the zero-width non-joiner or swaps Arabic ي/ك for Persian ی/ک, and `getByRole` does not normalise.
- `const user = userEvent.setup()` before `render`, then `await user.click(...)` and `await user.type(...)`. Type Persian and Arabic-Indic digits into every numeric field at least once, plus an empty value and pasted text with separators.
- A component that suspends: assert with `findBy*`, or wrap the render in `await act(async () => { … })`.
- Server Actions as plain functions in the node environment: `server-only` already resolves (aliased in `vitest.config.mts`); mock `next/cache` and `next/navigation`. `redirect()` works by throwing, so assert on the rejection. An unmocked `cookies()` throws "called outside a request scope".
- Mock only at boundaries you own (the `server/` query function, the network), never a component's own modules; a small real fixture beats a mock.
- Dates: `vi.setSystemTime(new Date('2026-09-18T08:00:00Z'))` mocks `Date` without fake timers (so `userEvent` keeps working), and pass `timeZone: 'Asia/Tehran'` to `Intl` explicitly so the result does not depend on the machine. Restore with `vi.useRealTimers()`.
- Vitest 5 defaults: `clearMocks` is on, an un-awaited `expect(...).resolves` or `.rejects` fails the test, and a nested `vi.mock` throws.
- One behaviour per test. Flat tests with small setup functions instead of nested `describe`/`beforeEach` chains (Dodds).
