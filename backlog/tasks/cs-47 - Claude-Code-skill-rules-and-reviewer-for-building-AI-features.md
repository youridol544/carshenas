---
id: CS-47
title: 'Claude Code skill, rules and reviewer for building AI features'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 22:12'
updated_date: '2026-09-30 10:01'
labels:
  - dx
  - ai
milestone: m-3
dependencies:
  - CS-43
  - CS-44
  - CS-45
  - CS-46
references:
  - docs/research/2026-09-29-prompting-context-engineering-and-agents.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents write most of Carshenas's code, so the AI practice has to live where Claude Code reads it, as the database, interface and React practice already does (the database and ui-design skills, the rule packs, the reviewers). This task turns the research note on prompting and agents (CS-43), the AI layer's ADR (CS-44) and the model choices (CS-46) into three things:
- a skill for AI features, covering prompts, context engineering, structured outputs and their retries, evaluations and the harness, prompt injection, cost, and when to build an agent;
- a rule pack that attaches to AI code paths;
- a read-only reviewer that checks an AI change before review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A skill for AI features gives worked examples on the AI layer: a versioned prompt that carries the glossary, a structured extraction retried on validation errors, an evaluation run on a labelled set, a defence against instructions inside listing text, and a cost report
- [ ] #2 A rule pack attaches when an agent opens AI code, and states the rules that are never broken: output validated against a schema, nothing unvalidated stored, numbers a user sees from the database, an evaluation before a step ships, no personal data in prompts or logs
- [ ] #3 A read-only reviewer agent checks an AI change against those rules and the task's evaluation, with evidence it produces itself
- [ ] #4 `.claude/skills/README.md` lists the skill with its sources, and AGENTS.md points to it in one line while staying under 150 lines
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Relevant checks pass (lint, typecheck, tests)
- [ ] #2 Docs or ADRs updated when behavior or decisions changed
- [ ] #3 No secrets or credentials committed
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Skill .claude/skills/ai-features/: SKILL.md (the rules that are never broken, the workflow for adding or changing an AI step from error analysis to shipping, when an agent is worth building, commands, a table of references) and references: prompting.md (context engineering, CS-43 patterns 8 and 11 to 18, the claims table), structured-output.md (portable schema, evidence before value, checks that repair, one re-ask, outcomes), evaluation.md (error analysis, the labelled set, splits, per-field precision and recall with Wilson intervals, paired comparison, the three-layer gate, thresholds from labels), injection.md (threat model per step, the layers, witness-value and metamorphic tests), cost.md (tokens per family, caching minimums, the per-call line, the per-run report), review.md (the reviewer checklist, CS-43 patterns 27 and 28).
2. Five worked examples on the layer (where they live is the owner question below): a versioned prompt built from a glossary; a structured extraction re-asked on a failed check; an evaluation run on a labelled set with Wilson intervals and a paired McNemar comparison; a layered defence against instructions in listing text with witness-value and metamorphic tests; a cost report from the per-call lines.
3. Rule pack .claude/rules/ai.md on packages/ai/** and apps/worker/src/models*.ts (every AI change defines or registers a task in packages/ai, so it attaches in every AI session): the never-broken rules and what lint cannot see.
4. Reviewer .claude/agents/ai-reviewer.md: read-only, fresh context; runs the package lint, typecheck and offline tests, reads prompt snapshot diffs, computes prompt versions, re-scores the task stored evaluation runs against the labels, traces call sites against the rules. It never calls a model and never writes to the database or tracked files (default chosen: spending Metis credit stays a person decision).
5. .claude/skills/README.md row with sources; the AGENTS.md AI steps line points to the skill and the reviewer (stays at 149 lines); CLAUDE.md lists both.
6. Evidence: pnpm check; a headless Claude Code run with an InstructionsLoaded hook showing .claude/rules/ai.md loaded by path_glob_match when an AI file is read and not when a crawl job is; the reviewer run on planted defects (reverted afterwards) and on CS-46 evaluation evidence; the task-reviewer pass; then In Review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-30, owner decision (AskUserQuestion): the five worked examples are tested code in packages/ai/src/examples/, compiled, linted and run offline by pnpm check like the layer tests, each file marked as never the product; the skill explains each step and points to the file. Chosen over code blocks in the skill checked once, and over code blocks checked by an extractor in pnpm check.

Slice 1 (2026-09-30): packages/ai/src/examples/, the five worked examples, each file marked as never the product. listing-paint.ts is the example task written as a product task is (a glossary rendered in a fixed order into English instructions with the sellers words verbatim, the portable schema with evidence before value, the listing cleaned and escaped as data in the user turn with a reminder after it, grounding checks that also refuse evidence found only inside text addressed to an AI, its registry entry on extraction model and fallback, and nextStep, the call site that stores only validated facts and sends a flagged listing or a reading that contradicts the parsed price to a person first rather than re-asking it into agreement). listing-text.ts: the model copy (NFC, Persian yeh and kaf, Latin digits, ZWNJ kept, zero-width, bidi and Unicode tag characters dropped, capped length), asData, addressed-sentence spans. evaluation.ts: runEvaluation through the layer, per-field Wilson intervals, per-class precision and recall with not_stated as a class, witness-value attack counts, cost at Metis list prices, the exact McNemar compare with a FAIL line, withInjection for start, middle and end. cost-report.ts: sums the model call completed JSON lines per task, prompt version and model. Tests: glossary-prompt (snapshot, a new word is a new version, byte-identical prefix), reask (schema and check failures fed back, invalid after the re-ask goes to review, cache hit costs nothing), evaluation (wilson 190/200 = 0.910 to 0.973 and McNemar 8 v 2 = 0.109, 6 v 0 = 0.031 against CS-43 computed values; a v2 prompt that fixes L4 is no significant difference, p = 1.000; the gate FAILs 0 v 6), injection (tag and zero-width characters dropped, closing tags escaped, obeying model 9 of 9 attacks without the addressed-text check against 0 of 9 with it, all 9 to review), cost-report (a real JSON logger: 4 calls, 1 cached, 5 requests, US$0.004714875, no listing text in any line). pnpm --filter @carshenas/ai lint, typecheck and test: 137 of 137 pass.

Slice 2 (2026-09-30): the skill .claude/skills/ai-features/ (SKILL.md: the five never-broken rules, the workflow for adding or changing a step from error analysis to review, where each worked example is, when an agent is worth building, commands with their cost; references prompting.md with context engineering, patterns 8 and 11 to 18, Persian tokens and the 20 claims table; structured-output.md with the routes, the portable profile, evidence before value, what belongs in a check and what goes to a person, the re-ask, outcomes and errors, confidence; evaluation.md with error analysis, the labelled set, what a report carries, the computed statistics, paired comparison and the three-layer gate, model judges, the harness; injection.md with the threat per step, layers L0 to L6 mapped to the example code, the tests; cost.md with Metis live prices, the two caches and their minimums, batch, the request path, the per-call line and a jq run report checked on real layer lines; review.md, the reviewer checklist). Rule pack .claude/rules/ai.md on packages/ai/** and apps/worker/src/models*.ts. Reviewer .claude/agents/ai-reviewer.md: read-only, never calls a model (spending Metis credit stays a person decision), re-scores stored runs with bakeoff --score, prints prompt versions with a tested node one-liner, traces call sites with a tested grep. README row with sources; the AGENTS.md AI steps line now points to the skill and the reviewer (149 lines); CLAUDE.md lists both; the ai-layer runbook points to all three. Persian words needing the non-joiner are written with ^ in code (fa) and converted to real non-joiners in markdown prose, scanned. pnpm check: exit 0.

AC2 evidence (2026-09-30): Claude Code 2.1.285 fires an InstructionsLoaded hook with file_path, load_reason, trigger_file_path and globs (found in the binary, not in the docs). Three fresh headless sessions in this worktree (claude -p ... --settings <scratch settings with an InstructionsLoaded hook that appends each event to a file> --allowedTools Read --model haiku), each told only to Read one file: (1) packages/ai/src/registry.ts loaded .claude/rules/ai.md with load_reason path_glob_match, trigger_file_path packages/ai/src/registry.ts, globs [packages/ai, apps/worker/src/models*.ts]; (2) apps/worker/src/models.ts loaded worker.md and ai.md, both path_glob_match with that trigger; (3) apps/worker/src/jobs/divar.ts loaded worker.md only, not ai.md. The same probe on the existing worker rule before any change loaded worker.md the same way. The hook reports what the harness loaded, not what a model says it saw.

AC3 evidence, review A (2026-09-30): the new agent was not callable from this session (launched in the main checkout, whose .claude/agents has no ai-reviewer), so it ran headless inside the worktree: claude -p with the brief Use the ai-reviewer subagent ..., --permission-mode bypassPermissions and --output-format stream-json, the transcript kept in the session scratchpad (US$0.96, 166 s). Brief: the CS-46 extraction choice against its stored runs. The subagent read review.md and the rule pack, re-scored both runs with bakeoff --score (writing only an ignored results file) and in its own script outside the repository, and reproduced every number of the note: Gemini 3.7 Flash 1046 of 1053 fields (99.34%, Wilson 98.6 to 99.7), 110 of 117 listings, 0 of 21 injected values, US$1.639 per 1,000; GPT-6 Luna 1034 of 1053 (98.20%), 98 of 117, 0 of 21, US$0.158. It then found what the note lacks: no paired comparison (per call 12 to 0, p = 0.0005, but per listing by majority 4 to 0, p = 0.125), Luna priced with 99.8% cache reads (about US$0.32 per 1,000 uncached), Gemini reporting 0 reasoning tokens at thinking low, runs without a prompt version. Its verdict: not ready for the claimed gain. These are findings on CS-46, for the owner and CS-52, not CS-47 defects. It also found a real documentation bug, verified here: pnpm 10.27 hands the -- of bakeoff -- --score on to the script and parseArgs refuses it (ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL); without -- it works. Fixed the form in the skill, the agent, review.md, evaluation.md, the ai-layer runbook, the run.ts header and the CS-46 learning (which also lacked --step); the CS-46 research note, a dated record, is left for the owner. The agent now also says throwaway scripts go outside the repository and are deleted.
<!-- SECTION:NOTES:END -->
