---
id: CS-43
title: >-
  Research: prompting, structured outputs, context engineering and agents, from
  the field's best
status: In Review
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-29 16:21'
labels:
  - research
  - ai
milestone: m-3
dependencies: []
references:
  - docs/research/2026-09-29-prompting-context-engineering-and-agents.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants the AI work built on the practice of the field's best people, with Ilya Sutskever named as the bar. Sutskever himself has published little practical guidance, so the note draws on those who have published measured, reproducible advice: the model makers' own guides, and engineers and researchers who report evaluations.

The questions:
- prompting and context engineering;
- structured outputs, including validation and a retry that feeds the validation error back to the model;
- confidence and review thresholds;
- evaluations and error analysis;
- prompt injection from text the model reads;
- caching and cost;
- when an agent is worth building and how.

It also asks which open-source projects do similar work: turning classified listings into records, valuing cars, explaining a rating. It feeds the AI layer's ADR (CS-44) and the skill for AI features (CS-47).

Widened by the owner on 2026-09-29, when the task started: gather material to learn from, the practice of people such as Andrej Karpathy and Ilya Sutskever and the model makers' own blogs, guides and benchmarks; check popular prompting advice, such as never writing negative instructions, and how to give examples (few-shot); cover agentic patterns; and study open-source agent harnesses in real use, such as OpenCode, for the patterns and techniques they use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A research note answers each question with cited sources, each marked for credibility, and separates measured findings from opinion
- [x] #2 The note lists the patterns Carshenas adopts, each with its source and the AI step it applies to (extraction, duplicate decisions, query understanding, explanations)
- [x] #3 The note surveys open-source projects doing similar work and records the ideas worth taking, and why
- [x] #4 The note studies open-source agent harnesses in real use, OpenCode among them, from their source code, and records the patterns worth taking, each with the Carshenas step or workflow it applies to
- [x] #5 Popular prompting claims, among them avoiding negative instructions and adding few-shot examples, are each checked against measured evidence and marked supported, contradicted, mixed or untested
- [x] #6 A reading path lists the talks, guides and papers to learn from first, each with its credibility mark and why it is on the list
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Relevant checks pass (lint, typecheck, tests)
- [x] #2 Docs or ADRs updated when behavior or decisions changed
- [x] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the AI steps the note must serve: extraction (CS-52), duplicate decisions (CS-55), query understanding (CS-62), explanations (CS-64), with name matching (CS-50) and pasted links (CS-65); ADR-0011 point 6, ADR-0019 and the Metis note, so nothing already measured there is re-researched.
2. Gather sources in parallel with research subagents. Each fetches what it cites and returns findings with URL, author, date, a credibility mark and whether it is measured or opinion: the model makers' guides; the researchers and engineers (Karpathy, Sutskever and others); prompting science and the popular claims, Persian included; structured output, confidence thresholds and evaluations; prompt injection, caching and cost; agents and context engineering; open-source harnesses read from their source code (OpenCode, Codex CLI, Gemini CLI, Aider, SWE-agent and others); projects doing similar work.
3. Check the load-bearing claims myself by fetching their sources, and measure what is cheap to measure here (Persian token counts per tokenizer).
4. Write the note in docs/research from the research template: questions, method, sources with credibility marks, findings split into measured and opinion, a table of popular claims with verdicts, the patterns Carshenas adopts per AI step, harness patterns, similar projects, a reading path, and a recommendation for CS-44, CS-45, CS-47, CS-52, CS-55, CS-62 and CS-64. Add the index row and the task reference.
5. Verify: pnpm check, every cited URL answers, a task-reviewer pass; then check the criteria with evidence and move to In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-29: Eight research passes ran in parallel (makers, people, prompting science, structured output and evaluations, injection and cost, agents, harnesses from source code, similar work). Each is kept as an appendix file in docs/research/2026-09-29-prompting-context-engineering-and-agents/. The main note (docs/research/2026-09-29-prompting-context-engineering-and-agents.md) has: 30 adopted patterns mapped to the AI steps; a claims table with 20 verdicts (negative instructions: mixed; few-shot always helps: contradicted); findings split into measured and opinion; the harness and similar-work surveys; a 25-item reading path; decisions for the owner. Lab: tokens.mjs through Metis showed Persian costs 1.06-1.13x English on Gemini 3.1 Flash-Lite, 1.27-1.33x on GPT-5.6-luna, 1.45-1.59x on DeepSeek V4 Flash and 2.25-2.58x on Claude Haiku 4.5 (evidence/tokens-2026-09-29.json). Checks: all 217 arXiv ids exist and match their titles; 177 of 181 URLs answer (the other 4 block scripts and are marked); key claims re-fetched (Anthropic prompting, refusal, caching and structured-output pages; OpenAI GPT-5.6; Gemini 3); harness claims re-read in the clones; Metis live prices saved (luna 0.22/1.32 per 1M against 0.10/0.60 in models.json, so the CS-42 cost for luna is about 2x low); rival probes rerun (evidence/rival-probes-2026-09-29.txt). pnpm check passes.

task-reviewer pass (2026-09-29): all six acceptance criteria pass, no blocking findings. Fixed its should-fix items: the short answer now matches the claims table (capitals untested; negative instructions mixed; the MIZAN score is one no-commas rule on 2025 models); DeepSeek's CS-42 cost is also about 2x low and is named beside gpt-5.6-luna; the first live token run that met Metis's 404 and GPT's 400 is kept as evidence/tokens-first-live-run-2026-09-29.json; Sources moved before Findings as the template orders them; CS-48 references the note. Minor items fixed too: a mislabelled Homerob probe case (500 million was true; now a false 700 million, rerun, conclusion unchanged), the messy-Persian table's scope stated, harnesses.md's non-breaking hyphens replaced and promptstats.py marked as kept, LangExtract marked O in both places, authors added to 17 sources (from arXiv's API, the ACL Anthology and the Terminal-Bench page), the negative-phrase count called a proxy. The Building effective agents byline now reads as the page does (Erik S. and Barry Zhang). Two learnings added. pnpm check passes on the final state.

Owner's decisions of 2026-09-29 (popup answers): commit, mark Done and fast-forward main; correct both earlier notes. Applied as dated correction lines: docs/research/2026-09-29-metis-ai.md (live Metis prices in finding 6, pointers from its catalogue table and recommendation 4) and docs/research/2026-09-28-torob-challenge-expectations-and-field.md (khodrobin's unwired fallback and five-axis guard, Homerob's number check, Capot's 7.6 percent).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wrote docs/research/2026-09-29-prompting-context-engineering-and-agents.md, with an appendix folder holding eight research passes, a lab and evidence. The note has:
- answers to the ten questions, with every finding marked M, V, P, O or L and measured findings kept apart from opinion;
- 20 popular claims with verdicts (negative instructions: mixed; few-shot always helps: contradicted; personas, tips and step-by-step: contradicted for accuracy);
- 30 adopted patterns, each with its evidence and the AI steps it serves;
- a survey of eleven open-source harnesses read from their source code at recorded commits, OpenCode among them;
- a survey of the projects and papers doing similar work, with the rivals' code probed;
- a 25-item reading path;
- design rules for CS-44 to CS-48 and each step, and six decisions for the owner.

Measured here: Persian costs 1.06-1.13x the English tokens on Gemini 3.1 Flash-Lite, 1.27-1.33x on GPT-5.6-luna, 1.45-1.59x on DeepSeek V4 Flash and 2.25-2.58x on Claude Haiku 4.5. Metis's live prices are about 1.1x list, so CS-42's per-1,000 costs were about 2x low for luna and DeepSeek.

Verified with:
- all 217 arXiv ids found on arXiv with matching titles;
- 177 of 181 URLs answering, the other four read another way and marked;
- key claims re-fetched from live pages, and harness claims re-read in the clones;
- every citation key resolving to a marked source;
- a task-reviewer pass (all six criteria pass; its fixes applied);
- pnpm check passing.

At the owner's request, dated corrections were added to the Metis note (live prices) and the field note (rivals' code).
<!-- SECTION:FINAL_SUMMARY:END -->
