# Pass 3: the measured science of prompting, used to check popular claims (CS-43)

Researched on 2026-09-29. Every arXiv paper was read in full (PDF converted to text); web pages were fetched with curl or WebFetch. openai.com returned 403, so the GPT-4o page was read from the Wayback Machine. Every number and quotation was matched against the fetched text, and a venue is named only where the paper or its arXiv record states it. The fetched texts were in the research session's scratchpad (not kept). The main note checked every arXiv identifier in this file against arXiv's own records.

Marks: M = measured with a published method; V = a vendor measuring its own product; P = practitioner report; O = guidance without data. IDs in this file are its own; the main note's source list maps the ones it cites. Every recommendation names the step it applies to: CS-52 extraction, CS-55 duplicate decisions, CS-62 query understanding, CS-64 explanations.

**Summary.** Checked on 2026-09-29, most popular rules fail on 2025–2026 models. Personas, tips or threats, politeness, ALL CAPS and "think step by step" do not reliably improve accuracy. What does move results: clear task definitions, where the data sits in the prompt, the output schema, validation in code, and model choice.

## Claim by claim

### 1. "Never write negative instructions"

**Verdict: mixed.** Negation is a real weak spot, but mainly in the *data* and in how a *question* is framed, and mostly on older or smaller models. Current models follow explicit prohibitions about as well as positive rules.

**Evidence that negation is hard**
- **Jang et al. 2022 [N1]** (OPT, GPT-3 125M–175B, InstructGPT, T0): the "negated prompts" invert the task ("Generate the incorrect answer…"). All model types got worse on them as they grew, and the best method stayed about 31.3 points below 13-year-olds. This tests task inversion, not a style rule.
- **Inverse Scaling, TMLR 2023 [N2]:** NeQA inserts "not" into questions. It showed inverse or U-shaped scaling, and the largest PaLM stayed below the smallest. GPT-4 was mixed on the task where models must avoid continuing a pattern.
- **Older negation benchmarks [N3][N4]** (open models up to LLaMA-65B, GPT-3, InstructGPT): models are "proficient at classifying affirmative sentences" but "struggle with negative sentences."
- **Vrabcová et al. 2025 [N11]** (Llama 3, Qwen 2.5, Mistral up to 123B): larger models handle negation better, and robustness is worse outside English.
- **Elkins & Chun 2026 [N10]** (16 models including GPT-5.1/5.2, Claude 4.5, Gemini-3-Flash): the same proposition phrased "should X" or "should not X".
  - Small open models endorsed the action 24% of the time under the affirmative phrasing and up to 100% under the negated one.
  - Commercial models were more stable but still swung. Their Negation Sensitivity Index: GPT-5.2 0.369, Claude Sonnet 4.5 0.421, Claude Haiku 4.5 0.710.
  - Agreement between models fell from 73% to 59%.
- **"Pink elephant", Castricato et al. 2024 [N6]:** the system prompt said not to bring up X and to discuss Y instead.
  - GPT-4 still mentioned X in 13% of replies, down from 33% without the instruction. Llama-2-13B-Chat went from 33% to 25%.
  - For the weaker OpenHermes models the authors report "an equivalent or increased tendency to mention Pink Elephants following such directive prompts."

**Evidence that prohibitions work on current models**
- **Persian IFEval, MIZAN leaderboard [N9]** (data dated 2025-11-25): the purely negative "no commas" category scored 0.95 (o3), 0.95 (GPT-5-mini), 1.00 (Gemini 2.5 Pro), 0.95 (Claude 3.7 Sonnet) and 0.87 (GPT-4.1).
  - Among the top 25 models the weakest categories were length (0.61–0.90) and combined constraints (0.63–0.86). The hard part is counting and composition, not prohibition.
- **IFEval [N7]** contains "Do not include keywords…" rules; GPT-4 (Nov 2023) scored 76.9% at prompt level.
- **IFBench, NeurIPS 2025 [N8]:** new constraints, some negative ("should not contain any whitespace"). GPT-4.1, Claude 3.7 and 4 Sonnet, and Qwen3-32B all score below 50%. No breakdown by positive vs negative wording is reported.

**The rule's only "measurement" is weak.** Bsharat et al. [N5], principle 4, used 20 questions, one response each and human raters, comparing against the original prompt. Their published prompt pairs show:
- Many "without the principle" prompts are contrived double negatives, for example "Which process isn't absent in plants when they make food from sunlight?"
- The rewritten versions also add specifics ("Use 2-3 defining characteristics"), so negation and specificity are confounded.
- Reported quality improvement was 55–90% and correctness gains 0–15% across 7 models.

**Vendor guidance.**
- **Anthropic [N13]:** "Tell Claude what to do instead of what not to do", yet its own sample prompts use "Do not…".
- **OpenAI GPT-4.1 guide [N14]:** "include explicit specification around what to do or not to do."
- **OpenAI GPT-5.2 guide [N16]:** "explicitly forbid extra features."

**Gap (untested):** no 2024–26 study compares "do X" with "don't do Y" wording of the same formatting or extraction rule on current models.

**Still applies to 2025–26 models:** partly.

**What Carshenas should do**
- **CS-52 (wording):** pair every prohibition with the alternative, e.g. "If the text does not state it, return null; do not infer." Put hard limits in the schema (enums, nullable fields), not in prose.
- **CS-52 (schema):** keep "not stated" distinct from "stated: none" (accident unknown vs no accident).
- **CS-52 (labels):** oversample negated phrasing in the 200 labelled listings («بدون رنگ», «رنگ ندارد», «تصادف نداشته», «معاوضه نمی‌کنم») and report accuracy on those items separately.
- **CS-55:** ask a fixed, affirmative question ("Are A and B the same vehicle?") and never flip its polarity between prompt versions.
- **CS-62:** add test cases for negated buyer terms (بدون رنگ، غیر اسنپ).

### 2. "Few-shot examples always help"

**Verdict: contradicted.**

**Where examples help**
- **GPT-3, Brown et al. 2020 [F1]:** "few-shot performance increases more rapidly" with model size. But on one benchmark the few-shot format cut the smallest model's score by almost 20%.
- **Many-shot, NeurIPS 2024, mainly Gemini 1.5 Pro [F6]:** hundreds to thousands of examples give significant gains, can override pretraining biases and perform comparably to fine-tuning.
- **Long-context in-context learning, NAACL 2025, Llama-2-7B long variants and Mistral-7B [F7]:**
  - Gains continue to thousands of examples when there are many labels.
  - Retrieving similar examples helps most with few examples.
  - Grouping same-label examples together hurts.
- **Liu et al. 2022, GPT-3 [F5]:** retrieving semantically similar examples beats random ones.

**The conditions that matter**
- **Label balance and order:** Zhao 2021, GPT-3 [F3]: majority-label and recency bias; format, example and order choices swing accuracy from near chance to near state of the art. Lu 2022 [F4]: order alone does this, and a good order for one model does not transfer to another.
- **Label correctness:** Min 2022, 12 models [F2]: random labels cost only 0–5 points. But Wei et al. 2023 [F8]: large models do follow flipped labels, so wrong labels matter at scale.
- **Copying:** larger models use shortcuts more [F9]. In 2025, near-duplicate examples made reasoning models "copy intermediate steps verbatim" [F13].

**Reasoning models**
- **DeepSeek-R1 [F10] (V, no numbers):** "Few-shot prompting consistently degrades its performance."
- **o1-preview on MedQA [F11]:** five-shot "resulted in a significant decrease in performance."
- **Reasoning models generally [F13]:** "adding more exemplars consistently degrades accuracy, even when demonstrations are optimal."
- **Qwen2.5 [F12]:** examples mainly "align the output format."
- **Over-prompting [F14]:** too many domain examples degrade some models (GPT-4o, DeepSeek-V3, Gemma-3 and others).

**Vendor guidance.** OpenAI: "Try zero shot first, then few shot if needed" [N17]. Anthropic: 3–5 examples in `<example>` tags, including with thinking [N13] (O).

**Still applies to 2025–26 models:** yes.

**What Carshenas should do**
- **CS-52:** start zero-shot with precise field definitions and the glossary. Then A/B 3–5 short examples that are:
  - diverse, label-balanced and verified,
  - shuffled,
  - consistent with the instructions,
  - never near-duplicates of real inputs,
  - aimed at hard cases (negation, installment bait, swaps).
- **CS-55:** use a few borderline pairs with their reasons.
- **CS-62:** examples are useful to map Farsi slang to filter values; measure latency.

### 3. "Give the model a role or expert persona"

**Verdict: contradicted for accuracy.**
- **Zheng et al., Findings EMNLP 2024 [P1]:** 162 roles, 2,410 questions, FLAN-T5-XXL, Llama-3 8B/70B, Mistral-7B, Qwen2.5 3B–72B. Personas "do not improve" accuracy, and picking the best persona automatically was about as good as random.
- **Wharton Prompting Science Report 4, Dec 2025 [P2]:** GPT-4o, GPT-4o-mini, o3-mini, o4-mini, Gemini 2.0/2.5 Flash; 25 trials per question.
  - Quote: "persona prompts generally did not improve accuracy relative to a no-persona baseline."
  - Gemini 2.0 Flash was the exception, and low-knowledge personas hurt.
- **Counter-evidence:**
  - Kong et al., NAACL 2024, ChatGPT [P3]: role-play raised AQuA from 53.5% to 63.8% and Last Letter from 23.8% to 84.2%. The authors say it acts as a chain-of-thought trigger, which modern models already do.
  - Kim et al. 2024 [P4]: role-play prompts degraded reasoning on 7 of 12 datasets with Llama 3.
- **Vendor:** Anthropic still recommends a role for behaviour and tone [N13] (O).

**Still applies to 2025–26 models:** yes; reasoning models were tested.

**What Carshenas should do:** no "expert appraiser" persona in CS-52, CS-55 or CS-62; spend those tokens on definitions. For CS-64 write a Farsi tone and length spec instead, and keep a role line only if the evaluation shows it helps.

### 4. "Tipping, threats or emotional appeals improve answers"

**Verdict: contradicted on current models.**
- **EmotionPrompt, 2023 models [P5]:** +8.00% relative on Instruction Induction and +115% relative on BIG-Bench (Flan-T5, Vicuna, Llama 2, BLOOM, ChatGPT, GPT-4).
- **Wharton Prompting Science Report 3, Aug 2025 [P6]:** Gemini 1.5/2.0 Flash, GPT-4o, GPT-4o-mini, o4-mini; GPQA 198 questions and MMLU-Pro 100 questions, 25 trials each.
  - Quote: "Threatening or tipping a model generally has no significant effect on benchmark performance."
  - EmotionPrompt's own "This is very important to my career!" was significant only once, and negative (Gemini 2.0 Flash, −0.040).
- **Salinas & Morstatter 2024 [P7]** (gpt-3.5-turbo-1106, Llama 2):
  - A $1000 tip degraded accuracy compared with smaller tips.
  - Adding a single space changed over 500 predictions.

**Still applies to 2025–26 models:** yes.

**What Carshenas should do:** never use them; they add variance.

### 5. "Be polite" or "be rude"

**Verdict: mixed.** Effects are small and depend on model and language.
- **Yin et al. 2024 [P8]** (English, Chinese, Japanese; GPT-3.5, GPT-4 and one local model per language): impolite prompts often hurt, very polite ones don't guarantee better results, and the best level differs by language.
- **Dobariya & Kumar 2025 [P9]** (GPT-4o; 50 generated questions × 5 tones × 10 runs): very rude 84.8% vs very polite 80.8%.
- **Their 2026 follow-up [P10]** (GPT-4o, GPT-5-nano, Gemini 2.5 Flash/Lite): effects "highly model-dependent."
- **Cai et al. 2025 [P11]** (GPT-4o mini, Gemini 2.0 Flash, Llama 4 Scout): "modern LLMs are broadly robust to tonal variation in typical mixed-domain use."
- **Mehta et al. 2026 [P12]** (5 models; English, Hindi, Spanish): polite prompts up to about 11% better quality, but language-dependent.
- **Wharton Report 1 [P13]:** "Please" sometimes helps and sometimes hurts.
- **Gap:** no Persian study found.

**Still applies to 2025–26 models:** partly.

**What Carshenas should do:** use neutral, direct wording with no Farsi courtesy formulas (taarof), and do not spend effort tuning tone.

### 6. "ALL CAPS and CRITICAL make the model obey"

**Verdict: untested directly.** Nearby evidence and vendors point against it.
- **Anthropic [N13]:** Claude Opus 4.5/4.6 "may now overtrigger. The fix is to dial back any aggressive language." Its example: "CRITICAL: You MUST use this tool when…" becomes "Use this tool when…".
- **OpenAI GPT-4.1 guide, 2025-04-14 [N14]:** "It's generally not necessary to use all-caps or other incentives like bribes or tips." Existing emphasis may make the model pay attention "too strictly."
- **OpenAI GPT-5 guide [N15] (P):** Cursor's "Be THOROUGH…" prompt was "counterproductive" and caused tool overuse.
- **IssueTrojanBench 2026 [P14]** (GPT-5.3 Codex, GPT-5.4, Sonnet 4.6; 4,176 runs): ALL-CAPS instructions hidden in data "made absolutely no difference."
- **PRISM-Δ 2026 [P15]** (Qwen3 4–14B, Gemma 3 4–12B): marking text with `**` gave small, inconsistent changes, from +1.1 to +5.8 points on one benchmark and −2.5 in one setting.
- **COLM 2026 [P16]** (Kimi-K2, Qwen3, Mistral): urgency and authority phrases shift which of two conflicting instructions wins. Emphasis re-weights priorities rather than improving compliance.

**Still applies to 2025–26 models:** partly.

**What Carshenas should do:** no caps or "CRITICAL". Enforce hard rules with the schema and code, and state the priority order once.

### 7. "Always ask it to think step by step"

**Verdict: contradicted.**

**Where it helped**
- **Wei et al., NeurIPS 2022 [C1]:** big gains for PaLM 540B, but "chain of thought actually hurts performance for most models smaller than 10B parameters."
- **Kojima et al., NeurIPS 2022, text-davinci-002 [C2]:** MultiArith 17.7% → 78.7%, GSM8K 10.4% → 40.7%.

**Where it doesn't**
- **Sprague et al., ICLR 2025 [C3]** (14 models including GPT-4o, Claude 3.5 Sonnet, Gemini 1.5, Llama 3.1):
  - Gains of +14.2 on symbolic, +12.3 on math and +6.9 on logic tasks; little elsewhere.
  - Up to 95% of the MMLU gain came from questions containing "=".
- **Wharton Prompting Science Report 2, June 2025 [C4]:**
  - Non-reasoning models: small average gains (Gemini 2.0 Flash +0.135; GPT-4o-mini +0.044, not significant). Answers became more variable, and the "correct on all 25 trials" metric fell for several models.
  - Reasoning models: o3-mini +0.029, o4-mini +0.031, Gemini 2.5 Flash −0.033.
  - Cost: requests took 35–600% longer on non-reasoning models and 20–80% longer on reasoning models.
- **Liu et al., ICML 2025 [C5]:** on tasks where thinking hurts humans, drops of up to 36.3 points (o1-preview compared with GPT-4o).
- **Gema et al., TMLR 2025 [C6]:** longer reasoning reduced accuracy on some tasks for Claude and OpenAI o-series models.
- **Vendors:** OpenAI: "Avoid chain-of-thought prompts" for reasoning models [N17]. OpenAI's GPT-5 guide: minimal reasoning is more prompt-sensitive than higher reasoning levels [N15].

**Still applies to 2025–26 models:** yes.

**What Carshenas should do**
- **CS-52:** no step-by-step instruction. Instead, an evidence field per fact holding the quoted Farsi span, which also serves as the audit trail. Use low or minimal reasoning effort and compare against a non-reasoning model.
- **CS-55:** a short reason field placed before the verdict (the reason is stored anyway).
- **CS-62 and CS-64:** no chain of thought; CS-62 is latency-sensitive.

### 8. "Prompt format does not matter"

**Verdict: contradicted.** The effect is smaller on frontier models but not zero.
- **Sclar et al., ICLR 2024 [R1]** (LLaMA-2 7–70B, Falcon, GPT-3.5-Turbo):
  - Up to 76 accuracy points between formats on LLaMA-2-13B, with a median spread of 0.064 on GPT-3.5.
  - The sensitivity persists with larger models, more examples and instruction tuning, and the best format differs between models.
- **He et al. 2024 [R2]** (GPT-3.5 and GPT-4 variants; plain text, Markdown, JSON, YAML): up to 40% difference for GPT-3.5 on code translation; GPT-4 is more robust.
- **Mizrahi et al., TACL 2024 [R3]:** single-prompt evaluations are brittle (20 models, 6.5M instances).
- **Seleznyov et al. 2025 [R4]:** GPT-4.1 and DeepSeek V3 are much more robust (standard deviation across formats 0.010 and 0.015), but some tasks still spread 8–10 points.
- **Wharton Report 1 [P13]:** removing the answer-format line significantly lowered GPT-4o and GPT-4o-mini.
- **Wang et al. 2023 [R6]:** when a model judges two candidates, their order alone changes the verdict. By swapping order, Vicuna "beat" ChatGPT on 66 of 80 queries.
- **Vendor [N14] (V):** in OpenAI's long-context tests, JSON "performed particularly poorly" as a document delimiter, while XML did well.

**Still applies to 2025–26 models:** partly.

**What Carshenas should do**
- Freeze one template per model version, with the listing inside XML-style tags, and log the prompt version with each result.
- Evaluate 2–3 paraphrases to know the spread, and re-run the evaluation whenever the model changes.
- **CS-55:** run both pair orders and accept "same vehicle" only if both agree.

### 9. "Forcing JSON output hurts reasoning"

**Verdict: mixed, and mostly contradicted when structured output is done properly.**
- **Tam et al. 2024 [J1]** (gpt-3.5-turbo-0125, Claude 3 Haiku, Gemini 1.5 Flash, Llama-3-8B, Gemma-2-9B):
  - Reasoning dropped under format restrictions, while classification improved.
  - GPT-3.5's JSON mode put the "answer" key before the "reason" key in 100% of responses, so it answered before reasoning.
- **.txt rebuttal, 2024-11-20, Llama-3-8B-Instruct [J2] (V):** with the same prompt, structured output was at least as good: GSM8K 0.77→0.78, Last Letter 0.73→0.77, Shuffle 0.41→0.44. It also notes Tam used different prompts for the two conditions.
- **JSONSchemaBench 2025, Llama-3.1-8B-Instruct [J3]:** constrained decoding with the reasoning field before the answer raised GSM8K from 80.1% to between 81.6% and 83.8% ("up to 4%"). Frameworks differ about two-fold in how many real schemas they support.
- **Structured Output Benchmark 2026, 21 models [J4]:** near-perfect schema compliance, but the best exact-value accuracy is only 83.0% on text. A valid schema is not a correct answer.
- **Chavan 2026, models of 0.6–4B [J5]:** constrained decoding fixes structure (78.6–92.9% valid → 100%) but not content errors.
- **OpenAI GPT-5.2 guide [N16]:** "Always provide a schema… If a field is not present… set it to null rather than guessing."

**Still applies to 2025–26 models:** partly. No controlled test was found on reasoning models, which think before writing the JSON.

**What Carshenas should do**
- **CS-52, CS-55, CS-62:** use native strict structured outputs.
  - Order fields as evidence → value → confidence, with explicit "not stated" values and nullable fields.
  - Validate ranges and cross-field rules in code, and measure per-field value accuracy rather than schema validity.
- **CS-64:** return the text together with the fact IDs it used, or template slots that code fills.

### 10. "Long context is free"

**Verdict: contradicted.**
- **Lost in the Middle, TACL 2024 [L1]:** accuracy is U-shaped by position. GPT-3.5 with the relevant document in the middle scored below its no-document score (56.1%).
- **Levy et al., ACL 2024 [L2]** (GPT-4, GPT-3.5, Gemini Pro, Mixtral and others): average accuracy fell from 0.92 to 0.68 at about 3,000 tokens.
- **RULER, COLM 2024, 17 models [L3]:** only half hold up at 32K tokens.
- **NoLiMa, ICML 2025, 13 models [L4]:** 11 fall below half their short-context baseline at 32K; GPT-4o goes from 99.3% to 69.7%. Reasoning models struggle too.
- **Chroma "Context Rot", 2025-07-14 [L5]:** 18 models including GPT-4.1, o3, Claude Opus 4/Sonnet 4 and Gemini 2.5 Pro.
  - Quote: "model performance consistently degrades with increasing input length."
  - A single distractor hurts, and a focused ~300-token input beats the full ~113k-token input for every model.
- **Laban et al. 2025 [L6]** (15 models including GPT-4.1, Gemini 2.5 Pro, o3, DeepSeek-R1; over 200,000 simulated conversations):
  - Performance is 39% lower in multi-turn conversations.
  - Putting all the information into one turn restores 95.1% of single-turn performance.
- **Instruction load:**
  - IFScale 2025 [L7]: the best model reaches 68% at 500 instructions. o3 and Gemini 2.5 Pro stay near-perfect up to about 150; GPT-4.1 and Claude Sonnet 4 decline linearly; models favour earlier instructions.
  - Qi et al. 2026 [L8]: adding one constraint the correct answer already met still cut performance; Claude Sonnet 4.5 kept only 85.0% of its multi-hop QA accuracy.
  - MOSAIC, EACL 2026 [L9]: compliance depends on constraint type, count and position (primacy and recency).
- **Vendors (V):** Anthropic says to put the data first and the question last ("up to 30 percent"); OpenAI's GPT-4.1 guide says to put instructions both before and after the data.

**Still applies to 2025–26 models:** yes.

**What Carshenas should do**
- **CS-52:** one listing per call; send only the glossary terms relevant to the fields; never batch several listings in one call.
- **CS-62:** keep it stateless. Each turn, send the consolidated filter state plus the newest utterance, not the chat history.
- **CS-64:** send only that listing's stored facts.
- **All steps:** keep the instruction list short and avoid redundant "always/never" lines.

### 11. "Temperature 0 makes output deterministic"

**Verdict: contradicted.**
- **Thinking Machines, 2025-09-10 [D1]** (Qwen3-235B-A22B-Instruct-2507 served on vLLM):
  - 1,000 samples at temperature 0 gave 80 distinct completions, first diverging at token 103.
  - Cause: "nearly all LLM inference endpoints are nondeterministic" because load and batch size vary.
  - Batch-invariant kernels made all 1,000 identical. In a separate Qwen-3-8B speed test, the run took 26 s with default vLLM, 55 s with unoptimized deterministic vLLM, and 42 s with the improved attention kernel.
- **Atil et al. [D2]** (GPT-3.5 Turbo, GPT-4o, Llama-3-70B/8B, Mixtral): accuracy varied up to 15% across runs, with a best-to-worst gap up to 70%.
- **Yuan et al., NeurIPS 2025 [D3]:** DeepSeek-R1-Distill-Qwen-7B showed up to 9% accuracy variation and 9,000-token length differences when only GPU count, GPU type or batch size changed.
- **Anthropic [D4]:** "Even with temperature set to 0, the results will not be fully deterministic."
- **Laban et al. [L6]:** temperature 0 cut single-turn variation (GPT-4o 17.8 → 2.8) but multi-turn unreliability stayed around 30%.
- **IFBench [N8]:** o3 requires temperature 1, so reasoning models may not allow 0 at all.

**Still applies to 2025–26 models:** yes.

**What Carshenas should do:** the input-hash cache is the real source of reproducibility. Store the model id and prompt version with every result, run each evaluation at least 3 times, and report the mean and spread.

### 12. "Asking the model to check or correct itself improves it"

**Verdict: mixed.** Self-correction without an outside signal is contradicted; correction driven by external feedback is supported.
- **Huang et al., ICLR 2024 [S1]:** without an outside signal, self-correction lowered accuracy. GPT-3.5 on CommonSenseQA went from 75.8% to 38.1%; GPT-4 on GSM8K from 95.5% to 89.0%. Gains appeared only when the true answers were available.
- **Self-Refine [S2]:**
  - About 20% average gain, mostly on preference-judged generation tasks.
  - Math improved by only 0.0–0.2 points, and ChatGPT's own feedback said "everything looks good" 94% of the time.
  - With an external error signal, math gains were 5% or more.
- **CRITIC, ICLR 2024, ChatGPT with tools [S3]:** +7.7 F1 on QA, +7.0% on math, −79.2% toxicity; weaker without the tools.
- **Kamoi et al., TACL 2024 survey [S4]:** "self-correction works well in tasks that can use reliable external feedback."
- **Xiong et al., ICLR 2024 [S5]:** confidence stated by the model is overconfident; agreement across several samples helps.
- **Reasoning models [F10]:** verification and reflection emerge inside RL-trained reasoning models; this is not a prompt trick.

**Still applies to 2025–26 models:** partly.

**What Carshenas should do**
- **CS-52:**
  - Validate against the schema and domain rules, and re-ask once with the exact validator error.
  - Calibrate the per-field confidence threshold on the labelled set; do not trust the raw number.
  - Send below-threshold fields to the review queue.
- **CS-64:** code checks that every number in the text is one of the database values supplied, and regenerates otherwise.
- **No "are you sure?" loops** anywhere.

### 13. "Automatic prompt optimisation beats hand-written prompts"

**Verdict: supported, given a metric and labelled data.**
- **DSPy [A1]** (GPT-3.5, llama2-13b-chat): more than 25% and 65% better than standard few-shot, and 5–46% and 16–40% better than expert-written examples.
- **OPRO, ICLR 2024 [A2]:** up to +8% on GSM8K and +50% on Big-Bench Hard over human prompts.
- **MIPRO, EMNLP 2024, Llama-3-8B [A3]:** best on 5 of 7 programs, by up to 13%.
- **GEPA, ICLR 2026 Oral, Qwen3 8B and GPT-4.1 mini [A4]:** +6% on average over RL training (GRPO), up to 20%, with up to 35× fewer rollouts; more than 10% better than MIPROv2.
- **The Prompt Report's case study [A5]** (a single task and model):
  - A human engineer spent 47 steps (about 20 hours) to reach F1 0.53 on the development set.
  - DSPy with gpt-4-0125-preview reached F1 0.548 on the test set (precision 0.385, recall 0.952), "much better than the human prompt engineer's prompts on the test set."
  - The authors found that combining automation with human revision worked best.

**Still applies to 2025–26 models:** yes.

**What Carshenas should do:** once the hand-written baseline and the 200-label set exist, run MIPROv2 or GEPA for CS-52 and CS-55.
- Use a train/dev/test split of about 100/50/50 and a per-field metric.
- Have a human review the optimised prompt for glossary drift and spurious cues, then version it.
- Watch for overfitting with only 200 items.

## Persian and multilingual

### 14. English or Farsi instructions when the data is Farsi?

**Verdict: mixed, and model-dependent.** No study tests 2025–26 frontier models on Persian extraction.

**Evidence for English instructions**
- **MEGA, EMNLP 2023, text-davinci-003 [M1]:** English templates beat machine-translated native ones: XNLI 58.3 vs 54.4, IndicXNLI 49.6 vs 38.7, PAWS-X 67.1 vs 64.2, XCOPA 77.6 vs 73.1. The native templates were machine-translated, which confounds the comparison.
- **Lai et al. 2023, ChatGPT [M2]:** Persian NER scored F1 25.9 with an English task description vs 21.9 with a Persian one; a supervised model reached 89.7.
- **Abaskohi et al., LREC-COLING 2024 [M6]** (GPT-3.5, GPT-4; English instructions with Persian data):
  - With GPT-4 at zero-shot, English instructions scored higher: ParsiNLU entailment 0.582 vs 0.383, emotion 0.574 vs 0.506, sentiment 0.812 vs 0.786.
  - GPT-3.5 with Persian instructions was near random on entailment.
- **Arabic study [M5]** (GPT-4o, Llama-3.1-8B, Jais-13B): English instructions best on average; GPT-4o was the most robust to prompt language.
- **Etxaniz et al. 2023, open models [M4]:** having the model translate the input to English itself beats answering directly.

**Evidence for Farsi instructions**
- **PARSE 2026 [M10]** (Qwen 2.5, Llama 3, Mistral 24B, Gemma 2 27B, Dorna; submitted to SIGIR 2026): the authors state "Persian prompts consistently outperform English prompts." In the Boolean-question table the differences are small and go both ways; for Llama 3 8B, one subtype favours Persian (0.78 vs 0.69) and another favours English (0.65 vs 0.48).
- **Liu et al., NAACL 2025 [M3]:** native-language prompting works better for culture-related tasks.

**Nuanced findings**
- **Mondshine et al., Findings NAACL 2025 [M7]** (GPT-3.5, Mixtral, Gemini 1.0 Pro, BLOOMZ; 35 languages including Persian):
  - Instruction language showed only "a slight preference for English"; context and output language mattered more.
  - Keeping output in the source language helps extractive tasks.
  - For Persian summarization, English instructions correlated with lower scores (r = −0.37).
- **Wu et al., Findings ACL 2026 [M8]** (DeepSeek-V3.1, Llama-3.3-70B; 10 languages, not Persian): no single strategy wins; translating helps low-resource languages and does little for high-resource ones.
- **Yong et al. 2025 [M9]:** English-centric reasoning models reason best in high-resource languages.

**Output language drift.** DeepSeek-R1 may reason and answer in English for other languages [F10], and Llama 3 often answers Persian prompts in English [M11].

**Persian evaluations and leaderboards**
- **ParsiNLU [M12]:** the first Persian understanding benchmark (TACL 2021).
- **Khayyam / PersianMMLU [M13]:** 20,192 questions; GPT-4 is best, and the authors put its gap to human averages at about 35%.
- **MIZAN leaderboard [N9]** (45 models; data dated 2025-11-25): o3 0.747, Gemini 2.5 Pro 0.733, GPT-5-mini 0.717, Claude 3.7 Sonnet 0.713, GPT-4.1 0.699. It includes no Claude 4.x and no full GPT-5.
- **PartAI Open Persian LLM Leaderboard [M18]:** exists; its results were not inspected.
- **MELAC [M15]:** 19 datasets, 41 models.
- **Persian sentiment study 2025 [M16]:** Claude 3.7 Sonnet, DeepSeek-V3, Gemini 2.0 Flash and GPT-4o; no significant difference among the top three.
- **FaMTEB, Persian embeddings [M14]:** 63 datasets. Jina v3 has the best average, BGE-m3 is best at reranking, and Persian-specific models win classification and clustering.
- **Hosseinbeigi et al. [M11]:** GPT-4o as a Persian judge agreed with ground truth at only κ = 0.54, so LLM judges are weak in Persian.

**Still applies to 2025–26 models:** partly; unknown for current frontier models.

**What Carshenas should do**
- Keep instructions in English with the Farsi terms verbatim alongside the glossary. This is easier to maintain and cheaper (the main note's lab measures it on the models Metis serves).
- State the output language explicitly:
  - English JSON keys and enum values,
  - verbatim Farsi evidence spans,
  - Farsi text for CS-64.
- A/B English vs Farsi instructions on the 200 labelled listings for each candidate model.
- Do not pre-translate listings or queries into English.

### 15. Tokenizer cost of Persian

**Verdict: supported.** Newer tokenizers have narrowed the gap.
- **Petrov et al., NeurIPS 2023 [T1]:** the same text can be up to 15× longer in some languages.
- **Ahia et al. 2023 [T2]:** users of many languages are overcharged while getting poorer results.
- **OpenAI's GPT-4o launch page, 2024-05-13 [T3] (V):** "Persian 1.9x fewer tokens (from 61 to 32)" with the new tokenizer; English went from 27 to 24.
- **Gemma 3 report [T4] (V):** "We use the same tokenizer as Gemini 2.0," which is "more balanced for non-English languages."

**This pass's own offline count [T5]** covered 5 synthetic texts: 3 listings, 1 buyer query and 1 instruction, 743 Farsi characters against their English translations. Tokens, Farsi over English:

| Tokenizer | Farsi / English tokens | Ratio |
|---|---|---|
| cl100k (GPT-4 era) | 601 / 213 | 2.82 |
| o200k (GPT-4o, 4.1, o-series, 5) | 293 / 211 | 1.39 |
| DeepSeek-V3 | 350 / 215 | 1.63 |
| Qwen3 | 493 / 233 | 2.12 |
| Gemma 3 (Gemini 2.0 tokenizer) | 271 / 230 | 1.18 |

Claude's tokenizer is not public and was not counted here; the main note's lab counted it live through Metis. A practitioner benchmark of Persian tokenizers [T6] (P) uses a very small corpus.

**Still applies to 2025–26 models:** yes.

**What Carshenas should do:** budget Persian at about 1.2–1.6× English tokens on the GPT, Gemini and DeepSeek families; the 2.8× figure from the GPT-4 era is obsolete. Measure Claude separately.

### 16. Normalising Persian orthography before sending text to a model

**Verdict: untested for accuracy.** No study was found that measures LLM accuracy with and without Persian normalisation. Token effects are small and depend on the tokenizer. Normalisation clearly matters for matching and for scoring.

**Evidence found**
- **Doctor et al., 2022 [T7]:** normalising Perso-Arabic script gave "statistically significant improvements… in most conditions" for trained translation and language models in 8 languages. Persian was not among them, and this is not about prompting.
- **TARAZ, LREC 2026 [T8]:** normalising digits and Arabic-form letters when *scoring* improved consistency by +10 over exact match.
- **Singh & Strouse 2024, GPT-3.5/4 [T9]:** how digits are split into tokens changes arithmetic accuracy; the gap shrinks at larger scale.

**This pass's offline count of the token effect [T5]** (all 5 Farsi texts combined, relative to standard Persian spelling):

| Variant | cl100k | o200k | DeepSeek-V3 | Qwen3 | Gemma 3 |
|---|---|---|---|---|---|
| Arabic ي and ك instead of Persian ی and ک | −0.3% | +7.8% | +5.1% | −6.1% | +10.7% |
| Zero-width non-joiner replaced by a space | −1.2% | −2.0% | −5.7% | −1.0% | −1.1% |
| Latin digits instead of Persian digits | −9.3% | −3.8% | −3.4% | −7.3% | +8.1% |

In o200k, «۶۸۰» takes 3 tokens where "680" takes 1.

**Still applies to 2025–26 models:** unknown.

**What Carshenas should do**
- Build a normalised copy of the text for the model:
  - Convert Arabic ي/ك to Persian ی/ک.
  - Unify digits to Latin, matching ADR-0014.
  - Keep the zero-width non-joiner but unify its variants.
- Keep the raw text for evidence spans.
- Parse prices, mileage and years with code where possible.
- Normalise gold labels and predictions the same way before scoring, and A/B raw vs normalised input on the 200 labelled listings.

## Claims table

| # | Claim | Verdict | Key evidence | Applies to 2025–26 | What Carshenas does |
|---|---|---|---|---|---|
| 1 | Never write negative instructions | Mixed | N1–N6, N8–N11, N13–N16 | Partly | Pair each "don't" with the alternative; hard limits in the schema; "not stated" separate from "none"; oversample negated facts; fixed affirmative decision question (CS-55) |
| 2 | Few-shot always helps | Contradicted | F1–F14, N13, N17 | Yes | Zero-shot first on reasoning models; A/B 3–5 balanced, verified, shuffled hard cases, never near-duplicates |
| 3 | Role or expert persona | Contradicted for accuracy | P1–P4 | Yes | No persona; spend tokens on definitions; Farsi tone spec for CS-64 |
| 4 | Tips, threats, emotion | Contradicted | P5–P7 | Yes | Don't use |
| 5 | Polite or rude | Mixed (small) | P8–P13 | Partly | Neutral, direct wording; no tuning |
| 6 | ALL CAPS / CRITICAL | Untested directly; vendors advise against | N13–N15, P14–P16 | Partly | No caps; enforce with schema and code; state priorities once |
| 7 | Always think step by step | Contradicted | C1–C6, N15, N17 | Yes | Evidence field instead; reason field before verdict in CS-55; none in CS-62/64; low reasoning effort |
| 8 | Format doesn't matter | Contradicted | R1–R4, R6, P13, N14 | Partly | Freeze template per model version; evaluate paraphrases; both pair orders in CS-55 |
| 9 | JSON hurts reasoning | Mixed, mostly contradicted | J1–J5, N16 | Partly | Native strict schema; evidence → value → confidence; measure value accuracy |
| 10 | Long context is free | Contradicted | L1–L9 | Yes | One listing per call; short prompts; stateless CS-62; few instructions |
| 11 | Temperature 0 is deterministic | Contradicted | D1–D4, L6, N8 | Yes | Hash cache; log model and prompt version; repeat evaluations 3× or more |
| 12 | Self-check improves answers | Mixed | S1–S5, F10 | Partly | Validator-driven re-ask; calibrated thresholds; review queue; number check in CS-64 |
| 13 | Automatic optimisation beats hand-written | Supported (with a metric) | A1–A5 | Yes | MIPROv2 or GEPA after the baseline, with a train/dev/test split |
| 14 | Farsi vs English instructions | Mixed | M1–M11, M16, F10 | Partly / unknown | English instructions plus Farsi terms; explicit output language; A/B per model |
| 15 | Persian token premium | Supported, narrowed | T1–T5 | Yes | Budget about 1.2–1.6× on GPT, Gemini and DeepSeek; Claude separately |
| 16 | Normalise orthography | Untested for accuracy | T5, T7–T9 | Unknown | Normalise the model copy and scoring; keep raw spans; A/B |

## Sources

All fetched 2026-09-29. Mark: M, V, P or O. Peer-reviewed venue named only where verified; otherwise "preprint".

**Negation and instruction following**
- **[N1]** Jang, Ye, Seo 2022, https://arxiv.org/abs/2209.12711, preprint, M. Models: OPT, GPT-3, InstructGPT, T0.
- **[N2]** McKenzie et al., "Inverse Scaling", TMLR 2023, https://arxiv.org/abs/2306.09479, M. Models: GPT-3, Anthropic LMs, PaLM, Gopher/Chinchilla, GPT-4 (5 tasks).
- **[N3]** García-Ferrero et al., EMNLP 2023, https://arxiv.org/abs/2310.15941, M. Models: open models up to LLaMA-65B.
- **[N4]** Truong et al. 2023, https://arxiv.org/abs/2306.08189, preprint, M. Models: GPT-3, InstructGPT, FLAN-T5-XXL.
- **[N5]** Bsharat et al. 2023, https://arxiv.org/abs/2312.16171 and https://github.com/VILA-Lab/ATLAS (principle-4 files), preprint, M (weak). Models: LLaMA-1/2, GPT-3.5/4.
- **[N6]** Castricato et al. 2024, https://arxiv.org/abs/2402.07896, preprint, M. Models: OpenHermes 7B/13B, Llama-2-13B-Chat, GPT-4.
- **[N7]** Zhou et al., IFEval, https://arxiv.org/abs/2311.07911, preprint, M. Models: GPT-4, PaLM 2.
- **[N8]** Pyatkin et al., IFBench, NeurIPS 2025 Datasets & Benchmarks, https://arxiv.org/abs/2507.02833, M.
- **[N9]** MCINext MIZAN leaderboard, https://huggingface.co/spaces/MCINext/mizan-llm-leaderboard (files `leaderboard/boards_data/ifeval.jsonl` and `all.jsonl`, last modified 2025-11-25), M (third-party; IFEval translated by machine plus humans).
- **[N10]** Elkins & Chun 2026, https://arxiv.org/abs/2601.21433 (v2), preprint, M.
- **[N11]** Vrabcová et al. 2025, https://arxiv.org/abs/2503.22395, preprint, M.
- **[N12]** Hwang et al., DIM-Bench, ACL 2025, https://arxiv.org/abs/2502.04362, M. Models: GPT-4o, Llama-3.1-70B and others. Background only; relevant to CS-52: GPT-4o was not fully robust when the input text itself looks like an instruction, even with explicit prompting.
- **[N13]** Anthropic, Prompting best practices, https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (live page), O/V.
- **[N14]** OpenAI GPT-4.1 Prompting Guide, 2025-04-14, openai-cookbook `examples/gpt4-1_prompting_guide.ipynb`, O/V.
- **[N15]** OpenAI GPT-5 prompting guide, 2025-08-07, `examples/gpt-5/gpt-5_prompting_guide.ipynb`, O/P.
- **[N16]** OpenAI GPT-5.2 Prompting Guide, 2025-12-11, `examples/gpt-5/gpt-5-2_prompting_guide.ipynb`, O.
- **[N17]** OpenAI, Reasoning best practices, https://platform.openai.com/docs/guides/reasoning-best-practices (undated), O.

**Few-shot**
- **[F1]** Brown et al. 2020, https://arxiv.org/abs/2005.14165, M.
- **[F2]** Min et al., EMNLP 2022, https://arxiv.org/abs/2202.12837, M.
- **[F3]** Zhao et al., ICML 2021, https://arxiv.org/abs/2102.09690, M.
- **[F4]** Lu et al., ACL 2022, https://arxiv.org/abs/2104.08786, M.
- **[F5]** Liu et al. 2021, https://arxiv.org/abs/2101.06804, preprint, M.
- **[F6]** Agarwal et al., NeurIPS 2024, https://arxiv.org/abs/2404.11018, M.
- **[F7]** Bertsch et al., NAACL 2025, https://arxiv.org/abs/2405.00200, M.
- **[F8]** Wei, Wei, Tay et al. 2023, https://arxiv.org/abs/2303.03846, preprint, M.
- **[F9]** Tang et al. 2023, https://arxiv.org/abs/2305.17256, preprint, M. Models: OPT 2.7–13B.
- **[F10]** DeepSeek-R1, Nature 645 (2025), https://arxiv.org/abs/2501.12948. V for the few-shot note.
- **[F11]** Nori et al. 2024, https://arxiv.org/abs/2411.03590, preprint, M. Model: o1-preview.
- **[F12]** Cheng et al., EMNLP 2025 Findings, https://arxiv.org/abs/2506.14641, M.
- **[F13]** Wang et al. 2025, https://arxiv.org/abs/2509.23196, preprint, M.
- **[F14]** Tang, Tuncel et al., IEEE FLLM, https://arxiv.org/abs/2509.13196, M.

**Persona, emotion, politeness, emphasis**
- **[P1]** Zheng et al., Findings EMNLP 2024, https://arxiv.org/abs/2311.10054, M.
- **[P2]** Basil et al., Wharton Prompting Science Report 4, https://arxiv.org/abs/2512.05858, M (technical report).
- **[P3]** Kong et al., NAACL 2024, https://arxiv.org/abs/2308.07702, M.
- **[P4]** Kim, Yang, Jung 2024, https://arxiv.org/abs/2408.08631, preprint, M.
- **[P5]** Li et al., EmotionPrompt, https://arxiv.org/abs/2307.11760, M.
- **[P6]** Meincke et al., Wharton Prompting Science Report 3, https://arxiv.org/abs/2508.00614, M.
- **[P7]** Salinas & Morstatter 2024, https://arxiv.org/abs/2401.03729, preprint, M.
- **[P8]** Yin et al., SICon 2024, https://arxiv.org/abs/2402.14531, M.
- **[P9]** Dobariya & Kumar 2025, https://arxiv.org/abs/2510.04950, M (small sample).
- **[P10]** Dobariya & Kumar, AMCIS 2026, https://arxiv.org/abs/2605.29027, M.
- **[P11]** Cai et al. 2025, https://arxiv.org/abs/2512.12812, preprint, M.
- **[P12]** Mehta et al. 2026, https://arxiv.org/abs/2604.16275, preprint, M.
- **[P13]** Meincke et al., Wharton Prompting Science Report 1, https://arxiv.org/abs/2503.04818, M.
- **[P14]** Singh, Yang, Chen, IssueTrojanBench 2026, https://arxiv.org/abs/2607.20759, preprint, M.
- **[P15]** Ge et al., PRISM-Δ 2026, https://arxiv.org/abs/2603.10705, preprint, M.
- **[P16]** Geng et al., COLM 2026, https://arxiv.org/abs/2602.21223, M.

**Chain of thought**
- **[C1]** Wei et al., NeurIPS 2022, https://arxiv.org/abs/2201.11903, M.
- **[C2]** Kojima et al., NeurIPS 2022, https://arxiv.org/abs/2205.11916, M.
- **[C3]** Sprague et al., ICLR 2025, https://arxiv.org/abs/2409.12183, M.
- **[C4]** Meincke et al., Wharton Prompting Science Report 2, https://arxiv.org/abs/2506.07142, M.
- **[C5]** Liu et al., ICML 2025, https://arxiv.org/abs/2410.21333, M.
- **[C6]** Gema et al., TMLR 2025, https://arxiv.org/abs/2507.14417, M.

**Format and ordering**
- **[R1]** Sclar et al., ICLR 2024, https://arxiv.org/abs/2310.11324, M.
- **[R2]** He et al. 2024, https://arxiv.org/abs/2411.10541, preprint, M.
- **[R3]** Mizrahi et al., TACL, https://arxiv.org/abs/2401.00595, M.
- **[R4]** Seleznyov et al. 2025, https://arxiv.org/abs/2508.11383, preprint, M.
- **[R6]** Wang et al. 2023, https://arxiv.org/abs/2305.17926, preprint, M.

**Structured output**
- **[J1]** Tam et al. 2024, https://arxiv.org/abs/2408.02442, preprint, M.
- **[J2]** Kurt (.txt), "Say What You Mean", 2024-11-20, https://blog.dottxt.ai/say-what-you-mean.html, V.
- **[J3]** Geng et al., JSONSchemaBench, https://arxiv.org/abs/2501.10868, preprint, M (authors include developers of Guidance, one of the frameworks tested).
- **[J4]** Structured Output Benchmark, https://arxiv.org/abs/2604.25359, preprint, M.
- **[J5]** Chavan 2026, https://arxiv.org/abs/2609.23742, preprint, M.

**Long context and instruction load**
- **[L1]** Liu et al., Lost in the Middle, TACL, https://arxiv.org/abs/2307.03172, M.
- **[L2]** Levy, Jacoby, Goldberg, ACL 2024, https://arxiv.org/abs/2402.14848, M.
- **[L3]** RULER, COLM 2024, https://arxiv.org/abs/2404.06654, M.
- **[L4]** NoLiMa, ICML 2025, https://arxiv.org/abs/2502.05167, M.
- **[L5]** Hong, Troynikov, Huber, "Context Rot", 2025-07-14, https://www.trychroma.com/research/context-rot, M (published by a vendor that sells retrieval).
- **[L6]** Laban et al. 2025, https://arxiv.org/abs/2505.06120, preprint, M.
- **[L7]** Jaroslawicz et al., IFScale, https://arxiv.org/abs/2507.11538, preprint, M.
- **[L8]** Qi et al. 2026, https://arxiv.org/abs/2601.22047, preprint, M.
- **[L9]** Purpura et al., MOSAIC, EACL 2026, https://arxiv.org/abs/2601.18554, M.

**Determinism**
- **[D1]** He / Thinking Machines, 2025-09-10, https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/, M (lab report).
- **[D2]** Atil et al., https://arxiv.org/abs/2408.04667, preprint, M.
- **[D3]** Yuan et al., NeurIPS 2025, https://arxiv.org/abs/2506.09501, M.
- **[D4]** Anthropic glossary, https://docs.claude.com/en/docs/about-claude/glossary, V/O.

**Self-correction**
- **[S1]** Huang et al., ICLR 2024, https://arxiv.org/abs/2310.01798, M.
- **[S2]** Madaan et al., Self-Refine, https://arxiv.org/abs/2303.17651, M.
- **[S3]** Gou et al., CRITIC, ICLR 2024, https://arxiv.org/abs/2305.11738, M.
- **[S4]** Kamoi et al., TACL 2024, https://arxiv.org/abs/2406.01297, M.
- **[S5]** Xiong et al., ICLR 2024, https://arxiv.org/abs/2306.13063, M.

**Automatic prompt optimisation**
- **[A1]** DSPy, https://arxiv.org/abs/2310.03714, M.
- **[A2]** OPRO, ICLR 2024, https://arxiv.org/abs/2309.03409, M.
- **[A3]** MIPRO, EMNLP 2024, https://arxiv.org/abs/2406.11695, M.
- **[A4]** GEPA, ICLR 2026, https://arxiv.org/abs/2507.19457, M.
- **[A5]** Schulhoff et al., The Prompt Report, https://arxiv.org/abs/2406.06608, M (single case study).

**Multilingual and Persian**
- **[M1]** MEGA, EMNLP 2023, https://arxiv.org/abs/2303.12528, M.
- **[M2]** Lai et al. 2023, https://arxiv.org/abs/2304.05613, M.
- **[M3]** Liu et al., NAACL 2025, https://arxiv.org/abs/2403.10258, M.
- **[M4]** Etxaniz et al. 2023, https://arxiv.org/abs/2308.01223, M.
- **[M5]** Kmainasi et al. 2024, https://arxiv.org/abs/2409.07054, M.
- **[M6]** Abaskohi et al., LREC-COLING 2024, https://arxiv.org/abs/2404.02403, M.
- **[M7]** Mondshine et al., Findings NAACL 2025, https://arxiv.org/abs/2502.09331, M.
- **[M8]** Wu et al., Findings ACL 2026, https://arxiv.org/abs/2604.16937, M.
- **[M9]** Yong et al. 2025, https://arxiv.org/abs/2505.05408, M.
- **[M10]** PARSE, https://arxiv.org/abs/2602.01246, M.
- **[M11]** Hosseinbeigi et al., Findings NAACL 2025, https://aclanthology.org/2025.findings-naacl.147.pdf, M.
- **[M12]** ParsiNLU, TACL 2021, https://arxiv.org/abs/2012.06154, M.
- **[M13]** Khayyam / PersianMMLU, https://arxiv.org/abs/2404.06644, M.
- **[M14]** FaMTEB, https://arxiv.org/abs/2502.11571, M.
- **[M15]** MELAC, https://arxiv.org/abs/2508.00673, M.
- **[M16]** Tohidi et al. 2025, https://arxiv.org/abs/2509.14922, M.
- **[M18]** PartAI Open Persian LLM Leaderboard, https://huggingface.co/spaces/PartAI/open-persian-llm-leaderboard (existence verified only).

**Tokenizers and orthography**
- **[T1]** Petrov et al., NeurIPS 2023, https://arxiv.org/abs/2305.15425, M.
- **[T2]** Ahia et al. 2023, https://arxiv.org/abs/2305.13707, M.
- **[T3]** OpenAI, "Hello GPT-4o", 2024-05-13 (Wayback copy of https://openai.com/index/hello-gpt-4o/), V.
- **[T4]** Gemma 3 Technical Report, https://arxiv.org/abs/2503.19786, V.
- **[T5]** This pass's offline count: tiktoken 0.14 (cl100k_base, o200k_base) and the Hugging Face tokenizer files for DeepSeek-V3, Qwen3-8B and Gemma 3. The script was in the research session's scratchpad (not kept); the main note's lab (`lab/tokens.mjs`) measures the same question live and is kept.
- **[T6]** https://github.com/abebr/persian-llm-token-bench, P (tiny corpus).
- **[T7]** Doctor et al., "Graphemic Normalization of the Perso-Arabic Script", G21C 2022, https://arxiv.org/abs/2210.12273, M.
- **[T8]** TARAZ, LREC 2026, https://arxiv.org/abs/2602.22827, M.
- **[T9]** Singh & Strouse 2024, https://arxiv.org/abs/2402.14903, M.

## Gaps and unverified points

- No current-model A/B test of "do X" vs "don't do Y" wording for the same rule.
- No controlled test of ALL CAPS or "CRITICAL" in system prompts on 2025–26 API models.
- No study of English vs Farsi instructions for Persian on GPT-5-class, Claude 4.x, Gemini 2.5+ or DeepSeek-V3.x models.
- No study of Persian normalisation's effect on LLM accuracy.
- Claude's tokenizer is not public. Whether Gemini 2.5/3 use the Gemma 3 tokenizer is unverified.
- Whether Metis passes temperature and structured-output parameters through unchanged was not tested in this pass.
- Petrov et al.'s Persian-specific figure is not quoted because the PDF table's columns could not be read reliably.

A cheap next step settles most of the open questions for Carshenas: A/B tests on the 200 labelled listings (CS-48), each repeated 3 times, comparing:
- English vs Farsi instructions;
- 0 vs 3–5 examples;
- raw vs normalised text;
- an evidence field vs none.
