# How do the field's best build with language models, and which of their practices does Carshenas adopt?

- Date: 2026-09-29
- Asked by / for: Pedrum, for CS-43. The task asks for the practice of the field's best people, with Ilya Sutskever named as the bar. On 2026-09-29 the owner widened it: "gather material that helps us learn about building ai applications", from people such as Andrej Karpathy and Ilya Sutskever and from the model makers' own blogs, guides and benchmarks; check advice such as "never use negatives and don'ts"; cover examples (few-shot) and agentic patterns; and study open-source harnesses in real use, such as OpenCode.
- Outcome: 30 patterns Carshenas adopts, each tied to its sources and to an AI step (section "What Carshenas adopts"). A table of 20 popular claims with verdicts. A reading path of 25 items. Design rules for CS-44, CS-45, CS-46, CS-47 and CS-48, and for each AI step. Two corrections to earlier notes, applied as dated lines at the owner's request on 2026-09-29 (Metis's live prices in `2026-09-29-metis-ai.md`; the rivals' code in `2026-09-28-torob-challenge-expectations-and-field.md`). No ADR: the binding choices belong to CS-44 (ADR-0021 is reserved for it). Appendix folder `2026-09-29-prompting-context-engineering-and-agents/` with the eight research passes, a lab and evidence.

## Questions

1. **Prompting and context engineering.** What measurably gets the best output from current models, and what is folklore? Popular claims are checked one by one: negative instructions, few-shot examples, roles, tips and threats, politeness, capitals, "think step by step", prompt format, forced JSON, long context, temperature 0, self-correction and automatic prompt optimisation. Which language should instructions be in when the data is Farsi, and what does Persian cost in tokens?
2. **Structured outputs.** What do the makers' structured-output modes guarantee, how should a schema be designed, and how does a retry that feeds the validation error back to the model work?
3. **Confidence and review thresholds.** Can a model's own confidence decide what goes to review, and what works better?
4. **Evaluations and error analysis.** How do practitioners who report evaluations build them, and what statistics does a 200-listing labelled set support?
5. **Prompt injection** from text the model reads: what works, what has been broken, and what a seller writing a listing can do to each Carshenas step.
6. **Caching and cost**, and latency on the request path.
7. **Agents.** When is an agent worth building, which patterns exist, and does any Carshenas step need one?
8. **Harnesses.** What do open-source agent harnesses in real use (OpenCode, Codex CLI, Gemini CLI, Aider, SWE-agent, OpenHands and others) do, read from their source code, and what transfers to Carshenas's AI layer and to building it with Claude Code?
9. **Similar work.** Which open-source projects and published studies turn listings into records, match duplicates, turn queries into filters, value cars and explain a rating, and which of their ideas are worth taking?
10. **What to read first.** A reading path for the owner.

Every pattern this note adopts is mapped to the AI step it serves:
- **extraction**: condition, price type, options and hints from a listing's free text (CS-52);
- **duplicate decisions**: borderline cross-site pairs (CS-55);
- **query understanding**: plain Farsi into filters (CS-62);
- **explanations**: why a listing got its rating, from stored facts (CS-64);
- and, where it matters, name matching (CS-50), pasted links (CS-65) and the AI-first development workflow (CS-47).

## Method

- **What was already known is not repeated.** ADR-0019 and the Metis note (`2026-09-29-metis-ai.md`) already measured, through Metis from Iran: which routes return schema-valid output, and each model's latency and cost per extraction. So did the field note (`2026-09-28-torob-challenge-expectations-and-field.md`), for what the other challenge entries built. This note cites them and measures only what they left open.
- **Eight research passes, one per topic, on 2026-09-29.** Each fetched what it cites, and each is kept as an appendix file:

  | File | Topic |
  |---|---|
  | `makers.md` | What Anthropic, OpenAI, Google and DeepSeek say about prompting their current models (about 220 quotes checked by script) |
  | `people.md` | Karpathy, Sutskever and the field's credible builders; the principles they share and where they disagree |
  | `science.md` | The measured science of prompting, used to check 16 popular claims, Persian included |
  | `structured.md` | Structured outputs and retries, confidence and review thresholds, evaluations and their statistics |
  | `injection-cost.md` | Prompt injection, then caching, cost and latency |
  | `agents.md` | When an agent is worth building, the agentic patterns, context engineering |
  | `harnesses.md` | Eleven open-source agent harnesses read from their source code at recorded commits |
  | `similar-work.md` | Open-source projects and papers doing Carshenas's work, and the Torob-challenge rivals' code |

- **Checked again for this note.** Nothing below rests on a pass's word alone:
  - All 217 arXiv identifiers cited anywhere in the folder were looked up on arXiv's own API. All exist, and every title matches the paper it is cited as (`…/evidence/arxiv-ids-2026-09-29.tsv`).
  - The claims this note leans on were fetched again and found on the live page. These include Anthropic's prompting page, the Sonnet 5.5, Sonnet 5 and refusal pages, the caching and structured-output pages, OpenAI's GPT-5.6 guidance, Gemini 3's guide and Metis's live pricing endpoint.
  - Harness claims were re-read in the cloned source: OpenCode's per-model prompts and its doom-loop limit, Gemini CLI's untrusted-content wrapper and loop thresholds, Aider's reflection limit and Codex's cache key. Two prompt-style counts were rerun and matched.
  - Every URL in this note was fetched on 2026-09-29: 177 of 181 answered directly. The other four answer 403 to scripts; their sources say how each was read.
- **Measured here** (`…/lab/`, with outputs in `…/evidence/`):
  - [L1] Tokens for the same texts in Farsi and English, on GPT, Claude, Gemini and DeepSeek through Metis and on two tokenizers offline, and what messy Persian does to the count (`evidence/tokens-2026-09-29.json`). The lab's first live run, which met Metis's 404 and GPT's 400, is kept as `evidence/tokens-first-live-run-2026-09-29.json`.
  - [L2] Metis's live prices for the measured models (`evidence/metis-pricing-2026-09-29.json`).
  - [L3] Offline probes of three Torob-challenge rivals' checks (`evidence/rival-probes-2026-09-29.txt`).
  - [L4] The arXiv check above.
- **A disclosure.** This note was written by Claude, an Anthropic model, and Karpathy joined Anthropic on 2026-05-19 [KarpathyAnthropic]. Anthropic's material is marked V or O like every other vendor's, and where the makers disagree the note says so.

### How sources are marked

Every source carries one mark, and every finding says whether it is measured or opinion.

| Mark | Meaning | How much weight |
|---|---|---|
| **M** | Measured with a published method: a peer-reviewed paper (venue named), a reproducible benchmark, or a controlled experiment with numbers | Most, for the models and year it tested. A 2022 result on GPT-3 may not hold for 2026 models, so each says what it tested |
| **V** | Measured by a vendor or project about its own product | Real numbers, from an interested party |
| **P** | A practitioner's report from production, with some numbers but no controlled method | Experience, not proof |
| **O** | Expert opinion or guidance without data | A hypothesis to test on the labelled set |
| **L** | Measured here, in this note's lab | Small, but reproducible from the lab |

## Short answer

1. **Clever wording barely matters on 2026 models; the task definition, the context and the checks do.**
   - Measured: personas, tips or threats, politeness and "think step by step" do not reliably raise accuracy [Wharton1–4, Zheng24, Sprague25].
   - Capitals and "CRITICAL" have not been tested directly; the makers now advise against them because newer models over-react [AnthropicBP, OpenAI-4.1].
   - What does move results: formatting and example choices [Sclar24], how much and what goes into the window [ContextRot, Laban25], the output schema, validation in code, and the model.
   - OpenAI measured its own leaner prompts scoring 10–15% higher with 41–66% fewer tokens (V) [OpenAI-5.6].
2. **"Never write negative instructions" does not hold as a rule on current models; the evidence is mixed** (claim 1).
   - Negation is hard when it is in the data or inverts the task, mostly for older and smaller models [Jang22, InverseScaling].
   - A prohibition can still prime the forbidden topic [PinkElephant24], and negated framings still swing current models' judgements [ElkinsChun26].
   - Explicit prohibitions can be followed well: on Persian IFEval's one purely negative rule ("no commas"), 2025 models scored 0.87 to 1.00 [MIZAN].
   - The harnesses people use most write 5 to 22 negative phrases per 1,000 words [harnesses.md §5].
   - So: say what to do, pair any prohibition with the alternative and its reason, and put hard limits in the schema.
3. **Few-shot is not "always better".** Start zero-shot. Add 3 to 5 diverse, balanced, checked examples only when the labelled set shows a gain. Examples can make reasoning models worse [DeepSeekR1, WangDemos25].
4. **Structured output guarantees the shape, not the truth.**
   - Validate every answer in code. Re-ask once with the error. Then send the item to review.
   - Put the evidence before the value.
   - Write "not stated" as an enum value, because Claude's strict schemas allow at most 16 union-typed parameters in total [AnthropicSO].
5. **A model's own confidence does not tell right from wrong** [Xiong24, ExtractConf26; CS-42's sample]. Review thresholds come from the labelled set, field by field.
6. **The evaluation is the product.** Error analysis comes first. Per-field precision and recall need intervals: 190 of 200 correct is 91.0–97.3% [structured.md §C.3]. So 200 listings can show "about 95%", not "at least 95%".
7. **Prompt injection is unsolved:** adaptive attacks broke 12 published defences [Nasr25].
   - Carshenas has no "lethal trifecta" [WillisonTrifecta]: no tools, no private data, no outbound channel. The risk is a seller skewing their own listing's facts.
   - So: limit what the model can change, cross-check it in code, and test with injections that aim at a specific wrong value.
8. **Cost depends on the model family more than the price list shows.**
   - The same Persian text costs 1.1× its English tokens on Gemini and up to 2.6× on Claude [L1].
   - Caching needs a byte-stable prefix above 1,024 tokens (GPT-5.6) or 4,096 (Haiku 4.5) [OpenAICaching, AnthropicCaching].
   - Metis's live prices are about 1.1× the makers' list prices [L2]. Priced on them, CS-42's per-1,000 costs were low:
     - about 2× for gpt-5.6-luna ($0.28, not $0.13) and DeepSeek V4 Flash ($0.39, not $0.19–0.26);
     - about 10% for Claude Haiku 4.5 and Gemini 3.1 Flash-Lite.
9. **No Carshenas step needs an agent.** Each is one structured call or a fixed workflow that code controls [AnthropicAgents, Kapoor24].
   - The harnesses' lessons transfer as mechanics for the AI layer: a registry per task, bounded retries that feed the error back, stable prefixes and snapshots of rendered prompts.
   - They also transfer to building Carshenas with Claude Code.
10. **The closest published work agrees with all of this** [similar-work.md]:
    - code does the numbers, the model does the words;
    - three bands with explicit abstention (accept, send to review or a model, reject);
    - checks in code rather than asking the model to check itself;
    - evaluate the way the product is used.

## Sources

The main note's sources, grouped by topic. Each appendix file lists its own, about 400 in all. Marks: M, V, P, O as defined above; "fact" for API documentation.

**The makers** (details: `makers.md`)
- [AnthropicBP] Anthropic, "Prompting best practices", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (live, read 2026-09-29) — O, one V note. The maker's current guidance for the Claude 4.5 to 5.5 models.
- [AnthropicSonnet55] Anthropic, "Prompting Claude Sonnet 5.5", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 — V/O. Refusals when reasoning is requested in the answer.
- [AnthropicSonnet5] Anthropic, "Prompting Claude Sonnet 5", https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5 — fact: a non-default temperature returns 400.
- [AnthropicRefusals] Anthropic, "Refusals and fallback", https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback — fact: which models refuse, and that refusals are billed.
- [AnthropicSO] Anthropic, "Structured outputs", https://platform.claude.com/docs/en/build-with-claude/structured-outputs — fact: limits and ordering.
- [AnthropicCaching] Anthropic, "Prompt caching", https://platform.claude.com/docs/en/build-with-claude/prompt-caching — fact: minimums per model.
- [AnthropicReduceHallucinations] Anthropic, "Reduce hallucinations", https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations — O.
- [AnthropicCE] Anthropic, "Effective context engineering for AI agents" (2025-09-29), https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — O.
- [AnthropicAgents] Anthropic ("Written by Erik S. and Barry Zhang"), "Building effective agents" (2024-12-19), https://www.anthropic.com/engineering/building-effective-agents — O. The reference on workflows against agents.
- [AnthropicMultiAgent] Anthropic, "How we built our multi-agent research system" (2025-06-13), https://www.anthropic.com/engineering/multi-agent-research-system — V.
- [AnthropicEvals26] Anthropic, "Demystifying evals for AI agents" (2026-01-09), https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — P/O.
- [OpenAI-4.1] OpenAI, GPT-4.1 prompting guide (2025-04-14), https://developers.openai.com/api/docs/guides/latest-model/gpt-4.1 — V/O.
- [OpenAI-5] OpenAI, GPT-5 prompting guide (2025-08-07), https://developers.openai.com/api/docs/guides/gpt-5 — V/O.
- [OpenAI-5.4] OpenAI, GPT-5.4 guide (2026-03-05), https://developers.openai.com/api/docs/guides/gpt-5.4 — O.
- [OpenAI-5.6] OpenAI, "Prompting guidance for GPT-5.6" (2026-07-09), https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6 — V/O. The lean-prompt measurement.
- [OpenAIReasoning] OpenAI, "Reasoning best practices", https://developers.openai.com/api/docs/guides/reasoning-best-practices — O.
- [OpenAISO] OpenAI, "Structured Outputs" guide, https://developers.openai.com/api/docs/guides/structured-outputs — fact.
- [OpenAISOLaunch] OpenAI, "Introducing Structured Outputs in the API" (2024-08-06), read from https://web.archive.org/web/20251221190543/https://openai.com/index/introducing-structured-outputs-in-the-api/ — V.
- [OpenAICaching] OpenAI, "Prompt caching", https://developers.openai.com/api/docs/guides/prompt-caching — fact.
- [OpenAILatency] OpenAI, "Latency optimization", https://developers.openai.com/api/docs/guides/latency-optimization — O.
- [OpenAIAgentsGuide] OpenAI, "A practical guide to building agents" (April 2025), https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf — O.
- [Gemini3] Google, Gemini 3 developer guide, https://ai.google.dev/gemini-api/docs/gemini-3 — O.
- [GeminiSO] Google, structured output guide, https://ai.google.dev/gemini-api/docs/structured-output, and API reference, https://ai.google.dev/api/generate-content — fact.
- [DeepSeekR1] DeepSeek-AI, "DeepSeek-R1", Nature 645 (2025), https://arxiv.org/abs/2501.12948 — O for its few-shot note.
- [DeepSeekJSON] DeepSeek, "JSON Output", https://api-docs.deepseek.com/guides/json_mode — fact.

**People** (details: `people.md`)
- [KarpathyIntro23] Andrej Karpathy, "Intro to Large Language Models" (2023-11-23), https://www.youtube.com/watch?v=zjkBMFhNj_g — O.
- [KarpathyStateGPT23] Karpathy, "State of GPT" (Microsoft Build, 2023), https://www.youtube.com/watch?v=bZQun8Y4L2A — O.
- [KarpathyDeepDive25] Karpathy, "Deep Dive into LLMs like ChatGPT" (2025-02-05), https://www.youtube.com/watch?v=7xTGNNLPyMI — O.
- [KarpathyYC25] Karpathy, "Software Is Changing (Again)" (YC AI Startup School, June 2025), https://www.youtube.com/watch?v=LCEmiRjPEtQ — O.
- [KarpathyCE] Karpathy on context engineering (2025-06-25), https://x.com/karpathy/status/1937902205765607626 — O.
- [KarpathyDwarkesh25] Dwarkesh Patel with Karpathy (2025-10-17), https://www.dwarkesh.com/p/andrej-karpathy — O.
- [KarpathyVerif25] Karpathy, "Verifiability" (2025-11-17), https://karpathy.bearblog.dev/verifiability/ — O.
- [KarpathyYear25] Karpathy, "2025 LLM Year in Review" (2025-12-19), https://karpathy.bearblog.dev/year-in-review-2025/ — O.
- [KarpathyClaude26] Karpathy's notes on coding with Claude (2026-01-26), https://x.com/karpathy/status/2015883857489522876 — P.
- [KarpathyAnthropic] Karpathy, "Personal update: I've joined Anthropic" (2026-05-19), https://x.com/karpathy/status/2056753169888334312 — fact.
- [KarpathyRecipe] Karpathy, "A Recipe for Training Neural Networks" (2019-04-25), https://karpathy.github.io/2019/04/25/recipe/ — O.
- [SutskeverDwarkesh25] Dwarkesh Patel with Ilya Sutskever (2025-11-25), https://www.dwarkesh.com/p/ilya-sutskever-2 — O.
- [CarmackList23] John Carmack's interview on the list Sutskever gave him (2023-02-02), https://dallasinnovates.com/exclusive-qa-john-carmacks-different-path-to-artificial-general-intelligence/ — fact about provenance.
- [WeiVerifier25] Jason Wei, "Asymmetry of verification and verifier's law" (2025), https://www.jasonwei.net/blog/asymmetry-of-verification-and-verifiers-law — O.
- [Chung24] Hyung Won Chung on adding structure that is later removed (2024-06-12), https://www.linkedin.com/posts/hyung-won-chung-5801b9a4_stanford-cs25-v4-i-hyung-won-chung-of-openai-activity-7206446428880080896-CoDu — O.
- [Sutton19] Rich Sutton, "The Bitter Lesson" (2019-03-13), http://www.incompleteideas.net/IncIdeas/BitterLesson.html — O.
- [AppliedLLMs] Yan, Bischof, Frye, Husain, Liu and Shankar, "What We've Learned From A Year of Building with LLMs" (2024-06-08), https://applied-llms.org/ — P.
- [METR25] METR, randomised trial of AI and experienced developers (2025-07), https://arxiv.org/abs/2507.09089 — M.
- [METR26] METR, uplift update (2026-02-24), https://metr.org/blog/2026-02-24-uplift-update/ — M, weak by its own account.

**Prompting science** (details: `science.md`)
- [Jang22] Jang, Ye and Seo, negated prompts, https://arxiv.org/abs/2209.12711 — M, preprint.
- [InverseScaling] McKenzie et al., "Inverse Scaling", TMLR 2023, https://arxiv.org/abs/2306.09479 — M.
- [PinkElephant24] Castricato et al., https://arxiv.org/abs/2402.07896 — M, preprint.
- [ElkinsChun26] Elkins and Chun, negation sensitivity in moral dilemmas, https://arxiv.org/abs/2601.21433 — M, preprint.
- [Bsharat23] Bsharat et al., "Principled Instructions Are All You Need", https://arxiv.org/abs/2312.16171 — M, weak.
- [MIZAN] MCINext, MIZAN Persian LLM leaderboard, IFEval board (data 2025-11-25), https://huggingface.co/spaces/MCINext/mizan-llm-leaderboard — M, third party.
- [Min22] Min et al., EMNLP 2022, https://arxiv.org/abs/2202.12837 — M.
- [Zhao21] Zhao et al., ICML 2021, https://arxiv.org/abs/2102.09690 — M.
- [Lu22] Lu et al., ACL 2022, https://arxiv.org/abs/2104.08786 — M.
- [Nori24] Nori et al., o1-preview on medical questions, https://arxiv.org/abs/2411.03590 — M, preprint.
- [WangDemos25] Wang et al., demonstrations and reasoning models, https://arxiv.org/abs/2509.23196 — M, preprint.
- [Zheng24] Zheng et al., personas, Findings of EMNLP 2024, https://arxiv.org/abs/2311.10054 — M.
- [Wharton1] Meincke et al., Prompting Science Report 1, https://arxiv.org/abs/2503.04818 — M.
- [Wharton2] Meincke et al., Prompting Science Report 2 (chain of thought), https://arxiv.org/abs/2506.07142 — M.
- [Wharton3] Meincke et al., Prompting Science Report 3 (tips and threats), https://arxiv.org/abs/2508.00614 — M.
- [Wharton4] Basil et al., Prompting Science Report 4 (personas), https://arxiv.org/abs/2512.05858 — M.
- [Salinas24] Salinas and Morstatter, https://arxiv.org/abs/2401.03729 — M, preprint.
- [Yin24] Yin et al., politeness across languages, https://arxiv.org/abs/2402.14531 — M.
- [Cai25] Cai et al., tone on modern models, https://arxiv.org/abs/2512.12812 — M, preprint.
- [Sprague25] Sprague et al., "To CoT or not to CoT?", ICLR 2025, https://arxiv.org/abs/2409.12183 — M.
- [LiuMindStep25] Liu et al., "Mind Your Step (by Step)", ICML 2025, https://arxiv.org/abs/2410.21333 — M.
- [Sclar24] Sclar et al., ICLR 2024, https://arxiv.org/abs/2310.11324 — M.
- [Seleznyov25] Seleznyov et al., https://arxiv.org/abs/2508.11383 — M, preprint.
- [Tam24] Tam et al., "Let Me Speak Freely?", EMNLP 2024 Industry, https://arxiv.org/abs/2408.02442 — M.
- [dottxt24] Will Kurt (.txt), "Say What You Mean" (2024-11-20), https://blog.dottxt.ai/say-what-you-mean.html — V.
- [JSONSchemaBench25] Geng et al., https://arxiv.org/abs/2501.10868 — M, preprint.
- [CRANE25] Banerjee et al., "CRANE: Reasoning with constrained LLM generation", ICML 2025, https://arxiv.org/abs/2502.09061 — M.
- [SOB26] Singh et al., "The Structured Output Benchmark", https://arxiv.org/abs/2604.25359 — M, preprint.
- [Chavan26] Chavan, constrained decoding in small models, https://arxiv.org/abs/2609.23742 — M, preprint.
- [LostMiddle] Liu et al., "Lost in the Middle", TACL 2024, https://arxiv.org/abs/2307.03172 — M.
- [ContextRot] Hong, Troynikov and Huber (Chroma), "Context Rot" (2025-07-14), https://www.trychroma.com/research/context-rot — M, from a retrieval vendor.
- [Laban25] Laban et al., "LLMs Get Lost In Multi-Turn Conversation", ICLR 2026, https://arxiv.org/abs/2505.06120 — M.
- [IFScale] Jaroslawicz et al., "How Many Instructions Can LLMs Follow at Once?", https://arxiv.org/abs/2507.11538 — M.
- [Vasileva26] Vasileva, instructions in composition, https://arxiv.org/abs/2608.12426 — M, preprint.
- [ThinkingMachines25] Horace He and Thinking Machines Lab, "Defeating Nondeterminism in LLM Inference" (2025-09-10), https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/ — M.
- [Huang24] Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet", ICLR 2024, https://arxiv.org/abs/2310.01798 — M.
- [CRITIC24] Gou et al., CRITIC, ICLR 2024, https://arxiv.org/abs/2305.11738 — M.
- [DSPy23] Khattab et al., DSPy, https://arxiv.org/abs/2310.03714 — M.
- [GEPA26] Agrawal et al., GEPA, ICLR 2026, https://arxiv.org/abs/2507.19457 — M.
- [PromptReport24] Schulhoff et al., "The Prompt Report", https://arxiv.org/abs/2406.06608 — M, one case study.
- [Abaskohi24] Abaskohi et al., Persian benchmarks for ChatGPT, LREC-COLING 2024, https://arxiv.org/abs/2404.02403 — M.
- [Lai23] Lai et al., "ChatGPT Beyond English", https://arxiv.org/abs/2304.05613 — M.
- [Mondshine25] Mondshine et al., prompt translation strategies, Findings of NAACL 2025, https://arxiv.org/abs/2502.09331 — M.
- [PARSE26] Mozafari, Mousavinasab and Jatowt, "PARSE: An Open-Domain Reasoning Question Answering Benchmark for Persian", https://arxiv.org/abs/2602.01246 — M, preprint.
- [Hosseinbeigi25] Hosseinbeigi et al., Findings of NAACL 2025, https://aclanthology.org/2025.findings-naacl.147.pdf — M.
- [Petrov23] Petrov et al., tokenizer unfairness, NeurIPS 2023, https://arxiv.org/abs/2305.15425 — M.

**Structured output, confidence, evaluation** (details: `structured.md`)
- [PARSE25] Shrimal et al., "PARSE: LLM Driven Schema Optimization for Reliable Entity Extraction", EMNLP 2025 Industry, https://arxiv.org/abs/2510.08623 — M.
- [VeriHarness26] Ray and Goyal, "Structured Feedback Improves Repair in an LLM Agent Loop", https://arxiv.org/abs/2607.14167 — M, preprint.
- [Instructor] Instructor (567-labs/instructor), re-asking on validation errors, https://python.useinstructor.com/concepts/reask_validation/ — O.
- [LangExtract] Google, LangExtract, https://github.com/google/langextract (read at 62b933a) — O: a library that publishes no accuracy figures.
- [Xiong24] Xiong et al., ICLR 2024, https://arxiv.org/abs/2306.13063 — M.
- [ExtractConf26] Nitesh Kumar, "Beyond Logprobs: A Multi-Signal Confidence Engine for LLM-Based Document Field Extraction", IJCAI-ECAI 2026 workshop, https://arxiv.org/abs/2606.24420 — M.
- [Farquhar24] Farquhar et al., semantic entropy, Nature 2024, https://www.nature.com/articles/s41586-024-07421-0 — M.
- [AngelopoulosBates] Angelopoulos and Bates, conformal prediction, https://arxiv.org/abs/2107.07511 — O, a method with proofs.
- [HusainEvals] Hamel Husain, "Your AI Product Needs Evals" (2024-03-29), https://hamel.dev/blog/posts/evals/ — P.
- [HusainField] Hamel Husain, "A Field Guide to Rapidly Improving AI Products" (2025-03-24), https://hamel.dev/blog/posts/field-guide/ — P.
- [EvalsFAQ] Husain and Shankar, "AI Evals: Everything You Need to Know" (page dated 2026-09-18), https://hamel.dev/blog/posts/evals-faq/ — P.
- [Shankar24] Shankar et al., "Who Validates the Validators?", UIST 2024, https://arxiv.org/abs/2404.12272 — M.
- [Miller24] Evan Miller, "Adding Error Bars to Evals", https://arxiv.org/abs/2411.00640 — M.
- [Bowyer25] Bowyer et al., ICML 2025 position paper, https://arxiv.org/abs/2503.01747 — M.
- [Zheng23Judge] Zheng et al., "Judging LLM-as-a-Judge", NeurIPS 2023, https://arxiv.org/abs/2306.05685 — M.
- [Panickssery24] Panickssery et al., NeurIPS 2024, https://arxiv.org/abs/2404.13076 — M.

**Prompt injection, cost and latency** (details: `injection-cost.md`)
- [WillisonTrifecta] Simon Willison, "The lethal trifecta" (2025-06-16), https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ — O.
- [OWASP-LLM01] OWASP, LLM01: Prompt Injection (2025), https://genai.owasp.org/llmrisk/llm01-prompt-injection/ — O.
- [Hines24] Hines et al., "Spotlighting", https://arxiv.org/abs/2403.14720 — M, preprint.
- [AgentDojo] Debenedetti et al., AgentDojo, NeurIPS 2024, https://arxiv.org/abs/2406.13352 — M.
- [BIPIA] Yi et al., BIPIA, KDD 2025, https://arxiv.org/abs/2312.14197 — M.
- [Liu24PI] Liu et al., USENIX Security 2024, https://arxiv.org/abs/2310.12815 — M.
- [MetaSecAlign] Chen et al., "Meta SecAlign", https://arxiv.org/abs/2507.02735 — M, preprint.
- [Nasr25] Nasr, Carlini et al., "The Attacker Moves Second", https://arxiv.org/abs/2510.09023 — M, preprint.
- [DesignPatterns25] Beurer-Kellner et al., https://arxiv.org/abs/2506.08837 — O.
- [Watchtower26] Pandey and Bhujang, "Poisoning the Watchtower", https://arxiv.org/abs/2605.24421 — M, preprint.
- [Wharton26PI] Wharton Generative AI Labs, hidden prompt injections, https://gail.wharton.upenn.edu/research-and-insights/hidden-prompt-injections/ — M, not peer-reviewed.
- [ReverseCAPTCHA26] Marcus Graves, "Reverse CAPTCHA", https://arxiv.org/abs/2603.00164 — M, preprint.
- [PIGuard25] Li et al., "PIGuard", ACL 2025, https://aclanthology.org/2025.acl-long.1468/ — M.
- [PG2] Meta, Llama Prompt Guard 2 model card, https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M — V.
- [Opus55Card] Anthropic, Claude Opus 5.5 system card (2026-09-22), https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf — V.
- [Haiku45Card] Anthropic, Claude Haiku 4.5 system card (October 2025), https://www-cdn.anthropic.com/7aad69bf12627d42234e01ee7c36305dc2f6a970/Claude%20Haiku%204.5%20System%20Card.pdf — V.
- [GPT56Card] OpenAI, GPT-5.6 deployment safety (results added 2026-08-03), https://deploymentsafety.openai.com/gpt-5-6 — V.
- [Manus25] Yichao Ji, "Context Engineering for AI Agents: Lessons from Building Manus" (2025-07-18), https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus — P.
- [MetisCaching] Metis, token caching (modified 2026-09-22), https://www.metisai.ir/token-caching/ — V, no prices.
- [RouteLLM] Ong et al., RouteLLM, ICLR 2025, https://arxiv.org/abs/2406.18665 — M.
- [MeanCache] Gill et al., "MeanCache", https://arxiv.org/abs/2403.02694 — M.
- [vCache] Schroeder et al., "vCache: Verified Semantic Prompt Caching", https://arxiv.org/abs/2502.03771 — M.
- [Kapoor24] Kapoor et al., "AI Agents That Matter", TMLR, https://arxiv.org/abs/2407.01502 — M.
- [TailAtScale] Dean and Barroso, "The Tail at Scale", CACM 56(2), 2013, https://www.barroso.org/publications/TheTailAtScale.pdf — M.

**Agents and context engineering** (details: `agents.md`)
- [12Factor] Dex Horthy (HumanLayer), "12-Factor Agents", https://github.com/humanlayer/12-factor-agents — O.
- [GoogleADK] Hangfei Lin (Google), context-aware multi-agent framework (2025-12-04), https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/ — O.
- [LangChainCE] LangChain, "Context engineering for agents" (2025-07-02), https://blog.langchain.com/context-engineering-for-agents/ — O.
- [Agentless24] Xia et al., Agentless, https://arxiv.org/abs/2407.01489 — M, preprint.
- [TauBench24] Yao et al., τ-bench, https://arxiv.org/abs/2406.12045 — M.
- [MAST25] Cemri et al., "Why Do Multi-Agent LLM Systems Fail?", NeurIPS 2025, https://arxiv.org/abs/2503.13657 — M.
- [ScalingAgents26] Kim et al., "Towards a Science of Scaling Agent Systems", https://arxiv.org/abs/2512.08296 — M, preprint.

**Harnesses** (details: `harnesses.md`; every repository read on 2026-09-29)
- [OpenCode] https://github.com/anomalyco/opencode at 7945de2 — code.
- [Codex] https://github.com/openai/codex at 0b1b78a — code.
- [GeminiCLI] https://github.com/google-gemini/gemini-cli at fe63502 — code.
- [Aider] https://github.com/Aider-AI/aider at 5dc9490, with its published benchmarks — code, V.
- [SWEagent24] Yang et al., SWE-agent, NeurIPS 2024, https://arxiv.org/abs/2405.15793 — M; code at https://github.com/SWE-agent/SWE-agent.
- [SWEbenchLB] The SWE-bench maintainers' leaderboard data, https://github.com/SWE-bench/swe-bench.github.io, and the SWE-agent team's mini-SWE-agent, https://github.com/SWE-agent/mini-swe-agent — M.
- [TerminalBench21] The Terminal-Bench Team (Stanford, Harbor and the Laude Institute), "Terminal-Bench 2.1" (2026-05-06) and the Harbor-Index comparison, https://www.tbench.ai/news/terminal-bench-2-1 — M.
- OpenHands (https://github.com/OpenHands/software-agent-sdk), Cline (https://github.com/cline/cline), Goose (https://github.com/aaif-goose/goose), Crush (https://github.com/charmbracelet/crush), pi (https://github.com/earendil-works/pi) — code.

**Similar work** (details: `similar-work.md`)
- [ExtractGPT24] Brinkmann, Shraga and Bizer, ExtractGPT, iiWAS 2024, https://arxiv.org/abs/2310.12537 — M.
- [WDCPAVE24] Brinkmann, Baumann and Bizer, extraction and normalisation, ADBIS 2024, https://arxiv.org/abs/2403.02130 — M.
- [SelfRefine25] Brinkmann and Bizer, self-refinement for extraction, https://arxiv.org/abs/2501.01237 — M, workshop.
- [VedulaAmazon26] Vedula et al., attribute extraction with five outcomes, https://arxiv.org/abs/2609.09716 — M/V.
- [AutoAdvER24] Ventirozos et al., "Shifting NER into High Gear: The Auto-AdvER Approach" (car ads), https://arxiv.org/abs/2412.05655 — M, preprint.
- [AutoSpecNER26] Lee et al., "AutoSpecNER", https://arxiv.org/abs/2606.24387 — M, preprint.
- [SteinerBizer26] Steiner and Bizer, end-to-end data integration with LLMs, https://arxiv.org/abs/2603.10547 — M, workshop.
- [Narayan23] Narayan et al., "Can Foundation Models Wrangle Your Data?", PVLDB 2023, https://arxiv.org/abs/2205.09911 — M.
- [Peeters25] Peeters, Steiner and Bizer, "Entity Matching using Large Language Models", EDBT 2025, https://arxiv.org/abs/2310.11244 — M.
- [ComEM25] Wang et al., "Match, Compare, or Select?", COLING 2025, https://arxiv.org/abs/2405.16884 — M.
- [Lin26] Kelvin Lin, "Cost-Aware Evaluation of Large Language Models for Ambiguous Product Entity Matching" (2026-05-08, CC BY 4.0), https://zenodo.org/records/20089436 — M, working paper. The page answers 403 to scripts; the record was confirmed through Zenodo's API.
- [OpenSanctions26] Smith et al., "OpenSanctions Pairs", https://arxiv.org/abs/2603.11051 — M.
- [Walmart26] Pavani et al., "Entity Resolution in Practice", https://arxiv.org/abs/2607.26298 — P.
- [ONSSplink22] ONS census duplicates with Splink, https://raw.githubusercontent.com/Data-Linkage/Splink-census-linkage/main/SplinkCaseStudy.pdf — P.
- [Splink] UK Ministry of Justice, Splink, https://github.com/moj-analytical-services/splink — V.
- [ZoomInfo24] Yao et al., natural-language search into fields, https://arxiv.org/abs/2411.05048 — M.
- [LinkedIn26] Liu et al., structured query understanding, KDD 2026, https://arxiv.org/abs/2605.27441 — M.
- [DoorDash24] DoorDash, LLMs for search retrieval (2024-11-19), https://careersatdoordash.com/blog/how-doordash-leverages-llms-for-better-search-retrieval/ — P. Answers 403 to scripts; read through the Internet Archive.
- [Yelp25] Yelp, "Search Query Understanding with LLMs" (2025-02-04), https://engineeringblog.yelp.com/2025/02/search-query-understanding-with-LLMs.html — P.
- [Instacart25] Instacart, "Building The Intent Engine" (2025-11-13), https://tech.instacart.com/building-the-intent-engine-how-instacart-is-revamping-query-understanding-with-llms-3ac8051ae7ac — P. Answers 403 to scripts; read through the Internet Archive.
- [Puduppully19] Puduppully, Dong and Lapata, AAAI 2019, https://ojs.aaai.org/index.php/AAAI/article/view/4668 — M.
- [Kasner24] Kasner and Dušek, "Beyond Traditional Benchmarks", ACL 2024, https://aclanthology.org/2024.acl-long.651/ — M.
- [TableauPulse24] Salesforce, Tableau Pulse (2024-09-12), https://www.salesforce.com/blog/tableau-pulse/ — P.
- [Turpin23] Turpin et al., NeurIPS 2023, https://arxiv.org/abs/2305.04388 — M.
- [Vacareanu24] Vacareanu et al., "From Words to Numbers", COLM 2024, https://arxiv.org/abs/2404.07544 — M.
- [Vedula25] Vedula et al., quantile regression with LLMs for prices, Findings of ACL 2025, https://arxiv.org/abs/2506.06657 — M.
- [CarGurusIMV] CarGurus, "What is IMV?", https://cargurus.helpscoutdocs.com/article/10-what-is-imv — P.
- [Zillow] Zillow, Zestimate accuracy, https://www.zillow.com/z/zestimate/ — V. The page answers 403 to scripts; read from the Internet Archive's capture of 2025-11-14.

**Measured here**
- [L1] Token lab, `lab/tokens.mjs`, run 2026-09-29 14:48 UTC; `evidence/tokens-2026-09-29.json`.
- [L2] Metis's live pricing endpoint, https://api.metisai.ir/api/v1/meta/providers/pricing, read 2026-09-29; `evidence/metis-pricing-2026-09-29.json`.
- [L3] Rival probes, `lab/rival-probes/`, run 2026-09-29; `evidence/rival-probes-2026-09-29.txt`.
- [L4] arXiv check of every identifier in this folder; `evidence/arxiv-ids-2026-09-29.tsv`.

## Findings

### 1. Prompting and context engineering

**Measured (M):**
- **Wording tricks do little on current models.**
  - Expert personas did not improve accuracy across 162 roles [Zheng24] or on GPT-4o, o3-mini, o4-mini and Gemini 2.x [Wharton4].
  - Tipping or threatening had "no significant effect" [Wharton3]. Politeness effects are small and model-dependent [Yin24, Cai25].
- **Chain of thought, from "think step by step":** it helps mainly on math and symbolic tasks [Sprague25]. On current models it adds little and makes requests 20–600% slower [Wharton2]. On some tasks it hurts, by up to 36 points [LiuMindStep25].
- **Format matters, less so on frontier models.**
  - Up to 76 accuracy points between prompt formats on LLaMA-2-13B, and the best format differs between models [Sclar24].
  - GPT-4.1 and DeepSeek V3 are far more robust, but some tasks still spread 8–10 points [Seleznyov25].
- **Length and load hurt.**
  - Accuracy falls as input grows, even on simple tasks: a focused ~300-token input beat the ~113k-token one for all 18 models tested [ContextRot].
  - Information in the middle is used worst [LostMiddle].
  - Spreading instructions over turns costs 39% on average, and one consolidated instruction recovers about 95% of single-turn performance [Laban25].
  - Following several constraints at once breaks down beyond about 5–6 [Vasileva26]. The best model manages 68% at 500 instructions [IFScale].
- **Temperature 0 is not deterministic:** 1,000 samples gave 80 distinct completions [ThinkingMachines25]. The newest Claude, GPT and Gemini models reject or ignore a non-default temperature anyway [AnthropicSonnet5, makers.md §3f].
- **Self-correction.** Asking the model to check itself without an outside signal lowered accuracy [Huang24]. Correction driven by a tool or validator helped [CRITIC24].
- **Automatic prompt optimisation beats hand-written prompts once a metric and labelled data exist** [DSPy23, GEPA26, PromptReport24].

**Measured by the makers (V):**
- OpenAI, GPT-5.6: leaner system prompts scored 10–15% higher with 41–66% fewer tokens in internal coding-agent evaluations [OpenAI-5.6].
- Anthropic: putting the question after long (20k-token) inputs improves quality "by up to 30 percent". No method is given [AnthropicBP].

**Guidance without data (O), where the makers agree** [makers.md]:
- Be clear and specific, and give the reason behind a rule: "Claude is smart enough to generalize from the explanation" [AnthropicBP].
- Use a reasoning-effort setting rather than prompting for chain of thought. Start low or at none for extraction [OpenAI-5.4, Gemini3, AnthropicBP].
- Drop aggressive emphasis ("CRITICAL: You MUST"), because newer models over-react to it [AnthropicBP, OpenAI-4.1].
- Contradictory rules cost reasoning models tokens and stability [OpenAI-5, OpenAI-5.6].
- Keep prompts concise; Gemini 3 "may over-analyze verbose or overly complex prompt engineering techniques used for older models" [Gemini3].

**Where the makers disagree:**
- **Few-shot for reasoning models:** Google always adds examples; Anthropic says 3–5; OpenAI says zero-shot first; DeepSeek says examples degrade R1.
- **Where the instructions go in long input:** Anthropic and Google put them last; GPT-4.1 prefers both ends.
- **Reasoning in the answer text.** Anthropic's classifier models refuse it with a billed `reasoning_extraction` refusal: Fable 5 and 5.1, Opus 5 and 5.5, Sonnet 5.5, but not Haiku 4.5 [AnthropicSonnet55, AnthropicRefusals]. OpenAI's meta-prompt asks for it.

**Context engineering** is "the delicate art and science of filling the context window with just the right information for the next step" [KarpathyCE]. The working principles (O and P):
- the smallest set of high-signal tokens [AnthropicCE];
- a static prefix first and dynamic input last, because a cache hit needs an exact prefix [Manus25];
- context compiled from durable state [GoogleADK];
- write, select, compress, isolate [LangChainCE].

**Persian** (the evidence is thinner here than anywhere else):
- **Instruction language (M, mixed; no study tests 2025–26 frontier models on Persian extraction).**
  - English instructions scored higher than Persian ones with GPT-4 on Persian data, for example entailment 0.582 against 0.383 [Abaskohi24]; Persian NER F1 was 25.9 against 21.9 [Lai23].
  - Across 35 languages, instruction language showed only "a slight preference for English", while context and output language mattered more [Mondshine25].
  - A 2026 Persian benchmark reports Persian prompts better for open models, with small differences both ways [PARSE26].
- **Tokens [L1].** The same texts in Farsi and English, through Metis:

  | Model family (tokenizer) | 3 listings, Farsi ÷ English | Query | Instructions | Glossary file, tokens |
  |---|---|---|---|---|
  | Gemini 3.1 Flash-Lite | 1.06–1.13 | 0.73 | 1.21 | 1,763 |
  | GPT-5.6-luna (identical to o200k offline) | 1.27–1.33 | 1.06 | 1.27 | 1,680 |
  | DeepSeek V4 Flash | 1.45–1.59 | 1.18 | 1.45 | 1,766 |
  | Claude Haiku 4.5 | 2.25–2.58 | 2.18 | 1.99 | 2,116 |
  | cl100k (GPT-4 era), offline | 2.65–2.93 | 2.53 | 2.21 | 1,994 |

  - For the longest listing, Claude counts 335 tokens where GPT counts 158. At Metis's live prices [L2] Claude's input then costs about 10× GPT's for the same text, not 5× as the price list suggests. Compare models per listing, not per million tokens.
- **Messy Persian [L1].** Change in tokens against standard Persian spelling, per text (the three listings and the query; the instructions text is left out because its numbers are already Latin digits):

  | Variant | GPT (o200k) | Gemini | DeepSeek | Claude |
  |---|---|---|---|---|
  | Arabic ي and ك typed instead of Persian ی and ک | +11 to +17% | +14 to +19% | +7 to +10% | −2 to 0% |
  | Latin digits instead of Persian digits | −3 to −11% | +5 to +25% | −2 to −10% | −6 to −23% |
  | A space instead of the zero-width non-joiner | −3 to −4% | −1 to −4% | −7 to −12% | −3 to −7% |

  - No study measures what normalising Persian does to a model's accuracy [science.md §16]. Normalise for parsing, matching and scoring, not for tokens.
- **Persian judges and instructions.** GPT-4o as a Persian judge agreed with ground truth at only κ = 0.54 [Hosseinbeigi25]. On a purely negative instruction in Persian IFEval, current models scored 0.87 to 1.00 [MIZAN].
- **Two API facts from the lab's first live run** (`evidence/tokens-first-live-run-2026-09-29.json`, 14:45 UTC, the `live` baselines):
  - Metis answers 404 for Anthropic's free token-counting endpoint.
  - GPT-5.6-luna answers HTTP 400 ("Could not finish the message because max_tokens or model output limit was reached") when its reasoning hits a small output cap (16 tokens), instead of stopping early.

### 2. Popular claims, checked

Verdicts: **supported**, **contradicted**, **mixed** or **untested**. Evidence and details are in `science.md` (claims 1–16) unless another file is named.

| # | Claim | Verdict | Strongest evidence | Holds for 2025–26 models? | What Carshenas does |
|---|---|---|---|---|---|
| 1 | "Never write negative instructions; say what to do" | **Mixed** | Negation in data or inverted tasks hurts, mostly older and smaller models [Jang22, InverseScaling]. A prohibition still primes the forbidden topic: GPT-4 mentioned it in 13% of replies [PinkElephant24]. Negated moral framings still swing current models [ElkinsChun26]. An explicit prohibition was followed well: 0.87–1.00 on Persian IFEval's one purely negative rule, "no commas", by 2025 models [MIZAN]. The rule's only "measurement" confounds negation with added detail [Bsharat23]. Anthropic states it as formatting advice; OpenAI allows "what not to do"; Opus 5.5 "responds well to instructions that name specific patterns to avoid" [makers.md §3a]. Busy harnesses use 5–22 negatives per 1,000 words [harnesses.md §5] | Partly | Pair each prohibition with the alternative and its reason; hard limits in the schema; keep "not stated" apart from "none"; oversample negated phrasing («بدون رنگ», «تصادف نداشته») in the labelled set |
| 2 | "Few-shot examples always help" | **Contradicted** | Label balance, order and choice swing results [Zhao21, Lu22]. Label correctness matters less than format [Min22]. Examples helped attribute extraction: GPT-4o F1 68.8 → 78.6 [similar-work.md, SelfRefine25]. They degrade reasoning models [DeepSeekR1, Nori24, WangDemos25] | Yes | Zero-shot first; then A/B 3–5 diverse, balanced, checked examples of hard cases, never near-duplicates of real inputs, with the evaluation items kept out of the example pool |
| 3 | "Give the model an expert persona" | **Contradicted** for accuracy | [Zheng24, Wharton4] | Yes | No persona; spend the tokens on definitions; a Farsi tone spec for explanations |
| 4 | "Tips, threats or emotional appeals help" | **Contradicted** | [Wharton3]; a $1,000 tip did worse than smaller tips [Salinas24]; Aider measured emotional appeals lowering scores (V) [harnesses.md §3] | Yes | Never |
| 5 | "Be polite" (or rude) | **Mixed**, small | [Yin24, Cai25, Wharton1] | Partly | Neutral, direct wording; no Farsi courtesy formulas |
| 6 | "CAPITALS and CRITICAL make the model obey" | **Untested** directly; the makers advise against | Newer models over-trigger [AnthropicBP, OpenAI-4.1]; the newest harness prompts dropped capitals [harnesses.md §5] | Partly | No capitals; state the priority order once |
| 7 | "Always ask it to think step by step" | **Contradicted** | [Sprague25, Wharton2, LiuMindStep25]; reasoning models need effort settings, not prompts [OpenAIReasoning] | Yes | Effort setting measured on and off; an evidence field instead of "reasoning"; no reasoning in the answer text on Claude's classifier models |
| 8 | "Prompt format does not matter" | **Contradicted** | [Sclar24, Seleznyov25] | Partly | Freeze one template per model version; evaluate 2–3 paraphrases to know the spread |
| 9 | "Forcing JSON hurts reasoning" | **Mixed**, mostly contradicted when done well | Worse when the answer comes before the reason [Tam24]; equal or better with the same prompt [dottxt24]; up to +4% with reasoning first [JSONSchemaBench25]; free reasoning before a constrained answer +10 [CRANE25] | Partly | Native strict schemas; evidence before value |
| 10 | "Long context is free" | **Contradicted** | [LostMiddle, ContextRot, Laban25, IFScale, Vasileva26] | Yes | One listing per call; few rules; for query refinement, the filter state plus the newest words, never the chat history |
| 11 | "Temperature 0 makes output deterministic" | **Contradicted** | [ThinkingMachines25]; new models reject the setting [AnthropicSonnet5] | Yes | Reproducibility from the input-hash cache and pinned models; evaluations run 3 times or more |
| 12 | "Asking the model to check itself improves it" | **Mixed** | Contradicted without an outside signal [Huang24]; supported with validators and tools [CRITIC24, VeriHarness26, PARSE25] | Partly | Re-ask only on a failed code check, once, with the error |
| 13 | "Automatic prompt optimisation beats hand-written prompts" | **Supported**, given a metric and data | [DSPy23, GEPA26, PromptReport24] | Yes | After CS-48's baseline, try MIPROv2 or GEPA on the development split, then review the result by hand |
| 14 | "Write the instructions in the data's language" | **Mixed**, model-dependent | [Abaskohi24, Lai23, Mondshine25, PARSE26] | Unknown | English instructions with the Farsi terms verbatim (cheaper, see [L1]); A/B per model in CS-46 |
| 15 | "Persian costs far more tokens" | **Supported**, narrowed | 1.06× to 2.58× by family [L1]; up to 15× across languages on older tokenizers [Petrov23] | Yes | Budget per family; compare models per listing |
| 16 | "Normalise Persian before the model" | **Untested** for accuracy | Token effects small and mixed [L1] | Unknown | Normalise a model copy for matching and scoring; keep the raw text for evidence offsets; A/B raw against normalised |
| 17 | "More instructions and detail are safer" | **Contradicted** | [IFScale, Vasileva26, OpenAI-5.6] | Yes | Few rules; anything code can check moves into validators |
| 18 | "Strict structured output means correct output" | **Contradicted** | Best exact-value accuracy across 21 models was 83% [SOB26]; constrained decoding fixes structure, not content [Chavan26]; OpenAI and Google say so [OpenAISO] | Yes | Validate values in code; measure value accuracy, not validity |
| 19 | "The model's stated confidence shows when it is wrong" | **Contradicted** | Stated confidence clusters at 80–100 [Xiong24]; in field extraction, token probabilities, stated confidence and 5-sample agreement all separated right from wrong poorly [ExtractConf26]; 1.0 on every wrong answer in CS-42's sample | Yes | Thresholds from signals fitted on labels (section 4) |
| 20 | "Delimiters or a detector stop prompt injection" | **Contradicted** | Adaptive attacks broke 12 defences [Nasr25]; detectors over-fire and none is tested on Persian [PIGuard25, PG2] | Yes | Limit what the model can change; cross-check in code; measure attack success |

### 3. Structured outputs and retries

**What the modes guarantee (vendor documentation and V):**
- OpenAI reported 100% schema adherence with strict mode, against under 40% before it [OpenAISOLaunch]. Its guide warns that "Structured Outputs can still contain mistakes" [OpenAISO].
- Anthropic's strict schemas [AnthropicSO]:
  - at most 24 optional and 16 union-typed parameters per request, for example `"type": ["string", "null"]`;
  - no numeric or length constraints;
  - required properties come out first;
  - refusals arrive as HTTP 200 with `stop_reason: "refusal"`.
- Gemini keeps the schema's key order from version 2.5 [GeminiSO]. Google's API reference, updated 2026-09-23, now marks `responseJsonSchema` deprecated in favour of `responseFormat` [structured.md A8]. CS-42 measured `responseJsonSchema` working through Metis, so CS-45 checks it again.
- DeepSeek has JSON mode only, and "may occasionally return empty content" [DeepSeekJSON].

**Measured (M):**
- Valid is not correct: the best exact-value accuracy across 21 models was 83.0% [SOB26].
- Field order matters when reasoning is involved:
  - a JSON mode that put the answer before the reason cut reasoning accuracy [Tam24];
  - reasoning before the answer inside the schema helped [JSONSchemaBench25, CRANE25].
  - For extraction, the equivalent is an evidence quote before the value.
- Feeding the error back works when it is specific:
  - guarded reflection cut extraction errors by 92% within the first retry [PARSE25];
  - feedback that names the failing field, the value observed and the admissible values raised repair success by 42–44 points [VeriHarness26].

**How libraries re-ask (O, read from their code and docs):**
- Instructor appends the failed answer and "Validation Error found: … Recall the function correctly, fix the errors", with 1–3 retries by default [Instructor].
- The Vercel AI SDK's current structured call throws `AI_NoObjectGeneratedError` instead of re-asking.
- LangChain's own example "fixes" a 10/10 rating by returning 5 to satisfy `le=5`. A retry can satisfy a validator by changing the value, so a changed value must pass the same checks again [structured.md §A.3].

### 4. Confidence and review thresholds

- **Stated confidence is overconfident, and the alternatives are weak too (M):**
  - stated values cluster at 80–100 [Xiong24];
  - in 55-field extraction with GPT-4o, token probabilities (AUC 0.705), stated confidence (0.692) and agreement across 5 samples (0.744, at 5× the cost) all separated right from wrong poorly [ExtractConf26].
- **What worked:** two structurally different extraction calls plus external signals reached AUC 0.928 in the same study.
- **Agreement has limits:** it cannot catch an error the model makes every time [Farquhar24].
- **Token probabilities are not portable.** Anthropic exposes none; OpenAI and Gemini do. Whether Metis passes them through is unverified [structured.md §B.2]. So nothing is designed around them.
- **How to set a threshold (method, O):** per field, on a development split. Accept items only while an upper confidence bound on the error among them stays at or below the target, report the coverage, then confirm on a test split [AngelopoulosBates].
  - Certifying at most 5% error needs 59 accepted items with none wrong (computed) [structured.md §C.3].
  - Document-AI products route to human review by per-field thresholds plus a random audit of accepted items [structured.md §B.5].

### 5. Evaluations and error analysis

**Practice (P and O):**
- Error analysis comes first:
  - read at least 30 real outputs and write what went wrong (open coding);
  - group the notes into failure types (axial coding);
  - fix the most frequent first [HusainField, EvalsFAQ].
- Label pass or fail with a written critique, by one domain expert following a written guide [EvalsFAQ].
- "20-50 simple tasks drawn from real failures is a great start"; regression suites should pass "nearly 100%" [AnthropicEvals26].
- "Look at samples of LLM inputs and outputs every day" [AppliedLLMs].
- "become one with the data" [KarpathyRecipe].

**Measured (M):**
- **Criteria drift:** graders refine their criteria by grading, so the rubric comes after reading outputs [Shankar24].
- **Model judges are biased:** with the answers swapped, GPT-4 stayed consistent 65.0% of the time [Zheng23Judge], and judges favour their own text [Panickssery24]. In Persian, GPT-4o agreed with ground truth at only κ = 0.54 [Hosseinbeigi25].
- **Intervals:** normal-approximation intervals are too narrow below a few hundred items [Bowyer25], and errors clustered by listing widen them [Miller24].

**Statistics for Carshenas's sets (computed; `structured.md` §C.3):**

| Situation | Result |
|---|---|
| 190 of 200 listings right on a field | 95.0%, 95% interval 91.0–97.3% (Wilson) |
| Claiming "at least 95%" with one-sided 95% confidence | needs 196 of 200 |
| 10 fields per listing, each 95% right and independent | about 60% of listings fully right (0.95¹⁰) [people.md P11] |
| Detecting a true 3-point gain between two prompt versions, paired, 80% power | about 430–1,130 items |
| 50 queries, 45 right | 78.6–95.7% |
| CS-55's "precision ≥ 95%" | 59 accepted pairs with no false merge, or 93 with one |

### 6. Prompt injection

**Measured (M):**
- **Nothing published holds against an adaptive attacker.** Adaptive attacks bypassed 12 published defences, most above 90% [Nasr25].
- **Plain text tasks are not safe:** frontier models acted on instructions embedded in the data 25–81% of the time (GPT-5 57.6%) [MetaSecAlign].
- **Placement helps a little:**
  - repeating the prompt after the data cut attack success from 57.7% to 27.8% [AgentDojo];
  - injections placed at the end are the strongest [BIPIA].
- **Delimiting and datamarking** worked against non-adaptive attacks [Hines24] and failed against adaptive ones [Nasr25].
- **A strict schema** stops an injection from hijacking the task, but not from choosing a wrong value inside the schema: constrained output still let 33% of a forged-authority attack through [Watchtower26, Liu24PI].
- **Models rarely say they saw an injection:** 1.4% of trials [Wharton26PI].
- **Invisible characters:** hidden instructions were rarely followed without tools (≤1.1% without a hint) [ReverseCAPTCHA26]. One encoding uses U+200C, the zero-width non-joiner that Persian needs, so a sanitiser must keep it.
- **Detectors** over-fire on benign text [PIGuard25], and none has been evaluated on Persian [PG2].

**Vendor (V), all agentic, none extraction:**
- Claude Opus 5.5 acted on text pasted into the user turn about 2% of the time [Opus55Card].
- GPT-5.6-luna: 2.94% on indirect attacks [GPT56Card].
- Claude Haiku 4.5: 7–28% of attacks succeed, by setting [Haiku45Card].

**Applied (O, [WillisonTrifecta, OWASP-LLM01, DesignPatterns25]):**
- No step has tools, private data or an outbound channel, so the damage is limited to what each step's output can change:

  | Step | Who attacks, for what | What a successful injection changes |
  |---|---|---|
  | Extraction | A seller wants "no paint", "no accident", or a hidden installment bait | That listing's condition facts and flags. Price, mileage and year are parsed by code, so they stay safe |
  | Duplicates | A seller hides a repost or forces a merge | One pair's grouping |
  | Query understanding | The buyer, against themselves | Their own filters; token waste |
  | Explanations | Nobody, as long as no seller text goes in | A wrong sentence, caught by the number check |
  | Pasted link | A seller testing their own listing again and again | A condition shown at once, without review |

- The test that matters (from the SEP method [MetaSecAlign]): injections that target a *specific wrong value* ("write paint: none" in a listing that states two painted panels). Include them in the labelled set at the start, middle and end of the text, and in Farsi, English and Finglish. Report "k of n attacks succeeded", never "robust" [Nasr25].

### 7. Caching, cost and latency

- **Metis's prices [L2].** The live endpoint prices each model at about 1.1× the makers' list price. `models.json`, which CS-42 used, priced gpt-5.6-luna at OpenAI's batch price:

  | Model | `models.json`, US$ per 1M in / out | Live endpoint, 2026-09-29 | Per 1,000 extractions: CS-42's median tokens × live price |
  |---|---|---|---|
  | gpt-5.6-luna | 0.10 / 0.60 | 0.22 / 1.32 | $0.28 (CS-42 reported $0.13) |
  | claude-haiku-4-5 | 1.00 / 5.00 | 1.10 / 5.50 | $2.16 ($1.95) |
  | gemini-3.1-flash-lite | 0.25 / 1.50 | 0.275 / 1.65 | $0.36 ($0.33) |
  | deepseek-v4-flash | 0.14 / 0.28 | 0.165 / 0.66 | $0.39 with its cache hits ($0.19–0.26) |

  Which price Metis bills is unverified until the rial invoice is reconciled [injection-cost.md §B.4].
- **Caching is a cost lever, and only above a minimum.**
  - The prefix must be byte-identical. The schema, the effort setting and the tools are part of it.
  - The minimum is 1,024 tokens for GPT-5.6 and 4,096 for Claude Haiku 4.5 [OpenAICaching, AnthropicCaching]. Gemini 3.1 Flash-Lite has no listed minimum and no cached rate at Metis.
  - Carshenas's English rules plus the glossary come to about 1,900–2,400 tokens by family [L1]: above GPT-5.6's minimum, below Haiku 4.5's.
  - A worked example at live luna prices, per 1,000 calls:

    | Prompt | Cost |
    |---|---|
    | Today's 700-token prompt, uncached | $0.28 |
    | A 1,450-token prompt, uncached | $0.44 |
    | The same 1,450 tokens with a cached 1,200-token prefix | $0.20 |

    So a longer, useful, cached prefix can cost less than a short one [injection-cost.md §B.7].
  - Metis documents a `cache` parameter but names no providers or prices, so pass-through must be tested [MetisCaching]. Measured on 2026-09-29 by CS-45 (the Metis note, finding 9): OpenAI, Anthropic and Gemini refuse that parameter, and each provider's own caching passes through, with its usage fields.
- **Output and reasoning tokens drive both cost and time.** They were 30–92% of each measured call's cost [injection-cost.md §B.4]. Cutting output tokens cuts latency far more than cutting the prompt [OpenAILatency].
- **What else saves money.** Batch processing halves the cost at OpenAI, Anthropic and Gemini; DeepSeek halves its price off-peak. Model cascades and routers need in-domain labels: routers trained on English chat did no better than random elsewhere [RouteLLM].
- **Semantic caching** had a precision of 0.52 in its recommended setup [MeanCache]. «زیر ۷۰۰» and «زیر ۸۰۰» must not share an answer, so Carshenas caches by exact input hash only.
- **Latency on the request path (pasted links in 5 seconds; plain-Farsi search):**
  - Use a non-reasoning small model with a capped output, and run independent work in parallel.
  - Send a second, hedged request after the measured 95th percentile, which costs about 5% more calls [TailAtScale].
  - Set a deadline, after which the code-derived rating is shown on its own.

### 8. Agents: when, and how

**Decision rules [agents.md §2]:**
- Start with one well-built call [AnthropicAgents].
- Use a fixed workflow when the steps are known: code owns the control flow and the model fills slots [OpenAIAgentsGuide, 12Factor].
- Build an agent only when all of these hold:
  - the steps cannot be predicted;
  - the environment gives a check on progress;
  - the extra tokens and latency are affordable;
  - a wrong action's damage is capped.
- Judge any step up by pass^k (every one of k attempts succeeds) and by cost against accuracy [TauBench24, Kapoor24].

**The price of each step up (M and V):**

| From → to | Evidence |
|---|---|
| One call → fixed chain | A fixed three-phase pipeline matched the open-source agents of its time on SWE-bench Lite at $0.70 per issue [Agentless24]. Simple baselines matched complex agents, at costs up to 100× apart [Kapoor24] |
| Fixed chain → agent | About 4× the tokens of a chat. Reliability falls with repeats: pass^8 below 25% in τ-bench retail [TauBench24, AnthropicMultiAgent] |
| One agent → several | +90.2% on Anthropic's research eval at about 15× the tokens (V) [AnthropicMultiAgent]; −39% to −70% on sequential planning [ScalingAgents26]; 14 failure modes [MAST25] |

**For Carshenas:**
- **No step needs an agent.** Extraction, duplicate decisions, query understanding, explanations and name matching are each one call, or a chain with validation, one retry, optional voting and the review queue.
- **Pasted links** are a fixed chain with two parallel branches: fetch, then parse, then database valuation alongside model extraction.
- **Search files (CS-70, CS-72)** stay deterministic SQL matching. They can be called "Karshenas watching" in the product copy without being built as an agent.
- **An agent becomes worth building** when a task's steps cannot be listed in advance, and a fixed workflow fails the evaluation on real requests.
  - It would also need a check on the end state and read-only tools, with writes gated by a person.
  - The first candidates are offline and reviewed, for example a catalogue "gardener" that proposes aliases for unmatched names (CS-50).
- **Named patterns that do fit:**
  - prompt chaining with gates in code;
  - routing on deterministic triggers rather than the cheap model's own judgement;
  - parallel sections for latency;
  - voting only in CS-55's borderline band, if measured;
  - an evaluator–optimizer for explanations whose evaluator is code.

  Each pattern's evidence is in `agents.md` §4.

### 9. Harnesses, read from their source code

Eleven harnesses were read at recorded commits [harnesses.md §1; OpenCode, Codex, GeminiCLI, Aider]:
- OpenCode (210,786 stars; 9.08M npm downloads in 30 days);
- Codex CLI (86.1M downloads);
- Gemini CLI, Aider, SWE-agent and mini-SWE-agent;
- OpenHands, Cline, Goose, Crush and pi.

What they do, and what Carshenas takes:

| Pattern | Where, in the source | Evidence | Carshenas takes it for |
|---|---|---|---|
| Model settings looked up by task name | Gemini CLI `defaultModelConfigs.ts`; Codex's model catalogue; Aider's 357-entry `model-settings.yml` | V | CS-45's registry: task → model, prompt version, schema, effort, output budget, timeout, retries, fallback |
| A different system prompt per model family | OpenCode `session/system.ts` picks one of ten prompts by model id; Codex per model; Cline had seven variants and dropped them | No harness shows variants help; Terminal-Bench gaps are large for OpenAI models only, and an 18-trial study found no significant winner [TerminalBench21] | The mechanism in CS-45, with one prompt per step; a family-specific addition only when the labelled set shows the default losing |
| Feed the error back, with a cap | Aider lists failed edits, up to 3 reflections; SWE-agent re-queries format errors up to 3 times and keeps the mistakes out of history; OpenCode and pi return the failing schema paths | Aider GPT-5 (high) 52.0% → 88.0% with test errors fed back (V); SWE-agent's lint guard +3 points (M) [SWEagent24] | Extraction, duplicates and query understanding: at most 2 retries (1 on the request path); the same invalid output twice stops |
| Deterministic repair before rejecting | pi coerces types before validating; OpenCode's edit tool tries nine matching strategies | Aider: 9× more edit errors with flexible patching off (V) | CS-45 and extraction: Persian digits to Latin and "5" to 5 in code, logged; a meaning is never "fixed" |
| Retryable and terminal errors, backoff, Retry-After | Codex `protocol/src/error.rs`; OpenCode `retry.ts` (5 tries, 2 s doubling, 30 s cap) | — | CS-45: an overflowing context, a failed authentication or an invalid request is never retried |
| Loop and repetition limits | OpenCode "doom loop" at 3 identical calls; Gemini CLI at 5 identical calls or 10 repeated chunks, with a model check after 30 turns | — | For single calls, only "the same answer twice stops"; for the Claude Code workflow, iteration caps |
| A stable prefix and cache breakpoints | Codex tests that the second request starts with the first unchanged; OpenHands keeps the date last; Goose rounds the time to the hour; OpenCode puts the date in the system prompt, which breaks this | OpenHands' code comment claims 6–14× cost when Gemini's cache is frozen (P) | CS-45 and extraction: a byte-identical prefix and a test that two renders share it |
| Untrusted content marked as data, and tested | Gemini CLI wraps web and tool output in `<untrusted_context>` with the closing tag escaped, and has an injection eval; OpenHands; Goose strips Unicode tag characters | — | Every step: listing text as escaped data; tag and zero-width runs stripped, the zero-width non-joiner kept; injection cases in CS-48 |
| Snapshots of rendered prompts; recorded replies | Codex pins rendered prompts in 1,457 snapshot files; OpenCode replays recorded HTTP traffic | — | CS-45 tests in `pnpm check`: a prompt change shows as a diff, and recorded Metis replies make tests free and deterministic |
| Evaluation tiers | Gemini CLI: always-pass evals block pull requests; nightly evals run 3 times; promotion after 7 clean nights. Cline reports pass^k and flakiness; pi reports paired lift | Process | CS-48's gate and the CS-47 reviewer |
| A minimal baseline first | mini-SWE-agent is a 190-line, bash-only loop | 76.8% on SWE-bench Verified against 79.2% for the best scaffold with the same model (M) [SWEbenchLB] | One call and one schema per step; machinery added only when an evaluation shows a gap |
| Room for reasoning in the output budget | Cline raised a summary budget because reasoning models "return no summary text at all" on a tight one | P | CS-45: an empty answer is its own error, retried with more room (the lab hit exactly this [L1]) |

**What their prompts show about prompting practice** [harnesses.md §5; counted with `lab/promptstats.py`]:
- Negative phrases are everywhere: 5 to 22 per 1,000 words in full prompts, and the most in the newest GPT-targeted ones. Codex CLI's template for GPT-6 Astra has 43. The count is a proxy for negative instructions, since "cannot" and "can't" also appear in plain descriptions.
- Codex pairs a prohibition with its reason: "The CLI is not able to render these so they will just be broken in the UI."
- Capitals are leaving: Codex's GPT-6 templates have no NEVER, and OpenCode's GPT-6 prompt no capitals at all.
- Examples follow the model family: `<example>` blocks for Anthropic and Gemini, none for GPT.
- Prompt length ranges from 176 to 3,869 words with no evidence that it matters. The minimal harnesses stay competitive.

### 10. Similar work, and the ideas worth taking

The closest measured analogues, with details and marks in `similar-work.md`:

| Carshenas step | Closest work | What it measured | Idea taken |
|---|---|---|---|
| Extraction | Product attribute extraction at Mannheim [ExtractGPT24, WDCPAVE24, SelfRefine25]; car-ad NER [AutoAdvER24, AutoSpecNER26]; Google's LangExtract | Normalising after extraction beat one-step extraction, 96.2 against 91.3 F1. Definitions plus similar demonstrations lifted GPT-4o from 68.8 to 79.3 F1. Self-refinement strategies "fail to significantly improve the extraction performance" at 2–2.6× the tokens. On car ads, recall is the weak side (GPT-4o 54.7) | Code normalises numbers; closed labels; a verbatim evidence quote aligned by code; "not stated" scored apart; no self-correction loop; recall reported |
| Duplicates | Entity matching with LLMs [Narayan23, Peeters25, ComEM25]; production linkage [Splink, ONSSplink22, OpenSanctions26, Walmart26]; an ambiguous-band study [Lin26] | In the uncertain band, Claude Haiku 4.5 reached precision 0.980 at $1.30 per 1,000 pairs, where a tuned fuzzy rule reached 0.401. Selecting among candidates beat pairwise matching, 86.4 against 67.8 F1. Transitive closure collapsed F1 to 0 | Hard vetoes, a SQL score and three bands; a model only in the uncertain band, conservative, both pair orders, choosing among up to 4 candidates or none; checked merges, never closure |
| Query understanding | ZoomInfo, LinkedIn, DoorDash, Yelp, Instacart [ZoomInfo24, LinkedIn26, DoorDash24, Yelp25, Instacart25]; torob-khaneh | Listing every allowed value raised accuracy (categorical ≥ 0.95). Frequent queries answered from a cache ("only 2% of queries needed real-time inference", P). LinkedIn serves a small schema-constrained model with a lexical fallback, under a 600 ms budget at the 95th percentile | Rules first, the model only for leftover words; closed vocabularies from CS-58; an exact cache of normalised queries; a leftover chip; required against preferred; a deadline and fallback |
| Explanations | Data-to-text [Puduppully19, Kasner24]; Tableau Pulse [TableauPulse24]; faithfulness [Turpin23] | Templates reached 99.94% fact precision against 87–89% for neural writers. Zero-shot LLM outputs had at least one error 60–86% of the time. Stated reasons rarely name what drove the answer | Code renders every number; the model selects and orders facts, or writes with placeholders; any digit or number word outside a placeholder is rejected; a template fallback |
| Valuation | CarGurus's IMV, Zillow, Redfin [CarGurusIMV, Zillow]; LLMs as regressors [Vacareanu24, Vedula25] | LLMs regress worse than gradient boosting; one reached 275% mean absolute percentage error on car prices given examples. On-market estimates look better because they see the asking price | Valuation stays statistical (CS-51): prospective evaluation, abstain with too few comparables, and never use the asking price as its own input |

**The Torob-challenge rivals, read in their code** [similar-work.md §3; L3]:
- khodrobin's "rules first, a local 7B model as fallback" is not wired: `needs_model()` is never called.
- Its explanation guard passed a false «۲ میلیارد», a false «۴۰ هزار کیلومتر», number words and invented claims, and caught only a wrong percentage and a wrong year.
- Homerob's number check passed every false case.
- Capot's keyword scanner flags «بدون رنگ شدگی» as repainted and «تصادفی نیست» as an accident.
- These are the measured case for two Carshenas rules: a model rather than keywords for condition facts, and a strict no-numbers-in-model-text check for explanations.

### 11. What the named people add

- **Andrej Karpathy** [people.md §3]:
  - He described the partial-autonomy app: it packages context, orchestrates several model calls, gives the person a view to check the result, and has an "autonomy slider" [KarpathyYC25].
  - Keep AI "on a tight leash", so that checking its work stays quick and likely to succeed [KarpathyYC25]. Demos are `works.any()`; products are `works.all()`, "a march of nines" [KarpathyDwarkesh25].
  - "LLMs don't want to succeed, they want to imitate. You want to succeed, and you should ask for it." Models "need tokens to think" [KarpathyStateGPT23, KarpathyDeepDive25].
  - He named context engineering [KarpathyCE], says judges "are gameable" [KarpathyDwarkesh25], and has lost trust in benchmarks [KarpathyYear25].
  - For coding with agents: give success criteria, write tests first, and "watch them like a hawk" [KarpathyClaude26].
- **Ilya Sutskever** [people.md §4] published no practical guidance on building apps, as the task expected. What does carry over is his diagnosis:
  - "this disconnect between eval performance and actual real-world performance", and models that "generalize dramatically worse than people" [SutskeverDwarkesh25].
  - For Carshenas: our own evaluation on real Farsi listings beats any leaderboard, the long tail must be sampled, and the test split must never be used to tune prompts.
  - The famous "30 papers" list has no official version; it is a reconstruction of a list he gave John Carmack [CarmackList23]. It covers deep learning up to 2020 and is not on the reading path below.
- **The principles the field's builders share** [people.md §1]:
  - look at the data before building metrics;
  - choose models with your own evaluation, not leaderboards;
  - keep a person verifying;
  - automate what you can verify;
  - give exactly the context the task needs;
  - calibrate any confidence against labels;
  - start simple, and remove structure when a better model makes it unnecessary [Chung24, Sutton19];
  - report cost next to accuracy;
  - measure your own speed, because feeling fast is not being fast [METR25].

## What Carshenas adopts

Steps: **E** extraction (CS-52), **D** duplicate decisions (CS-55), **Q** query understanding (CS-62), **X** explanations (CS-64), **N** name matching (CS-50), **L** pasted links (CS-65), **W** the AI-first development workflow (CS-47). Each pattern is a design rule for the task named, to be confirmed on the labelled set where it is marked O.

| # | Pattern | Evidence | Steps | Lands in |
|---|---|---|---|---|
| 1 | One structured call per step; add a chain, voting or a second model only when the evaluation shows a gain | [AnthropicAgents O, Agentless24 M, Kapoor24 M, SWEbenchLB M] | all | CS-45, CS-46 |
| 2 | Code parses what the source structures and owns every number and decision; the model reads free text and picks labels | [WDCPAVE24 M, Vacareanu24 M, DesignPatterns25 O] | E, X, L | CS-52, CS-51, CS-64 |
| 3 | Native strict structured output per provider, every answer validated with zod; a portable schema: all fields required, `not_stated` and `unclear` as enum values rather than null unions, enums over free text | [OpenAISO, AnthropicSO, SOB26 M] | E, D, Q, N | CS-45 |
| 4 | Evidence before value in the schema: a verbatim quote per non-empty fact, aligned to the text by code (exact, then fuzzy after normalising); an unaligned quote goes to review | [LangExtract O, Tam24 M, JSONSchemaBench25 M, AnthropicReduceHallucinations O] | E, D | CS-52, CS-64 chips |
| 5 | One re-ask on a failed code check, with the failing field, the value seen and the admissible values; a fixed context, not the history; then a typed failure to review; the same invalid answer twice stops | [VeriHarness26 M, PARSE25 M, Instructor O, harnesses.md] | E, D, Q, X | CS-45 |
| 6 | One outcome per call: ok, invalid, refusal (HTTP 200 on Claude), truncated, empty, or provider error; output budgets with room for reasoning | [AnthropicRefusals, L1, harnesses.md] | all | CS-45 |
| 7 | A registry per task: model, prompt and schema version, effort, output budget, timeout, retry policy and fallback model | [harnesses.md: Gemini CLI, Codex, Aider] | all | CS-45, CS-46 |
| 8 | A byte-identical prefix (rules, glossary, schema, examples) with the variable input last; no dates or ids in it; a test that two renders share it; sized against each family's caching minimum | [Manus25 P, OpenAICaching, AnthropicCaching, L1] | E, D, Q | CS-45, CS-52 |
| 9 | Cache by a hash of step, prompt, schema, model, settings and normalised input; no semantic cache | [MeanCache M, vCache M] | all | CS-45, CS-48 |
| 10 | Log per call: step, versions, requested and answering model, tokens split into uncached, cache read, cache write, output and reasoning, latency, retries, outcome; price from Metis's live endpoint; reconcile with the invoice | [ADR-0019, Kapoor24 M, L2] | all | CS-45, CS-46 |
| 11 | Reasoning effort as a measured setting, starting at none or low; no "think step by step"; no reasoning requested in answer text on Claude's classifier models | [Sprague25 M, Wharton2 M, OpenAI-5.4 O, AnthropicSonnet55] | all | CS-46, CS-47 |
| 12 | No temperature tuning; reproducibility from the cache, pinned models and repeated evaluations | [ThinkingMachines25 M, AnthropicSonnet5, Gemini3] | all | CS-45, CS-48 |
| 13 | Instructions in English with Farsi terms verbatim; the glossary as definitions and decision criteria with the reason for each distinction; the output language stated; English against Farsi instructions A/B-tested per model | [Abaskohi24 M, Mondshine25 M, AnthropicBP O, OpenAI-5.6 O, L1] | E, D, Q, X | CS-47, CS-46 |
| 14 | Say what to do; each prohibition paired with the alternative and its reason; hard limits in the schema; no capitals, personas, tips, threats or courtesy formulas | Claims 1, 3–6 | all | CS-47 |
| 15 | Zero-shot first; then 3–5 diverse, balanced, checked examples of hard cases, never near-duplicates of real inputs, evaluation items kept out of the example pool | Claim 2 [SelfRefine25 M] | E, D, Q | CS-52, CS-48 |
| 16 | Few rules per prompt; anything code can check moves to a validator; one listing per call; query refinement sends the filter state and the newest words, never the chat | [IFScale M, Vasileva26 M, Laban25 M, ContextRot M] | all | CS-47 |
| 17 | A normalised copy of the text for the model and for matching (Persian ی and ک, Latin digits, the zero-width non-joiner kept, tag and other zero-width characters stripped); the raw text kept for evidence offsets | [L1, ReverseCAPTCHA26 M, science.md §16] | E, D, Q, N | CS-52, CS-45 |
| 18 | Prompts, schemas and guards versioned by content hash; rendered prompts snapshotted in tests; recorded model replies for tests with no network | [harnesses.md: Codex, OpenCode; similar-work.md: khodrobin] | all, W | CS-45, CS-47 |
| 19 | Three states per fact (stated, not stated, inferred); "not stated" scored as its own class; negated phrasing oversampled in the labelled set | [WDCPAVE24 M, VedulaAmazon26 M, L3] | E | CS-48, CS-52 |
| 20 | Confidence from signals rather than the model's number: grounding, agreement with parsed fields, a second structurally different call on critical fields; thresholds per field from the development split with an upper-bound rule, plus a random audit of accepted items | [ExtractConf26 M, Xiong24 M, AngelopoulosBates O] | E, D | CS-48, CS-52, CS-55 |
| 21 | Injection defence in layers: listing text as escaped data in the user turn, a "no authority" rule, a short reminder after it; a required `instructions_to_ai` flag; witness-value injections and metamorphic invariance in the labelled set; "k of n attacks succeeded" reported beside accuracy and cost | [Nasr25 M, MetaSecAlign M, AgentDojo M, BIPIA M, Wharton26PI M] | E, D, L | CS-52, CS-48 |
| 22 | Code cross-checks the model against parsed fields (price type against the structured price, mileage and year against the text); disagreement goes to review; model-derived facts can move a rating only a capped amount until reviewed | [OWASP-LLM01 O, injection-cost.md §A.8] | E, L | CS-52, CS-51 |
| 23 | Duplicates: hard vetoes, a SQL score and three bands set from sampled labels; the model only in the uncertain band, conservative, asked in both orders, choosing among up to 4 candidates or none; checked merges, never transitive closure | [Lin26 M, ONSSplink22 P, ComEM25 M, Walmart26 P, Zheng23Judge M] | D | CS-55 |
| 24 | Query understanding: rules first; the model sees only leftover words; closed vocabularies and pg_trgm candidates; values checked in code; unrecognised words must be substrings of the query; required against preferred; an exact cache; a deadline with a lexical fallback | [ZoomInfo24 M, DoorDash24 P, Yelp25 P, Instacart25 P, LinkedIn26 M] | Q, L | CS-62 |
| 25 | Explanations: code renders every fact through the Farsi formatters; the model selects and orders facts or writes placeholders; any digit or Persian number word outside a placeholder is rejected; a topic guard; one retry, then a template | [Puduppully19 M, Kasner24 M, TableauPulse24 P, L3] | X | CS-64 |
| 26 | Name matching: one alias table applied by code; aliases drafted by a model offline and approved by a person; leftovers chosen from the top pg_trgm candidates or none; coverage and precision reported apart | [SteinerBizer26 M, ComEM25 M, similar-work.md] | N | CS-50 |
| 27 | Evaluation: error analysis first; a written labelling guide; development and test splits; per-field precision and recall with Wilson intervals and listing-level accuracy; paired comparison of prompt versions; runs repeated 3 times | [EvalsFAQ P, Shankar24 M, Miller24 M, Bowyer25 M, AnthropicEvals26 P] | all | CS-48 |
| 28 | A CI gate in three layers: deterministic checks on every commit, golden items that must all pass, and a statistically significant paired loss (rather than "below the last report") on a prompt, model or schema change | [structured.md §C.4, harnesses.md: Gemini CLI tiers] | all | CS-48 |
| 29 | No agent at runtime; fixed workflows whose control flow is code; the criteria in section 8 before any agent | [AnthropicAgents O, OpenAIAgentsGuide O, TauBench24 M, MAST25 M] | all | CS-44, CS-70, CS-72 |
| 30 | For the Claude Code workflow: a skill with worked examples, a rule pack and a clean-context reviewer; an evaluation command the agent can run, printing briefly; evaluations written before long documentation | [agents.md §6, harnesses.md, METR25 M] | W | CS-47 |

Later, once the labelled set exists: automatic prompt optimisation (MIPROv2 or GEPA) on the development split, reviewed by hand before a new prompt version ships (claim 13), for E and D.

## Reading path

Ordered so each stage builds on the last, starting with how models work. Times are approximate. The five stages:
1. How language models work.
2. Prompting and context, as the makers say it now.
3. Evaluations.
4. Agents and building with them.
5. Security, then Carshenas's own problems.

| # | Read or watch | Time | Mark | Why it is here |
|---|---|---|---|---|
| 1 | Karpathy, "Intro to Large Language Models" (2023-11-23) [KarpathyIntro23] | 1 h | O | The mental model: a model as a compressed internet, the "LLM OS", and a first look at security |
| 2 | Karpathy, "Deep Dive into LLMs like ChatGPT" (2025-02-05), at least the post-training and "LLM psychology" parts [KarpathyDeepDive25] | 1–3.5 h | O | Where hallucinations, working memory, "tokens to think" and jagged skills come from |
| 3 | Karpathy, "Software Is Changing (Again)" (YC, June 2025) and his context-engineering post [KarpathyYC25, KarpathyCE] | 45 min | O | Partial autonomy, the autonomy slider, generation and verification: the shape of a good LLM product |
| 4 | Karpathy, "2025 LLM Year in Review" and "Verifiability", with Jason Wei on the asymmetry of verification [KarpathyYear25, KarpathyVerif25, WeiVerifier25] | 20 min | O | Why tasks you can verify improve fastest, and why the labelled set is the answer key |
| 5 | Dwarkesh Patel with Ilya Sutskever (2025-11-25), the first 25 minutes and "research taste" [SutskeverDwarkesh25] | 30 min | O | The bar the owner named, and why benchmark scores are not your product's accuracy |
| 6 | Anthropic, "Prompting best practices" (the live page for the Claude 5 family) [AnthropicBP] | 40 min | O | A maker's current guidance: be explicit, give reasons, examples, long-context layout, less emphasis |
| 7 | OpenAI, "Prompting guidance for GPT-5.6" [OpenAI-5.6] | 30 min | V/O | Lean prompts measured; contradictions; effort as the last tuning knob; keeping "not mentioned" apart from "no" |
| 8 | Google, Gemini 3 developer guide [Gemini3] | 15 min | O | Why temperature stays at 1.0, and why concise prompts suit reasoning models |
| 9 | Wharton Prompting Science Reports 1–4 (2025) [Wharton1–4] | 1 h | M | What the famous tricks (personas, tips, threats, "think step by step") do on current models: mostly nothing |
| 10 | Chroma, "Context Rot" (2025-07-14) [ContextRot], then Anthropic, "Effective context engineering for AI agents" (2025-09-29) [AnthropicCE] | 40 min | M, O | The measurement behind "less context is more", then how a maker applies it |
| 11 | Sclar et al., "Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design" (ICLR 2024) [Sclar24] | 30 min | M | Why prompts are evaluated on data, never judged by eye |
| 12 | Hamel Husain, "Your AI Product Needs Evals" and "A Field Guide to Rapidly Improving AI Products" [HusainEvals, HusainField] | 45 min | P | How a practitioner builds evaluations, starting from error analysis |
| 13 | Husain and Shankar, "AI Evals: Everything You Need to Know", selected questions [EvalsFAQ] | 40 min | P | Sizes, splits, judge validation, one expert as the authority |
| 14 | Shankar et al., "Who Validates the Validators?" (UIST 2024) [Shankar24] | 45 min | M | Criteria drift: why the rubric comes after reading outputs |
| 15 | Evan Miller, "Adding Error Bars to Evals" (2024) [Miller24] | 30 min | M | The statistics a 200-listing set needs |
| 16 | Yan, Bischof, Frye, Husain, Liu and Shankar, "What We've Learned From A Year of Building with LLMs" (2024) [AppliedLLMs] | 70 min | P | The densest practitioner checklist: structured output, small prompts, caching, evaluation |
| 17 | Anthropic, "Building effective agents" (2024-12-19) [AnthropicAgents] | 20 min | O | Workflows before agents, and the named patterns |
| 18 | Kapoor et al., "AI Agents That Matter" (TMLR) [Kapoor24] | 40 min | M | Cost beside accuracy; simple baselines that match complex agents |
| 19 | Yichao Ji, "Context Engineering for AI Agents: Lessons from Building Manus" (2025-07-18) [Manus25] | 15 min | P | The cache hit rate as a production metric; stable prefixes |
| 20 | mini-SWE-agent's README and one of the harness prompts in `harnesses.md` [SWEbenchLB] | 20 min | M, O | How little machinery a strong model needs, and what real prompts look like |
| 21 | METR's randomised trial (2025) and its 2026 update [METR25, METR26] | 25 min | M | Feeling faster is not being faster: measure the AI-first workflow |
| 22 | Simon Willison, "The lethal trifecta" (2025-06-16) [WillisonTrifecta] | 10 min | O | The one-page threat model for prompt injection |
| 23 | Nasr, Carlini et al., "The Attacker Moves Second" (2025) [Nasr25] | 40 min | M | Why no defence can be called robust, and how to report attack success |
| 24 | Brinkmann and Bizer on attribute extraction and normalisation (ADBIS 2024) [WDCPAVE24], then Peeters, Steiner and Bizer on entity matching (EDBT 2025) [Peeters25] | 1 h | M | The closest measured analogues to CS-52 and CS-55 |
| 25 | Kasner and Dušek, "Beyond Traditional Benchmarks" (ACL 2024) [Kasner24] | 30 min | M | Why model-written numbers fail, and what that means for CS-64 |

Left off on purpose: the "30 papers" attributed to Sutskever. It is not an official list, and it teaches how models are trained, not how to build with them [people.md §4].

## Decisions and follow-ups for the owner

1. **Correct CS-42's cost figures.** The Metis note priced calls from `models.json`. Metis's live endpoint lists about 1.1× the makers' prices, and gpt-5.6-luna at 2.2× the catalogue [L2]. So CS-42's costs per 1,000 extractions are about 2× low for gpt-5.6-luna and DeepSeek V4 Flash, and about 10% low for Claude Haiku 4.5 and Gemini 3.1 Flash-Lite (section 7). Applied on 2026-09-29 at the owner's request: a dated correction in the Metis note (finding 6, with pointers from its catalogue table and its recommendation 4). Still to do: CS-46 prices every call from the live endpoint and reconciles against the rial invoice.
2. **Correct the field note's account of khodrobin.**
   - Its model fallback is not wired, and its five-axis guard lets scale-word errors through [L3].
   - Its 100% query scores come from sets used to build its rules.

   Applied on 2026-09-29 at the owner's request: a dated correction after the car entries in `2026-09-28-torob-challenge-expectations-and-field.md`, which also covers Homerob's number check and Capot's 7.6 %.
3. **What "at least 95% field accuracy" means** (CS-48, CS-52): the point estimate or the interval's lower bound, and per field or per listing. 190 of 200 correct does not prove 95% (section 5).
4. **CS-48's regression rule** ("fails when accuracy drops below the last accepted report") would fail on noise. The alternative is pattern 28: deterministic checks, golden items, and a significant paired loss.
5. **A budget for a second call on critical fields** (accident, chassis, replaced panels, price type), used as a confidence signal (pattern 20).
6. **Metis pass-through checks for CS-44's spike or CS-45.** Is the `cache` parameter or Anthropic's `cache_control` honoured, and billed as documented? Also check batch, log-probabilities, Gemini's `responseFormat`, and the latency Metis adds at the 95th percentile. Done in CS-45 on 2026-09-29; the results are in the Metis note, finding 9.

## Recommendation

- **CS-44 (the library ADR)** should require:
  - a re-ask that carries the validation error;
  - each provider's native structured output through Metis, Anthropic's `output_config.format` included;
  - typed handling of refusals, truncation and empty answers;
  - recorded-reply tests;
  - no dependence on log-probabilities.

  The harness pass found pi's `pi-ai` package worth a look beside the candidates CS-44 already names [harnesses.md §2].
- **CS-45** builds patterns 3 to 12 and 18: the registry, the portable schema profile, the single re-ask, the outcome taxonomy, the stable prefix, the hash cache, the per-call log with live prices, prompt snapshots and recorded replies.
- **CS-46** runs the bake-off as a set of A/B tests on the labelled data:
  - English against Farsi instructions;
  - 0 against 3–5 examples;
  - raw against normalised text;
  - effort on against off.

  It reports well-formed rate, per-field accuracy with intervals, attack success, latency at the median and 95th percentile, and cost per listing at live prices.
- **CS-47** turns this note into the skill (patterns 11 to 18 and the claims table), the rule pack (the never-broken rules) and the reviewer (patterns 27 and 28).
- **CS-48** adopts patterns 19 to 21, 27 and 28, and decides items 3 and 4 above.
- **The steps:** CS-52 takes patterns 2, 4, 15, 17 and 19 to 22; CS-55 takes 23; CS-62 takes 24; CS-64 takes 25; CS-50 takes 26.

**The trade-off accepted.**
- Most prompting guidance is opinion, and most measured work is on English and older models. So every pattern marked O is a hypothesis to test on Carshenas's labelled Persian data, not a rule to follow blindly.
- The note favours what was measured over who said it, including the makers.

**What would change this recommendation:**
- CS-48 or CS-46 results that contradict a pattern on Persian listings, for example Farsi instructions winning, or examples not helping;
- a model whose stated confidence proves calibrated on the labelled set;
- a prompt-injection detector with a measured low false-positive rate on Persian;
- Metis not passing caching or batch through, which changes the cost plan. Measured on 2026-09-29 (the Metis note, finding 9): the providers' own caching passes through; batch works on OpenAI's route only.
