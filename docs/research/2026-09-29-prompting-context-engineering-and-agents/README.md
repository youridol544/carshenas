# Appendix: the CS-43 research on prompting, context, structured output, evaluation, injection, cost and agents

The evidence behind `../2026-09-29-prompting-context-engineering-and-agents.md`, and the input for the AI layer's ADR (CS-44), the layer itself (CS-45), the model bake-off (CS-46) and the Claude Code skill for AI features (CS-47).

Each file is one research pass from 2026-09-29, kept as written apart from local paths and a few clarifications the main note's checks added (each marked where it appears). A pass records its method, its sources with dates and marks (M, V, P, O), verbatim quotes of at most 25 words, and what it could not verify. IDs inside a file are that file's own; the main note's source list gives the keys it cites.

| File | Topic |
|---|---|
| `makers.md` | Pass 1: what Anthropic, OpenAI, Google and DeepSeek say about prompting their current models, topic by topic, with where they disagree |
| `people.md` | Pass 2: Karpathy, Sutskever and the field's credible builders; 14 shared principles, 9 disagreements, and the draft reading path |
| `science.md` | Pass 3: the measured science of prompting, used to check 16 popular claims, Persian and tokenizers included |
| `structured.md` | Pass 4: structured outputs and retries, confidence and review thresholds, evaluations, error analysis and their statistics |
| `injection-cost.md` | Pass 5: prompt injection (defences, measurements, applied per step) and caching, cost and latency (with Metis's documentation and prices) |
| `agents.md` | Pass 6: when an agent is worth building, the named patterns, context engineering, and the AI-first workflow |
| `harnesses.md` | Pass 7: eleven open-source agent harnesses read from their source code at recorded commits, their measured results, and their prompts' style |
| `similar-work.md` | Pass 8: open-source projects and papers doing Carshenas's work, per step, and the Torob-challenge rivals' code |
| `lab/` | `tokens.mjs` (Persian against English tokens, per model family, through Metis), `promptstats.py` (prompt-style counts for harness prompts), `rival-probes/` (offline probes of three rivals' checks); `lab/README.md` says how to run each |
| `evidence/` | The runs the main note quotes: `tokens-2026-09-29.json`, `tokens-first-live-run-2026-09-29.json` (the run that met Metis's 404 and GPT's 400), `metis-pricing-2026-09-29.json`, `rival-probes-2026-09-29.txt`, and `arxiv-ids-2026-09-29.tsv` (all 217 arXiv identifiers cited in this folder, each found on arXiv with a title that matches) |

**What was checked after the passes.** The main note's method section lists it: every arXiv identifier, the claims the note leans on (fetched again from the live pages), the harness claims (re-read in the cloned source), two prompt-style counts (rerun), Metis's live prices and the rival probes (rerun from the kept copies).

**Names of files that were not kept.** The passes mention throwaway files from the research session: saved copies of sources, quote-checking scripts, clones of repositories and a statistics script. Where a pass pointed at one, the text now reads "the research session's scratchpad (not kept)". Only what is in `lab/` and `evidence/` survives.
