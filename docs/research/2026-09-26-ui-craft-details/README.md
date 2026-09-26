# Appendix: UI craft details (CS-26)

The evidence behind `../2026-09-26-ui-craft-details.md` and behind `.claude/skills/ui-design/references/craft.md`, whose bracketed IDs point here. Each file is one research pass from 2026-09-26, kept as written apart from local paths: every tip has its reason, values, sources with dates and verbatim quotes of at most 25 words, confidence, and conflicts.

| File | IDs | Topic |
|---|---|---|
| `motion.md` | M-1 to M-36 | whether and how to animate, interruption, timing and springs, popovers, staggers, morphs and shared elements, RTL, reduced motion and weak devices, plus corrections to the old `motion.md` |
| `loading.md` | L-1 to L-35 | layout stability, response times, pending indicators, skeletons (with the recommended abstraction), optimistic updates, undo |
| `interaction.md` | I-1 to I-38 | touch targets, press, hover, tooltips and delay groups, safe triangles, menus, sheets and gestures, keyboard and search |
| `visual.md` | V-1 to V-38 | icons and stroke weight, colour budget, empty states, scroll fades, surfaces, text and spacing, defensive layout |
| `typography.md` | T-1 to T-25, M1 to M17 | Persian line height by role, clipping, metrics, size, weight, measure, underlines, digits, punctuation, fallbacks, with the measurement tables |
| `taste-match.md` | H-1 to H-50 | which practitioners independently state the owner's seventeen details, and the further details harvested from the best matches |
| `lab/` | | the font measurement scripts, to rerun when CS-3 picks the font |

Names such as `visual-test/*.mjs`, `shot-*.png` and `results-*.json` inside the passes refer to throwaway files from the research session, which were not kept. The measurements that depend on the font are repeatable with `lab/`, and the checks on a page with `.claude/skills/verify-ui/craft-checks.js`.
