---
name: research
description: Investigate a question and write a cited research note in docs/research (questions and sources first, findings and recommendation after). Use when asked to research, compare, evaluate options or vendors, or when a task needs a spike before it can be planned.
argument-hint: "<question to answer> [for CS-<n>]"
---

# /research — answer a question with sources

Question: $ARGUMENTS

1. Create `docs/research/YYYY-MM-DD-kebab-slug.md` from the template in `docs/research/README.md`. Write the **Questions** section first so the note is useful even if interrupted.
2. Gather evidence: official docs (use the Context7 MCP for libraries and services), primary sources from practitioners with real production experience, and hands-on checks in the scratchpad when a claim is cheap to verify (install it, run it, measure it). Prefer what you can verify over what someone asserts. Skip content marketing and course-seller material unless it cites primary sources.
3. Record every source with URL, author, date and one line on why it is credible. Mark anything unverified as such; never invent quotes or URLs.
4. Write **Findings** (facts, with the source next to each) and a **Recommendation** (what to do, the trade-off you are accepting, what would change your mind).
5. Add a row to the index table in `docs/research/README.md`. Link it: `backlog task edit CS-N --ref docs/research/<file>` when it belongs to a task. If the recommendation is a binding decision, offer `/adr`.
6. Report the recommendation in a few sentences and the path of the note.
