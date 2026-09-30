# Prompts and context engineering

Sources: CS-43's note (`docs/research/2026-09-29-prompting-context-engineering-and-agents.md`, sections 1, 2 and 9, patterns 8 and 11 to 18) and its appendices `makers.md`, `science.md`, `agents.md` §5 and `harnesses.md` §5. Marks as in the note: M measured with a published method, V measured by a vendor about its own product, P a practitioner's report, O opinion, L measured in the note's lab.

## What moves results, and what does not

On 2026 models, clever wording barely matters; the task definition, the context, the schema, the checks in code and the model do.

- **Little or nothing (M):** expert personas (162 roles, no gain), tips and threats, politeness, capitals and "CRITICAL" (untested directly; the makers now advise against them because newer models over-react), and "think step by step", which adds little on current models, makes requests 20 to 600% slower and on some tasks costs up to 36 points.
- **A lot:** how much goes into the window (a focused 300-token input beat a 113k-token one for all 18 models tested; instructions spread over turns cost 39%), the format and the example choice (up to 76 points between formats on an older model, 8 to 10 on some tasks for frontier ones), the output schema and its validation in code, and the model. OpenAI measured its own leaner prompts scoring 10 to 15% higher with 41 to 66% fewer tokens (V).
- **So** prompts are tested on data, never judged by eye: freeze one template per version and, when it matters, evaluate two or three paraphrases to know the spread.

## Context engineering

"The delicate art and science of filling the context window with just the right information for the next step" (Karpathy). For Carshenas:

- **The smallest set of high-signal tokens.** A few rules per prompt. Anything code can check (ranges, units, enums, consistency across fields, grounding) moves out of the prompt into a validator: following more than five or six constraints at once breaks down, and the best model managed 68% at 500 instructions.
- **Static first, variable last.** One layout for every step:
  1. the instructions, byte-identical for every call of the version: the task, the rules, the glossary, any examples, the "no authority" rule;
  2. the schema, sent by the route as a parameter (in DeepSeek's JSON mode, in a system message);
  3. the user turn: the variable input, cleaned and escaped as data, then a one-line reminder.

  No date, time, id or input in the prefix: a provider's cache needs an exact prefix, and the schema and settings are part of it. `glossary-prompt.test.ts` proves the prefix is the same bytes on every call.
- **One item per call, stateless.** Never a batch of listings in one conversation: examples from earlier items leak into later ones.
- **Context compiled from durable state.** Build a prompt with named, tested functions over PostgreSQL facts (CS-55 sends two listings' normalised facts and their differing fields, never whole pages), and store the prompt version with each result so it can be replayed.
- **Combine the turns.** A refined search (CS-62) sends the current filters and the newest words, never the chat so far.
- **Show what the model understood**, so the person checks it quickly: CS-62's parsed filters as editable chips.

## Writing the instructions

- **English, with the Persian words verbatim** (pattern 13). English instructions scored higher on Persian data in the older studies and were slightly preferred across 35 languages (M, mixed; nothing tests 2026 frontier models on Persian extraction), and they cost fewer tokens. State the output language. English against Farsi instructions is an A/B test per model, not a belief.
- **The glossary as definitions and decision criteria, with the reason for each distinction.** "Claude is smart enough to generalize from the explanation" (Anthropic, O): «When several are stated, choose the most severe, because the most severe one sets the price.» Keep it as data rendered in a fixed order (`GLOSSARY` in `listing-paint.ts`), so the schema's enum and the words the model reads cannot drift and a new seller's word is a new version. Its English value names come from `docs/product/glossary.md`; its Persian words come from real listings. CS-46 found «لیسه», «آبرنگ» and «پالونی» missing, and every model failed alike where they were.
- **Say what to do** (pattern 14). "Never write negatives" does not hold as a rule: explicit prohibitions are followed well (0.87 to 1.00 on Persian IFEval's purely negative rule), but a prohibition can prime the forbidden topic. Pair each prohibition with the alternative and its reason, and put hard limits in the schema. Keep "not stated" apart from "none" in words and in the enum.
- **No capitals, personas, tips, threats or courtesy formulas.** State a priority order once.
- **Reasoning is a measured setting** (pattern 11): the route's effort or thinking level, starting at none or low for extraction, set per step in `STEP_MODELS`. No "think step by step". Put an evidence field before each value instead of a free "reasoning" field. Never ask Claude's classifier models (Fable 5 and 5.1, Opus 5 and 5.5, Sonnet 5.5; not Haiku 4.5) for reasoning in the answer: they refuse with a billed `reasoning_extraction` refusal.
- **No temperature tuning** (pattern 12). Temperature 0 is not deterministic (1,000 samples gave 80 distinct completions) and the newest Claude, GPT and Gemini models reject or ignore a non-default one. Reproducibility comes from the answer cache, pinned models and evaluations repeated three times.
- **Zero-shot first** (pattern 15). Add three to five diverse, balanced, checked examples of hard cases only when the labelled set shows a gain; never near-duplicates of real inputs, and never items from the evaluation set. Examples helped attribute extraction (GPT-4o F1 68.8 to 78.6) and can hurt reasoning models, and the makers disagree, so it is measured per model.
- **No self-check without a signal.** Asking the model to check itself lowered accuracy (M); a re-ask driven by a failed check in code helps (`references/structured-output.md`).
- **Automatic prompt optimisation later.** Once CS-48's baseline exists, MIPROv2 or GEPA on the development split can beat a hand-written prompt (M); a person reviews the result before it ships.

## Persian text

- **Tokens depend on the family** (L1, the same texts through Metis, Farsi against English): Gemini 3.1 Flash-Lite 1.06 to 1.13 times, GPT-5.6-luna 1.27 to 1.33, DeepSeek V4 Flash 1.45 to 1.59, Claude Haiku 4.5 2.25 to 2.58. The longest listing was 335 tokens on Claude and 158 on GPT, so Claude's input cost about ten times GPT's, not five as the price list suggests. Compare models per listing, never per million tokens.
- **A cleaned copy for the model and the checks** (pattern 17; `modelCopy` in `listing-text.ts`): NFC, Persian ی and ک for the Arabic letters keyboards type (Arabic ي and ك add 11 to 17% tokens on GPT), Latin digits, the zero-width non-joiner kept, other zero-width and direction marks and Unicode tag characters dropped, the length capped. The raw text stays in the snapshot. Evidence is compared against the same copy the model read. What normalising does to accuracy is untested: A/B it on the labelled set.
- **Source files:** write the zero-width non-joiner as `^` with `fa()`, or build it from its code point; never type it (AGENTS.md, Gotchas).

## Versions and snapshots

- The prompt version is a content hash of the instructions, the schema, the checks' version and the output budget (`promptVersion` in `task.ts`); the answer cache adds the model and its options. A changed word is a new version, never a stale cache hit.
- Change `checks.version` whenever `checks.run` changes: an answer stored under the old version would fail the new check on every call and be asked again forever.
- Snapshot the rendered prompt (`t.assert.snapshot`, like `glossary-prompt.test.ts`), refresh with `test:update-snapshots`, and read the diff before committing. A family-specific prompt variant is added only when the labelled set shows the default losing on that family; the harnesses that keep ten variants show no evidence they help.

## Worked example 1: a versioned prompt that carries the glossary

`packages/ai/src/examples/listing-paint.ts` and `glossary-prompt.test.ts`:

1. `PAINT` and `PRICE_TERMS` are the schema's enums; `GLOSSARY` gives every value but `not_stated` its meaning and the sellers' words, and TypeScript refuses a value without its words.
2. `instructionsFrom(GLOSSARY)` renders the English instructions: the task, evidence before value, `not_stated` with its reason, the glossary in a fixed order, the "no authority" rule. `INSTRUCTIONS` is the stable prefix.
3. `renderListing` is the variable part: the cleaned title and description escaped as data inside tags, then the reminder.
4. The tests snapshot the rendered prompt, show every glossary word reaching the model, show that adding «آبرنگ» changes the prompt version, and prove that six listings send six requests whose instructions, schema and settings are the same bytes, with the listing as the one user turn.

## Popular claims, checked (CS-43, section 2)

| # | Claim | Verdict | What Carshenas does |
|---|---|---|---|
| 1 | Never write negative instructions | Mixed | pair each prohibition with the alternative and its reason; hard limits in the schema; oversample negated phrasing in the labelled set |
| 2 | Few-shot examples always help | Contradicted | zero-shot first, then 3 to 5 checked examples of hard cases if the set shows a gain |
| 3 | An expert persona helps | Contradicted | no persona; spend the tokens on definitions |
| 4 | Tips, threats or emotional appeals help | Contradicted | never |
| 5 | Be polite, or rude | Mixed, small | neutral, direct wording |
| 6 | CAPITALS and CRITICAL make it obey | Untested; makers advise against | no capitals; the priority order stated once |
| 7 | Always ask it to think step by step | Contradicted | the effort setting, measured on and off; an evidence field |
| 8 | Prompt format does not matter | Contradicted | one frozen template per version; paraphrases evaluated when it matters |
| 9 | Forcing JSON hurts reasoning | Mixed, mostly contradicted when done well | native strict schemas, evidence before value |
| 10 | Long context is free | Contradicted | one listing per call, few rules, filters plus new words instead of chat history |
| 11 | Temperature 0 is deterministic | Contradicted | the cache, pinned models, repeated evaluations |
| 12 | Asking the model to check itself helps | Mixed | re-ask only on a failed check in code, once, with the error |
| 13 | Automatic prompt optimisation beats hand-written | Supported, given a metric and data | after CS-48's baseline, on the development split, reviewed by hand |
| 14 | Write instructions in the data's language | Mixed, model-dependent | English with Persian terms verbatim; A/B per model |
| 15 | Persian costs far more tokens | Supported, narrowed | budget per family; compare per listing |
| 16 | Normalise Persian before the model | Untested for accuracy | a cleaned copy for the model and the checks, raw text kept; A/B it |
| 17 | More instructions are safer | Contradicted | few rules; checks move into validators |
| 18 | Strict structured output means correct output | Contradicted | validate values in code; measure value accuracy, not validity |
| 19 | Stated confidence shows when it is wrong | Contradicted | thresholds from signals fitted on labels |
| 20 | Delimiters or a detector stop prompt injection | Contradicted | limit what the model can change, check in code, measure attack success |
