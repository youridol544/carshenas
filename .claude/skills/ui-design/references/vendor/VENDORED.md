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
