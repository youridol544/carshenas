# Pass 4: structured outputs and retries, confidence and review thresholds, evaluations and error analysis (CS-43)

Researched on 2026-09-29; every source below was fetched that day, and the numbers marked "computed" were calculated in this pass (the statistics script was in the research session's scratchpad, not kept; the formulas are standard: Wilson and exact binomial intervals, exact McNemar). openai.com returned 403, so its two posts were read from Wayback captures. The Gemini docs were read with curl and a cookie jar, because ai.google.dev redirects to a sign-in. The web-search budget ran out near the end, so the gaps marked UNVERIFIED were not searched further. The main note re-checked the claims it leans on.

**Labels:** M = measured with a published method (venue named when peer-reviewed); V = a vendor measuring its own product; P = practitioner report from production; O = opinion, guidance or documentation without data. Source IDs such as [A3] point to the tables at the end; they are this file's own.

## The findings that matter most

1. **Strict modes guarantee the output's shape, not its truth.**
   - OpenAI reported that gpt-4o-2024-08-06 "with Structured Outputs scores a perfect 100%" on its own schema eval, against "less than 40%" for gpt-4-0613 [A1, V, 2024].
   - OpenAI and Gemini both warn that values can still be wrong [A1, A9].
2. **Anthropic's limits will shape the CS-52 schema** [A3]:
   - at most 16 parameters with union types (so `"type": ["string", "null"]` counts) and 24 optional parameters per request;
   - no `minimum`/`maximum` and no `minLength`/`maxLength`; `minItems` only 0 or 1;
   - "required properties appear first, followed by optional properties";
   - the capitalization of enum values is not guaranteed.
   - Consequence: make every field required, write "not stated" as an enum value rather than `null`, and check numbers in zod.
3. **Gemini:**
   - Key order has followed the schema only "for all Gemini 2.5 models and beyond", since 2025-11-05 [A6]. Before that the API sorted keys alphabetically unless `propertyOrdering` was set [A7].
   - The API reference (updated 2026-09-23) marks `responseSchema` and `_responseJsonSchema` "Deprecated. Use responseFormat instead." [A8]. This clashes with Metis's working `responseJsonSchema`, so check it again before CS-45 ships.
4. **Retries:**
   - Instructor, Pydantic AI and LangChain re-ask with the validation error, with default budgets of 1 to 3; the AI SDK's current structured-output call throws an error instead of re-asking. None of these libraries publishes a success rate.
   - Feedback that lists the admissible alternatives raised repair success by 42–44 points [A22, preprint].
   - Guarded reflection cut extraction errors by 92% within the first retry [A21, EMNLP 2025 Industry].
   - Self-correction without an external signal does not help [A24, ICLR 2024].
   - No published measurement was found of how many schema-invalid outputs one re-ask fixes under today's strict modes.
5. **Confidence:**
   - Models state confidence mostly between 80 and 100 and overstate it [B1, B4].
   - For field extraction with GPT-4o, token probabilities (AUC 0.705), stated confidence (0.692) and agreement across 5 samples (0.744, at 5× the cost) all separated right from wrong poorly [B9].
   - The CS-42 Metis sample (1.0 on wrong answers) fits this pattern.
6. **Evaluations:**
   - Start with error analysis: free notes on real outputs (open coding), then grouping them into failure types (axial coding), about 100 examples.
   - Use pass/fail labels from one domain expert.
   - Validate any model grader by its rates of caught failures (TPR) and correctly passed good outputs (TNR).
   - Regression items should pass nearly 100%.
   - Compare prompt versions item by item on the same set.
7. **Statistics (computed):**
   - 190 correct out of 200 is 95.0%, with a 95% interval of 91.0–97.3% (Wilson method).
   - To show "at least 95%" with one-sided 95% confidence you need at least 196 of 200 correct.
   - Detecting a 3-point gain between two prompt versions needs roughly 430–1,130 paired items.
   - 50 queries give intervals 17–25 points wide.

---

## A. Structured outputs and retries

### A.1 What each provider offers (as of 2026-09)

| | OpenAI [A1, A2] | Anthropic [A3, A4] | Gemini [A6–A9] | DeepSeek [A30] |
|---|---|---|---|---|
| **Launch** | 2024-08-06 | Beta 2025-11-14 (Sonnet 4.5, Opus 4.1; header `structured-outputs-2025-11-13`); Haiku 4.5 on 2025-12-04; out of beta 2026-01-29 | JSON Schema support and key-order change 2025-11-05 | JSON mode only |
| **Request parameter** | `response_format: {type: "json_schema", json_schema: {strict: true, schema}}` (Responses API: `text.format`) | `output_config.format: {type: "json_schema", schema}`; the old `output_format` is deprecated and needs the beta header | `responseMimeType` + `responseJsonSchema`; the reference now points to `responseFormat.text.{mimeType, schema}` | `response_format: {type: 'json_object'}`, plus the word "json" and an example in the prompt |
| **Schema rules and limits** | Root must be an object, not `anyOf`<br>All fields required (`null` unions emulate optional)<br>`additionalProperties: false`<br>Supported: string `pattern`/`format`, number min/max/`multipleOf`, array `minItems`/`maxItems`, `$defs`, recursion<br>Not supported: `allOf`, `not`, `if`/`then`/`else`<br>Limits: 5,000 properties, 10 levels of nesting, 1,000 enum values in total | Not supported: recursion, numeric constraints, string length constraints<br>`minItems` only 0 or 1<br>Enums of primitive values only<br>At most 20 strict tools, 24 optional and 16 union-typed parameters per request<br>Compile timeout 180 s | Listed keywords: `$defs`/`$ref`, `enum` (strings and numbers), `items`/`prefixItems`, min/max, `anyOf`/`oneOf`, `required`, `additionalProperties`, `propertyOrdering`<br>Cyclic references are unrolled only to a limited degree | No schema is enforced |
| **Key order** | "same order as the ordering of keys in the schema" | Schema order, but required keys before optional ones | Schema order for Gemini 2.5 and later | Not guaranteed |
| **Failure outcomes** | `refusal` field; truncation at the token limit | `stop_reason` `"refusal"` (HTTP 200, still billed) or `"max_tokens"` | Docs say "always validate values in your application" | "may occasionally return empty content" |
| **First call with a new schema** | In 2024: "Typical schemas take under 10 seconds to process on the first request, but more complex schemas may take up to a minute." | Compiled grammars "cached for 24 hours from last use"; editing only names or descriptions keeps the cache; the Jan 2026 GA added "improved grammar compilation latency" | Not documented | Not applicable |

Other Anthropic notes [A3]:
- Its structured outputs cannot be combined with Citations (400 error) or with prefilling.
- The SDKs strip constraints Claude cannot enforce, then validate the reply against the full schema. In Anthropic's words: "Claude receives a simplified schema, but your code still enforces all constraints through validation."

**Measured coverage (JSONSchemaBench [A10], M, preprint Feb 2025; APIs tested around late 2024):**
- OpenAI and Gemini produced 88–100% compliant output on the schemas they accepted.
- They accepted few real-world schemas: OpenAI 89% of GlaiveAI but 9% of GitHub-Hard and 6% of JSON Schema Store; Gemini 8% of GitHub-Easy.

### A.2 Does forcing a format hurt accuracy?

**Measured:**
- **Tam et al. [A11], M, EMNLP 2024 Industry.** Models: gpt-3.5-turbo-0125, claude-3-haiku, gemini-1.5-flash, Llama-3-8B, Gemma-2-9B.
  - Stricter formats lowered accuracy on reasoning tasks but raised it on classification.
  - "100% of GPT 3.5 Turbo JSON-mode responses placed the "answer" key before the "reason" key", so the model answered without reasoning first.
  - Parsing errors were not the main cause, and a reformat step fixed them.
- **Kurt / dottxt rebuttal [A12], V, 2024-11-20.** Llama-3-8B with the same prompt in both arms; unstructured versus structured:
  - GSM8K 0.77 → 0.78;
  - Last Letter 0.73 → 0.77;
  - Shuffled Objects 0.41 → 0.44.
- **JSONSchemaBench [A10], M, preprint.** Llama-3.1-8B with a schema that puts "reasoning" before "answer": constrained decoding raised GSM8K from 80.1% to 81.6–83.8%. The paper sums this up as an improvement "up to 4%".
- **CRANE [A14], M, ICML 2025.** Very restrictive grammars reduce what the model can express. Letting it reason freely before the constrained answer gained up to 10 points on GSM-Symbolic and FOLIO with open models.
- **BAML's schema-aligned parsing [A13], V, 2024-07-29.** On the Berkeley function-calling benchmark (1,000 items per model), its lenient parser scored 91.7–94.4% against 19.8–87.5% for native function calling. This predates today's strict modes.

**What this means:** constraining does not hurt when the prompt describes the schema and the reasoning or evidence comes before the answer. With Anthropic this can also happen outside the JSON: its "Grammars apply only to Claude's direct output", not to its thinking [A3]. All of this evidence is from English math, symbolic and classification tasks; none of it is Farsi extraction.

### A.3 Retrying with the validation error

**How the libraries do it:**
- **Instructor [A16]** (source code as of 2026-09):
  - Tool mode appends the failed reply, then `"Validation Error found:\n{exception}\nRecall the function correctly, fix the errors"`.
  - JSON mode sends "Correct your JSON ONLY RESPONSE, based on the following errors:".
  - `max_retries` counts attempts after the first; the default is 3 in the v2 `client.create` and 1 in the patched `create`.
  - Validators receive `context`, and the docs show one that rejects a quote not found in the source text.
- **Pydantic AI [A17]:**
  - A `ModelRetry` from an output validator, or a validation error, becomes the message "N validation error(s): …json…" followed by "Fix the errors and try again."
  - The output retry budget "defaults to 1".
  - Issue #7875 (2026-08-29, P) reports that every failed attempt stays in the conversation, so token cost grows with each retry [A20].
- **Vercel AI SDK 7 [A18]:**
  - `generateText` with `Output.object` throws `AI_NoObjectGeneratedError` (carrying the text, response, usage and cause); it does not re-ask.
  - `generateObject` was deprecated in version 6. Its version 5 hook `experimental_repairText({text, error})` received JSON-parse or type-validation errors.
  - Invalid tool calls go back to the model in the next step, or through `repairToolCall`.
  - `maxRetries` ("Default: 2") retries failed API calls, not invalid output.
- **LangChain [A19]:**
  - Version 1's `ToolStrategy` has `handle_errors` on by default and answers with "Error: Failed to parse structured output … Please fix your mistakes."
  - The legacy `RetryWithErrorOutputParser` resends the prompt, the completion and "Details: {error}"; `max_retries` is 1.
  - `OutputFixingParser` sends only the format instructions, the completion and the error, not the original input.
  - LangChain's own example "fixes" a 10/10 rating by returning 5 to pass the `le=5` rule. The retry satisfied the validator by changing the value.

**Measurements:**
- **PARSE [A21], M, EMNLP 2025 Industry.** Models: Claude 3.5/3.7 Sonnet, Claude 3.5 Haiku, Llama 4 Maverick, DeepSeek-R1.
  - Reflection with guardrails reduced "extraction errors by 92% within the first retry" compared with a plain re-prompt.
  - Rewriting the schema's descriptions and patterns gave up to 64.7% higher accuracy on the SWDE web-data set.
  - Latency was about 2–4× higher.
- **VeriHarness [A22], M, preprint 2026-07.** Qwen2.5-Coder-14B and Llama-3.1-8B, 50 paired TextWorld games.
  - Feedback naming the failure location, the observed value and the admissible alternatives raised success by 44 and 42 points.
  - "Ablations locate most of the gain in the admissible alternatives."
  - JSON versus prose feedback made no difference.
- **Box AI [A23], P, 2025-10, CUAD contracts.** One retry that includes the values already extracted: F1 0.80 → 0.81 and 0.82 → 0.84.
- **Huang et al. [A24], M, ICLR 2024.** Without external feedback, "LLMs struggle to self-correct their responses".
- **Gap:** how often one re-ask fixes a schema-invalid output under current strict modes remains UNVERIFIED.

### A.4 Schema design: what the evidence supports

- **Field descriptions work as instructions.**
  - PARSE's schema rewriting improved accuracy [A21, M].
  - In Instructor's test, renaming a field from `final_choice` to `answer` moved accuracy from 4.5% to 95% [A15, V].
  - Azure says "Language mismatches can significantly reduce accuracy." [A31, O]
- **Prefer enums to free text.**
  - JSON mode improved classification in Tam et al. [A11, M].
  - Anthropic's capitalization caveat applies: "Compare enum values case-insensitively" [A3].
- **Give an explicit "not stated" option.**
  - OpenAI: forcing a schema "can result in hallucinations if the input is completely unrelated to the schema" [A2, O].
  - OpenAI's SimpleQA numbers: gpt-5-thinking-mini abstained 52% with 26% errors, against 1% and 75% for o4-mini [A32, V].
  - Kadavath et al.: adding "none of the above" "reduces accuracy and calibration significantly with our models" [B3, M, 2022 models]. So measure the "not stated" class separately.
- **Put reasoning or evidence before the answer.**
  - Tam et al. [A11, M] and CRANE [A14, M] support it.
  - In Instructor's test on 200 GSM8K problems with gpt-4o-mini, a `chain_of_thought` field scored 92–94% against 33–33.5% without one [A15, V].
  - All of this is on reasoning tasks; for extraction the equivalent is an evidence field.
- **Flat schemas:** no evidence on accuracy was found. Anthropic says to "Flatten structures where possible" only because of its grammar limits [A3, O].
- **A catalogue too large for an enum:**
  - OpenAI allows at most 1,000 enum values [A2]; Anthropic has grammar-size limits [A3].
  - Choosing among retrieved candidates beat pairwise matching by 16.02% F1 on average, but position bias remains [A28, M, COLING 2025].
  - The best prompt differs by model and dataset [A29, M, EDBT 2025].
- **Ground each value in a quote from the source.**
  - LangExtract computes character offsets in code (exact match with difflib, then fuzzy matching at a 0.75 threshold). "extractions that cannot be located in the source text will have char_interval = None" [A25, O]. It also warns that models can copy values from the few-shot examples.
  - Anthropic advises to "extract word-for-word quotes first" [A26, O].
  - In Anthropic's 2023 long-context test, quotes in a scratchpad helped "in all head-to-head comparisons"; Claude 2 went from 0.939 to 0.961 [A27, V].

### A.5 Design rules

**CS-45, the AI layer**
1. One versioned zod schema per step is the single source. Derive each provider's schema by stripping what that provider cannot enforce, and validate every reply against the full zod schema before storing anything [A2, A3, A8, A9].
2. Use each provider's strict mode through Metis, with an adapter ready for Gemini's `responseFormat`. Use DeepSeek only in JSON mode with the schema and an example in the prompt, and treat empty content as a failure [A1–A4, A6, A8, A30].
3. Keep one portable schema profile:
   - root is an object, every field required, `additionalProperties: false`, no recursion;
   - absence written as enum values (`not_stated`, `unclear`) rather than `null` unions;
   - enum values unique regardless of capitalization, and compared that way [A2, A3].
4. Record one outcome per call: ok, invalid, refusal, truncated, empty or provider error. Only an invalid output is re-asked [A1–A3, A30].
5. Order each group of fields as evidence, then value, then note, and keep them all required so Anthropic does not reorder them [A2, A3, A6, A11].
6. Keep schemas stable and warm them at deploy time, because the first call per schema pays the compile cost [A1, A3].
7. Re-ask at most once. Send:
   - the original input and the invalid output;
   - where it failed, the observed value and the admissible values;
   - a fixed context, never the accumulated history.

   After that, send the item to review, and require a changed value to pass the grounding check again [A16–A24].
8. The cache key must include the prompt, schema, provider and model versions. Anthropic's output "will not be fully deterministic" even at temperature 0, and newer Claude models reject any temperature other than 1 [B14].
9. Add rules across fields in code, because schema-valid is not the same as correct [A1, A9].

**CS-52, extraction**
1. For each fact, store an evidence quote and an enum value that includes `not_stated`.
   - Code normalizes the text (ی/ي, ک/ك, zero-width non-joiners, digits) and aligns the quote to the listing, exactly and then fuzzily.
   - A value whose quote cannot be found goes to review and is never stored [A25–A27, A16].
2. Paint, body, chassis, accident and price type are closed enums with `not_stated` and `other`. Descriptions carry the glossary's Farsi terms; test descriptions with and without them on the CS-48 set [A11, A21, A31, A15].
3. Code parses what the source already structures; the model reads only the free text [A31].
4. A/B-test evidence-first ordering with a paired comparison, because it is proven only on reasoning tasks [A11, A14, A15, C10].

**CS-48, labelled set and harness**
1. Log per item: number of attempts, error class, whether the re-ask fixed it, and whether the fixed value was grounded. This fills the measurement gap [A21, A22].
2. Include listings where each fact is not stated, plus unrelated inputs, to catch forced values [A2, A32].
3. Evaluate a schema change the way you evaluate a prompt change [A15].

**Other steps**
- CS-50: retrieve the top candidates in code, offer them as a per-request enum of IDs plus `unmatched`, and measure `unmatched` precision and sensitivity to candidate order [A2, A28, B3].
- CS-62: build the query-understanding schema from the filter UI's own zod schema, and require each "unrecognised" term to be a substring of the query [A2, A25].

---

## B. Confidence and review thresholds

### B.1 Stated confidence (all measured)
- **Xiong et al. [B1], ICLR 2024.** GPT-3, GPT-3.5, GPT-4, Vicuna, LLaMA 2.
  - Models are overconfident; their values "predominantly fall within the 80% to 100% range and are typically in multiples of 5".
  - Sampling several answers and comparing them helps predict failures.
- **Tian et al. [B2], EMNLP 2023.** ChatGPT, GPT-4 and Claude as of 2023: stated confidence was better calibrated than token probabilities, often halving calibration error in relative terms.
- **Kadavath et al. [B3], 2022, Anthropic models.** Calibrated on lettered multiple choice; "none of the above" hurts; self-evaluation improves after seeing several of the model's own samples.
- **SimpleQA [B4], V, 2024.** GPT-4o and o1: "models consistently overstate their confidence". How often an answer repeats over 100 samples is better calibrated.
- **Newer work:**
  - Reliability "strongly depends on how the model is asked" [B5, preprint].
  - Which signal wins flips with how you measure it [B6, 2026, 7–8B models].
  - Larger reasoning budgets worsen calibration (Gemini 2.5 Pro, Claude 4) [B7, ICML 2025 workshop].
  - For grading tasks, stated confidence with an "overconfidence advisory" beat token probabilities on post-2025 flagships (GPT-5.2/5.4, Sonnet 4.5/4.6, Gemini 3.1 Pro) [B8, preprint 2026-09].
- **ExtractConf [B9], IJCAI-ECAI 2026 workshop.** GPT-4o on 55-field invoices.
  - Average token probability "degrades to an all-positive classifier at any practical threshold".
  - Two structurally different extraction calls, combined with OCR and layout signals, reached AUC 0.928 and 99.1% accuracy in the top confidence band.
  - Numeric fields were calibrated; free-text fields were overconfident.

### B.2 Token probabilities
- OpenAI exposes `logprobs` and `top_logprobs` (0–20) [B11], and its cookbook uses them for classification thresholds [B10, O]. The reference says parameter support differs for reasoning models; whether they return logprobs is UNVERIFIED.
- Gemini exposes `responseLogprobs` and `logprobs` (0–20) [A8].
- Anthropic: its Messages API reference has no logprobs parameter [B14], and its OpenAI-compatibility layer marks `logprobs` and `top_logprobs` as "Ignored" [B13].
- Whether Metis passes logprobs through is UNVERIFIED.

### B.3 Agreement across samples or models
- Self-consistency: the share of samples that agree is "highly correlated with accuracy" [B15, ICLR 2023].
- Consistency-based calibration beats after-the-fact methods [B16, AAAI-25].
- SelfCheckGPT: samples contradict each other on hallucinated facts [B17, EMNLP 2023].
- Semantic entropy groups answers by meaning, but "does not help when LLM outputs are systematically bad" [B18, Nature 2024].
- Consequence: an error the model makes every time, such as a colloquial term it always misreads, is invisible to agreement checks; only labelled data finds it.

### B.4 Conformal prediction, selective prediction and abstention
- Conformal methods applied to language models [B19, ICML 2023 workshop; B20, ICLR 2024]: both depend on the calibration data being representative of production.
- Selective classification sets a target error rate and rejects items as needed to meet it [B22, NIPS 2017].
- Angelopoulos and Bates [B21] choose the threshold by scanning a binomial upper confidence bound on the error among accepted items. The guarantee holds with high probability if items are independent and identically distributed.
- Abstention survey [B23, TACL].

### B.5 How document-AI products route to human review
- **AWS A2I with Textract [B24]:** thresholds per key, confidence ranges, missing keys, and "Randomly send a sample of forms to humans for review."
- **Azure Document Intelligence [B25]:** 0.95 means "likely correct 19 out of 20 times"; use it to auto-accept or flag.
- **Azure Content Understanding [A31]:** thresholds of 0.90, 0.80 and 0.70 by field criticality, given as illustrations only: "Determine thresholds experimentally".
- **Google Document AI [B26]:** its human-review service had "Confidence threshold filters" and was deprecated on 2024-01-16.

### B.6 Design rules

**CS-45**
1. Store signals per field instead of one self-reported number: grounding result, agreement with a second call, whether a re-ask was needed, validator flags, provider and model. Keep stated confidence only as one input among them [B1, B4, B9].
2. Do not design around token probabilities [B9, B13, B14, A8].
3. For critical fields (accident, chassis, replaced panels, price type), run a second, structurally different call or a second provider, and send disagreements to review [B9, B15, B17].

**CS-48**
1. Fit thresholds per field on a development split: accept items only while the upper bound on error among them stays at or below the target, report the coverage, then confirm on a separate test split [B21, B22, C2].
2. Label "not stated" and "unmatched" as their own classes [B3, A32, C4].
3. Audit a random sample of auto-accepted fields in production. Items coming back from the review queue are a biased sample of hard cases [B24].

**CS-52**
1. Route to review per field, with thresholds taken from the labelled data.
2. Review a field entirely until its threshold can be certified. Certifying at most 5% error needs 59 accepted items with no errors (computed).
3. Keep numeric and free-text fields on separate thresholds [B9, B25, A31].

**CS-55**
Accept "same listing" only when the model gives the same answer with the pair in both orders; otherwise send it to review [C15, A28].

---

## C. Evaluations and error analysis

### C.1 Guidance
- **Husain [C1], P, 2024-03-29.** Three levels of evaluation; assertions can also drive retries; "You must remove all friction from the process of looking at data."
- **Husain on model graders [C2], P, 2024-10-29, modified 2026-09-01.**
  - Binary pass/fail labels with a written critique.
  - About 100 labelled examples per failure mode; "Below 60 examples, the confidence intervals are often too wide".
  - Report TPR and TNR.
  - Split labels 10–20% train, 40–45% development, 40–45% test, with 30–50 examples of each label per set.
- **Husain's field guide [C3], P, 2025-03-24.** Error analysis took one customer's date handling from 33% to 95%; three issues caused over 60% of problems.
- **Husain and Shankar's FAQ [C4], O.** The page shows published 2026-09-18; its 2025 origin is UNVERIFIED.
  - Open-code at least 30 traces yourself, then work toward about 100.
  - "Axial coding is the most important step."
  - They spent "60-80%" of development time on error analysis and evaluation.
  - One expert as the final judge of quality; CI suites of 100 or more examples that favour code checks.
- **Shankar et al. [C5], M, UIST 2024, qualitative study with 9 practitioners.** Criteria drift: "users need criteria to grade outputs, but grading outputs helps users define criteria".
- **SPADE [C6], M, PVLDB 2024.** Checks generated from prompt changes: 14% fewer checks and 21% fewer false failures.
- **Eugene Yan [C7, C8], O, 2024.** For extraction, use precision, recall and precision–recall curves; "accuracy is too coarse a metric to be useful".
- **Jason Wei [C9], O, 2024.** "at least 1,000 examples" for research benchmarks; grading must be exact.
- **Anthropic, "Demystifying evals for AI agents" [C12], P, 2026-01-09.**
  - Regression suites "should have a nearly 100% pass rate".
  - "20-50 simple tasks drawn from real failures is a great start".
  - Read the transcripts: fixing grading bugs moved one benchmark from 42% to 95%.
- **OpenAI evaluation best practices [C13], O.**
  - Warns about position and length bias in model graders.
  - Its hosted Evals become "read-only" on 2026-10-31 and shut down on 2026-11-30.
- **Anthropic's evaluation docs [C14], O.** Grade with a different model than the one being graded.
- **Karpathy [C17], 2019.** "begin by thoroughly inspecting your data".

### C.2 Biases of model graders (measured)
- **Zheng et al. [C15], NeurIPS 2023.**
  - With the two answers swapped, GPT-4 stayed consistent 65.0% of the time and Claude-v1 only 23.8%.
  - Padding answers with repeated content fooled GPT-3.5 and Claude-v1 91.3% of the time and GPT-4 8.7%.
  - GPT-4 favoured itself by +10%, Claude-v1 by +25%.
  - Fix: judge both orders and only count a win when they agree.
- **Panickssery et al. [C16], NeurIPS 2024.** How well a model recognizes its own text correlates linearly with how much it favours it.

### C.3 Statistics for Carshenas (computed)

| Situation | Result |
|---|---|
| 190 of 200 correct (95%) | 95% interval 91.0–97.3% (Wilson); the normal-approximation interval gives 92.0–98.0% |
| "True accuracy ≥ 95%" with one-sided 95% confidence (exact method) | Needs at least 196 of 200; "≥ 90%" needs at least 188 |
| 200 listings × 12 fields, correlation within a listing 0.1 / 0.3 | Effectively 1,143 / 558 independent items; margin ±1.3 / ±1.8 points |
| Field stated in 10% of listings, 19 of 20 recalled | Recall interval 76–99% |
| Two prompt versions: 8 items only the new one gets right, 2 only the old | Exact McNemar p = 0.109; 6 against 0 gives p = 0.031 |
| Detect a true 3-point paired gain with 80% power | About 430–1,130 items, depending on how many items flip |
| 50 queries, 45 correct | 78.6–95.7% |
| 50 queries, 40 correct | 67.0–88.8% |
| Error among auto-accepted items: 0 of 60 / 0 of 150 wrong | Upper bound 4.9% / 2.0% |
| CS-55 "precision ≥ 95%" | Needs 59 accepted pairs with no false positives, 93 with one |

Supporting points:
- Normal-approximation intervals are too narrow below a few hundred items: "CLT-based methods perform very poorly" [C18, ICML 2025].
- Grouped (clustered) errors can be "over three times" naive standard errors [C11].
- Frontier models tend to get the same questions right and wrong, so comparing them item by item costs nothing extra [C10, C11].
- McNemar's test [C19].

### C.4 Design rules

**CS-48**
1. Build the set from real Tehran listings, stratified so every fact has stated, not-stated and misleading cases. Open-code, then axial-code into a Farsi failure taxonomy (for example negation such as «بدون رنگ», or ambiguous «دور رنگ»), and fix the most frequent first [C3, C4, C17].
2. One expert labels, following a written guide; double-label a subset [C4, C12].
3. Report per field: precision and recall with `not_stated` as its own class, coverage above the threshold, cost, Wilson intervals, and field-level results with intervals widened for clustering by listing [C7, C10, C18].
4. Compare prompt versions item by item: report the counts that only the new or only the old version gets right, and the exact McNemar p-value [C10, C19].
5. Gate CI in three layers [C4, C12, C10, C19]:
   - deterministic checks (schema, grounding, number provenance) on every commit;
   - golden regression items that must all pass;
   - on a prompt, model or schema change, fail on a statistically significant paired loss, and require a human to accept a new report after any smaller drop.
6. Use model graders only for CS-64's tone and faithfulness. Validate them with TPR and TNR on held-out labels, use a different model family, and judge pairs in both orders [C2, C4, C13–C16].
7. Keep the evaluation tooling in the repo [C13].

**Other steps**
- CS-64: a test pulls every number from the explanation (Persian, Arabic-Indic and Latin digits) and requires each to appear in the stored facts [C1, C6].
- CS-62: treat 50 queries as a smoke test, report intervals, and grow the set from logs.

## Decisions for the owner
1. What "≥ 95% field accuracy" means: the point estimate or the lower bound, and per listing or per field. 190 of 200 does not prove 95%.
2. CS-48's rule to fail when accuracy "drops below the last accepted report" would fail on noise. The alternative is rule 5 above: a paired test plus golden items.
3. The cost budget for a second call on critical fields.

## Unverified or not found
- How often one re-ask fixes an invalid output.
- Whether Metis passes through logprobs and Gemini's `responseFormat`.
- Logprobs on OpenAI's reasoning models.
- A peer-review venue for JSONSchemaBench.
- The FAQ's 2025 origin date.
- Any Farsi-specific evidence for any of these patterns.
- Any accuracy evidence for flat schemas.

## Sources

**A. Structured outputs and retries**

| ID | Label | Date | Source |
|---|---|---|---|
| A1 | V | 2024-08-06 | OpenAI, Introducing Structured Outputs in the API. Read from the Wayback capture https://web.archive.org/web/20251221190543/https://openai.com/index/introducing-structured-outputs-in-the-api/ |
| A2 | O | fetched 2026-09-29 | OpenAI Structured Outputs guide, https://developers.openai.com/api/docs/guides/structured-outputs |
| A3 | O | fetched 2026-09-29 | Anthropic structured outputs, https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| A4 | O | entries 2025-11-14 to 2026-01-29 | Anthropic release notes, https://platform.claude.com/docs/en/release-notes/overview; launch post https://claude.com/blog/structured-outputs-on-the-claude-developer-platform |
| A6 | O | 2025-11-05 | Google, Improving Structured Outputs in the Gemini API, https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/ |
| A7 | O | 2025-06-02 capture | Gemini structured output docs, https://web.archive.org/web/20250602051139/https://ai.google.dev/gemini-api/docs/structured-output |
| A8 | O | updated 2026-09-23 | Gemini API reference, https://ai.google.dev/api/generate-content |
| A9 | O | updated 2026-09-23 | Gemini structured output guide, https://ai.google.dev/gemini-api/docs/structured-output |
| A10 | M | 2025-02 | Geng et al., JSONSchemaBench (preprint), https://arxiv.org/abs/2501.10868 |
| A11 | M | 2024 | Tam et al., EMNLP 2024 Industry, https://aclanthology.org/2024.emnlp-industry.91/ |
| A12 | V | 2024-11-20 | dottxt (Kurt), Say What You Mean, https://blog.dottxt.co/say-what-you-mean.html |
| A13 | V | 2024-07-29 | BAML, schema-aligned parsing, https://www.boundaryml.com/blog/schema-aligned-parsing |
| A14 | M | 2025 | CRANE, ICML 2025, https://arxiv.org/abs/2502.09061 |
| A15 | V | 2024-09-26 | Instructor, Bad schemas could break your LLM structured outputs, https://python.useinstructor.com/blog/2024/09/26/bad-schemas-could-break-your-llm-structured-outputs/ |
| A16 | O | docs and code | Instructor re-ask docs https://python.useinstructor.com/concepts/reask_validation/ and source (567-labs/instructor `instructor/v2/…`) |
| A17 | O | docs and code | Pydantic AI https://ai.pydantic.dev/output/ and `pydantic_ai_slim/pydantic_ai/messages.py` |
| A18 | O | docs | AI SDK https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data; version 6 migration guide; https://v5.ai-sdk.dev/docs/reference/ai-sdk-core/generate-object |
| A19 | O | docs and code | LangChain https://docs.langchain.com/oss/python/langchain/structured-output; `langchain_classic/output_parsers/{retry,fix,prompts}.py` |
| A20 | P | 2026-08-29 | Pydantic AI issue #7875, https://github.com/pydantic/pydantic-ai/issues/7875 |
| A21 | M | 2025 | PARSE, EMNLP 2025 Industry, https://arxiv.org/abs/2510.08623 |
| A22 | M | 2026-07 | VeriHarness (preprint), https://arxiv.org/abs/2607.14167 |
| A23 | P | 2025-10 | Box AI, metadata extraction, https://arxiv.org/abs/2510.19334 |
| A24 | M | 2024 | Huang et al., ICLR 2024, https://arxiv.org/abs/2310.01798 |
| A25 | O | 2025-07-30 | LangExtract, https://developers.googleblog.com/en/introducing-langextract-a-gemini-powered-information-extraction-library/ and https://github.com/google/langextract |
| A26 | O | fetched 2026-09-29 | Anthropic, Reduce hallucinations, https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations |
| A27 | V | 2023-09-23 | Anthropic, prompting for long context, https://www.anthropic.com/news/prompting-long-context |
| A28 | M | 2025 | Wang et al., COLING 2025, https://arxiv.org/abs/2405.16884 |
| A29 | M | 2025 | Peeters et al., EDBT 2025, https://arxiv.org/abs/2310.11244 |
| A30 | O | fetched 2026-09-29 | DeepSeek JSON Output, https://api-docs.deepseek.com/guides/json_mode |
| A31 | O | 2026-07-16 | Azure Content Understanding best practices, https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/concepts/best-practices |
| A32 | V | 2025-09-05 | OpenAI, Why language models hallucinate, Wayback capture https://web.archive.org/web/20251229232716/https://openai.com/index/why-language-models-hallucinate/ |

**B. Confidence and review thresholds**

| ID | Label | Date | Source |
|---|---|---|---|
| B1 | M | 2024 | Xiong et al., ICLR 2024, https://arxiv.org/abs/2306.13063 |
| B2 | M | 2023 | Tian et al., EMNLP 2023, https://arxiv.org/abs/2305.14975 |
| B3 | M | 2022 | Kadavath et al., https://arxiv.org/abs/2207.05221 |
| B4 | V | 2024 | SimpleQA, https://arxiv.org/abs/2411.04368 |
| B5 | M | 2024 / 2026 | Yang et al. (preprint), https://arxiv.org/abs/2412.14737 |
| B6 | M | 2026 | Kim & Kang (preprint), https://arxiv.org/abs/2605.27752 |
| B7 | M | 2025 | Lacombe et al., ICML 2025 workshop, https://arxiv.org/abs/2508.15050 |
| B8 | M | 2026-09 | Hsiao (preprint), https://arxiv.org/abs/2609.10996 |
| B9 | M | 2026 | ExtractConf, IJCAI-ECAI 2026 workshop, https://arxiv.org/abs/2606.24420 |
| B10 | O | 2023-12-20 | OpenAI cookbook, Using logprobs, https://cookbook.openai.com/examples/using_logprobs |
| B11 | O | fetched 2026-09-29 | OpenAI API reference, https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create |
| B13 | O | fetched 2026-09-29 | Anthropic OpenAI SDK compatibility, https://platform.claude.com/docs/en/api/openai-sdk |
| B14 | O | fetched 2026-09-29 | Anthropic Messages API reference, https://platform.claude.com/docs/en/api/messages/create |
| B15 | M | 2023 | Wang et al., self-consistency, ICLR 2023, https://arxiv.org/abs/2203.11171 |
| B16 | M | 2025 | Lyu et al., AAAI-25 (Vol. 39 No. 18), https://ojs.aaai.org/index.php/AAAI/article/view/34120 |
| B17 | M | 2023 | SelfCheckGPT, EMNLP 2023, https://arxiv.org/abs/2303.08896 |
| B18 | M | 2024 | Farquhar et al., semantic entropy, Nature 2024, https://www.nature.com/articles/s41586-024-07421-0 |
| B19 | M | 2023 | Kumar et al., ICML 2023 workshop, https://arxiv.org/abs/2305.18404 |
| B20 | M | 2024 | Quach et al., ICLR 2024, https://arxiv.org/abs/2306.10193 |
| B21 | O (method with proof) | 2022 | Angelopoulos & Bates, https://arxiv.org/abs/2107.07511 |
| B22 | M | 2017 | Geifman & El-Yaniv, NIPS 2017, https://arxiv.org/abs/1705.08500 |
| B23 | O | 2025 | Wen et al., abstention survey, TACL, https://arxiv.org/abs/2407.18418 |
| B24 | O | fetched 2026-09-29 | AWS A2I with Textract, https://docs.aws.amazon.com/sagemaker/latest/dg/a2i-textract-task-type.html |
| B25 | O | 2026-04-08 | Azure Document Intelligence, accuracy and confidence, https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/accuracy-confidence |
| B26 | O | updated 2026-09-24; 2023 capture | Google Document AI deprecations https://cloud.google.com/document-ai/docs/hitl and the human-review page as captured https://web.archive.org/web/20230424211158/https://cloud.google.com/document-ai/docs/hitl |

**C. Evaluations and error analysis**

| ID | Label | Date | Source |
|---|---|---|---|
| C1 | P | 2024-03-29 | Husain, Your AI product needs evals, https://hamel.dev/blog/posts/evals/ |
| C2 | P | 2024-10-29 | Husain, LLM-as-a-judge, https://hamel.dev/blog/posts/llm-judge/ |
| C3 | P | 2025-03-24 | Husain, field guide, https://hamel.dev/blog/posts/field-guide/ |
| C4 | O | page 2026-09-18 | Husain & Shankar, evals FAQ, https://hamel.dev/blog/posts/evals-faq/ |
| C5 | M | 2024 | Shankar et al., UIST 2024, https://arxiv.org/abs/2404.12272 |
| C6 | M | 2024 | SPADE, PVLDB 2024, https://www.vldb.org/pvldb/vol17/p4173-shankar.pdf |
| C7 | O | 2024-03 | Yan, task-specific evals, https://eugeneyan.com/writing/evals/ |
| C8 | O | 2024-08 | Yan, LLM evaluators, https://eugeneyan.com/writing/llm-evaluators/ |
| C9 | O | 2024-05-24 | Wei, successful evals, https://www.jasonwei.net/blog/evals |
| C10 | M | 2024 | Miller, Adding Error Bars to Evals, https://arxiv.org/abs/2411.00640 |
| C11 | O | 2024-11-19 | Anthropic, statistical approach to model evals, https://www.anthropic.com/research/statistical-approach-to-model-evals |
| C12 | P | 2026-01-09 | Anthropic, Demystifying evals for AI agents, https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |
| C13 | O | fetched 2026-09-29 | OpenAI evaluation best practices, https://developers.openai.com/api/docs/guides/evaluation-best-practices |
| C14 | O | fetched 2026-09-29 | Anthropic, define success and build evaluations, https://platform.claude.com/docs/en/test-and-evaluate/develop-tests |
| C15 | M | 2023 | Zheng et al., NeurIPS 2023 Datasets and Benchmarks, https://arxiv.org/abs/2306.05685 |
| C16 | M | 2024 | Panickssery et al., NeurIPS 2024, https://arxiv.org/abs/2404.13076 |
| C17 | O | 2019-04-25 | Karpathy, A recipe for training neural networks, https://karpathy.github.io/2019/04/25/recipe/ |
| C18 | M | 2025 | Bowyer et al., ICML 2025 (position paper), https://arxiv.org/abs/2503.01747 |
| C19 | O | fetched 2026-09-29 | statsmodels McNemar, https://www.statsmodels.org/stable/generated/statsmodels.stats.contingency_tables.mcnemar.html |
