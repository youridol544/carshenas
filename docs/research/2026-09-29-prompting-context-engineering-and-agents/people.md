# Pass 2: what the field's most credible builders say, mapped to Carshenas (CS-43)

Researched on 2026-09-29. Everything cited was fetched; copies were kept in the research session's scratchpad (not kept). The main note re-checked the claims it leans on.

## 0. Method and caveats

- **Credibility marks**, used after every source:
  - **M**: measured with a published method ("peer-reviewed" when it is).
  - **V**: a vendor measuring its own product.
  - **P**: a practitioner reporting from production.
  - **O**: opinion or guidance without data.
- **YouTube blocked transcripts from this network** ("Sign in to confirm that you're not a bot"). The block was not worked around. For each talk this pass used the official page plus one of these:
  - **Official transcripts:** the Dwarkesh interviews.
  - **The speaker's own material:**
    - Karpathy's YC slides: the Keynote file linked in the YC video description, "Slides provided by Andrej", whose text was extracted.
    - Hyung Won Chung's MIT slides, exported from his Google Slides link.
    - Karpathy's own video descriptions and announcement posts.
  - **Third-party transcripts, labelled as such:**
    - Singju Post for the YC talk.
    - A Readwise copy of the captions for State of GPT.
    - pickscribe/ytscribe for the Anthropic roundtable.
- **Quotes in the Sequoia Ascent 2026 post are not verbatim.** Karpathy says it is "AI generated content", made with "Codex 5.5". It is an edited transcript and is marked that way.
- **Karpathy joined Anthropic on 2026-05-19** (https://x.com/karpathy/status/2056753169888334312). His praise of Claude Code dates from December 2025, before that. Anthropic, Vercel, Manus and .txt sources are vendors.
- **Numbers marked "(computed)" are this pass's arithmetic, not a source's.**

## 1. Principles they agree on

**P1. Look at the data and the outputs before building metrics, and keep looking.**
- Opinion and practice:
  - Jason Wei (2023): "you can learn a lot by manually looking at data" [O].
  - Anthropic roundtable (2024), a panelist, probably Zack Witten (the transcript has no speaker labels): "the equivalent for prompting is look at the model outputs" [O/P].
  - Chip Huyen (2025): "staring at data for just 15 minutes usually gives me some insight that could save me hours of headaches" [P].
  - Yan et al. (2024): "Look at samples of LLM inputs and outputs every day" [P].
  - Andrew Ng (2025): disciplined evals and error analysis are "the single biggest predictor of how rapidly a team makes progress building an AI agent" [O].
  - Husain and Shankar (2026): "Start with error analysis, not infrastructure." They spent "60-80% of our development time on error analysis and evaluation" [P].
  - Anthropic (2026): "Read the transcripts!" [O, vendor].
- Measured:
  - Shankar et al., UIST '24 [M, peer-reviewed], found "criteria drift": "users need criteria to grade outputs, but grading outputs helps users define criteria."
- For Carshenas:
  - Read at least 30 real CS-52 extractions and write down how they fail before freezing the labelling rubric.
  - Do the same for CS-55 borderline pairs and CS-62 real queries.
  - Keep reading a sample of production output every week, because Farsi phrasing will keep moving the criteria.

**P2. Choose models and prompts with your own eval, not leaderboards. Re-run it on every change and pin model versions.**
- Opinion and practice:
  - Ilya Sutskever (2025) describes "this disconnect between eval performance and actual real-world performance" and says labs "take inspiration from the evals" [O].
  - Karpathy (2025): "Training on the test set is a new art form." [O]
  - Chip Huyen, book summary: "Public benchmarks can help you weed out bad models, but won't help you find the best models for your applications." [O]
  - Yan et al.: prompt migration across models is painful (Voiceflow lost 10% after a model version change; second-hand example). They say "Version and pin your models" and run a shadow pipeline on newer models [P].
- For Carshenas:
  - Run the same labelled set on each Metis AI candidate, through the provider's native structured-output route.
  - Record accuracy, cost and latency for each; pin the model IDs.
  - Treat any provider model update as a migration and re-run the eval (CS-48).

**P3. Build the eval set from the real distribution, and know its error bars.** It needs the long tail, edge cases, cases where the right answer is "not stated", a rubric two experts would agree on, and a held-out test split.
- Opinion and practice:
  - Amanda Askell (2024): "I don't trust the model ever and then I just hammer on it." She also said "a really well-constructed set [of] a few hundred prompts … can be much more signal than thousands that aren't as well-crafted" [O]. On prompts applied to many cases: "What you actually want to do is find the cases where it's unusual."
  - David Hershey (speaker inferred from context) on real user input: "they never used the shift key and every other word is a typo" [P].
  - Anthropic (2026): "A good task is one where two domain experts would independently reach the same pass/fail verdict." [O, vendor]
  - Wei (2024): "It's critical to have a single-number metric". Also: "The grading in your eval should be extremely correct." [O]
  - Yan et al.: "LLMs will return output even when they shouldn't". On extraction, a model "may confidently return values even when those values don't actually exist" [P].
  - Husain and Shankar:
    - Build balanced sets of answerable and unanswerable cases.
    - Split judge labels into train, dev and test.
    - Overfitting to dev "can happen even if you never put the dev examples directly in the prompt" [P].
  - Chip Huyen: "if a human has a hard time following the instructions, the model will, too" [P].
- Error bars for the 200-listing set (computed):
  - With 200 listings and 95% observed accuracy, the 95% Wilson interval is about 91.0–97.3%; with 400 it is 92.4–96.7%; with 1,000 it is 93.5–96.2%.
  - Field-level answers are correlated within a listing, so the effective sample size sits between the listing count and the field count.
  - 200 listings will catch large regressions but cannot tell 94% from 96%.
- For Carshenas: the CS-52 set must include listings that should come back null, for example no mention of paint or accident. It also needs:
  - contradictions, slang and misspellings, and Finglish;
  - installment and swap bait, and ride-hailing hints;
  - listing texts that try to instruct the model.

  Two more design points:
  - **Guideline and split:** write the labelling guideline first and reuse its glossary in the prompt. Split the set into dev and test, and report the confidence interval with the accuracy.
  - **Other sets:** CS-55 needs hard negatives (same model, year and colour, but a different car). CS-62 needs realistic, typo-ridden queries.

**P4. Keep a human verifying: partial autonomy, an autonomy slider, and verification made fast.**
- Opinion and practice:
  - Karpathy (2023): "use LLMs in low-stakes applications. Combine them always with human oversight." [O]
  - Karpathy's own note on the November 2023 video: "TLDR right now, do not trust what LLMs say or do." [O]
  - Karpathy's YC slides (2025): a partial-autonomy app has four parts:
    - it packages context;
    - it orchestrates LLM calls;
    - it has a custom GUI;
    - it has an autonomy slider.

    The slides also say: 'Keep AI "on a tight leash" to increase the probability of successful verification'. In the talk: "they are doing the generation, and we as humans are doing the verification" [O].
  - Ilya (2025) on the bug ping-pong: fix a bug, get a second bug, then the first one comes back [O].
  - Chip Huyen: the best teams have humans review 30–1,000 outputs a day [P].
  - Simon Willison: "If you haven't seen it run, it's not a working system." [P]
- Measured:
  - METR's randomised trial (2025) [M; preprint]: developers forecast they would be 24% faster, felt 20% faster afterwards, and actually took 19% longer.
  - METR's 2026 update: developers are "likely" faster now, but the data is "only very weak evidence" of how much.
- For Carshenas:
  - The CS-52 review queue is the autonomy slider: auto-accept above a threshold you have calibrated.
  - CS-62: show the parsed filters as editable chips, plus the words the parser did not recognise. The buyer is the verifier.
  - CS-55: an "unsure" answer goes to the review queue.
  - In the development workflow: small diffs, owner review, and the task-reviewer subagent.

**P5. Automate what you can verify: put a verifier around every generation.**
- Opinion and practice:
  - Karpathy (2025): "Software 2.0 easily automates what you can verify." [O]
  - Karpathy (2026): "Don't tell it what to do, give it success criteria and watch it go." [O/P]
  - Wei (2025), "verifier's rule". He adds that "it is possible to actually improve the asymmetry by front-loading some research about the task" [O].
  - Willison (2025): agents work when you "reduce your problem to a clear goal and a set of tools that can iterate towards that goal" [P].
  - Karpathy's autoresearch (March 2026): one file the agent edits, a fixed 5-minute run, one metric, keep or discard [P].
- Measured:
  - Huang et al., ICLR 2024 [M, peer-reviewed]: without external feedback, models "struggle to self-correct… at times, their performance even degrades".
  - Ng's 2024 compilation of others' papers: GPT-3.5 went from 48.1% zero-shot on HumanEval to "up to 95.1%" in an agent loop [O citing M]. HumanEval grades with unit tests, which is the verifier.
- For Carshenas:
  - The labelled set is Wei's "answer key". The CS-64 test that every number comes from the database is exactly this pattern.
  - Validate CS-62 against the filter schema.
  - For CS-52, cross-check fields against each other and against what code parsed.
  - Derived suggestion: ask for a supporting quote from the listing for each field and check it with a substring match. Yan et al. note that structured, source-identified output can be verified against the input.

**P6. Context engineering: give the model exactly what the task needs, with stable prefixes.**
- Opinion and practice:
  - Karpathy (2025-06-25): context engineering is "the delicate art and science of filling the context window with just the right information for the next step". Also: "Too much or too irrelevant and the LLM costs might go up and performance might come down." [O]
  - Anthropic (2025): "smallest possible set of high-signal tokens" [O, vendor].
  - Yan et al.: put the final prompt on a blank page and read it [P].
  - Manus (2025): KV-cache hit rate is "the single most important metric for a production-stage AI agent" [P].
  - Lilian Weng (2026): "the need to specify goals, constraints, context, and evaluation did not disappear" [O].
- Measured:
  - Liu et al., TACL [M, peer-reviewed]: accuracy is best when the relevant information sits at the beginning or end of the context.
  - Chroma (2025) tested 18 models [M; vendor-authored, code released]: performance "grows increasingly unreliable as input length grows".
- For Carshenas:
  - CS-52: a fixed prefix (instructions, glossary, schema) with the listing last, so provider caching works.
  - CS-50: code retrieves candidate catalogue rows and the model chooses among them.
  - CS-62: pass only the filter schema and its allowed values.
  - CS-64: pass only the facts the explanation may cite.

**P7. Give the model tokens to think, then check that it helps.**
- Opinion and practice:
  - Karpathy (2023): "These transformers need tokens to think" [O]. His Deep Dive video (2025) has a section "models need tokens to think".
  - Chip Huyen, book: step-by-step prompting "can yield surprising improvements" [O].
  - Roundtable: people add "think step-by-step" and never check that the model actually does it [O].
  - Weng (2025): "we cannot by default assume CoT is always faithful" [O citing M].
- For Carshenas:
  - For the batch steps (CS-52, CS-55), measure reasoning on versus off on the dev split.
  - For CS-62, where the buyer is waiting, keep reasoning to a minimum.
  - The reason stored for a CS-55 decision is an audit trail, not proof of why the model decided.

**P8. Structured output, validated in code; one prompt, one job.**
- Yan et al.: "Generate structured output to ease downstream integration". Also: "Have small prompts that do one thing, and only one thing, well" [P].
- Karpathy (2023) recommended constrained (JSON) output [O]. His December 2025 grading prompt says: "Please follow the format exactly because I will be parsing it programmatically." [P]
- Weng (2023) lists "Reliability of natural language interface" as an open problem for agents [O].
- For Carshenas: separate calls for CS-52, CS-55, CS-62 and CS-64. The code validates every output before it is used.

**P9. Don't trust a model's stated confidence, or its stated reasons, until you have calibrated them against labels.**
- Measured:
  - Xiong et al., ICLR 2024 [M, peer-reviewed]: "LLMs, when verbalizing their confidence, tend to be overconfident". Consistency across several samples helps.
  - Kadavath et al. 2022 [M; lab preprint]: models are well calibrated only "in the right format". Weng summarises that RLHF makes calibration worse.
- Opinion and practice:
  - Karpathy (2023): models "don't know what they don't know" [O].
  - Yan et al.: log probabilities "may not be well-calibrated" [P].
- For Carshenas:
  - Set the CS-52 review threshold from a table of accuracy per confidence band on the dev split.
  - Consider agreement between two samples, or two Metis providers, as the confidence signal. It costs more.
  - Recalibrate whenever the model changes.

**P10. An LLM judge must be validated against human labels, its biases controlled, and it must never be optimised against hard.**
- Measured:
  - Zheng et al., NeurIPS 2023 [M, peer-reviewed]: a GPT-4 judge reached "over 80% agreement, the same level of agreement between humans". It showed position, verbosity and self-preference biases.
- Opinion and practice:
  - Karpathy (2025): judges "are gameable". During reinforcement learning against a judge, the reward jumped to 100% on outputs that ended in "dhdhdhdh" [O/P].
  - Karpathy's llm-council (2025): the models ranked each other, and he wrote "I'm not 100% convinced this aligns with my own qualitative assessment" [P].
  - Yan et al.: compare pairs, swap the order, allow ties, and control for length. In one example, agreement with humans went from 68% to 94% after three iterations [P].
  - Husain and Shankar: measure true-positive and true-negative rates on held-out labels, and use one judge per failure mode [P].
- For Carshenas: the CS-55 model is effectively a judge.
  - Measure its precision on labelled pairs.
  - Run each pair in both orders; if the two runs disagree, the answer is "unsure".

**P11. Demos mislead: errors compound across steps.**
- Karpathy's slides: 'Mind the "demo-to-product gap"!' and "demo is a `works.any()` / product is a `works.all()`". In the Dwarkesh interview: "It's a march of nines." [O]
- Chip Huyen: LinkedIn took one month to reach 80%, then four more months to pass 95% (second-hand) [P]. Her arithmetic: 95% per step becomes 60% over 10 steps.
- Yan et al.: factual inconsistencies run at a "baseline rate of 5 - 10%" [P].
- For Carshenas:
  - If a listing has 10 independent fields each 95% accurate, only about 60% of listings are entirely correct, since 0.95¹⁰ ≈ 0.60 (computed). Report both field-level and listing-level accuracy.
  - CS-65 (link to rating in 5 seconds) chains several steps; evaluate it end to end.

**P12. Start simple and add structure only when an eval demands it. Remove it when models improve.**
- Anthropic (2024): "finding the simplest solution possible, and only increasing complexity when needed" [O, vendor].
- Huyen's pitfall "Start too complex" [P].
- Sutton (2019) [O].
- Hyung Won Chung (2024-06-12, from his own post): "we should revisit the structures we added and remove those that hinder further scaling". Also: "As a community we love adding structures but a lot less for removing them." His slides say "This idea doesn't work yet" [O].
- Boris Cherny (2025-05-07): "as the model gets better, it subsumes everything else". He builds for something "a year from now" [O, vendor].
- Manus: "we want Manus to be the boat, not the pillar stuck to the seabed" [P].
- Ng (2025): "ripping out scaffolding and letting the LLM do more" [O].
- Vercel (2025-12-22) removed 80% of its agent's tools. Success went from 4 of 5 to 5 of 5, measured on only 5 queries [V]. Their caveat: "This only worked because our semantic layer was already good documentation."
- For Carshenas: use one well-specified call per step before building any chain. Keep code parsing the structured fields (that is structure that won't go away). Keep the evals re-runnable so a new model can retire a crutch.

**P13. Report cost next to accuracy; use the smallest model that meets the bar; cache.**
- Measured: Kapoor et al., TMLR 2025 [M, peer-reviewed]: state-of-the-art agents are "needlessly complex and costly". They argue for "jointly optimizing the two metrics".
- Opinion and practice:
  - Yan et al.: "Choose the smallest model that gets the job done"; caching is underrated [P].
  - Karpathy (2023): optimise cost only after reaching top performance. In 2025 he reported "930 LLM queries and cost about $58" [P].
- For Carshenas: report cost per 1,000 items and latency in every eval. CS-62 and CS-65 have latency budgets, so evaluate small models there.

**P14. In the development workflow, the human owns the spec and the understanding.** Small diffs, tests first, watch every diff, current documentation.
- Karpathy (2025-04-25): "Describe the next single, concrete incremental change". He keeps "a very tight leash on this new over-eager junior intern savant" [P].
- Karpathy (2026-01-26):
  - "if you have any code you actually care about I would watch them like a hawk"
  - "the models make wrong assumptions on your behalf and just run along with them without checking" [P]
- Sequoia 2026, edited transcript: "People have to be in charge of the spec and plan." [O]
- MenuGen (2025): "Claude kept hallucinating deprecated APIs, model names, and input/output conventions" [P].
- Willison: "LLMs actively reward existing top tier software engineering practices" [P].
- Weng (2026), listing failure modes of research agents: "Bias toward training-data defaults" and "Over-optimism" [O citing M].
- For Carshenas: the repo already does /plan, /work, the task-reviewer, `pnpm check`, /verify-ui and Context7. One addition from METR: measure your real cycle time per task rather than trusting how fast it feels.

## 2. Where they disagree

- **D1. How big an eval must be.**
  - Wei: "It's good to have at least 1,000 examples" (research evals compared across checkpoints).
  - Anthropic: "20-50 simple tasks drawn from real failures is a great start".
  - Askell: a few hundred well-crafted examples.
  - Husain and Shankar: review 100 traces; 100–200 labels per failure mode for a judge.
  - Resolution: size the set to the effect you need to detect (see the interval arithmetic in P3). Applies to CS-48, CS-52 and CS-55.
- **D2. Deterministic workflows or let the model do more.**
  - Yan et al. (2024): "Prioritize deterministic workflows for now".
  - Cherny, Vercel and Ng (2025) argue for less scaffolding.
  - Resolution: Chung's rule. Add the structure today's model needs, and remove it when the eval shows a new model doesn't need it.
- **D3. Are agents ready?**
  - Karpathy on 2025-10-17: "they just don't work", and autocomplete is "my sweet spot".
  - Karpathy on 2026-01-26: he went to "80% agent coding" after a "threshold of coherence around December 2025".
  - METR: slower in 2025; "likely" faster in 2026 on weak evidence.
  - Lesson: measure your own workflow.
- **D4. Can a model tell when it is wrong?**
  - Karpathy (2023): GPT-4 "knows very well that it did not meet the assignment". Kadavath et al. [M]: models "(mostly)" know.
  - Against: Huang et al. [M] and Xiong et al. [M].
  - Resolution: self-checks help only with an external signal, and confidence must be calibrated.
- **D5. LLM as judge.**
  - Zheng et al. [M]: agreement with humans matches human–human agreement.
  - Karpathy: gameable under optimisation.
  - Yan et al.: "not a silver bullet".
  - Resolution: use a judge as a measuring instrument validated on held-out labels, never as an optimisation target.
- **D6. Does forcing a structured format hurt reasoning?**
  - Tam et al., EMNLP 2024 Industry [M, peer-reviewed]: "a significant decline in LLMs reasoning abilities under format restrictions".
  - .txt (2024-11-20) [V, with reproducible notebooks]: re-running the tasks, structured output was an "improvement across the board".
  - Resolution: test both on the CS-52 dev split.
- **D7. Persona prompts.**
  - Karpathy (2023): "Say something like, you are a leading expert on this topic. Pretend you have IQ 120".
  - The roundtable host: persona prompting gives "mixed results. Maybe this worked a little bit better in previous models".
  - Askell: "If they understand the thing, just ask them to do the thing that you want."
  - Karpathy's 2026 edited transcript: "If you yell at them, they are not going to work better or worse."
- **D8. Build for next year's model or today's.**
  - Cherny: build for a year from now.
  - Karpathy: the demo-to-product gap. Ilya: models "generalize dramatically worse than people".
  - Resolution for a project with a deadline: build for the model you can measure today, and keep the eval so a future model can simplify the system.
- **D9. Are LLMs an example of the bitter lesson?**
  - Sutton (2025-09-26): LLMs are "also a way of putting in lots of human knowledge"; there's "no ground truth".
  - Karpathy: LLMs are "ghosts", and pretraining is "crappy evolution".
  - Builder takeaway: labelled sets and verifiers supply the ground truth Sutton says is missing.

## 3. Karpathy: advice you can act on, by source

- **State of GPT, Microsoft Build, May 2023 [O].**
  - "LLMs don't want to succeed, they want to imitate. You want to succeed, and you should ask for it."
  - Write prompts the way you would brief a task contractor who "can't email you back". Load relevant material into context.
  - Reach top performance first, then optimise cost.
  - Use it in low-stakes applications, with human oversight.
- **Intro to Large Language Models, 2023-11-23 [O].** From his own note under the video: trust the model "a bit more" when the answer came from retrieval into the context window. Double-check math and code.
- **Deep Dive (2025-02-05) and How I Use LLMs (2025-02-27) [O].** No transcript was available, so only his own chapter lists are used:
  - "knowledge/working memory"
  - "models need tokens to think"
  - "jagged intelligence"
  - "Be aware of the model you're using"
  - "Thinking models and when to use them"
- **April 2025 coding rhythm [P].** Ask for approaches with pros and cons before code; test; commit; stay "slow, defensive, careful, paranoid".
- **MenuGen, 2025-04-27 [P].** The code was the easy part. Services and outdated API knowledge were the hard part.
- **YC talk, June 2025 (his slide is dated 16 June; the video was published 19 June) [O].** Partial autonomy, the autonomy slider, a fast generation–verification loop, and "less Iron Man robots and more Iron Man suits".
- **Context engineering post, 2025-06-25 [O].** See P6.
- **Dwarkesh interview, 2025-10-17 [O].**
  - Agents are "not very good at code that has never been written before".
  - LLM judges are gameable.
  - The march of nines.
- **nanochat (2025-10-13) and llm-council (2025-11-22) [P].** Small, legible harnesses. The council ranking did not match his own judgement.
- **Verifiability (2025-11-17) and 2025 Year in Review (2025-12-19) [O].**
  - A good LLM app does the context engineering, strings several model calls together "carefully balancing performance and cost tradeoffs", gives the human a GUI, and offers an autonomy slider.
  - He has lost trust in benchmarks.
- **2025-12-26 [O].** "a failure to claim the boost feels decidedly like skill issue".
- **2026-01-26 [P].** Give success criteria, write tests first, watch diffs, beware bloat.
- **autoresearch, March 2026 [P].** One metric, a fixed budget, keep or discard.
- **Sequoia Ascent, 2026-04-30 [O, edited transcript].** "You have to explore the model they give you. It has no manual."
- **2026-07-21 [P].** "Sometimes the LLM needs more bits to understand what you're trying to achieve". He recommends long voice "ramble" sessions.

## 4. Sutskever

**What he said.**
- **NeurIPS test-of-time talk, 2024-12-13** (official page neurips.cc; quotes via The Verge's report, because no transcript was available) [O]:
  - "Pre-training as we know it will unquestionably end"
  - "There's only one internet."
  - Reasoning systems will be more unpredictable.
- **Dwarkesh interview, 2025-11-25, official transcript [O]:**
  - Eval scores run ahead of real economic impact.
  - The bug ping-pong.
  - Labs "take inspiration from the evals".
  - The competitive-programming analogy (10,000 hours versus 100).
  - "these models somehow just generalize dramatically worse than people".
  - Research taste as "beauty, simplicity, elegance".
- **In 2026 two public statements were found:**
  - His testimony in the Musk v. Altman trial (reported by CNN on 2026-05-18; not about building).
  - A post on 2026-09-01: "Neoclouds have limited cybersecurity."

**The reading list's provenance.**
- In a Dallas Innovates interview published 2023-02-02, Carmack said Ilya gave him "a list of like 40 research papers". Ilya's words were: "If you really learn all of these, you'll know 90% of what matters today." Carmack placed this about four years earlier.
- On 2023-02-06 Carmack posted that he had expected Ilya to publish it: "A canonical list of references from a leading figure would be appreciated by many."
- On 2024-01-31 Andrew Carr posted "a partial version", "missing the "Meta Learning" selection".
- On 2024-05-07 @keshavchan posted the arc.net folder "Ilya 30u30". It holds 27 links and the newest is from 2020 (Scaling Laws).
- No official version from Sutskever or OpenAI was found. These claims are UNVERIFIED: that the poster was an OpenAI researcher, and that the list was used for OpenAI onboarding.

**What an app builder can take from him:**
- Your own eval on real Farsi listings beats any benchmark.
- Sample the long tail, because generalisation is weak.
- Iterating prompts on your test set is the same eval-overfitting he describes in the labs, so keep the test split untouched.
- Keep humans verifying agent output.
- Hold his standard of simplicity.

**What you cannot take from him:** anything about prompting, product design or evaluation recipes. He discusses training research. The reading list covers deep learning up to 2020 and has nothing on instruction tuning, RLHF, tools or agents.

## 5. The rest of the requested people: where they appear

- **Wei:** P1, P3, P5, D1.
- **Chung:** P12, D2.
- **Sutton and harness builders:** P12, D2, D9. Harness builders here means Cherny (Claude Code), Manus, Lance Martin, Vercel and Ng.
- **Weng:** P6–P10, P14. Posts on prompting, agents, hallucination, reward hacking, "Why We Think", human data, and the 2026 harness post.
- **Chip Huyen:** P1–P4, P10–P12. Her generative AI platform post: start from the simplest architecture; build observability in "from the beginning".
- **Eugene Yan and co-authors:** throughout. Yan's seven patterns: evals, RAG, fine-tuning, caching, guardrails, defensive UX, user feedback.
- **Anthropic roundtable:** P1, P3, D7.
- **Ng:** P1, P5, P12.
- **Willison:** P4, P5, P14.
- **Additions of comparable standing:** Husain and Shankar, METR, Kapoor and Narayanan, and Anthropic's eval and context-engineering posts.
- **Also verified, for optional use:** GEPA (ICLR 2026 oral) [M] shows reflective prompt optimisation can beat reinforcement learning. That supports an autoresearch-style prompt loop on the dev split only.

## 6. Mapping to Carshenas

| Step | What to do, from the principles |
|---|---|
| CS-48, all steps | Dev/test split, one number plus per-field slices, confidence interval, pinned model, cost and latency in every report, re-run on every change (P1–P3, P13) |
| CS-52 extraction | Error analysis first; guideline doubles as glossary; null answers allowed; schema plus cross-field checks; confidence calibrated on labels; test reasoning on/off (P3, P5, P7–P9) |
| CS-55 duplicates | Code features first, LLM only for borderline pairs; precision on hard negatives; both pair orders; "unsure" goes to the queue (P5, P9, P10, P12) |
| CS-62 query understanding | Realistic, typo-ridden queries; schema validation; editable chips showing what was understood; small model and cache (P4, P5, P13) |
| CS-64 explanations | The database-numbers test is the verifier; humans spot-check a sample (P5, P11) |
| CS-50 name matching | Code retrieves candidates, the model picks; clean catalogue first, per Vercel's caveat (P6, P12) |
| CS-65 link to rating | Errors compound across steps; 5-second budget; end-to-end eval (P11, P13) |
| Development workflow | Specs, small diffs, tests first, current docs, measure real speed (P14) |

## 7. Reading path (this pass's draft; the main note keeps the final one)

Order: how LLMs work, then prompting and context, then evaluations, then agents and workflow, then security and cost. Times marked ≈ are estimates.

1. Karpathy, "Intro to Large Language Models" (2023-11-23), 60 min [O]. https://www.youtube.com/watch?v=zjkBMFhNj_g — the mental model, the "LLM OS", and a security primer.
2. Karpathy, "Deep Dive into LLMs like ChatGPT" (2025-02-05), 3 h 31 min; start with the fine-tuning and "LLM psychology" part [O]. https://www.youtube.com/watch?v=7xTGNNLPyMI — where hallucinations, working memory and "tokens to think" come from.
3. Karpathy, "2025 LLM Year in Review" plus "Verifiability", and Wei, "Asymmetry of verification and verifier's rule", ≈20 min [O]. https://karpathy.bearblog.dev/year-in-review-2025/ · https://karpathy.bearblog.dev/verifiability/ · https://www.jasonwei.net/blog/asymmetry-of-verification-and-verifiers-law — why verifiable tasks improve fastest, and why your labelled sets are the answer key.
4. Dwarkesh Patel with Ilya Sutskever (2025-11-25), 96 min; read the first 25 minutes and "Research taste" [O]. https://www.dwarkesh.com/p/ilya-sutskever-2 — the gap between evals and reality.
5. Dwarkesh Patel with Karpathy (2025-10-17), 2 h 25 min; read the three sections from 00:29, 00:40 and 01:42 (≈45 min) [O]. https://www.dwarkesh.com/p/andrej-karpathy — gameable judges and the march of nines.
6. Karpathy, "State of GPT" (Microsoft Build, May 2023), ≈42 min [O]. https://www.youtube.com/watch?v=bZQun8Y4L2A — the original prompting advice; notice which parts aged, such as personas.
7. Anthropic, "AI prompt engineering: a deep dive" (2024-09-05), ≈80 min [O/P]. https://www.youtube.com/watch?v=T9aRN5JkmL8 — read the outputs; the temp-agency test; edge cases; say what you actually want.
8. Weng, "Prompt Engineering" (2023-03-15), 21 min [O, a review of measured work]. https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/ — measured biases in few-shot example choice and order.
9. Karpathy, "Software Is Changing (Again)" (June 2025, 40 min) plus his context-engineering post (2 min) [O]. https://www.youtube.com/watch?v=LCEmiRjPEtQ · https://x.com/karpathy/status/1937902205765607626 — partial autonomy and the generation–verification loop.
10. Anthropic, "Effective context engineering for AI agents" (2025-09-29), ≈18 min [O, vendor]. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — why less context is often better (context rot).
11. Yan, Bischof, Frye, Husain, Liu and Shankar, "What We've Learned From A Year of Building with LLMs" (2024-06-08), ≈70 min [P]. https://applied-llms.org/ — the densest practitioner checklist available.
12. Wei, "Successful language model evals" (2024-05-24), ≈9 min [O]. https://www.jasonwei.net/blog/evals — one number, correct grading, enough examples.
13. Huyen, "Common pitfalls when building generative AI applications" (2025-01-16), ≈10 min [P]; optionally chapters 3–4 of her book *AI Engineering* (O'Reilly, 2025). https://huyenchip.com/2025/01/16/ai-engineering-pitfalls.html — daily human review; don't use generative AI where you don't need it.
14. Shankar et al., "Who Validates the Validators?" (UIST '24), ≈45 min [M, peer-reviewed]. https://arxiv.org/abs/2404.12272 — criteria drift: why the rubric comes after reading outputs.
15. Husain and Shankar, "AI Evals: Everything You Need to Know" (2026-09-18), 30–40 min of selected questions [P]. https://hamel.dev/blog/posts/evals-faq/ — concrete sizes, data splits, judge validation, and a single domain expert as the quality authority.
16. Anthropic, "Demystifying evals for AI agents" (2026-01-09), ≈30 min [O, vendor]. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents — start from real failures; grade outcomes, not paths.
17. Anthropic (Erik S. and Barry Zhang), "Building effective agents" (2024-12-19), ≈16 min [O, vendor]. https://www.anthropic.com/engineering/building-effective-agents — workflows versus agents; the simplest solution first.
18. Ng, "Improve Agentic Performance with Evals and Error Analysis", parts 1 and 2 (2025-10-15 and 2025-10-22), ≈15 min [O]. https://www.deeplearning.ai/the-batch/improve-agentic-performance-with-evals-and-error-analysis-part-1/ — error analysis on traces; removing scaffolding.
19. Sutton, "The Bitter Lesson" (2019-03-13), plus Chung's CS25 post (2024-06-12), ≈10 min [O]. http://www.incompleteideas.net/IncIdeas/BitterLesson.html — add structure for today; delete it tomorrow.
20. Karpathy's coding rhythm (2025-04-25), notes from Claude coding (2026-01-26), and Sequoia Ascent 2026 (2026-04-30), ≈40 min [O/P]. https://x.com/karpathy/status/1915581920022585597 · https://x.com/karpathy/status/2015883857489522876 · https://karpathy.bearblog.dev/sequoia-ascent-2026/ — agentic engineering in practice.
21. Willison, "Here's how I use LLMs to help me write code" (2025-03-11) and "Vibe engineering" (2025-10-07), ≈35 min [P]. https://simonwillison.net/2025/Mar/11/using-llms-for-code/ · https://simonwillison.net/2025/Oct/7/vibe-engineering/ — the engineering habits that LLMs reward.
22. METR's randomised trial (2025-07-10) and its 2026 update (2026-02-24), ≈25 min [M; preprint]. https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ · https://metr.org/blog/2026-02-24-uplift-update/ — how fast it feels is not how fast it is.
23. Kapoor et al., "AI Agents That Matter" (TMLR 2025), ≈40 min [M, peer-reviewed]. https://arxiv.org/abs/2407.01502 — report cost with accuracy; use holdout sets.
24. Yichao Ji (Manus), "Context Engineering for AI Agents" (2025-07-18), ≈15 min [P]. https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus — cache hit rate and stable prompt prefixes.
25. Weng, "Adversarial Attacks on LLMs" (2023-10-25), 33 min [O, a review of measured work]. https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/ — security primer only; `injection-cost.md` goes deeper.

## 8. Not verified

- **Missing transcripts:**
  - No transcript for Deep Dive, How I Use LLMs, or the NeurIPS talk; only their chapter lists and The Verge's quotes are used.
  - The roundtable transcript has no speaker names, so the attributions to Zack Witten and David Hershey are inferred from context.
- **Exact dates and durations:**
  - The exact day of the YC talk (16 or 17 June 2025).
  - The durations of State of GPT and the roundtable are estimated from transcript length.
- **Rumours not used:** reports that SSI would release a model in August 2026.
- **Primary source not reachable:** the ACM page for the UIST paper was blocked by Cloudflare. The venue was confirmed from the authors' PDF.

## 9. Other sources verified but not listed above

- **Karpathy posts on X:** 1887211193099825254, 1895242932095209667, 2004607146781278521, 2079610838143623371, 1992381094667411768, 2049903821095354523.
- **Karpathy repositories and posts:**
  - github.com/karpathy/nanochat, llm-council, autoresearch;
  - karpathy.bearblog.dev/vibe-coding-menugen and /auto-grade-hn;
  - karpathy.github.io/2026/02/12/microgpt [P].
- **YC talk transcripts:** singjupost.com/andrej-karpathy-software-is-changing-again and donnamagi.com/articles/karpathy-yc-talk (both third-party).
- **Sutskever:**
  - https://www.theverge.com/2024/12/13/24320811/what-ilya-sutskever-sees-openai-model-data-training
  - https://neurips.cc/virtual/2024/test-of-time/105032
  - https://x.com/ilyasut/status/2094881278621253755
  - https://edition.cnn.com/2026/05/18/tech/openai-musk-lawsuit-verdict
- **Reading-list provenance:**
  - https://dallasinnovates.com/exclusive-qa-john-carmacks-different-path-to-artificial-general-intelligence/
  - https://x.com/ID_AA_Carmack/status/1622673143469858816
  - https://x.com/andrew_n_carr/status/1752526711311507526
  - https://x.com/keshavchan/status/1787861946173186062
  - https://arc.net/folder/D0472A20-9C20-4D3F-B145-D2865C0A9FEE
  - https://www.turingpost.com/p/ilya-sutskever-reading-list
  - https://tensorlabbet.com/2024/09/24/ai-reading-list/
- **Wei:** https://www.jasonwei.net/blog/some-intuitions-about-large-language-models [O]
- **Chung:** MIT slides https://docs.google.com/presentation/d/1nnjXIuN2XDJENAOaKXI5srQscO3276svvP6JgivTv6w [O]
- **Bitter lesson and harness builders:**
  - Sutton interview: https://www.dwarkesh.com/p/richard-sutton [O]
  - Boris Cherny on Latent Space: https://www.latent.space/p/claude-code [O, vendor]
  - Lance Martin: https://rlancemartin.github.io/2025/07/30/bitter_lesson/ [P]
  - Vercel: https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools [V]
- **Weng:**
  - https://lilianweng.github.io/posts/2023-06-23-agent/
  - https://lilianweng.github.io/posts/2024-07-07-hallucination/
  - https://lilianweng.github.io/posts/2024-11-28-reward-hacking/
  - https://lilianweng.github.io/posts/2025-05-01-thinking/
  - https://lilianweng.github.io/posts/2026-07-04-harness/
  - https://lilianweng.github.io/posts/2024-02-05-human-data-quality/
- **Huyen:**
  - https://huyenchip.com/2025/01/07/agents.html
  - https://huyenchip.com/2024/07/25/genai-platform.html
  - https://github.com/chiphuyen/aie-book
- **Eugene Yan:** https://eugeneyan.com/writing/llm-patterns/ [O/P]
- **Ng:** https://www.deeplearning.ai/the-batch/how-agents-can-improve-llm-performance/ and https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-2-reflection/
- **Willison:** https://simonwillison.net/2025/Sep/30/designing-agentic-loops/
- **Husain:** https://hamel.dev/blog/posts/llm-judge/ and https://hamel.dev/blog/posts/field-guide/
- **Measured papers:**
  - Xiong et al., ICLR 2024 [M]: https://arxiv.org/abs/2306.13063
  - Zheng et al., NeurIPS 2023 [M]: https://arxiv.org/abs/2306.05685
  - Huang et al., ICLR 2024 [M]: https://arxiv.org/abs/2310.01798
  - Kadavath et al. 2022 [M, lab preprint]: https://arxiv.org/abs/2207.05221
  - Liu et al., TACL [M]: https://arxiv.org/abs/2307.03172
  - Chroma [M]: https://www.trychroma.com/research/context-rot
  - Tam et al., EMNLP 2024 Industry [M]: https://aclanthology.org/2024.emnlp-industry.91/
  - .txt response [V]: https://blog.dottxt.ai/say-what-you-mean.html
  - METR [M]: https://arxiv.org/abs/2507.09089
  - GEPA [M]: https://arxiv.org/abs/2507.19457
