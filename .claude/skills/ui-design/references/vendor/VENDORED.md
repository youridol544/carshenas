# Vendored design guidance

Third-party guideline files copied at pinned commits on 2026-09-18, all MIT (licence files alongside). They are reference reading for the `ui-design` skill, not skills of their own. **`../../SKILL.md` and the project references take precedence** wherever they disagree, in particular on anything about direction, Persian typography, contrast method and review output format.

Copied, not installed: the `skills` CLI reports installs to a telemetry endpoint by default, Vercel's own `web-design-guidelines` skill re-fetches its rules from an unpinned URL on every run, and marketplace plugins update silently. To update a file, re-copy it at a new commit, read the diff, and change the table below.

| File | Source | Commit | Edits made here |
|---|---|---|---|
| `vercel-web-interface-guidelines.md` | github.com/vercel-labs/web-interface-guidelines, `AGENTS.md` | `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1` | none |
| `emil-design-eng.md` | github.com/emilkowalski/skills, `skills/emil-design-eng/SKILL.md` | `85e8e2363b713506e1d5b6e07a0eb2da66be1bc3` | removed the skill frontmatter and the "Initial Response" block that scripts the agent's first reply |
| `make-interfaces-feel-better/*.md` | github.com/jakubkrehel/make-interfaces-feel-better, `skills/make-interfaces-feel-better/` | `35545ea1512ad59fa463e6b1f95ca9c052981fe6` | `SKILL.md` renamed to `overview.md` with its frontmatter removed, so it cannot register as a separate skill |
| `fixing-accessibility.md` | github.com/ibelick/ui-skills, `skills/fixing-accessibility/SKILL.md` | `c5bcd86450b3582ba25204c622b9213b07464938` | removed the skill frontmatter |

Known places where these files do not fit a Farsi, right-to-left product (our rules win):

- Vercel: "Curly quotes (“ ”)" is an English rule; Persian uses «». "prefer APCA over WCAG 2" is not a requirement anywhere; WCAG 2.2 ratios are. Its Tailwind and React wording is incidental.
- Emil Kowalski and Jakub Krehel: no right-to-left content beyond one icon-flipping table; examples use physical `left`/`right`, `translateX` and `transform-origin` that must be mirrored deliberately; "`antialiased` on the root" is macOS-specific; letter-spacing and uppercase label tricks do nothing for Persian script.
- Output formats they prescribe for reviews do not apply; the `design-reviewer` agent defines ours.

Found wrong or outdated by the CS-26 research (2026-09-26; evidence in `docs/research/2026-09-26-ui-craft-details.md`, rules in `../craft.md`):

- Jakub Krehel's hit-area snippet (`after:left-1/2 … after:-translate-1/2`) uses a physical inset, and its logical rewrite lands beside the button in RTL (measured in Chromium). Use a negative inset (`after:-inset-2.5`).
- Jakub's icon-stroke table: 2.5 px beside bold text is heavier than Vazirmatn's measured bold stem (1.95 px at 16 px); match strokes to the real font. His `pl-*`/`pr-*` and `dark:` examples fail our lint. His press scale of 0.96 and Emil's 0.97 both sit in our 0.95 to 0.98 range; use the token.
- Emil Kowalski: "velocity exceeds ~0.11" is Sonner's toast threshold, not a sheet's (sheets use 0.4 to 0.5 px/ms); his general `bounce: 0.2` spring is bouncier than Apple's advice (start at 0, overshoot only after a gesture with momentum); the blur he uses to mask cross-fades is dropped under reduced motion (Apple); "never use ease-in" has one exception, an element leaving the screen for good.
- Emil, Rauno and Vercel gate hover with `(hover: hover) and (pointer: fine)`: right for phones, but touch laptops and iPads defeat media queries, so behaviour that depends on hover checks `pointerType` (Devon Govett).
- Vercel's live page (not the vendored copy) offers `maximum-scale=1` as an alternative to 16 px inputs and says React Suspense delays fallbacks automatically; the first breaks our zoom rule and the second is contradicted by React's documentation. Vercel's and Rauno's "use box-shadow for focus rings because outline ignores radius" is outdated: every current engine draws outlines along the radius.
