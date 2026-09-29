# Pass 6: when an agent is worth building, the agentic patterns, and context engineering (CS-43)

Researched on 2026-09-29. Every source cited was fetched that day and quotes are verbatim; text copies of the sources, the Berkeley Function-Calling Leaderboard CSVs and the METR data file were in the research session's scratchpad (not kept). The main note re-checked the claims it leans on.

Marks: **M** = measured with a published method; **V** = a vendor measuring its own product; **P** = practitioner report from production; **O** = opinion or guidance without data.

## 1. Bottom line

**No Carshenas step needs an agent today.** Each step has a known, fixed sequence and a bounded input:
- extraction (CS-52);
- duplicate decisions (CS-55);
- query understanding (CS-62);
- explanations (CS-64);
- name matching (CS-50);
- pasted links (CS-65).

Each is best built as one structured call, or a short fixed workflow that code controls. That workflow validates, may retry once, may escalate, and sends what is left to the review queue.

"Karshenas watching a search file" (CS-70/72) should stay deterministic matching, as designed. It can be called an agent in the product copy without being built as one.

The reasons, each backed in the sections below:
- The makers' guidance is to start simple.
- Fixed pipelines have matched agents at a fraction of the cost.
- Reliability falls sharply over repeated trials.
- Latency: the CS-42 note measured about 1.5–2 s per structured call through Metis, so the 5-second budget of CS-65 allows at most two calls in sequence.

What would change this is in section 7.

## 2. Decision rules: single call, fixed workflow or agent

**R1. Start with one well-built call, and add steps only when an eval shows a gain.**
- Anthropic, "Building effective agents" (2024-12-19, O): "we recommend finding the simplest solution possible, and only increasing complexity when needed."
  - Also: "For many applications, however, optimizing single LLM calls with retrieval and in-context examples is usually enough."
  - The page has been edited since publication. It now opens with "Much of the tooling landscape described in this post has changed since December 2024", and its routing example names Haiku 4.5 and Sonnet 4.5.
  - https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, "Effective context engineering" (2025-09-29, O): begin by "testing a minimal prompt with the best model available", then add instructions for the failures you find.

**R2. If the steps are known in advance, use a fixed workflow: code owns the control flow and the model fills slots.**
- OpenAI Agents SDK docs (current, O): "orchestrating via code makes tasks more deterministic and predictable, in terms of speed, cost and performance." https://openai.github.io/openai-agents-python/multi_agent/
- 12-Factor Agents (Dex Horthy, HumanLayer; repository created 2025-03-30, O based on about 100 builder conversations): most products sold as agents are "mostly deterministic code, with LLM steps sprinkled in at just the right points". https://github.com/humanlayer/12-factor-agents
- Agentless (Xia et al., arXiv 2024-07, M; venue UNVERIFIED, listed only as a preprint): a fixed three-phase pipeline (localise, repair, validate) reached 32.00% on SWE-bench Lite at $0.70 per issue. That was the best result among the open-source agents at the time. https://arxiv.org/abs/2407.01489

**R3. Build an agent only when all of these hold:**
- the number and order of steps can't be predicted;
- the environment gives a signal to check progress ("ground truth" from tool results or tests);
- you can afford several times the tokens and an unbounded latency;
- the damage a wrong action can do is capped.

Sources:
- Building effective agents: agents are for problems "where it's difficult or impossible to predict the required number of steps". Also: "The autonomous nature of agents means higher costs, and the potential for compounding errors."
- OpenAI, "A practical guide to building agents" (PDF dated April 2025, O): agents fit complex judgement, rules that have become hard to maintain, and heavy reliance on unstructured data. "Before committing to building an agent, validate that your use case can meet these criteria clearly. Otherwise, a deterministic solution may suffice." https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- Anthropic, "How we contain Claude across products" (2026-05-25, O): "As agents grow more capable, so does their potential blast radius." https://www.anthropic.com/engineering/how-we-contain-claude

**R4. Prefer one agent with a few distinct tools over many agents. Split only when evals show the model failing to follow instructions or to pick tools.**
- OpenAI guide: "maximize a single agent's capabilities first". It notes that some systems manage more than 15 distinct tools while others struggle with fewer than 10 overlapping ones.

**R5. Use several agents only for read-heavy, parallel, high-value work, and keep writing single-threaded.**
- Cognition, "Multi-Agents: What's Actually Working" (Walden Yan, 2026-04-22, P): "multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions." https://cognition.com/blog/multi-agents-working

**R6. Judge any step-up by reliability over repeated runs (pass^k: the task succeeds on every one of k attempts) and by cost against accuracy, not by a single run.**
- τ-bench, Anthropic's evals post, and "AI Agents That Matter" (details in section 3).

**R7. Put a human in the loop at failure thresholds and before hard-to-undo actions.**
- OpenAI guide (O) and 12-Factor factor 7 (O).
- Karpathy (June 2025 talk, from a third-party transcript, wording UNVERIFIED against the video; O): "it's less Iron Man robots and more Iron Man suits that you want to build." https://singjupost.com/andrej-karpathy-software-is-changing-again/

**R8. Re-test every piece of scaffolding when the model changes.**
- Anthropic, "Harness design for long-running application development" (Prithvi Rajasekaran, 2026-03-24, V/O): "every component in a harness encodes an assumption about what the model can't do on its own". https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic, "Harnessing Claude's intelligence" (Lance Martin, 2026-04-02, O): ask "what can I stop doing?" https://claude.com/blog/harnessing-claudes-intelligence

### The price of each step up

| Step up | What you gain | What you pay (measured) |
|---|---|---|
| Single call → fixed chain | Each call has an easier task; code can check between steps | Calls add up in sequence (about 1.5–2 s each through Metis, from `../2026-09-29-metis-ai.md`). Building effective agents: chaining trades "latency for higher accuracy" |
| Fixed chain → one agent | Can handle work whose steps can't be predicted | About **4×** the tokens of a chat (V). Reliability falls with repeated runs: GPT-4o solves under 50% of τ-bench tasks, and pass^8 is under 25% in retail (M). Anthropic's think-tool table (Claude 3.7 Sonnet, airline, V) falls from 0.584 at k=1 to 0.340 at k=5; the baseline falls from 0.332 to 0.100 |
| One agent → several | Parallel search across wide questions | About **15×** the tokens of a chat (V). −39% to −70% on sequential planning tasks, +81% on decomposable finance tasks (M). 14 distinct failure modes (MAST, M) |
| Adding a separate evaluator loop | Better quality near the edge of what the model can do | A full harness run cost 20× a solo run ($200 over 6 h against $9 over 20 min; one comparison, V) |

As an illustration only (not a source): if each step of a 10-step agent is 95% reliable and failures are independent, the whole run succeeds about 60% of the time (0.95^10). A 2026 preprint found constraint failures to be nearly independent and to accumulate multiplicatively (section 3).

## 3. Measured evidence (kept apart from opinion)

### Agents compared with simpler systems

- **ReAct** (Yao et al., ICLR 2023, M; PaLM-era models): interleaving reasoning and actions beat imitation and reinforcement learning by +34 and +10 absolute points on ALFWorld and WebShop. https://arxiv.org/abs/2210.03629
- **Reflexion** (Shinn et al., NeurIPS 2023, M; GPT-4): 91% pass@1 on HumanEval against 80% for GPT-4 alone. https://arxiv.org/abs/2303.11366
- **CodeAct** (Wang et al., ICML 2024, M; 17 LLMs): writing actions as code gave up to 20% higher success than JSON or text actions. https://arxiv.org/abs/2402.01030
- **SWE-agent** (Yang et al., NeurIPS 2024, M): interface design for the agent alone lifted it to 12.5% on SWE-bench and 87.7% on HumanEvalFix. https://arxiv.org/abs/2405.15793
- **AI Agents That Matter** (Kapoor et al., TMLR, M; GPT-3.5/4, Llama-3):
  - "There is no significant accuracy difference between our warming strategy and the best-performing agent architecture."
  - "For substantially similar accuracy, the cost can differ by almost two orders of magnitude."
  - Its escalation baseline starts with a cheap model and moves to a stronger one only when a test fails.
  - https://arxiv.org/abs/2407.01502
- **τ-bench** (Yao et al., 2024, M; venue UNVERIFIED): introduced pass^k. GPT-4o solves under 50% of tasks, with pass^8 under 25% in retail. https://arxiv.org/abs/2406.12045
- **Holistic Agent Leaderboard** (Kapoor et al., ICLR 2026, M): 21,730 runs over 9 models and 9 benchmarks for about $40,000. Found "higher reasoning effort reducing accuracy in the majority of runs." https://arxiv.org/abs/2510.11977

### Multi-agent systems

- **Anthropic's research system** (2025-06-13, V; Opus 4 leading Sonnet 4 subagents):
  - +90.2% over single-agent Opus 4 on an internal research eval.
  - Token usage alone explains 80% of the variance on BrowseComp.
  - Agents use about 4× the tokens of a chat, and multi-agent systems about 15×.
  - https://www.anthropic.com/engineering/multi-agent-research-system
- **MAST, "Why Do Multi-Agent LLM Systems Fail?"** (Cemri et al., NeurIPS 2025 Datasets and Benchmarks, spotlight, M):
  - 1,600+ traces across 7 frameworks; 14 failure modes in 3 categories; annotator agreement kappa = 0.88.
  - Gains from multi-agent systems "are often minimal".
  - https://arxiv.org/abs/2503.13657
- **"Towards a Science of Scaling Agent Systems"** (Kim et al., Google, preprint v3 2026-04-08, M):
  - Change against a single agent runs from +80.8% on decomposable financial reasoning to −70.0% on sequential planning.
  - Architectures without central verification pass errors on more.
  - The v1 figures (180 configurations; errors amplified 17.2× without coordination, 4.4× with it) come from the 2026-01-28 blog post. The v3 abstract says 260 configurations.
  - https://arxiv.org/abs/2512.08296
- **Cognition 2026** (V): its review agent finds about 2 bugs per pull request, about 58% of them severe. It works best when the reviewer shares no context with the coder.

### Tools and context

- **Berkeley Function-Calling Leaderboard** (BFCL; Patil et al., ICML 2025, M). Computed in this pass from the leaderboard's CSVs (last updated 2026-04-12):
  - With real user-contributed functions, 92 of 109 models score lower when choosing among several functions than when given one (median −6.4 points).
  - With the older, non-live test set, 71 of 109 are lower (median −1.0).
  - Correctly calling no tool when none fits ranges from 10% to 100% (median 77%).
  - So Drew Breunig's claim that "every model performs worse" with more than one tool is **mostly supported, but not for every model**.
  - https://gorilla.cs.berkeley.edu/leaderboard.html
- **RAG-MCP** (Gan and Sun, 2025 preprint, M; DeepSeek-v3): retrieving only the relevant tools raised tool-selection accuracy from 13.62% to 43.13%. https://arxiv.org/abs/2505.03275
- **Less is More** (Paramanayakam et al., DATE 2025, M): fewer tools per call means better function calling on edge models, and up to 70% less execution time. https://arxiv.org/abs/2411.15399
- **LLMs Get Lost in Multi-Turn Conversation** (Laban et al., ICLR 2026 oral, M; 15 LLMs):
  - An average 39% drop when instructions arrive over several turns; 200,000+ simulated conversations.
  - "when LLMs take a wrong turn in a conversation, they get lost and do not recover."
  - Even at temperature 0, about 30% unreliability remains.
  - Gathering everything into one instruction works; agent-like re-statement only recovers 15–20%.
  - https://arxiv.org/abs/2505.06120
- **Lost in the Middle** (Liu et al., TACL, M): models are best when the relevant information sits at the start or end of the context. https://arxiv.org/abs/2307.03172
- **Chroma, Context Rot** (Hong, Troynikov and Huber, 2025-07-14, M; technical report from a retrieval vendor; 18 models including GPT-4.1, Claude 4, Gemini 2.5):
  - Performance degrades as input grows, even on simple tasks.
  - Focused prompts of about 300 tokens scored "significantly higher" than full prompts of about 113,000 tokens.
  - https://research.trychroma.com/context-rot
- **IFScale** (Jaroslawicz et al., NeurIPS 2025 workshop, M; 20 models): the best frontier models reach only 68% accuracy when given 500 instructions at once, with a bias towards earlier instructions. https://arxiv.org/abs/2507.11538
- **Vasileva 2026** (preprint, reviewed in the May 2026 ACL review cycle, M; 15 models):
  - "Reliable instruction following breaks down beyond 5-6 simultaneous constraints."
  - Failures are nearly independent, so they multiply.
  - https://arxiv.org/abs/2608.12426

### Checking and correcting a model's output

- **Huang et al.** (ICLR 2024, M): models "struggle to self-correct their responses without external feedback, and at times, their performance even degrades". https://arxiv.org/abs/2310.01798
- **CRITIC** (ICLR 2024, M): checking outputs with tools helps, highlighting "the crucial importance of external feedback". https://arxiv.org/abs/2305.11738
- **Self-Refine** (NeurIPS 2023, M; GPT-3.5/4): about +20% absolute from self-feedback across 7 tasks. https://arxiv.org/abs/2303.17651
  - Self-correction without outside feedback is therefore **mixed**: it helps generation tasks and fails on reasoning.
- **Self-consistency** (ICLR 2023, M): majority voting over samples gives +17.9% on GSM8K. https://arxiv.org/abs/2203.11171
- **More Agents Is All You Need** (TMLR, M): sample-and-vote accuracy grows with the number of samples. https://arxiv.org/abs/2402.05120
- **LLM-as-a-judge** (Zheng et al., NeurIPS 2023 Datasets and Benchmarks, M): judges show position, verbosity and self-enhancement bias; GPT-4 agrees with humans over 80% of the time. https://arxiv.org/abs/2306.05685

### Routing between models

- **RouteLLM** (ICLR 2025, M): more than 2× lower cost without losing quality. https://arxiv.org/abs/2406.18665
- **FrugalGPT** (TMLR, M): a model cascade matched GPT-4 with up to 98% lower cost. https://arxiv.org/abs/2305.05176

### Coding agents and developer productivity (for the development workflow)

- **METR time horizons** (NeurIPS 2025, M; paper v4 2026-07-10). Time Horizon 1.1 data, last updated 2026-05-08:

  | Model | 50% horizon | 95% interval | 80% horizon |
  |---|---|---|---|
  | Claude Opus 4.6 | about 12.0 h | 5.3–60.6 h | about 1.2 h |
  | Claude Mythos Preview (early) | about 17.4 h | — | about 3.1 h |

  - The horizon has doubled about every 129 days since 2023.
  - METR says measurements above 16 hours are unreliable with its current task suite.
  - The 80% horizon is 5–10× shorter than the 50% horizon, which is the reliability tax in practice.
  - https://metr.org/time-horizons/
- **METR randomised trial** (2025-07, M; Cursor with Claude 3.5/3.7 Sonnet): AI made experienced developers 19% slower, while they believed it made them 20% faster. https://arxiv.org/abs/2507.09089
  - Update of 2026-02-24: returning developers now show an estimated 18% speed-up (interval −38% to +9%). Selection effects make this "only very weak evidence". https://metr.org/blog/2026-02-24-uplift-update/
- **METR, algorithmic against holistic scoring** (2025-08-12, M): a Claude 3.7 Sonnet agent passed maintainer tests 38% of the time, yet "none of them are mergeable as-is". https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/

### Vendor measurements of their own products (V)

- **Think tool** (2025-03-20): on τ-bench airline, pass^1 rose from 0.370 to 0.570, a 54% relative gain. The post's own table shows 0.584; the discrepancy is noted. It gives no gain for simple instruction following. The page now recommends extended thinking in most cases.
- **Advanced tool use** (2025-11-24):
  - Tool search cut tokens by 85% and lifted accuracy from 49% to 74% (Opus 4) and from 79.5% to 88.1% (Opus 4.5).
  - Letting Claude call tools from code cut tokens by 37%.
  - Examples in tool definitions lifted accuracy from 72% to 90%.
- **Harnessing Claude's intelligence** (2026-04-02): letting Opus 4.6 filter its own tool output raised BrowseComp from 45.3% to 61.6%.
- **April 23 postmortem** (2026-04-23): one system-prompt line limiting response length caused a "3% drop for both Opus 4.6 and 4.7". https://www.anthropic.com/engineering/april-23-postmortem
- **Opus 5.5 post** (2026-09-24), Claude Code usage March–September 2026: "Context per request has grown 2.6x. The input to output token ratio moved from 189:1 to 324:1." https://claude.com/blog/claude-opus-5-5-built-for-coding-sessions-that-use-more-context

## 4. The named patterns and where they fit

| Pattern | Definition | Source (mark) | Measured evidence | Carshenas fit |
|---|---|---|---|---|
| Augmented LLM | One call with retrieval, tools or memory | Building effective agents (O) | See R1 and Agentless | **Adopt** as the default for every step |
| Prompt chaining with gates | Fixed sequence of calls, with checks in code between them | Building effective agents (O) | Agentless (M) | **Adopt**: CS-65 (fetch → parse → extract → match → value → explain); CS-52 (extract → validate) |
| Routing / escalation | Classify the input and send it to a specialised prompt or a cheaper or stronger model | Building effective agents; OpenAI guide (O) | RouteLLM, FrugalGPT, escalation baseline (M). Caution (P): a weak model deciding for itself when to escalate did not work (Cognition 2026) | **Adopt for CS-52 and CS-50**: escalate on deterministic triggers (schema failure, contradictory fields, low confidence), not on the cheap model's own judgement. Keep it only if the labelled set (CS-48) shows it beats a single model on cost for the same accuracy |
| Parallelisation: sectioning | Independent sub-tasks run at the same time | Building effective agents (O); SDK guardrails in parallel mode (O) | — | **Adopt where latency matters**: CS-65 runs extraction and name matching together; CS-62 runs an out-of-scope guardrail alongside the filter call |
| Parallelisation: voting | Same task sampled N times, answers aggregated | Building effective agents (O) | Self-consistency; More Agents (M) | **Candidate for CS-55's borderline band only**: e.g. 3 samples, disagreement goes to review. It triples the cost, so measure it first |
| Orchestrator–workers | A central model splits the task and hands pieces to workers | Building effective agents; Anthropic research system | +90.2% at about 15× tokens (V); −70% on sequential tasks (M) | **Nothing at runtime.** Used in the development workflow (research subagents) |
| Evaluator–optimizer | One step generates, another critiques, repeat | Building effective agents; harness design (V) | Checks with outside feedback help (CRITIC); intrinsic self-critique does not on reasoning (Huang); self-graders are lenient (harness design) | **Adopt for CS-64 with a code-side evaluator**: code checks every number and fact in the Farsi text against stored facts; one retry with the error message; otherwise a template. An LLM judge only offline, calibrated against people |
| Autonomous agent (ReAct loop) | A model using tools in a loop until done | Building effective agents; Effective context engineering; ReAct (M) | τ-bench pass^k; METR 50% vs 80% gap | **None now** (section 7) |
| Reflexion | Written self-reflection kept as memory across attempts | Shinn et al. (M) | 91% on HumanEval | Runtime: no. Workflow: `docs/learnings.md` is a hand-curated version of this |
| CodeAct / programmatic tool calling | The model writes code to call tools and filter results | Wang et al. (M); Anthropic (V) | +20% (M); −37% tokens (V) | Development workflow only |
| Agent–computer interface / poka-yoke | Design the tool (or schema) so misuse is hard | SWE-agent (M); tools post (O) | 12.5% SOTA at the time (M) | **Adopt**: treat each JSON schema as a tool. Enums, units in field names (`_toman`), an explicit "unknown" value, unambiguous names |
| Think step / reasoning first | Room to reason before acting, or a reason field before the verdict | Think tool (V) | +54% relative on policy-heavy tasks; no gain on simple instruction following | **CS-55**: put the reason before the decision in the schema (the reason is stored anyway). **CS-52**: only if the evals show a gain |
| Guardrails and tripwires | Input, output and tool checks that stop the run | OpenAI SDK; OpenAI guide (O) | — | **Adopt**: CS-62 input guardrail (run in parallel for latency); output guardrail is the schema plus a catalogue check |
| Feed the error back and retry | Put the validation error in the next call, cap retries | 12-Factor factor 9 (O) | — | **Adopt**: one retry for CS-52 and CS-62, then the review queue |
| Pre-fetch context | Code gathers what the model will surely need | 12-Factor factor 13 (O) | — | **Adopt**: facts for CS-64, catalogue candidates for CS-62 and CS-50 |
| Stateless reducer; one store for execution and business state | Each call is a pure function of its inputs; state lives in the database | 12-Factor factors 12 and 5; Managed Agents; Google ADK (O) | — | **Adopt**: prompt version, model and input hash → output, stored in PostgreSQL (already in AGENTS.md) |
| Human contact as a step | Escalate to a person on a failure threshold or a risky action | 12-Factor factor 7; OpenAI guide (O) | — | **Already designed**: review queue; superadmin approval of crawl requests (CS-71) |
| Clean-context reviewer | Generator and verifier don't share context | Cognition 2026 (P/V) | About 2 bugs per pull request | Development workflow: the task-reviewer subagent (already in place) |
| Planner–generator–evaluator with "sprint contracts" | Agree what "done" means before building | Harness design (V) | 20× cost, better quality (one comparison) | Development workflow: `/plan` acceptance criteria are the contract |

## 5. Context-engineering principles, applied to Carshenas's prompts

1. **Smallest set of high-signal tokens.**
   - Anthropic (O): "the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."
   - Backed by Chroma (M), IFScale (M) and Vasileva 2026 (M).
   - Karpathy (post of 2025-06-25, O): "Too much or too irrelevant and the LLM costs might go up and performance might come down."
   - Apply: keep each prompt to a few rules. Move every rule code can check (ranges, units, enums, cross-field consistency) into validators. HumanLayer (2025-11-25, O): "Never send an LLM to do a linter's job."
2. **Examples: a few diverse, canonical ones, not a list of edge cases.**
   - Anthropic (O): "curate a set of diverse, canonical examples".
   - Claude's prompting docs (O): 3–5 examples.
   - Manus (Yichao Ji, 2025-07-18, P): "don't few-shot yourself into a rut".
   - Apply: never extract a batch of listings in one conversation. Each listing gets its own stateless call.
3. **Static first, dynamic last.**
   - Anthropic's harness post (2026-04-02, O): "Static first, dynamic last."
   - Codex agent-loop post (Michael Bolin, OpenAI, 2026-01-23, O): "Cache hits are only possible for exact prefix matches within a prompt." Fetched through the Wayback Machine because openai.com returns 403 from here.
   - Manus (P): "KV-cache hit rate is the single most important metric for a production-stage AI agent". It warns against timestamps at the start of the prompt and against unstable JSON key order.
   - Claude's docs (V): long inputs go above the instructions; "Queries at the end can improve response quality by up to 30 percent".
   - Apply this layout to every step:
     - cached prefix: role, glossary, a few rules, schema, 3–5 examples;
     - then the variable input: listing text, facts or candidates, with keys serialised in a stable order;
     - then a short closing instruction.
   - Also: no dates or IDs in the prefix; one model per step. The OpenAI docs set a 1,024-token minimum cacheable prompt for GPT-5.6 and later. Metis supports caching, per the CS-42 note.
4. **Scope by default; context is compiled from durable state.**
   - Google ADK (Hangfei Lin, 2025-12-04, O): "Context is a compiled view over a richer stateful system." And: "Every model call and sub-agent sees the minimum context required." https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/
   - Anthropic Managed Agents (2026-04-08, O): the durable session log is separate from the context window.
   - Apply: build each prompt with named, tested functions over PostgreSQL facts. For CS-55, send only the two listings' normalised facts, the differing fields and short text snippets. Store the prompt version with each result so it can be replayed.
5. **Few tools, clearly distinct, retrieved rather than dumped.**
   - Anthropic (O): "If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better."
   - BFCL and RAG-MCP (M).
   - Apply: CS-62 and CS-50 need no tools. Code retrieves the top catalogue candidates (for example by trigram match) and passes them in with a "none of these" option.
6. **Combine the turns, don't pile up history** (Laban, M).
   - Apply to CS-62 refinements: send the current filter object plus the new utterance, never the chat so far.
7. **Show what the model understood and let the user correct it.**
   - Karpathy talk (O): partial-autonomy products with an "autonomy slider" and a fast check-and-correct loop for the user.
   - Apply: CS-62 shows the parsed filters as editable chips.
8. **Prompts are code with evals.**
   - Anthropic postmortem (V): one line caused a 3% drop; Anthropic now runs "a broad suite of per-model evals for every system prompt change".
   - Breunig, "The Problem is Prompt Debt" (2026-06-22, O): "specify your system's behavior with measurements, not prose". Hand-tuned prompts tie you to one model, which matters with four providers behind Metis.
9. **Working definitions of context engineering** (O):
   - Karpathy: "the delicate art and science of filling the context window with just the right information for the next step" (post 1937902205765607626, 2025-06-25).
   - Tobi Lütke: "the art of providing all the context for the task to be plausibly solvable by the LLM" (2025-06-19).
   - Philipp Schmid (2025-06-30): "A System, Not a String".
   - LangChain team (2025-07-02): four families of technique — write, select, compress, isolate. https://blog.langchain.com/context-engineering-for-agents/
   - Breunig (2025-06-22 and 06-26) names the four failure modes: context poisoning, distraction, confusion and clash.
   - Google's "Context Engineering: Sessions & Memory" (Milam and Gulli, November 2025, O): "no more and no less than the most relevant information". Fetched from a mirror because Kaggle's page needs JavaScript.

## 6. What this means for the AI-first workflow (input for CS-47)

Much of this is already in the repository: an AGENTS.md map under 150 lines, skills, reviewer subagents, `init.sh`, and Backlog tasks with acceptance criteria.

- **A map, not a manual.**
  - OpenAI "Harness engineering" (Ryan Lopopolo, 2026-02-11, P/V; via the Wayback Machine): "give Codex a map, not a 1,000-page instruction manual". Their AGENTS.md is about 100 lines, and `docs/` is the system of record. "anything it can't access in-context while running effectively doesn't exist."
  - Custom linters there inject fix-it messages into the agent's context; a recurring "doc-gardening" agent opens pull requests against stale docs.
  - Their numbers (V): about 1M lines of code and about 1,500 pull requests, 3.5 per engineer per day.
- **The skill itself (skill-authoring docs, O):**
  - "The context window is a public good."
  - Body under 500 lines; references one level deep.
  - "Create evaluations BEFORE writing extensive documentation"; three test scenarios; test with every model you plan to use.
- **Verification loops.**
  - Claude Code docs (O): "Give Claude a check it can run: tests, a build, a screenshot to compare." Ask for evidence rather than a claim of success.
  - Anthropic C compiler project (Nicholas Carlini, 2026-02-05, V/P): the verifier must be "nearly perfect, otherwise Claude will solve the wrong problem". Keep output to a few lines, put ERROR on the same line as the reason so grep finds it, and give a `--fast` mode. That run: 16 agents, about 2,000 sessions, $20,000.
  - For AI features, the check is the eval run on the labelled set (CS-48), printed briefly.
- **Tests are not enough.**
  - METR (M): 38% of runs passed the tests, yet none were mergeable.
  - Dex Horthy (Pragmatic Engineer, 2026-07-15, P): an experiment shipping unreviewed code was shut down after four months.
  - Keep human review and the task-reviewer pass.
- **Research → plan → implement, compacting on purpose.**
  - HumanLayer (August 2025, P): keep context use "in the 40%-60% range". "a bad line of a plan could lead to hundreds of bad lines of code."
  - Anthropic's long-running harness (Justin Young, 2025-11-26, P/V): a JSON feature list, a progress file, one feature at a time, git commits, and an end-to-end test at the start of each session.
  - Claude Code docs: after two failed corrections, `/clear` and start again.
  - Anthropic (2026-09-24): choose the model at the start of a session and compact before stepping away, to protect the cache.
- **Subagents are for keeping context apart, not for role-play** (HumanLayer; Cognition 2025 and 2026; Claude Code docs).
  - Use read-only researchers and a clean-context reviewer.
  - Anthropic (2026-09-24) says forked subagents now start from the parent's cache.
- **Evals for agents** (Anthropic, 2026-01-09, O/V):
  - "20-50 simple tasks drawn from real failures is a great start".
  - Use pass^k for anything that must be consistent.
  - Grade the outcome rather than the path, and read the transcripts.
- **Productivity: measure, don't assume** (METR 2025/2026, M): self-reported speed-ups are unreliable.

## 7. Does any step need an agent, and what would change that?

**Today, no.**
- CS-52, CS-55, CS-62, CS-64 and CS-50 are each one call, or a chain with validation, one retry, escalation, optional voting, and the review queue.
- CS-65 is a fixed chain with two parallel branches that fits in 5 s. If it doesn't, stream the rating first and use a template explanation.
- CS-70/72 is SQL matching over the shared search definitions (CS-58). If buyers later add soft preferences ("one owner, never a taxi"), add a single classification call over the CS-52 facts as a filter step. That is still a workflow.

**An agent becomes worth building when all of these are true:**
1. The task's steps can't be listed in advance, and a fixed workflow fails the eval on real requests. Example: a buyer's research assistant that compares models, searches listings, computes differences and iterates.
2. There is an end-state check, and pass^k meets the product bar.
3. It runs where latency doesn't matter, or the user expects to wait.
4. Its tools are read-only, and writes pass a human gate.
5. It is capped (12-Factor suggests "3-10, maybe 20 steps max"), traced and resumable.
6. It sits on the cost–accuracy Pareto frontier against the workflow (AI Agents That Matter).

The first likely candidates are offline and reviewable:
- a catalogue "gardener" that proposes aliases and trims for unmatched names (CS-50), for approval;
- a helper that proposes a parser fix plus test fixtures when a source's saved pages change shape, within ADR-0008 (never working around blocks).

## 8. Caveats

- **Venues that could not be confirmed:** Agentless and τ-bench (arXiv preprints only); RAG-MCP and the scaling-agents paper are preprints.
- **Mirrors and third-party copies:**
  - OpenAI's two 2026 posts came through the Wayback Machine.
  - The Google whitepapers came from mirrors (archive.org, jsdelivr, smallake.kr).
  - Karpathy's talk quotes come from a third-party transcript; the video wording is unchecked.
- **Numbers that differ between versions of the same source:**
  - Think-tool text says 0.570; its table shows 0.584.
  - Laban's HTML version shows −35%; the abstract says 39%.
  - The scaling-agents paper went from 180 to 260 configurations between v1 and v3.
- **Not checked:** the Databricks long-context study and the o3 "98.1 → 64.1" figure that Breunig cites. They were left out.
