# Pass 1: what the model makers say about prompting their current models (CS-43)

Researched on 2026-09-29. Each page was fetched with curl (Anthropic's and OpenAI's documentation also as the `.md` versions they publish) and saved. About 220 quotations were checked by a script as verbatim text in the saved copies; only whitespace, Markdown emphasis and the style of quote marks were normalised. The saved copies and the checking script were in the research session's scratchpad (not kept). The main note re-fetched the claims it leans on and found them on the live pages (A1, A2, A3, A17, O9, G2).

Marks: M = measured with a published method or peer-reviewed; V = measured by the vendor about its own product; P = practitioner report; O = guidance without data. IDs in this file are its own. The main note's source list maps them to its keys.

## 1. Sources and the model generations they target

Launch dates come from each vendor's changelog.

**Anthropic** (base URL `platform.claude.com/docs/en/…`). The old stand-alone pages ("be clear and direct", multishot, XML tags, long-context tips, extended-thinking tips, prompt generator, prompt improver) now redirect into A1.

| ID | Source | Targets / date | Mark |
|---|---|---|---|
| A1 | `…/build-with-claude/prompt-engineering/claude-prompting-best-practices` | Fable 5.1, Mythos 5.1, Fable 5, Opus 5.5, Opus 5, Opus 4.8–4.6, Sonnet 5.5, Sonnet 5, Sonnet 4.6, Haiku 4.5 | O, one V note |
| A2 | `…/prompting-claude-sonnet-5-5` | Sonnet 5.5, launched 2026-09-28 | V/O |
| A3 | `…/prompting-claude-sonnet-5` | Sonnet 5, 2026-06-30 | O |
| A4 | `…/prompting-claude-opus-5-5` | Opus 5.5, 2026-09-22 | V/O |
| A5 | `…/prompting-claude-opus-5` | Opus 5, 2026-07-24 | O/V |
| A6 | `…/prompting-claude-opus-4-8` | Opus 4.8, 2026-05-28 | O |
| A7 / A8 | `…/prompting-claude-fable-5`, `…/prompting-claude-fable-5-1` | Fable 5 (2026-06-09), Fable 5.1 (2026-09-01) | O/V |
| A9 | `…/build-with-claude/effort` | | O |
| A10 | `…/thinking-steering-and-cost` | | O |
| A11 | `…/build-with-claude/thinking` | API facts on sampling | fact |
| A12 | `…/test-and-evaluate/strengthen-guardrails/reduce-hallucinations` | | O |
| A13 | `…/increase-consistency` | still shows prefill, which Claude 4.6 and later reject | O |
| A14 | `…/mitigate-jailbreaks` | | O |
| A15 | `…/test-and-evaluate/develop-tests` | | O |
| A16 | `…/prompt-engineering/overview` | | O |
| A17 | `…/build-with-claude/refusals-and-fallback` | | fact |
| A18 | `…/multilingual-support` | | V, method stated |
| A19 | https://claude.com/blog/best-practices-for-prompt-engineering | dated 2025-11-10, but the text mentions the "Claude 5 generation", so it was edited later | O |
| A20 | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | 2025-09-29 | O |
| A21 | https://www.anthropic.com/news/prompting-long-context | 2023-09-23; Claude Instant 1.2, Claude 2 | V, reproducible notebook |
| A22 | https://claude.com/blog/claude-2-1-prompting | 2023-12-06 | V |
| A23 | https://claude.com/blog/prompt-improver | 2024-10-14; tested on Claude 3 Haiku | V |
| A24 | https://github.com/anthropics/claude-cookbooks/blob/main/misc/metaprompt.ipynb | the "prompt generator"; now uses claude-sonnet-4-6 and no prefill | O |
| A25 | https://github.com/anthropics/prompt-eng-interactive-tutorial | "uses … Claude 3 Haiku", so dated | O |

**OpenAI** (base URL `developers.openai.com/api/docs/guides/…`; dates from https://developers.openai.com/api/docs/changelog). The API's default example model is now `gpt-6-astra`.

| ID | Source | Targets / date | Mark |
|---|---|---|---|
| O1 | `…/prompt-engineering` | | O |
| O2 | `…/prompting` | | O |
| O3 | `…/latest-model/gpt-4.1` | GPT-4.1, 2025-04-14 | V/O |
| O4 | `…/gpt-5` | GPT-5, 2025-08-07 | V/O, P (Cursor) |
| O5 | `…/gpt-5.1` | 2025-11-13 | O |
| O6 | `…/gpt-5.2` | 2025-12-11 | O |
| O7 | `…/gpt-5.4` | GPT-5.4 including mini and nano, 2026-03-05 | O |
| O8 | `…/gpt-5.5` | 2026-04-24 | O |
| O9 | `…/prompt-guidance-gpt-5p6` | GPT-5.6 family, 2026-07-09 | V/O |
| O10 | `…/latest-model/gpt-6-astra` | GPT-6 Astra 2026-09-03; Sol and Luna 2026-09-22 | O |
| O11 | https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra | 2026-09-11 | O |
| O12 | `…/reasoning-best-practices` | written for o1, o3, o4-mini; still live | O |
| O13 | `…/reasoning` | | O |
| O14 | https://model-spec.openai.com/2026-08-18.html | Model Spec | normative |
| O15 | `…/prompt-optimizer` | | O |
| O16 | https://developers.openai.com/cookbook/examples/gpt-5/prompt-optimization-cookbook | 2025-08-07 | V, demo scale |
| O17 | `…/optimizing-llm-accuracy` | GPT-4 era | V |
| O18 | `…/prompt-generation` | Playground meta-prompts | O |

**Google** (base URL `ai.google.dev/gemini-api/docs/…`; dates from its changelog)

| ID | Source | Targets / date | Mark |
|---|---|---|---|
| G1 | `…/prompting-strategies` | examples labelled gemini-2.5-flash, plus a Gemini 3 section | O |
| G2 | `…/gemini-3` | 3 Pro preview 2025-11-18, 3 Flash 2025-12-17, 3.1 Pro 2026-02-19 | O |
| G3 | `…/whats-new-gemini-3.5` | 3.5 Flash GA 2026-05-19 | O |
| G4 | `…/latest-model` | 3.8 Flash GA 2026-09-02 | O |
| G5 | `…/long-context` | | O, one V figure |
| G6 | `…/thinking` | | O |
| G7 | `…/models/gemini-3.1-flash-lite` | GA 2026-05-07 | O |
| G8 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/prompts/few-shot-examples | gemini-pro examples | O |
| G9 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking/prompting-guide | Gemini 2.5 examples | O |
| G10 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/prompts/prompt-optimizer | | O |
| G11 | Lee Boonstra, "Prompt Engineering" whitepaper v7, https://www.kaggle.com/whitepaper-prompt-engineering | February 2025; gemini-pro examples | O |

For G11, Kaggle returned a reCAPTCHA page. The quotes come from two byte-identical mirrors (https://archive.org/details/22365-3-prompt-engineering-v-7 and a Google Drive copy). They could not be confirmed against the original host.

**DeepSeek**

| ID | Source | Targets / date | Mark |
|---|---|---|---|
| D1 | https://arxiv.org/abs/2501.12948 (v1 2025-01-22, v2 2026-01-04); peer-reviewed in Nature 645, 633–638, published 2025-09-17 (https://www.nature.com/articles/s41586-025-09422-z) | DeepSeek-R1 | the prompting note has no numbers, so O in an M venue |
| D2 | https://github.com/deepseek-ai/DeepSeek-R1, "Usage Recommendations" | R1 | O |
| D3 | https://api-docs.deepseek.com/quick_start/parameter_settings | temperature table | O |
| D4 | https://api-docs.deepseek.com/guides/thinking_mode | | fact |
| D5 | https://api-docs.deepseek.com/guides/json_mode | | O |

Current DeepSeek API models are DeepSeek-V4.1-Flash and V4-Pro-0813 (its pricing page). No official V4 prompting guide was found; search returned only third-party SEO pages, which were skipped.

## 2. Measured findings, kept apart from opinion

**Anthropic**
- **A1, no model, date or method given:** "Queries at the end can improve response quality by up to 30 percent in tests, especially with complex, multidocument inputs." It applies to inputs of 20k tokens or more. [V]
- **A21, 2023, Claude Instant 1.2 and Claude 2, stitched documents of 70K–95K tokens:**
  - "Pulling relevant quotes into the scratchpad is helpful in all head-to-head comparisons."
  - "Generic examples on general/external knowledge do not seem to help performance."
  - Claude 2 went "from 0.939 to 0.961 … a 36% reduction in errors".
  - It stresses "putting the instructions at the end of the prompt". [V, dated]
- **A22, Claude 2.1:** "a simple prompt adjustment improving accuracy from 27% to 98%". The adjustment was a prefilled answer start, which Claude 4.6 and later reject. [V, dated]
- **A23, Claude 3 Haiku:** the prompt improver "increased accuracy by 30% for a multilabel classification test" (500 Wikipedia articles). The improver worked by adding chain-of-thought sections and prefill, which newer guidance advises against or the API rejects. [V, dated]
- **A2, Sonnet 5.5, JSON answers that need working out:**
  - Adding "Think the problem through before you answer." at high effort brings accuracy "close to what the model reaches at xhigh".
  - Parsing the last JSON value "made nearly every response usable without changing its accuracy".
  - Splitting into two requests gave high accuracy "but at very high cost and latency". [V, no numbers]
- **A4, Opus 5.5:** removing "think carefully" lines in a chat product "made replies start sooner, with no clear decline in the quality of the reply". Also "Claude Opus 5.5 at medium matches or exceeds Claude Opus 5 at high". [V, no numbers]
- **A5, Opus 5:** "for most tasks, thinking enabled at low effort performs better than thinking disabled at similar cost." [V, no numbers]
- **A18:** MMLU professionally translated into 14 languages, zero-shot chain of thought, relative to English. Arabic scored 97.2% on Sonnet 4.5 and 92.5% on Haiku 4.5. Persian is not tested. [V, method stated]

**OpenAI**
- **O3, GPT-4.1:**
  - Three agent reminders "increased our internal SWE-bench Verified score by close to 20%".
  - "inducing explicit planning increased the pass rate by 4%".
  - Passing tools through the API instead of pasting schemas into the prompt gave +2%. [V]
- **O3, GPT-4.1, no numbers:** instructions at both ends of long context work best; if only once, above beats below; "XML performed well in our long context testing"; "JSON performed particularly poorly". [V]
- **O9, GPT-5.6, "a sample of internal coding-agent eval runs":** leaner system prompts "improved evaluation scores by roughly 10–15% while reducing total tokens by 41–66% and cost by 33–67%". [V]
- **O16, GPT-5 and GPT-5-mini:** an optimizer-rewritten prompt raised FailSafeQA robustness 0.320→0.540 and grounding 0.800→0.950. This was a single comparison shown as a demo. [V]
- **O4, GPT-5:** passing back earlier reasoning raised Tau-Bench Retail "from 73.9% to 78.2%". This is about API usage, not wording. [V]
- **O17, GPT-4, Icelandic error correction:** few-shot examples raised BLEU from 62 to 70. Sample size not stated. [V]

**Google**
- **G5:** "You can get ~99% on a single query". With several needles, "the model does not perform with the same accuracy". No method shown. [V]

**DeepSeek**
- **D1:** "Few-shot prompting consistently degrades its performance." Stated as an evaluation observation, with no numbers. [O]

No maker publishes a peer-reviewed, quantified study of prompt wording itself. Almost everything below is O.

## 3. Topic by topic

### (a) "Don't" versus saying what to do

- **Anthropic**
  - "Tell Claude what to do instead of what not to do" (A1). On the page this is the first of the ways "to steer output formatting", with the example "Do not use markdown in your response". [O]
  - Positive examples "tend to be more effective than negative examples or instructions that tell the model what not to do" (A3, A5, A6). [O]
  - Telling the model not to think backfires: "that kind of instruction increases tag leakage"; instructions naming the thinking tags "are less effective than the general form" (A5). [O]
  - Generic don'ts "tend to shift the model to a different fixed palette rather than producing variety" (A6). [O]
  - The nuance on the newest model: Opus 5.5 "responds well to instructions that name specific patterns to avoid" (A4). [O]
- **OpenAI**
  - Literal models may need "explicit specification around what to do or not to do" (O3). [O]
  - "Instructing a model to always follow a specific behavior can occasionally induce adverse effects" (O3). [O]
  - For small models, "Be careful with output nothing else"; scope it, e.g. "after the final JSON, output nothing further" (O7). [O]
  - GPT-6 guidance itself uses explicit "Avoid …" lists (O10).
- **Google**
  - The whitepaper says "Growing research suggests that focusing on positive instructions … can be more effective than relying heavily on constraints". No citation is attached. [O]
  - "Also a list of constraints can clash with each other." (G11) [O]
  - G1 is neutral: "You can tell the model what to do and not to do." [O]
- **DeepSeek:** nothing published.

### (b) Examples and few-shot

- **Anthropic**
  - "Include 3–5 examples for best results", diverse enough that Claude "doesn't pick up unintended patterns", wrapped in `<example>` tags; "Multishot examples work with thinking." (A1) [O]
  - The blog says "Claude 4.x and similar advanced models pay very close attention to details in examples", and to start with one example (A19). [O]
  - A20 advises against a laziness-list of edge cases: "curate a set of diverse, canonical examples". [O]
  - A21's measured result (2023): examples from the same context help, generic ones don't. [V]
- **OpenAI**
  - For reasoning models: "Try zero shot first, then few shot if needed"; mismatches between examples and instructions "may produce poor results" (O12). [O]
  - Behaviour shown in examples must also be "cited in your rules"; models reuse sample phrases verbatim (O3). [O]
  - GPT-5.6 says to trim "examples that do not change behavior" (O9). [O, inside the V lean-prompt result]
  - Placement is inconsistent: O1 puts examples in the developer message, O2 in user messages.
- **Google**
  - "We recommend to always include few-shot examples"; you can even "remove instructions" if the examples are clear; too many examples cause over-fitting; keep formatting consistent (G1). [O]
  - G8 contradicts G1: "always accompany few-shot examples with clear instructions". [O]
  - The whitepaper says "at least three to five", later "start with 6", and to mix up the classes (G11). [O]
- **DeepSeek:** for R1, few-shot "consistently degrades" performance; describe the problem zero-shot and specify the output format (D1). The JSON-mode docs still ask for one example of the output format (D5). [O]

### (c) Structure: XML, Markdown, JSON

- **Anthropic:** XML tags "help Claude parse complex prompts unambiguously" (A1). Its own blog says "XML tags and heavy role prompting are less necessary with modern models" (A19), and A20 says formatting "is likely becoming less important". For security, A14 says "JSON-encode untrusted content". [O]
- **OpenAI:** Markdown plus XML, ordered identity, instructions, examples, context (O1). O3's long-context tests favour XML and found JSON poor. Cursor reported that XML "spec" blocks improved adherence (O4). [P]
- **Google:** XML-style tags or Markdown; "Choose one format and use it consistently within a single prompt" (G1). The whitepaper claims asking for JSON output reduces hallucinations and recommends a JSON-repair library for truncated output (G11). [O]
- **DeepSeek:** JSON mode needs the word "json" and an example in the prompt, and "the API may occasionally return empty content" (D5).

### (d) Where instructions go relative to long input

- **Anthropic:** long data at the top, the query at the end (A1 [V], A21 [V]). This applies to 20k+ tokens. For long system prompts, add a short reminder near the end (A5). [O]
- **OpenAI:** GPT-4.1 found instructions at both ends best; "If you'd prefer to only have your instructions once, then above the provided context works better than below." (O3) [V]
- **Google:** put all context first and "Place your specific instructions or questions at the very end of the prompt." (G1, G2), with a bridge phrase such as "Based on the information above…". G5 says the same. [O]
- **Caching** pushes all makers to put static content first. Anthropic's caching page: "Place static content (tool definitions, system instructions, context, examples) at the beginning". OpenAI GPT-5.5: static parts first, dynamic last (O8).

### (e) Reasoning, thinking budgets and effort; when chain of thought is unnecessary

- **Anthropic**
  - "Prefer general instructions over prescriptive steps"; manual chain of thought only as a fallback when thinking is off (A1). [O]
  - Use effort before prompt steering, because prompts are "wording-sensitive" (A10). [O]
  - Maximum effort "on some structured-output … tasks … can lead to overthinking" (A9, Opus 4.7). [O]
  - On Fable 5, Opus 5.5 and Sonnet 5.5, asking for reasoning in the response text triggers `reasoning_extraction` refusals (A2, A4, A7), and those refusals are billed (A17). [fact]
- **OpenAI**
  - For reasoning models, "think step by step" "may not enhance performance (and can sometimes hinder it)" (O12). [O]
  - At GPT-5's minimal effort, a brief explanation at the start of the answer "improves performance on tasks requiring higher intelligence" (O4). [O]
  - At GPT-5.2's "none", encourage it to think or outline steps (O6). [O]
  - GPT-5.4: "Start with none for execution-heavy workloads such as … field extraction"; effort is "a last-mile tuning knob" (O7). [O]
  - "Higher reasoning effort isn't automatically better." (O8) [O]
- **Google:** "generally not necessary to have the model outline, plan, or detail reasoning steps in the returned response itself" (G1). Replace Gemini 2.5-era chain-of-thought prompts with `thinking_level` (G2, G3). Use minimal or low thinking for classification (G6). [O]
- **DeepSeek:** R1 recommends a "reason step by step" directive for maths and forcing the answer to start with a think tag (D2). The V4 API has thinking on by default with effort levels (D4).

### (f) Temperature and sampling

- **Anthropic:** on Opus 4.7 and later, Sonnet 5 and later, and Fable/Mythos, "non-default temperature, top_p, or top_k values return a 400 error on every request". Sonnet 5 says to "use system-prompt instructions to guide tone and variety instead" (A11, A3). [fact]
- **OpenAI:** GPT-5.1 and 5.2 accept temperature only at effort "none" (O6). For GPT-6, "remove temperature, top_p, and top_logprobs" when effort is not "none"; the changelog says GPT-6 Astra accepts no custom temperature at all (O10). [fact]
- **Google:** Gemini 3: keep the default 1.0; setting it lower "may lead to unexpected behavior, such as looping" (G2). Gemini 3.5 and 3.8: "Remove these parameters from all requests." For determinism, use "a system instruction with explicit rules" (G3, G4). The older whitepaper says the opposite: "For CoT prompting, set the temperature to 0." (G11). G1 still says to raise temperature after a safety fallback. [O]
- **DeepSeek:** R1 recommends 0.5–0.7, with 0.6 preferred (D2). The API table suggests 0.0 for coding and maths (D3), but thinking mode, which is the default, ignores temperature silently (D4).

### (g) Roles and system prompts

- **Anthropic:** put the role in the system prompt; "Even a single sentence makes a difference" (A1). The blog cautions against overdoing it: "Don't over-constrain the role." (A19) [O]
- **OpenAI:** developer instructions outrank user messages. The Model Spec's authority order is Root, System, Developer, User, Guideline, then No Authority (tool output and quoted text) (O1, O14). "Put overall tone or role guidance in the system message" (O2). [O]
- **Google:** role, constraints and output format go in the System Instruction or at the very beginning of the prompt (G1). [O]
- **DeepSeek:** R1: "Avoid adding a system prompt; all instructions should be contained within the user prompt." (D2). The current API JSON example uses a system prompt (D5). [O]

### (h) Emphasis such as ALL CAPS or "CRITICAL"

The makers agree that 2025–2026 models over-react to it.
- **Anthropic:** Opus 4.5/4.6 over-trigger; "The fix is to dial back any aggressive language", e.g. replace "CRITICAL: You MUST use this tool when…" with "Use this tool when…" (A1). [O]
- **OpenAI**
  - GPT-4.1: all caps is "generally not necessary" and "could cause GPT-4.1 to pay attention to it too strictly" (O3). [O]
  - Cursor found a "Be THOROUGH" block "counterproductive with GPT-5" (O4). [P]
  - "Avoid unnecessary absolute rules"; use ALWAYS/NEVER/must "for true invariants" (O8, O9). [O]
  - For small models, "Do not rely on "you MUST" alone" (O7). [O]
  - OpenAI's own Playground meta-prompt still contains "NEVER START EXAMPLES WITH CONCLUSIONS!" (O18).
- **Google:** "Avoid unnecessary or overly persuasive language" (G1), though its own grounding clause uses bold **only** and **not**. [O]
- **DeepSeek:** nothing published.

### (i) Explaining the reason behind an instruction

- **Anthropic:** explicit principle. Explain why, e.g. the text-to-speech engine can't pronounce ellipses; "Claude is smart enough to generalize from the explanation" (A1). Fable 5: "Give the reason, not only the request" (A7). [O]
- **OpenAI:** no explicit principle in the guides fetched. The closest is Cursor's product-context example (O4, P) and "decision rules" for judgment calls (O8). [O]
- **Google:** only "Explicitly explain any ambiguous terms or parameters" (G1). [O]
- **DeepSeek:** nothing published.

### (j) Contradictory instructions

- **OpenAI** (the most detailed)
  - GPT-4.1 tends to follow the instruction "closer to the end of the prompt" (O3). [O]
  - Contradictions are "more damaging to GPT-5", which "expends reasoning tokens" reconciling them (O4). [O]
  - "conflicting rules can create more instability than missing detail" (O9). [O]
  - GPT-6 may "pause and block work early" on conflicting guidance (O10). [O]
  - The Model Spec: a later instruction at the same authority level wins; higher authority wins over lower (O14). [O]
- **Google:** the whitepaper warns constraints "can clash" (G11). [O]
- **Anthropic:** no guidance on this in the pages fetched (they were searched). This is a gap.
- **DeepSeek:** nothing published.

### (k) Prompt length and verbosity

- **Anthropic:** aim for "the smallest possible set of high-signal tokens", though "minimal does not necessarily mean short" (A20). Older skills are "too prescriptive for Claude Fable 5 and can degrade output quality" (A7). [O]
- **OpenAI:** measured gain from leaner prompts (O9). [V] "Legacy prompts often over-specify the process" (O8). But for small models, prompts "are often a bit longer and more explicit" (O7). Guidance written for GPT-6 Sol or Luna may over-constrain Astra (O11). [O]
- **Google:** Gemini 3 "may over-analyze verbose or overly complex prompt engineering techniques used for older models" (G2). [O]
- **DeepSeek:** "directly describe the problem and specify the output format" (D1). [O]

### (l) How to iterate on prompts

- **Anthropic**
  - Define success criteria and build evals before tuning (A15, A16).
  - "More questions with slightly lower signal automated grading is better than fewer questions with high-quality human hand-graded evals."
  - LLM graders should reason first and then discard the reasoning.
  - Treat a model-specific tip "as measured on that model and re-check it against your own evals" (A1).
  - The prompt improver and prompt generator doc pages now redirect; whether the Console tools still exist is unconfirmed. [O]
- **OpenAI**
  - Pin model snapshots and keep eval suites (O1). Keep prompts as versioned code (O2).
  - Migrate by switching the model first ("don't change prompts yet"), pinning effort, getting an eval baseline, then changing one thing at a time (O6).
  - Remove "one group of instructions, examples, or tools at a time, then rerun the same evals" (O9).
  - Metaprompting: diagnose failures, then make surgical edits (O5).
  - The dataset-backed optimizer goes read-only 2026-10-31 and shuts down 2026-11-30; an optimized prompt can "perform worse than your original on specific inputs" (O15). [O]
- **Google:** rephrase, try an analogous task, reorder the prompt (G1). Document every attempt and keep prompts separate from code (G11). Read the thought summaries (G6). The Vertex prompt optimizers exist (G10). [O]
- **DeepSeek:** "conduct multiple tests and average the results" (D2).

## 4. Where the makers disagree

1. **Few-shot for reasoning models.** Google always includes examples; Anthropic says 3–5 (its blog says start with one); OpenAI says zero-shot first; DeepSeek R1 says few-shot degrades.
2. **Instruction placement in long context.** GPT-4.1 prefers both ends, or above if only once; Anthropic and Google put the query last.
3. **Temperature.** The whitepaper's temperature 0 (February 2025) against Gemini 3's 1.0-or-loops. In 2026, Claude, GPT-5/6 with reasoning, and DeepSeek in thinking mode all reject or ignore temperature.
4. **Reasoning in the output.** OpenAI's meta-prompt ("Reasoning Before Conclusions") and Google's Flash-Lite example schema put a reasoning field before the answer. Anthropic's newest models refuse requests to reproduce reasoning in text, and bill the refusal. Anthropic lists the models with these classifiers as Fable 5.1, Fable 5, Opus 5.5, Opus 5 and Sonnet 5.5 (A17); Haiku 4.5 is not among them.
5. **Your own instructions next to tool output.** Anthropic: "Don't put your own instructions in tool results." Google 3.x: "append any extra instructions to the end of the function response text".
6. **System prompt.** DeepSeek R1 says don't use one; everyone else uses it.
7. **Output schema.** GPT-5.5 says remove schema definitions from the prompt and use Structured Outputs. GPT-5.2 says "Always provide a schema or JSON shape for the output." DeepSeek's JSON mode requires an example in the prompt.
8. **Contradictions inside one maker's own documentation.** Anthropic's docs against its blog on XML and roles; Google's G1 against G8 on dropping instructions; OpenAI's O1 against O2 on where examples go.

## 5. What this means for each Carshenas step

These are maker-backed patterns; each still needs testing on the labelled sets.

- **CS-52, extraction**
  - Put the rules, glossary and examples first (cacheable), then the listing as a JSON-encoded string, plus an explicit untrusted-content policy and adversarial listings in the eval set (A14, O14).
  - Keep "not mentioned" separate from "explicitly none": "Absence of evidence shouldn't automatically become a factual "no."" (O8); set missing fields to null rather than guessing (O6).
  - Write the glossary as definitions and decision criteria, not keyword maps (O9 warns against "keyword maps"), and say why each distinction matters (A7).
  - Start effort at none or low (O7, G6). On Sonnet 5.5, add the "think" line if JSON accuracy drops (A2).
  - Treat the number of examples as an eval variable, and mix the label classes (G11).
- **CS-55, duplicates**
  - Have the model output a decision and a confidence, and apply the 95%-precision threshold in code. Anthropic: "moving confidence filtering out of the finding step often helps"; a "be conservative" instruction gets followed literally (A3).
  - For the stored reason on Claude, ask for a short justification that cites fields, not "your reasoning". Whether a JSON reason field trips `reasoning_extraction` is not documented; test it.
- **CS-62, query understanding:** use the lowest effort, because Sonnet 5.5 at medium thinks "before almost every reply, even a greeting" (A2). Keep the buyer's explicit values as given ("Preserve explicit user values", O9) and define when to ask, abstain or proceed (O7). Normalise Finglish in code, since Anthropic advises native script over transliteration (A18).
- **CS-64, explanations:** pass the database facts as structured data, with grounding rules ("Base claims only on provided context or tool outputs", O7; A12). Name Farsi as the output language explicitly (O9, A18). Keep the code test that every number comes from the database; the makers themselves say "Always validate critical information" (A12).
- **CS-50, catalogue matching:** closed outputs (enums) and one correct example for small models (O7).
- **CS-65, rating within 5 seconds:** low effort and a stable prefix. Gemini 3.8 Flash "can use more tokens … by design" (G4).
- **All steps:** don't count on temperature 0 for determinism; the input-hash cache, pinned snapshots and explicit rules do that job. DeepSeek-R1 has a Farsi-relevant risk: it "might use English for reasoning and responses" for languages other than Chinese and English (D1).

## 6. Unverified or missing

- **Boonstra whitepaper origin.** Read from mirrors only, because Kaggle showed a reCAPTCHA. Its "Growing research" claim cites nothing.
- **Anthropic's "30 percent" figure.** No model, date or method is given.
- **Current tools.** Whether Anthropic's Console prompt improver and generator still exist.
- **DeepSeek V4.** Whether R1's few-shot finding holds for it.
- **Persian performance.** No maker publishes Persian-specific prompting data.
- **Tutorial last-commit date.** GitHub's API was rate-limited, so it could not be checked.
