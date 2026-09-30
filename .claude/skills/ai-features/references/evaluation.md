# Evaluations and the harness

Sources: CS-43's note (sections 4 and 5, patterns 19 to 21, 27 and 28, "Decisions and follow-ups" 3 and 4) and its appendix `structured.md` (B.6, C.1 to C.4); CS-46's bake-off (`docs/research/2026-09-30-model-per-ai-step.md`, `packages/ai/scripts/bakeoff/`); CS-48's criteria. The evaluation is the product: Torob reports its own AI features as coverage and accuracy on a hand-checked set, and AGENTS.md ships no AI step without one.

## Error analysis comes first

- Read at least 30 real outputs yourself and write what went wrong in each (open coding); group the notes into failure types (axial coding, "the most important step"); fix the most frequent first. Three issues caused over 60% of the problems in one practitioner's case (P). Practitioners who report evaluations spend 60 to 80% of their time here.
- The criteria come after reading outputs: graders refine them by grading (criteria drift, M). Write the labelling guide from the error analysis, then label.
- Look at inputs and outputs every day while a step is being built; "become one with the data" (Karpathy).

## The labelled set

- **Real items from the product's own population**, Tehran's Divar listings first (CS-48: at least 200, from a release when CS-49 exists, personal data removed, snapshot references kept); CS-54 adds Bama's. Synthetic items only where real ones cannot exist yet (CS-46's written searches), and marked so.
- **Stratified so every field has stated, not-stated and misleading cases.** Oversample negated phrasing («بدون رنگ», «تصادف نداشته»), the readings models get wrong («دور رنگ میخاد» is a body that needs paint, not a painted one: eight of nine models got it wrong in CS-46's first run), and the long tail. CS-46 found no listing mentioning ride-hailing and none saying nothing was replaced, so CS-48 samples them.
- **Three states per fact** (pattern 19): stated, not stated, inferred; `not_stated` is scored as a class of its own, because forcing a value where the text says nothing is the error a strict schema invites.
- **Injection cases from the start** (`references/injection.md`): witness values at the start, middle and end, and benign imperatives.
- **One expert labels, from a written guide**, before any model sees the item; a subset is labelled twice. Every label changed after a run is listed with its reason (CS-46's `scripts/bakeoff/data/README.md` is the pattern: where a careful reader can read the text two ways, the label accepts both).
- **A development split and a test split.** Tune prompts, examples and thresholds on the development split only; the test split never tunes anything, or it stops measuring anything.

## What a report carries

| Measure | Why |
|---|---|
| prompt version, model with its settings, labelled set and its cut | a number without them cannot be compared or reproduced |
| outcomes: ok, invalid, refusal, truncated, empty, error | a call without a valid answer counts as wrong on every field, since the product stores nothing for it |
| per field: accuracy with its 95% Wilson interval, precision and recall per value with `not_stated` as its own class | accuracy alone is too coarse for extraction; recall is the weak side on car ads (GPT-4o 54.7 in one study, M) |
| items with every field right | ten fields at 95% each, independent, leave about 60% of listings fully right |
| coverage above each field's review threshold | what share goes out without a person |
| attacks: k of n witness values reported | never "robust" (`references/injection.md`) |
| cost per 1,000 items at Metis's list price, tokens, latency at the median and the 95th percentile | cost beside accuracy, always (`references/cost.md`) |
| the misses, item by item, for a person to read | the next round of error analysis |

`formatReport` in `evaluation.ts` prints four lines of this, short enough for a terminal or a task's notes.

## What a set of this size can show (computed; CS-43, section 5)

| Situation | Result |
|---|---|
| 190 of 200 right on a field | 95.0%, 95% interval 91.0 to 97.3% (Wilson); normal-approximation intervals are too narrow below a few hundred items |
| claiming "at least 95%" with one-sided 95% confidence | needs 196 of 200 |
| detecting a true 3-point gain between two prompt versions, paired, 80% power | about 430 to 1,130 items |
| 50 searches, 45 right | 78.6 to 95.7% |
| CS-55's "precision at least 95%" | 59 accepted pairs with no false merge, or 93 with one |

Errors cluster by listing, which widens field-level intervals (two fields of one listing are not independent). So 200 listings can show "about 95%", not "at least 95%": what "95% field accuracy" means (the point estimate or the lower bound, per field or per listing) is CS-48's decision, as is the regression rule below.

## Comparing two versions

- Compare item by item on the same set: count the item-fields only the new version gets right and only the old one gets right, and test the split with the exact McNemar test (`mcnemarExact`, `compare`): 8 against 2 is p = 0.109, not a gain; 6 against 0 is p = 0.031. Frontier models tend to get the same items right and wrong, so pairing costs nothing and sees more.
- Models are not deterministic: repeat a run three times before believing a small difference, and report pass^k (all k attempts right) where a step must be consistent.
- **The gate, in three layers** (pattern 28):
  1. deterministic checks on every commit (`pnpm check`: schemas, grounding, snapshots, the number checks, the examples);
  2. golden items that must all pass (regression suites should pass "nearly 100%"; "20 to 50 simple tasks drawn from real failures is a great start");
  3. on a prompt, glossary, schema, checks or model change, a FAIL on a statistically significant paired loss, and a person's acceptance of any smaller drop.

  CS-48's criterion as first written ("fails when accuracy drops below the last accepted report") would fail on noise (CS-43, decision 4); the alternative above is CS-43's recommendation, and the choice is CS-48's.

## Model judges

Only where code cannot check, which in Carshenas is CS-64's tone and faithfulness. A judge is itself evaluated: its agreement with held-out human labels (true and false positive rates), a different family from the model judged (models favour their own text), both orders for pairwise judgements (GPT-4 stayed consistent in 65% of swapped pairs). GPT-4o agreed with ground truth at only κ = 0.54 as a Persian judge, so a Persian judge needs its own labels.

## The harness

- **Today:** CS-46's bake-off, `pnpm --filter @carshenas/ai bakeoff -- --step <step>`, runs candidates through the layer on `scripts/bakeoff/data/` and writes every call with its answer to `packages/ai/results/`; `-- --score <files>` scores saved runs again against today's labels with no model call. The runs its note quotes are in `docs/research/2026-09-30-model-per-ai-step/evidence/`.
- **CS-48** builds the product's harness: one command that runs the parser and the model on the labelled set and reports the table above, each report stored with its prompt version, labels entered in the superadmin section and exported to the repository file, and re-runs of unchanged inputs costing no model call because answers are cached by input hash (example 3 shows the mechanism).
- **The command an agent runs** prints briefly: a few lines, FAIL first on the line that says why, so a person or grep finds it.

## Worked example 3: an evaluation run on a labelled set

`packages/ai/src/examples/evaluation.ts`, `labelled-listings.ts` and `evaluation.test.ts`, with a stub model that misreads L4's repaint as paint:

1. `wilson(190, 200)` and `mcnemarExact(8, 2)`, `(6, 0)` reproduce CS-43's computed values.
2. `runEvaluation` asks the task about six labelled listings through the layer: paint 5 of 6 (43.6 to 97.0%), `full`'s precision halved and `not_stated`'s recall 0, all fields right 5 of 6, 0 of 1 injected values reported, US$0.0057 for six requests.
3. The same run again through the same layer: 0 requests, US$0, the same scores.
4. A second prompt version whose glossary says how to read a body that needs paint fixes L4: `compare` reports "no significant difference ... p = 1.000". One item fixed is not yet a proven gain; the set has to grow before small gains can be shown.
5. Six items right before and wrong after: "FAIL: worse ... p = 0.031".
