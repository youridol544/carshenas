# React 19 and Next.js 16 engineering knowledge for coding agents

- Date: 2026-09-21 (sources fetched and labs run on 2026-09-17 and 2026-09-18; examples and compiler behaviour re-checked on 2026-09-21)
- Asked by / for: Pedrum ("knowledge like epic react with examples and anything that helps ai coding harness make standard nextjs and react codes, performant, clean, readable, maintainable and scalable frontend code that matches with web standards")
- Outcome: lint stack extended and self-tested (`apps/web/eslint.config.mjs`, `apps/web/eslint/selftest.mjs`); five path-scoped rule packs in `.claude/rules/` (`react.md`, `next-app-router.md`, `server-actions-data.md`, `typescript.md`, `testing.md`); the on-demand `react-patterns` skill with three example modules; `.claude/skills/README.md` inventory. No third-party knowledge skill installed.

## Questions

1. What do React 19.2 and Next.js 16.3 change that a model trained on older code gets wrong?
2. What do respected engineers (the React and Next.js teams, Dan Abramov, Kent C. Dodds, Dominik Dorfmeister, Mark Erikson, Matt Pocock, Josh W. Comeau) recommend for state, effects, composition, data loading, types and tests, with examples?
3. Where should that knowledge live so an agent actually uses it: always-on context, path-scoped rules, skills, or lint?
4. Which published agent skills are worth installing, and which are not?

## Method and limits

Eight parallel research passes over primary sources (react.dev and the `react/react` repository at the 19.3.0 tag, the Next.js 16.3.5 docs bundled in `node_modules/next/dist/docs/`, authors' own blogs, npm and GitHub API data, arXiv), with every quoted sentence matched as an exact string against the downloaded source (about 1,000 checks, one mismatch caused by non-breaking spaces). Three hands-on labs installed the stack: React 19.3 exports, TypeScript/Zod/ESLint with `next build`, and a Testing Library lab. On 2026-09-21 every "after" example in the `react-patterns` skill was assembled into a throwaway feature and passed this repo's ESLint and `tsc`, and a context provider was compiled with `babel-plugin-react-compiler` 1.0.0 to see what the compiler memoises. The web-search quota ran out part-way, so conference talks and podcasts are likely under-represented; later discovery used known URLs, RSS feeds and the GitHub and arXiv APIs.

## Sources and why they are credible

| Who | Why credible | What was read (with links) |
|---|---|---|
| React team | Authors of React | [`<form>`](https://react.dev/reference/react-dom/components/form), [`useTransition`](https://react.dev/reference/react/useTransition), [`use`](https://react.dev/reference/react/use), [`forwardRef`](https://react.dev/reference/react/forwardRef), [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect), [Rules of React](https://react.dev/reference/rules), [React Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1) (2025-10-07), [React blog](https://react.dev/blog) for 19.3 (2026-09-09) |
| Next.js team (Vercel) | Framework authors | Bundled 16.3.5 docs in `apps/web/node_modules/next/dist/docs/`, published as [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Caching](https://nextjs.org/docs/app/getting-started/caching), [Mutating data](https://nextjs.org/docs/app/getting-started/mutating-data), [Data security](https://nextjs.org/docs/app/guides/data-security), [Backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Upgrading to 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [AI agents](https://nextjs.org/docs/app/guides/ai-agents), plus the migrating-to-cache-components, error-handling, `catchError` and Vitest guides; [nextjs.org/evals](https://nextjs.org/evals) (run 2026-09-11); `vercel-labs/next-skills` README |
| Sebastian Markbåge | React and Next.js core | [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) (2023-10-23) |
| Dan Abramov | Former React core | [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) (2019-03-09), [Writing Resilient Components](https://overreacted.io/writing-resilient-components/), [Before You memo()](https://overreacted.io/before-you-memo/) (2021-02-23), [What Does "use client" Do?](https://overreacted.io/what-does-use-client-do/) (2025-04-25), [One Roundtrip Per Navigation](https://overreacted.io/one-roundtrip-per-navigation/) (2025-05-29) |
| Kent C. Dodds | Epic React, Testing Library | [Don't Sync State. Derive It!](https://kentcdodds.com/blog/dont-sync-state-derive-it) (2019-09-30), [State Colocation](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) (2019-09-23), [Stop using isLoading booleans](https://kentcdodds.com/blog/stop-using-isloading-booleans) (2020-03-02), [How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) (2021-06-05), [AHA Programming](https://kentcdodds.com/blog/aha-programming) (2020-06-22), [Colocation](https://kentcdodds.com/blog/colocation), [Prop Drilling](https://kentcdodds.com/blog/prop-drilling), testing posts; the Epic Stack's `avoid-use-effect.mdc` (2025-03-21). His posts and workshops are licensed GPL v3 for non-commercial use, so the repo paraphrases and links them |
| Dominik Dorfmeister (TkDodo) | TanStack Query maintainer | [Don't over useState](https://tkdodo.eu/blog/dont-over-use-state) (2020-08-29), [Avoiding Hydration Mismatches with useSyncExternalStore](https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store) (2024-02-21), [Component Composition is great btw](https://tkdodo.eu/blog/component-composition-is-great-btw) (2024-09-21), [The Useless useCallback](https://tkdodo.eu/blog/the-useless-use-callback) (2025-07-28), [The Vertical Codebase](https://tkdodo.eu/blog/the-vertical-codebase) (2026-04-13), [Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files) (2024-07-26), design-system posts of 2025-11-17, 2025-12-01 and 2026-01-02 and a testing post of 2026-03-23 (their URLs were not recorded) |
| Mark Erikson | Redux maintainer | [A (Mostly) Complete Guide to React Rendering Behavior](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/); [React Compiler and rendering slides](https://blog.isquaredsoftware.com/2026/04/presentations-react-compiler-rendering/) (2026-04) |
| Matt Pocock | Total TypeScript | [TSConfig Cheat Sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet); "Cursor rules for better AI development" (2025-04-23, URL not recorded) |
| TypeScript team | Compiler authors | [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (2026-07-08); typescript-eslint issue #12518 |
| Josh W. Comeau | Educator | CSS mental-model articles on joshwcomeau.com |
| web.dev, W3C | Platform references | [Web Vitals](https://web.dev/articles/vitals), [Font best practices](https://web.dev/articles/font-best-practices), [Structural markup and right-to-left text](https://www.w3.org/International/questions/qa-html-dir), [ARIA APG: Read Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/), WCAG 2.2 |
| Research papers | Measurements of agent context | [arXiv 2602.11988](https://arxiv.org/abs/2602.11988) (context files), [2602.12670](https://arxiv.org/abs/2602.12670) (SkillsBench), [2603.29919](https://arxiv.org/abs/2603.29919) (SkillReducer), [2606.15828](https://arxiv.org/abs/2606.15828) (AGENTS.md smells), [2508.14419](https://arxiv.org/abs/2508.14419) (static-analysis feedback), [2605.20049](https://arxiv.org/abs/2605.20049); Vercel's AGENTS.md versus skills eval by Jude Gao (2026-01-27, URL not recorded) |

## Findings: what differs from training data (as of 2026-09-18)

| Package | Current | What an agent must know |
|---|---|---|
| react | 19.3.0 (2026-09-09); the app pins 19.2.8 | `ref` is a prop (`forwardRef` unnecessary), `<Context value>` replaces `.Provider`, `use(Context)` replaces `useContext`, Actions and `useActionState` replace `useFormState`, `useEffectEvent` and `<Activity>` are stable in 19.2, `<ViewTransition>` only in 19.3 |
| next | 16.3.5 | `proxy.ts` replaced middleware; request APIs are async; `next lint` is gone; Cache Components (`'use cache'`, `cacheLife`, `cacheTag`, `updateTag`, two-argument `revalidateTag`) replace `unstable_cache` and route segment config; `error.tsx` gets `retry`; `catchError` from `next/error` for component boundaries; Turbopack is the default |
| typescript | 7.0.2 exists but "does not ship with an API"; typescript-eslint 8.70 supports up to 6.0 | The app stays on 5.9 (verified: TS 7 breaks typed lint) |
| eslint | 10.x exists; jsx-a11y, eslint-plugin-react and eslint-config-next support 9 only | Stay on 9.39 |
| eslint-plugin-react-hooks | 7.1.1 | The compiler-powered rules (`purity`, `refs`, `set-state-in-effect`, `immutability`, …) are in `recommended`; `eslint-plugin-react-compiler` is obsolete |
| zod | 4.x | The Next 16.3.5 forms example is Zod 3 style and fails type-checking on Zod 4; `z.coerce.number()` turns `''` into 0 and rejects Persian digits (lab) |
| vitest | 5.0.1 | `clearMocks` on by default; un-awaited `resolves`/`rejects` fail; async Server Components unsupported |

## Findings: the knowledge, condensed

The full statements, each with its source, are in the rule packs and the skill; this is the reasoning behind them.

- **Mutations are Actions** (react.dev): `<form action>`, `useActionState`, `useFormStatus` in a child of the form, `useOptimistic` only inside an Action. Expected errors are returned state; only unknown errors throw.
- **Derive, don't sync; effects are for external systems** (react.dev; Dodds; TkDodo; Abramov): computed values in render, `key` to reset, handlers for user-caused logic, `useSyncExternalStore` for outside stores, ref callbacks with cleanup for DOM work, `useEffectEvent` instead of silencing `exhaustive-deps`.
- **Composition before context and memo** (Abramov, "Before You memo()"; TkDodo; Erikson: "Context is not a 'state management' tool"): pass `children`, colocate state, one context per concern, unions instead of boolean props.
- **React Compiler** (React team, 2025-10-07): "For new code, we recommend relying on the compiler for memoization and using `useMemo`/`useCallback` where needed to achieve precise control." Hands-on on 2026-09-21: compiling a context provider with `babel-plugin-react-compiler` 1.0.0 cached the value object on `isOpen`, so `@eslint-react/no-unstable-context-value` only pushes useless `useMemo` here and was switched off.
- **Server first** (Next docs; Abramov: "'use client' is a typed <script>"): `'use client'` at the leaves, serialisable props, reads in Server Components straight from the data layer, never through Route Handlers or Server Actions ("Server Actions are queued").
- **Cache Components** (Next caching guide): every `await` is streamed, cached or deliberately blocking; dynamic `params` are request-time data, so pass the promise into a component under `<Suspense>` ("Maximizing the static shell").
- **Server Functions are public endpoints** (Next data-security guide; Markbåge: bound arguments "are NOT encrypted"): authorise and validate inside every action; return minimal DTOs.
- **TypeScript** (Pocock; TS release notes): `as const` plus derived unions and `satisfies` instead of enums, discriminated unions with exhaustive switches, `unknown` at trust boundaries, no `React.FC`.
- **Testing** (Dodds; TkDodo; Next Vitest guide): test through roles and names; async Server Components in Playwright; jsdom does not resolve logical properties under `dir="rtl"` (lab), so direction and layout are browser tests.
- **Farsi-specific traps found in the labs**: Persian digits break `Number()`, `type="number"`, `z.coerce.number()` and `pattern="\d{6}"`; `Intl` currency style and `dateStyle: 'full'` produce wrong Persian output. These became lint rules where possible.

## Findings: where knowledge must live

| Evidence | What it says |
|---|---|
| Vercel AGENTS.md eval (Jude Gao, 2026-01-27) | "In 56% of eval cases, the skill was never invoked"; baseline 53 %, skill 53 %, skill plus instruction 79 %, an 8 KB docs index in AGENTS.md 100 % |
| nextjs.org/evals (2026-09-11, pass@4) | Claude Fable 5.1 97 % with and without AGENTS.md; Opus 5 94 % → 97 %; Sonnet 5 81 % → 97 % |
| arXiv 2602.11988 (ETH, 2026-02-12) | Context files "do not generally improve task success rates, while increasing inference cost by over 20%"; useful "for specifying non-standard coding practices" |
| arXiv 2602.12670 (SkillsBench) | Curated skills raise pass rate from 33.9 % to 50.5 %; "Focused Skills with at most three modules outperform larger or exhaustive bundles" |
| arXiv 2603.29919 (SkillReducer, 55,315 skills) | "over 60% of body content is non-actionable"; compression had "a less-is-more effect" |
| arXiv 2606.15828 | "Lint Leakage" (rules a linter already checks) is the most common AGENTS.md smell (62 % of 100 repositories) |
| arXiv 2508.14419 | Iterating on static-analysis feedback cut security issues from over 40 % to 13 % and readability violations from over 80 % to 11 % |
| Claude Code memory docs | "Path-scoped rules trigger when Claude reads files matching the pattern, not on every tool use" |

Conclusion: anything mechanical goes into lint, because it is enforced every time and costs no context; what the linter cannot see goes into short path-scoped rules that load with the files they govern, one line per rule and no rule the linter already checks; examples go into one focused skill with three modules. Strong models gain little from always-on framework docs (nextjs.org/evals), so AGENTS.md stays a map.

## Findings: published skills and plugins

| Candidate | Verdict | Why |
|---|---|---|
| Next.js bundled docs and managed `AGENTS.md` block | **use** (already, since the scaffold) | "Framework knowledge comes from the bundled docs, not from Skills" (Next AI agents guide); offline, version-matched |
| Vercel `next-best-practices` | **gone** | Retired on 2026-06-17 by the Next.js team in favour of the bundled docs |
| Vercel `vercel-react-best-practices` | **do not install**; outranked if present | 108 KB AGENTS.md (about 27k tokens); predates `useEffectEvent` and still teaches latest-ref and handler-ref patterns; open issues about a wrong memo rule (#140) and context waste (#169) |
| Official Next workflow skills | **later** | `next-cache-components-optimizer` once real routes exist; `next-dev-loop` requires agent-browser, which conflicts with ADR-0002 |
| `mattpocock/skills` | **read, not installed** | Process skills overlapping `/plan`, `/work`, `/adr`, `/research` |
| Kent C. Dodds skills | **none exists** for React knowledge | `kcd-skills` holds personal workflow skills; the Epic Stack `epic-*` skill files were written by a contributor and contradict his posts in three places; a third-party "dodds" persona skill hides 212 zero-width characters in its title (confirmed) |
| `react-doctor` | **not now** | Pre-1.0, telemetry to Sentry, overlaps ESLint |
| `typescript-lsp` plugin | **optional** | Needs a TypeScript with a JavaScript API; revisit with TS 6 |
| The `skills` CLI | **not used** | Telemetry on by default; copying at a pinned commit does the same |

## Recommendation (implemented in the frontend quality harness)

1. **Lint first.** typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` with the project service; jsx-a11y `strict`; 25 `@eslint-react` rules for the React 19 API and common agent mistakes; `exhaustive-deps` as an error; restricted syntax and imports for stale idioms and the Farsi traps; Testing Library, jest-dom and Vitest rules on tests. `eslint-disable` comments have no effect in `src/` (`noInlineConfig`) and `pnpm lint` fails on warnings, so a rule cannot be silenced from code. `apps/web/eslint/samples/` plus `selftest.mjs` prove in `pnpm check` that deliberately bad files are rejected (by rule id and, where several restrictions share a rule, by message) and a clean React 19 component is not.
2. **Five rule packs under 80 lines** that hold only what lint cannot check, loaded by path.
3. **One skill, three modules**, every "after" example lint- and type-checked in this repo.
4. **No installed third-party knowledge skill**; the inventory and the rule for adding one are in `.claude/skills/README.md`.

Trade-offs accepted: typed lint makes `pnpm lint` slower (about 6 s on the empty app, growing with the code); path-scoped rules load only when a matching file is read, so an agent that creates files without reading any may miss them (measured in a fresh-session check); hand-written rules can go stale, so each names its sources and is pruned when it stops preventing mistakes.

What would change this: TypeScript 7 gaining an API (then typed lint on TS 7 and the `typescript-lsp` plugin); ESLint 10 support in jsx-a11y and eslint-config-next; a version-pinnable official React skill from the React team.

## Not verified

- A date for Next 17 or React 20.
- Whether Next 16.3.5's vendored React canary includes every 19.3 behaviour change (only exports were checked).
- ESLint 10 with eslint-config-next; Biome's rule coverage.
- Kent C. Dodds on the React Compiler or `useEffectEvent` (nothing found in his blog, workshops or code search).
- Figures quoted second-hand in blog posts about AGENTS.md that did not match the arXiv abstracts they cited.
