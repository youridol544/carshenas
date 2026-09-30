# Structured outputs, checks and the re-ask

Sources: CS-43's note (sections 3 and 4, patterns 3 to 7 and 20) and its appendix `structured.md` (A.1 to A.5, B.1 to B.6); ADR-0021 point 2.3; `packages/ai/src/call.ts`, the layer's checked call; the learnings of 2026-09-29 on the AI SDK.

## What each route guarantees

Strict structured output guarantees the shape, not the truth. OpenAI measured 100% schema adherence in strict mode against under 40% before it, and still warns that answers "can contain mistakes"; the best exact-value accuracy across 21 models was 83% (M). So every value is checked, and accuracy is measured on values, not on validity.

- **OpenAI** (Chat Completions, `response_format` json_schema strict). A refusal arrives in `message.refusal` with a normal finish reason, which the SDK's OpenAI package drops; the layer reads it from the raw body.
- **Anthropic** (Messages, `output_config.format`, set explicitly by the layer for every Claude id): at most 24 optional and 16 union-typed parameters per request, no numeric or length constraints, required properties come out first, and a refusal is HTTP 200 with `stop_reason: "refusal"`.
- **Gemini** (`generateContent` with `responseJsonSchema`) keeps the schema's key order. Google now marks `responseJsonSchema` deprecated in favour of `responseFormat`; CS-45 measured both through Metis.
- **DeepSeek** has JSON mode only, the schema in a system message, and "may occasionally return empty content": an `empty` outcome.

## The portable schema profile (pattern 3)

One zod schema per task is the single source; the route's schema is derived from it and every answer is validated against the full zod schema again.

- The root is a strict object (`z.strictObject`), every field required, no extra properties, no recursion.
- Absence is an enum value (`not_stated`, `unclear`), never a `null` union, which Claude's strict mode limits and which blurs "not stated" with "none".
- Closed enums over free text. Values unique regardless of capitalisation.
- Descriptions are instructions: the model reads them, and renaming a field changed one test's accuracy from 4.5% to 95% (V).
- Flatten where possible; a catalogue too large for an enum (OpenAI allows 1,000 values) becomes candidates retrieved by code and offered as a per-request list with a "none of these" value (CS-50, CS-55).

## Evidence before value (pattern 4)

Each fact is a pair: `<fact>_evidence`, the shortest phrase of the listing that states it, copied exactly, then `<fact>`, the value. Required fields come out in schema order, so the model commits to a quote before it picks a label, which is what helped when reasoning came before the answer (M). Code aligns the quote with the text the model read, exactly and then fuzzily after normalising if CS-52 measures that it helps; a value whose quote cannot be found is fed back once and then goes to review. For CS-64's explanations, the same idea: the model chooses and orders facts, and code renders them.

## Checks in code

`checks: { version, run }` states what the schema cannot:

- **What belongs:** grounding (evidence present when the value is stated, absent when it is `not_stated`, found in the text the model read, and found outside any sentence addressed to an AI); rules across fields; for explanations, no digit or Persian number word outside a placeholder.
- **What does not:** a disagreement with a field code parsed from the site (a price, a year, a mileage). A re-ask invites the model to change an honest reading until the check passes; LangChain's own example "fixes" a 10 out of 10 rating by answering 5 to satisfy `le=5`. So the answer is stored and held for a person (`nextStep` in `listing-paint.ts`, `reviewFirst`), and the disagreement is a data-inconsistency flag (CS-52).
- **How a problem is worded:** `{ path, message }`, the message naming the value seen and what is admissible: «is "بی رنگ", which does not appear in the listing: copy the words exactly as the listing writes them, or set paint_evidence to "" and paint to "not_stated".» Feedback that names the failing field, the observed value and the admissible alternatives raised repair success by 42 to 44 points (M), most of it from the alternatives.
- **Bump `version` whenever `run` changes** (it is part of the prompt version and so of every cache key).

## The re-ask (pattern 5)

The layer re-asks at most once (`maxReasks` 0 or 1, by the owner's decision of 2026-09-29):

- the second request is a fixed context, never the history: the input, the answer that failed, and "Your answer did not pass validation:" with one `- path: message` line per problem, then "Answer again with the complete JSON object.";
- the second answer passes the same schema and the same checks, so a changed value is grounded again;
- the same answer twice stops the loop;
- what still fails is `invalid`, with its problems, for review. Guarded reflection cut extraction errors by 92% within the first retry (M); a model asked to check itself with no outside signal got worse (M).

Deterministic repair comes before rejecting, and is logged: Persian digits to Latin, "5" to 5 in code. A meaning is never "fixed" in code.

## Outcomes and errors (pattern 6)

| Result | Means | The caller |
|---|---|---|
| `ok` with `value` and `answerId` | valid and checked, stored in `ai_answer` | stores the value, linked to the answer's row |
| `invalid` with `problems` | failed the schema or the checks after the re-ask | review, never the value |
| `refusal` | the provider refused (Claude's `stop_reason`, OpenAI's `refusal`, a content filter) | review; refusals are billed |
| `truncated` | the output budget ran out (`finishReason: length`) | review, and raise `maxOutputTokens` if it recurs: reasoning models spend the budget before the answer |
| `empty` | no text (DeepSeek's empty content, a reasoning model with no room left) | review |
| throws `ModelCallError` | no answer at all | `retryable` (`timeout`, `aborted`, `rate_limited`, `unavailable`): let it propagate, the queue retries; `unauthorized`, `no_credit`, `rejected`: a person |

The layer reads the finish reason and OpenAI's refusal field before the output: with no text, the SDK's `output` getter throws. The SDK's own retries are off (`maxRetries: 0`): the queue retries in the worker, and the web path has one attempt within its deadline.

## Confidence and review thresholds (pattern 20)

- A model's stated confidence does not tell right from wrong: stated values cluster at 80 to 100, and in field extraction token probabilities (AUC 0.705), stated confidence (0.692) and agreement across five samples (0.744, at five times the cost) all separated them poorly (M). Every wrong answer in CS-42's sample said 1.0.
- What worked: two structurally different calls plus signals outside the model reached AUC 0.928 in the same study. For Carshenas the signals are grounding, agreement with parsed fields, whether a re-ask was needed, and a second call on critical fields (accident, chassis, replaced panels, price type) if CS-48 budgets it.
- Token probabilities are not portable (Anthropic exposes none, Metis's pass-through is unverified), so nothing is designed around them.
- Thresholds are set per field on the development split: accept items only while an upper confidence bound on the error among them stays at or below the target, report the coverage, confirm on the test split. Certifying at most 5% error needs 59 accepted items with none wrong. Audit a random sample of accepted items in production; the review queue is a biased sample of hard cases.

## Worked example 2: a structured extraction re-asked on validation errors

`packages/ai/src/examples/listing-paint.ts` (`ListingPaint`, `checkListingPaint`, `nextStep`) and `reask.test.ts`:

1. A value outside the enum (`"unpainted"`): the second request carries the listing, the failed answer and «- paint: Invalid option: expected one of "none"|"spots"|"partial"|"full"|"not_stated"; received "unpainted"»; the second answer is stored and `nextStep` says `store`.
2. Evidence retyped with a space for the non-joiner: valid for the schema, refused by the check, fed back naming the field and the words sent.
3. An answer still invalid after the re-ask: two requests and no more, nothing cached, `nextStep` says `review` with the problems, and the log line is a warning with only the failing paths.
4. The same question again: answered from the cache, no request, a cost of 0 on the line.
