# Pass 8: open-source projects and published work doing what Carshenas does (CS-43)

Researched on 2026-09-29 by six parallel readers, one per topic. Every cited source was fetched with curl or WebFetch, and every repository was shallow-cloned and its code read, with the commit and date recorded. The headline numbers and quotes were re-checked against the saved texts: Zillow, Redfin, TabPFN, Vacareanu and Vedula; Lin, OpenSanctions, ComEM, the ONS bands and Walmart; WDC-PAVE, self-refinement, Amazon, Auto-AdvER and AutoSpecNER; Yelp, Instacart, ZoomInfo and sahibinden; Kasner, Puduppully, Turpin and the Citations docs; the CarGurus 10-K and help pages; LangExtract's thresholds; khodrobin's guard, eval gate and unwired model fallback; torob-khaneh's leftover chip. One correction came out of it: WDC-PAVE's best normalisation-only score is **96.2** (Table 7, 96.21), not 96.1 as first reported.

The fetched copies, the clones and the six topic reports were in the research session's scratchpad (not kept). The offline probes of the Torob-challenge rivals are kept in `lab/rival-probes/`, with their output in `evidence/rival-probes-2026-09-29.txt`.

**Marks:** M = measured with a published method (venue given when peer-reviewed); V = the vendor or project about itself; P = practitioner report from production; O = opinion.

## Five patterns across the field

1. **Code does numbers, the model does words.** Separate normalisation beats one-step extraction; templates beat neural writers on facts; LLMs are poor price regressors; numeric query fields are near-perfect with rules.
2. **Three bands and explicit abstention everywhere:** a review queue, an LLM for borderline pairs, an "unmatched" state, "no rating", a leftover chip for words not understood.
3. **Check in code instead of asking the model to check itself:** evidence quotes aligned in code, placeholders, enumerations. Self-refinement and model judges measured poorly.
4. **Measure the way the product is used:** time-based splits, correct nulls reported separately, scores per field and per facet, held-out sets never used to fix rules, runs repeated.
5. **Version by content hash:** prompt, schema and guard code plus the input, so a change expires stale outputs.

## 1. Survey

### 1a. Extraction and LLM data pipelines (CS-52, CS-50)

| Project or paper | What it does | Link | Licence | Activity or venue | Mark |
|---|---|---|---|---|---|
| ExtractGPT (Brinkmann, Shraga, Bizer) | Which prompt parts help attribute extraction: schema format, descriptions, example values, similar demonstrations, fine-tuning | https://arxiv.org/abs/2310.12537 · https://github.com/wbsg-uni-mannheim/ExtractGPT | Apache-2.0 | iiWAS 2024, best paper; code 3f96461, 2024-05-24 | M, peer-reviewed |
| WDC-PAVE (Brinkmann, Baumann, Bizer) | Extraction vs extraction with normalisation vs normalisation alone; 565 offers from 59 sites, 4,687 pairs | https://arxiv.org/abs/2403.02130 · https://github.com/wbsg-uni-mannheim/wdc-pave | none declared | ADBIS 2024 | M, peer-reviewed |
| Self-refinement strategies (Brinkmann, Bizer) | Error-based prompt rewriting, self-correction and fine-tuning on GPT-4o, with token costs | https://arxiv.org/abs/2501.01237 | — | BTW 2025 workshops (DE4DS) | M, peer-reviewed workshop |
| Column type annotation (Korini, Bizer) | Refined label definitions for a closed vocabulary | https://arxiv.org/abs/2503.02718 | — | ADBIS 2025 (group page only) | M |
| End-to-end integration (Steiner, Bizer) | An LLM drafts value mappings offline; code applies them | https://arxiv.org/abs/2603.10547 | — | ICDE 2026 workshop, 2026-03-11 | M, workshop |
| MAVE (Google Research, built on Amazon product data) | 2.2 M products labelled by a five-model ensemble plus rules | https://arxiv.org/abs/2112.08663 | dataset NOASSERTION | WSDM 2022 | M, peer-reviewed |
| LLM-Ensemble (Walmart) | Dawid–Skene weighting of seven LLMs | https://arxiv.org/abs/2403.00863 | — | SIGIR 2024 short paper | M, peer-reviewed |
| EIVEN (Amazon, UIC) | Multimodal LLM for implicit attribute values | https://aclanthology.org/2024.naacl-industry.40 | — | NAACL 2024 industry track | M, peer-reviewed |
| Hyper-Parallel Decoding extraction (Vedula et al., Amazon) | Claude-labelled data distilled into Qwen3-4B; five outcomes, including "ungrounded" | https://arxiv.org/abs/2609.09716 | — | AKBC 2026 workshop, 2026-09-11 | M/V (own catalogue) |
| Instacart PARSE | Multimodal extraction, cascades, yes-probability confidence, human audit | https://www.instacart.com/company/how-its-made/scaling-catalog-attribute-extraction-with-multi-modal-llms | — | 2025-08 | P (read only through zenml.io's summary) |
| Registry-bound trait extraction (J. Wang) | Closed 39-key vocabulary, with a verbatim evidence quote and a confidence per row | https://arxiv.org/abs/2606.00994 | — | preprint, 2026-05-31 | V |
| Auto-AdvER (Autotrader UK and co-authors) | Named-entity recognition on car ads (condition, history, sales options): encoders vs LLMs | https://arxiv.org/abs/2412.05655 | — | preprint, 2024-12-07 | M, not peer-reviewed |
| AutoSpecNER | 659 car ads, 15 specification entities: rules vs encoders vs LLMs | https://arxiv.org/abs/2606.24387 | — | preprint, 2026-06-23 | M, not peer-reviewed |
| RAVE (Kvet et al.) | Slovak property ads (machine-translated); local LLMs; ablation of schema size | https://doi.org/10.1109/ACCESS.2025.3564511 | data MIT | IEEE Access 13, 2025 | M, peer-reviewed |
| LangExtract (Google) | Few-shot extraction aligned to character spans; chunking; several passes | https://github.com/google/langextract | Apache-2.0 | 62b933a, 2026-09-21; 38.9k stars; v1.0.0 on 2025-07-22 | V; code read; publishes no accuracy |
| DocETL (Shankar et al., Berkeley) | Declarative LLM pipelines; agent-proposed rewrites; "gleaning" | https://github.com/ucbepic/docetl · https://arxiv.org/abs/2410.12189 | MIT | 0b1f0f1, 2026-09-05; PVLDB 18(9), 2025 | M, peer-reviewed |
| LOTUS (Patel et al.) | Semantic operators; model cascades with precision and recall targets | https://github.com/lotus-data/lotus · https://arxiv.org/abs/2407.11418 | Apache-2.0 | 136ae4f, 2026-07-03; PVLDB 18(11), 2025 | M, peer-reviewed |
| Palimpzest and Abacus (MIT) | Cost-based optimiser that picks a model for each operator | https://github.com/mitdbg/palimpzest | MIT | 807ed30, 2026-04-13 (pushed 2026-09-17); CIDR 2025; Abacus PVLDB 19(5), 2026 | M, peer-reviewed |

### 1b. Duplicates, entity matching and record linkage (CS-55, CS-50)

| Project or paper | What it does | Link | Licence | Activity or venue | Mark |
|---|---|---|---|---|---|
| Narayan, Chami, Orr, Ré, "Can Foundation Models Wrangle Your Data?" | GPT-3 prompted for entity matching and wrangling; ablates how demonstrations are chosen | https://arxiv.org/abs/2205.09911 · https://github.com/HazyResearch/fm_data_tasks | Apache-2.0 | PVLDB 16(4), VLDB 2023; c954cfd, 2023-01-18 | M, peer-reviewed |
| Peeters, Steiner, Bizer, "Entity Matching using LLMs" (MatchGPT) | 6 LLMs × 10 prompts; demonstrations, rules, fine-tuning, cost, structured explanations | https://openproceedings.org/2025/conf/edbt/paper-81.pdf · https://github.com/wbsg-uni-mannheim/MatchGPT | none declared | EDBT 2025; ba16919, 2024-10-18 | M, peer-reviewed |
| BATCHER (Fan et al.) | Several pairs per prompt; covering-based choice of demonstrations | https://arxiv.org/abs/2312.03987 · https://github.com/fmh1art/BatchER | none declared | ICDE 2024; b55ba12, 2023-12-17 | M, peer-reviewed |
| "Match, Compare, or Select?" / ComEM (Wang et al.) | Matching vs comparing vs selecting; a cheap ranker feeds an LLM selector | https://aclanthology.org/2025.coling-main.8/ · https://github.com/tshu-w/ComEM | none declared | COLING 2025; 5b43c5b, 2026-05-27 | M, peer-reviewed |
| Ditto (Li et al.) | Fine-tuned RoBERTa matcher with knowledge injection, summarisation and augmentation | https://arxiv.org/abs/2004.00584 · https://github.com/megagonlabs/ditto | Apache-2.0 | PVLDB 14(1), 2021; 5298556, 2021-09-24 | M, peer-reviewed |
| AnyMatch; cross-dataset deep dive; Jellyfish (Zhang et al.) | Small fine-tuned matchers vs prompted LLMs | https://arxiv.org/abs/2409.04073 · https://openproceedings.org/2025/conf/edbt/paper-224.pdf · https://aclanthology.org/2024.emnlp-main.497.pdf | — | preprint 2024; EDBT 2025; EMNLP 2024 | M (the last two peer-reviewed) |
| LLM-CER (Fu et al.) | The LLM clusters small sets of records instead of judging pairs | https://arxiv.org/abs/2506.02509 | code MIT (not read) | SIGMOD '26 (per the PDF) | M |
| Lin, "Cost-Aware Evaluation of LLMs for Ambiguous Product Entity Matching" | The LLM decides only the band where a tuned fuzzy matcher is unsure | https://zenodo.org/records/20089436 | CC BY 4.0 | working paper, 2026-05-08 | M, not peer-reviewed |
| OpenSanctions Pairs (Smith et al.) | 755,540 analyst-labelled pairs: the production logistic matcher vs LLMs | https://arxiv.org/abs/2603.11051 | — | preprint v2, 2026-08-25 | M (its baseline is P) |
| Walmart, "Entity Resolution in Practice" (Pavani et al.) | Hard vetoes, thresholds that account for sparse records, checked merges, a distilled LLM teacher | https://arxiv.org/abs/2607.26298 | — | preprint, 2026-07-28 | P (measured on public benchmarks) |
| Avito Duplicate Ads Detection (Kaggle 2016), 2nd-place write-up | Duplicate classified ads from text, image, location and price features | https://github.com/sonnylaskar/Competitions/tree/master/Kaggle/Avito%20Duplicate%20Ad%20Detection | not checked | 2016 | P (hidden-test leaderboard) |
| Splink (UK Ministry of Justice) | Fellegi–Sunter linkage in SQL, PostgreSQL included; EM; labelling, threshold and accuracy tools | https://github.com/moj-analytical-services/splink · https://ijpds.org/index.php/ijpds/article/view/1794 | MIT | c9f5712, 2026-09-29 (v5.0.0); IJPDS 2022 | V |
| ONS census duplicate case study with Splink | 58 M records; clerical review sampled by score band | https://raw.githubusercontent.com/Data-Linkage/Splink-census-linkage/main/SplinkCaseStudy.pdf | — | Statistics Canada Symposium 2022 | P |
| dedupe | Active learning of which pairs to label; learned blocking; clustering | https://github.com/dedupeio/dedupe | MIT | 3f61e79, 2025-07-28 | P |
| Zingg | Spark entity resolution; active-learning labelling | https://github.com/zinggAI/zingg | AGPL-3.0 | 9e3595a, 2026-09-13 | V |
| nomenklatura (OpenSanctions) | Production resolver: a SQL graph of judgements, with a review tool | https://github.com/opensanctions/nomenklatura | MIT | 0f42896, 2026-09-28 | P |

### 1c. Turning queries into filters (CS-62)

| Project or paper | What it does | Link | Licence | Activity or venue | Mark |
|---|---|---|---|---|---|
| LangChain self-query retriever (`langchain_classic`) | The model writes `{query, filter, limit}`; a Lark grammar; translators per store | https://github.com/langchain-ai/langchain | MIT | aaf25d0, 2026-09-29 | code read |
| LlamaIndex `VectorIndexAutoRetriever` | The model writes a `VectorStoreQuerySpec`, checked for shape only | https://github.com/run-llama/llama_index | MIT | 7e2c60a, 2026-09-28 | code read |
| torob-khaneh (Torob entry, homes) | Persian rule-based parser; chips keep their place in the query; a leftover chip | https://github.com/kiana-nb/torob-khaneh | none declared | 66cc6e3, 2026-09-24 | V (20 self-tests) |
| Yelp, "Search Query Understanding with LLMs" | Precomputes frequent queries; small models for the rest | https://engineeringblog.yelp.com/2025/02/search-query-understanding-with-LLMs.html | — | 2025-02-04 | P |
| Instacart, "Building The Intent Engine" | An offline teacher fills a cache; a fine-tuned Llama-3-8B handles misses | https://tech.instacart.com/building-the-intent-engine-how-instacart-is-revamping-query-understanding-with-llms-3ac8051ae7ac | — | 2025-11-13 (Wayback copy) | P |
| DoorDash, retrieval post and LLM-as-a-judge post | Taxonomy linking over retrieved candidates; required vs preferred attributes; yes/no checks per facet | https://careersatdoordash.com/blog/how-doordash-leverages-llms-for-better-search-retrieval/ · https://careersatdoordash.com/blog/doordash-llm-as-a-judge-evaluating-natural-language-search/ | — | 2024-11-19; 2026-05-14 (Wayback copies) | P |
| LinkedIn (Liu et al.), two papers | Schema-constrained 1.5B model, lexical fallback, cache, measured latency; a P95 budget of 600 ms | https://arxiv.org/abs/2605.27441 · https://arxiv.org/abs/2509.09690 | — | KDD '26; CIKM '25 (per the papers) | M, peer-reviewed, own systems |
| ZoomInfo (Yao et al.) | Natural language → JSON fields → search query; more than 500 labelled queries | https://arxiv.org/abs/2411.05048 | — | preprint, 2024-11-07 | M |
| sahibinden.com (Baysan et al.) | LLM judge of a classifieds site's query parsing, vehicles included | https://doi.org/10.3389/fdata.2025.1611389 | — | Frontiers in Big Data, 2025-07-21 | M, peer-reviewed |
| Airbnb CASTLE; Siddiqui et al.; Hontan et al. | Synthetic labelled queries; a small model writing filters; results across languages | https://arxiv.org/abs/2605.21812 · https://arxiv.org/abs/2601.16492 · https://arxiv.org/abs/2604.03057 | — | CIKM '26; preprints 2026 | M |
| Yandex Lavka, «LLM Cache в поиске» | Offline results for frequent queries, with a fallback | https://habr.com/ru/companies/yandex/articles/1029142/ | — | 2026-04-30 | P |
| Cars.com Carson; Autotrader UK AI categories; Redfin; Rightmove | Plain-language or category search | Linked from the press releases | — | 2025-11 to 2026-02 | V (press releases) |

### 1d. Valuation (CS-51)

| Project or paper | What it does | Link | Licence | Activity or venue | Mark |
|---|---|---|---|---|---|
| CarGurus help pages: IMV, no rating, new cars | IMV from comparable current and past listings, computed daily; when no rating is shown | https://cargurus.helpscoutdocs.com/article/10-what-is-imv · …/26-why-are-some-listings-without-pricing · …/495-why-is-there-no-deal-rating-for-new-vehicles | — | updated 2026-05-14, 2021-07-28, 2026-02-05 | P (no error figure published) |
| CarGurus 10-K, fiscal 2025 | IMV inputs; Next Best Deal Rating; model risk | https://www.sec.gov/Archives/edgar/data/1494259/000119312526059435/carg-20251231.htm | — | filed 2026-02-19 | P |
| CarGurus patent US20140257934A1 | Price score from fair value and the model's standard deviation; bands by percentile | https://patents.google.com/patent/US20140257934A1/en | — | published 2014-09-11 | O (a method, not necessarily today's practice) |
| Zillow Zestimate | Median error on and off the market; share within 5, 10 and 20 %; a range | https://www.zillow.com/z/zestimate/ (Internet Archive capture of 2025-11-14) | — | "Last updated: July 28, 2025" | V |
| Redfin Estimate | Median error; comparables; when no estimate is shown | https://www.redfin.com/redfin-estimate | — | undated, read 2026-09-29 | V |
| Autotrader UK price indicator; KBB range pricing | Five flags and the gap in pounds; hierarchical curves; a price range | https://www.autotrader.co.uk/partners/retailer/terms-and-conditions/price-indicator · https://b2b.kbb.com/kbb-vehicle-values/range-based-pricing/ | — | Autotrader blog 2020-08-27; others undated | P |
| Grinsztajn, Oyallon, Varoquaux | Trees vs deep learning on 45 tabular datasets | https://arxiv.org/abs/2207.08815 | — | NeurIPS 2022 Datasets and Benchmarks | M, peer-reviewed |
| TabPFN (Hollmann et al.) and TabPFN-2.5 | Tabular foundation model | https://www.nature.com/articles/s41586-024-08328-6 · https://arxiv.org/abs/2511.08667 | code Apache-2.0; newer weights non-commercial | Nature 2025-01-08; repo 09b4188, 2026-09-29 | M (Nature); V (2.5 report) |
| Vacareanu et al., "From Words to Numbers" | LLMs as regressors from in-context examples | https://arxiv.org/abs/2404.07544 | — | COLM 2024 | M, peer-reviewed |
| Vedula et al. (Amazon), text to price | Fine-tuned Mistral-7B with quantile heads, Craigslist cars included | https://arxiv.org/abs/2506.06657 | — | Findings of ACL 2025 | M, peer-reviewed |
| ProbSAINT | Probabilistic used-car pricing on 2 M records, split by time | https://arxiv.org/abs/2403.03812 | — | preprint, 2024-03-06 | M |
| Cook County Assessor, model-res-avm | Production AVM: time-based test, SHAP, comparables | https://github.com/ccao-data/model-res-avm | AGPL-3.0 | feec9b7, 2026-09-11 | P |
| Belard/portugal-used-car-price-ai | Used-car valuation | https://github.com/Belard/portugal-used-car-price-ai | none | 05c55fe, 2026-06-04 | V (random split; tunes on its test set) |

### 1e. Explaining a rating and grounding (CS-64)

| Project or paper | What it does | Link | Licence | Activity or venue | Mark |
|---|---|---|---|---|---|
| Turpin, Michael, Perez, Bowman | Do chain-of-thought explanations mention a bias that swayed the answer? | https://arxiv.org/abs/2305.04388 | — | NeurIPS 2023 | M, peer-reviewed |
| Chen et al. (Anthropic), "Reasoning Models Don't Always Say What They Think" | The same test on reasoning models | https://arxiv.org/abs/2505.05410 | — | preprint, 2025-05-08 | M |
| Agarwal, Tanneru, Lakkaraju, "Faithfulness vs. Plausibility" | Position paper | https://arxiv.org/abs/2402.04614 | — | arXiv 2024; no venue found | O |
| Kasner, Dušek, "Beyond Traditional Benchmarks" | Zero-shot data-to-text, with error annotation word by word | https://aclanthology.org/2024.acl-long.651/ | — | ACL 2024 | M, peer-reviewed |
| "LLMs as Span Annotators"; factgenie | LLMs vs humans at marking error spans; an annotation tool | https://arxiv.org/abs/2504.08697 · https://github.com/ufal/factgenie | tool MIT | EACL 2026 workshop; b4bfc9a, 2026-09-17 | M; V |
| TaPERA; STAT-TO-TEXT | Numeric claims computed by executed code, then written | https://aclanthology.org/2024.acl-long.692/ · https://arxiv.org/abs/2609.23966 | — | ACL 2024; preprint 2026-09-21 | M |
| Clinical notes, npj Digital Medicine | 12,999 clinician-labelled sentences from GPT-4 notes | https://www.nature.com/articles/s41746-025-01670-7 | — | 2025-05-13 | M, peer-reviewed |
| Vectara hallucination leaderboard | Hallucination rate of summaries, per model | https://github.com/vectara/hallucination-leaderboard | Apache-2.0 | af0e320; updated 2026-09-22 | V |
| Puduppully, Dong, Lapata | Choose and plan the content, then write | https://ojs.aaai.org/index.php/AAAI/article/view/4668 | — | AAAI 2019 | M, peer-reviewed |
| Castro Ferreira et al.; Kasner, Dušek 2022 | Pipeline vs end-to-end data-to-text; one template per fact | https://aclanthology.org/D19-1052/ · https://arxiv.org/abs/2203.16279 | — | EMNLP 2019; ACL 2022 | M, peer-reviewed |
| Dušek, Howcroft, Rieser; `slot_error.py` | Slot error rate, and reranking outputs by it | https://arxiv.org/abs/1911.03905 · https://github.com/tuetschek/e2e-cleaning | none declared | INLG 2019 | M, peer-reviewed |
| Tableau Pulse (Salesforce) | Deterministic insights as template sentences, which an LLM then summarises | https://www.salesforce.com/blog/tableau-pulse/ | — | 2024-09-12 | P |
| Guardrails AI `provenance_llm` | An LLM answers yes or no for each sentence | https://github.com/guardrails-ai/provenance_llm | Apache-2.0 | 81e44b6, 2026-07-27; 6 stars | O (unmeasured) |
| Anthropic Citations | Cited spans with character, page or block indices | https://platform.claude.com/docs/en/build-with-claude/citations | — | launched 2025-01-23 | V |
| Vertex AI check grounding; Cohere grounded generation | A support score and citations for each claim | https://cloud.google.com/generative-ai-app-builder/docs/check-grounding · https://docs.cohere.com/docs/retrieval-augmented-generation-rag | — | Vertex page updated 2026-09-24 | V |
| persian-tools; hazm; Parsivar | Persian digits and number words | https://github.com/persian-tools/persian-tools · https://github.com/roshan-research/hazm · https://github.com/ICTRC/Parsivar | MIT (all three) | 97a4390, 2026-09-28; a399c82; 3d21580 | tested in this pass (persian-tools, Parsivar) |

### 1f. The Torob field (all self-reported)

| Project | What it does | Link | Licence | Commit | Mark |
|---|---|---|---|---|---|
| khodrobin | Five sites crawled; rule-based alias matching to specs; a Go rule parser gated in CI by 92 queries; qwen2.5:7b explanations behind a five-axis guard | https://github.com/sobhanaz/khodrobin | MIT | 2e5e77d, 2026-09-09 | V (seed rebuild, 33 guard tests and probes reproduced) |
| Capot | Gradient-boosted log-price model; keyword flags with an optional LLM pass; duplicates by rule; precision@5 | https://github.com/mhnasajpour/Capot | none | b1eb287, 2026-09-04 | V (data gitignored, so not reproducible) |
| caro | Listing lifecycle; repost linking; appraiser gated by a baseline; explanations from an evidence ledger | https://github.com/sahandmusanezhad/caro | MIT | 8f855f6, 2026-09-27 | V (1,507 assertions in 13 of 15 suites reproduced) |
| torob-car | Query parsing: cache, then the LLM with a 4 s timeout, then rules; names resolved with pg_trgm | https://github.com/pejmanS21/torob-car | none | d8d0c3c, 2026-09-25 | V |
| Homerob | LLM explanations with a digit check; a hedged race between models | https://github.com/MohammadJavadHeidari/Homerob | MIT | ca0d61a, 2026-09-28 | V (check probed) |

## 2. Ideas worth taking, per step

### CS-52: extraction

1. **Define the score before measuring it.**
   - Score each field with explicit outcomes for absent values, and report precision and recall on non-empty values apart from correct nulls. Run the evaluation twice.
   - Evidence:
     - 45 % of WDC-PAVE's 4,687 pairs are "n/a" (M, ADBIS 2024).
     - Amazon scores five outcomes (correct, correct null, incorrect, missed, ungrounded), and only about 93 % of outputs were identical across runs (M/V).
   - Why: most condition fields are unmentioned in Farsi listings, so a 95 % that counts nulls can hide poor recall.
2. **Three states per fact: stated, not mentioned, inferred.** Unknown never counts as clean.
   - Evidence:
     - caro scores "unknown" paint risk at 0.35, between minor paint and paint on several panels (`ranking.py` 538–590, V).
     - Half of Amazon's 4.6 % "ungrounded" values were reasonable inferences.
   - Why: «مناسب اسنپ» is an inference; «بدون رنگ» is a statement.
3. **Put negations in the 200-listing set.**
   - Evidence: an offline probe of Capot's keyword scanner (`lab/rival-probes/probe_capot.py`, output in `evidence/rival-probes-2026-09-29.txt`) showed it:
     - flags «بدون رنگ شدگی» as repainted and «تصادفی نیست» as an accident;
     - flags «در رهن نیست» as a lien and «موتور تعویض نشده» as engine replaced;
     - misses «یک لکه رنگ».
   - Why: this is the measured case for a model over keywords, and a demo moment.
4. **Build the prompt in the measured order:** glossary definitions of each label, then similar labelled demonstrations retrieved with pgvector. Test 3 against 10 demonstrations, and keep evaluation listings out of the retrieval pool.
   - Evidence, GPT-4o F1 on two datasets (M, BTW 2025 workshop):

     | Prompt | F1 | Tokens vs zero-shot |
     |---|---|---|
     | zero-shot | 68.8 / 63.6 | 1× |
     | with definitions | 72.2 / 76.3 | about 3× |
     | few-shot | 78.6 / 83.9 | about 7× |
     | both | 79.3 / 85.3 | — |
     | fine-tuned | 83.2 / 85.1 | 0.9× |

   - Evidence, number of demonstrations (GPT-3.5, iiWAS 2024): 3 gave 78.1 F1 at $0.071 per 1,000 values; 10 gave 79.9 at $0.141.
   - Evidence, GPT-4 (ADBIS 2024): 74.4 zero-shot ($0.10 per 1k values); 79.7 with 10 example values ($1.66); 90.5 with 10 demonstrations added ($4.60).
5. **The model picks labels; code handles numbers, units, dates and money.**
   - Evidence:
     - Normalising values already extracted scored 96.2 F1, against 91.3 in one step. Unit normalisation was the weakest operation (83.5) and name expansion the strongest (98.3) (M, ADBIS 2024).
     - Code normalisers covered 96 % of values (Steiner and Bizer 2026, M).
     - khodrobin enforces that no detail extractor may return a price (`details.py` 14–36, V).
6. **A verbatim evidence quote for every non-empty fact, aligned by code.**
   - How: exact match first, then fuzzy with LangExtract's defaults: at least 0.75 token coverage and a density of at least 1/3. The statuses are EXACT, LESSER, FUZZY or none.
   - Normalise ي/ی, ك/ک, the zero-width non-joiner and digits before matching, but keep the offsets into the original text; LangExtract normalises nothing.
   - Evidence:
     - LangExtract's README warns that LLMs "may occasionally extract content from few-shot examples rather than the input text" (code read at 62b933a).
     - 90.12 % of 5.43 M quotes were verbatim in Wang's registry-bound extraction (V).
   - Why: the listing page's chips can show their sentence, and a quote that does not align becomes a review reason. It also catches leaked examples and injected text.
7. **No self-correction loops.** Re-ask once, and only when a check in code fails (schema, enumeration, alignment).
   - Evidence:
     - Both refinement techniques "fail to significantly improve the extraction performance while substantially increasing processing costs": 2–2.6× the tokens, and self-correction corrupted 16 % of updates while improving 19 % (M).
     - DocETL's gleaning doubles the cost of an operation (M).
8. **Small schemas with enumerations.**
   - Evidence:
     - A 36-attribute schema dropped Qwen2.5-32B to 10.04 % micro-F1 with invalid JSON; with the right attributes it reached 97.92 % (M, IEEE Access).
     - Amazon's constrained decoding changed fewer than 1 % of values.
   - Why: Metis's DeepSeek route refused `json_schema`, so enumerations must be validated in code anyway.
9. **Confidence from signals calibrated on the labels, not from the model's own number.**
   - Signals:
     - agreement between rules and the model (MAVE's unanimous labels: 97.8 % precision, M);
     - the alignment status;
     - agreement across two runs;
     - a yes-probability only where log-probabilities exist (Instacart via summary, P; LOTUS needs them, M).
   - Evidence against self-reported confidence: its calibration error ran from 0.062 to 0.346 across models (Lin, M).
10. **Expect recall, not precision, to be the weak side.**
    - Evidence:
      - Car ads, GPT-4o with 100 in-context examples: precision 72.3, recall 54.7, F1 62.0; the authors call LLMs "costly and far from perfect for this task" (Auto-AdvER, M preprint).
      - AutoSpecNER: a fine-tuned DeBERTa reached 90.1 % micro-F1, the best LLM 77.8 %, rules 43 %.
    - Why: these are the closest published analogues, and they make 95 % on free-text spans a stretch. Score closed labels per field, and report recall.
11. **Price-type traps: stated phrases plus a check against the cohort price, both kept out of valuation.**
    - Evidence:
      - khodrobin's `plausibility.py` phrases: «حواله», «پیش‌فروش», instalments, «فروش دولتی/سازمانی» (V).
      - Capot drops prices below 0.35× or above 3× the cohort median, and reports that removing down-payment outliers cut its error from 28 % to 11.8 % (V).
12. **Operations:**
    - Redact phone numbers before the model sees the text (khodrobin found 34 of 1,891 descriptions carried one).
    - Make the cache version a SHA-256 of the prompt and guard module (khodrobin replaced a hand-bumped "1" that went stale).
    - Keep a daily spend ceiling (khodrobin's is $5). Both verified in `main.py` 53–65.
13. **Choose a model per field by measurement (CS-46), against the hand labels.**
    - Evidence:
      - Instacart: cheap models were fine on simple attributes and 60 % worse on complex ones (P, second-hand).
      - Abacus: choosing per operator was 10.8× cheaper (M).
    - Never judge against a "champion" model, as Palimpzest does.
14. **Later, not now: fine-tune from reviewed corrections.**
    - It breaks even with few-shot at about 6,666 offers (M).
    - Fine-tuned models lost 17 % F1 on the other dataset (M).
15. **Double-label a subset and report agreement.** Auto-AdvER reported 92 %.

### CS-55: cross-site duplicates

*Caveat for all of these:* in the benchmarks, "the same product from two shops" is a match. Two identical 206s in Tehran are different cars, so agreeing attributes are weaker evidence here.

1. **Measure the cross-posting rate first.** Use Capot's rule as a candidate generator: same brand, model and year; mileage within 2 %; price within 3 %; different sources.
   - It linked 1,058 listings. Its precision is unmeasured, and negotiable listings cannot link (`canonical.py` 154–213, V).
2. **Hard vetoes before any score:**
   - different `model_year_sh`;
   - different trim;
   - different colours, where both are stated;
   - odometer lower by more than 5 % (caro).

   Evidence: vetoes raised cluster purity by 32.8 points on one benchmark; "precision needs hard rule-based vetoes" (Walmart, P).
3. **A deterministic SQL score and three bands, with the edges set from sampled labels.**
   - Evidence: in the ONS census study, the share confirmed as duplicates by clerical review, by match weight (P):

     | Match weight | Confirmed duplicates |
     |---|---|
     | ≥ 40 | 99.45 % |
     | 20–25 | 92.81 % |
     | 15–20 | 77.46 % |
     | 10–15 | 45.90 % |
     | 5–10 | 14.90 % |

   - Splink derives thresholds and precision–recall from a labels table (V).
   - The score: pg_trgm similarity on normalised Persian text, plus agreement on year, mileage, colour, city and price ratio.
   - Sample size: 98 correct out of 100 gives a Wilson lower bound of about 0.93, so sample more near the edge for automatic linking.
4. **An LLM only inside the uncertain band: conservative, with a structured output, and the reason stored.**
   - Evidence, in Lin's ambiguous band (M, working paper):

     | Matcher | Precision | Recall or F1 | Cost per 1,000 pairs |
     |---|---|---|---|
     | Tuned fuzzy rule | 0.401 | F1 0.445 | — |
     | Logistic regression | — | F1 0.596 | — |
     | Claude Haiku 4.5 | 0.980 | recall 0.937 | $1.30 |
     | Claude Sonnet 4.6 | 0.982 | recall 0.941 | $3.95 |

   - Lin's prompt: "Be conservative about predicting match because false positive merges are costly in deduplication."
   - OpenSanctions: production logistic matcher precision 84.46 and recall 99.42, against GPT-4o zero-shot precision 98.78 and F1 98.95 (M).
   - Output schema: match, confidence, reason, and main evidence from a fixed list that includes "insufficient".
   - Store positive, negative or unsure, with who decided (rule, model or human), the model and the prompt version, as nomenklatura does.
   - Haiku 4.5 is served on Metis's native route.
5. **Choose among at most four candidates, with a "none" option, instead of separate yes/no calls.**
   - Evidence, ComEM with GPT-4o-mini, mean F1 over eight datasets (M, COLING 2025):

     | Method | Mean F1 | Run cost |
     |---|---|---|
     | Pairwise matching | 67.80 | $0.46 |
     | Selecting | 82.26 | $0.17 |
     | ComEM | 86.42 | $0.09 |
     | Ditto trained on 5,000 pairs | 80.69 | — |

   - Accuracy falls as the true match sits lower in the list.
6. **Checked merges, never transitive closure.** One negative judgement blocks a merge, and ambiguity is refused.
   - Evidence:
     - Closure collapsed F1 from 0.540 to 0.000 on MusicBrainz 200K: "Transitivity is not a free lunch." (Walmart, P).
     - caro links neither candidate when the best two are within 0.10 (V).
7. **Demonstrations only if they measure better.** If used, pick near-misses that name the deciding attribute.
   - Evidence:
     - "manually curated examples outperform randomly selected examples by an average of 14.7 F1 points". Choosing the attributes added 13.7 points; changing "same" to "equivalent" cost 9.4 (Narayan, M).
     - Demonstrations helped in about 61 % of cases and cost small models 4–26 points (Peeters, M).
8. **Labelling practice:**
   - Oversample the uncertain band and hard negatives: same trim, year and city, but a different car.
   - Hide the machine's prediction from the labeller (Splink).
   - Allow "can't say" (Zingg).
   - Hold out by time: Avito's second-place team "failed to notice that the training set was ordered based on time!"
9. **Photos only if ADR-0010 allows them.**
   - Avito's leaders used difference hashes, image "uniqueness" and CNN features (P). caro weights pHash at 0.45, set by hand.
   - No source isolates what hashing alone is worth. The owner decides.
10. **Cost levers, only if the band grows:**
    - Cache by input hash.
    - Batch dissimilar pairs: "4x-7x cost saving"; batching similar pairs did worst (BATCHER, M).
    - Distil: a teacher costs about $450 per 1 M pairs, against $12 for the distilled matcher (Walmart, P).

### CS-62: plain-Farsi search into filters

1. **Rules first; the model sees only the words left over.**
   - Evidence:
     - sahibinden's rule parser "either parses a query very well or very poorly" (M).
     - ZoomInfo's numeric bounds scored 0.995–1.0 exact.
     - khodrobin's rules scored 50/50, 30/30 and 10/12. Its misses were number words («پونصد», «نود و پنج»), and its hard set was used to fix the rules (V).
   - Why: Metis calls take seconds (`deepseek-v4-flash` median 3,025 ms in CS-42), so chips should appear from rules at once.
2. **Chips that carry their place in the query, plus a leftover chip, with a coverage check:** spans, filler words and the leftover together must cover the whole query.
   - Evidence:
     - torob-khaneh's chip reads «این بخش را متوجه نشدم و در نتایج اثری ندارد» (verified).
     - caro's `unparsed` and `assumptions` are shown to the buyer.
   - Counter-evidence, from the frameworks:
     - LangChain's own example turns "songs that were not published on Spotify" into `NO_FILTER`.
     - LangChain's `fix_invalid` (off by default) silently deletes invalid comparisons.
     - LlamaIndex falls back to no filters without saying so.
3. **Closed vocabularies from CS-58, candidates from pg_trgm, values validated in code.** Drop anything outside the vocabulary, bound the ranges, and swap inverted ranges.
   - Evidence:
     - "specifying every entry permitted by the field significantly increased the accuracy". Categorical fields reached ≥0.95; free-text keywords only 0.804 (ZoomInfo, M).
     - DoorDash's model chooses among 100 retrieved taxonomy concepts, with hallucination "less than one percent" (P).
     - khodrobin's `intent.py` and torob-car's `word_similarity ≥ 0.6` do the same (V). LangChain never checks values.
4. **Required vs preferred.** Price, trim and year exclude listings. «مناسب اسنپ» and vague words only rank them, and vague words become buckets that code turns into numbers.
   - Evidence: DoorDash's MUST and SHOULD (P); Siddiqui's buckets with boundaries adjustable when the query runs (M); Autotrader UK's categories combined with price and mileage filters (V).
   - Why: CS-52 facts can be unknown, and a hard filter would hide those listings.
5. **Lifestyle words as declared, precomputed categories** scored from facts and hints. The model at most maps a phrase to a category id.
   - Evidence: Autotrader UK's 13 scored categories (V).
6. **Cache exact normalised queries in PostgreSQL.**
   - The key: the leftover text, the parser version and the schema version.
   - Reviewed frequent answers become aliases.
   - Evidence:
     - Yelp precomputes "high-end LLM responses for only head queries above a certain frequency threshold", and reached 95 % of traffic for one feature (P).
     - Instacart: "only 2% of queries needed real-time inference" (P).
     - Yandex Lavka: 2,000 queries make 80 % of add-to-cart actions; the cache is rebuilt daily with a fallback (P).
7. **Never make results wait for the model.** Keep a lexical fallback, and allow one retry or a repair against the schema.
   - Evidence:
     - LinkedIn routes unclear intent to keyword-only retrieval, with a median of 243–276 ms and P99 of 554–626 ms on an A100 (M).
     - Its CIKM paper found smaller models showed "lower precision and frequent hallucinations" (M).
     - Homerob races a second model after 3 s, with a 7 s deadline (V).
   - Why: CS-65 has a five-second budget.
8. **Evaluate per facet on labelled Farsi queries, and gate CI on it.** Split the set into literal, hard and messy, and keep a held-out set that is never used to fix the rules. Use a judge only with the gold reference.
   - Evidence:
     - DoorDash: 19 of 35 manually reviewed human ratings were wrong, and per-facet yes/no checks exposed broken facets (P).
     - sahibinden's judge reached Spearman 0.898 with the reference and 0.381 without (M).
     - An English-only fine-tune fell to 24 % in Basque and 64 % in French (M), so the test set must be real Farsi.
   - Realistic targets: at least 95 % on enumerations (Instacart F1 95.7 %), and 0.80–0.92 on free text.
9. **When nothing matches, suggest the filter to relax,** from counts with each filter removed (Redfin, V; caro never loosens a deal-breaker).
10. **Version prompts, schema, golden set and cache together** (LinkedIn, M).

### CS-64: explaining a rating

1. **Code computes every fact and renders it as a Farsi phrase through the app's formatters.** The model only selects, orders and joins them by fact id, or writes sentences with `{{fact_id}}` placeholders.
   - Evidence:
     - Templates reach 99.94 % fact precision, against 87.47 % for a planned neural model, and 89.21 % even with a perfect plan (Puduppully, M).
     - Tableau Pulse found raw numbers given to the model were "modified incorrectly, entirely omitted, or included in a repetitive manner", and fixed it with template sentences in between (P).
     - 60.6–85.6 % of zero-shot LLM outputs had at least one error: "too many semantic errors to be usable in practice" (Kasner and Dušek, M; 2023-era models).
     - Current models still hallucinate in 1.8–15.1 % of summaries (Vectara, V).
2. **A validator that forbids numbers in model text.** No digit in any script, and no Persian number word, outside a placeholder. Car names and years must be placeholders too, because ۲۰۶ and «تیپ ۲» contain digits.
   - Evidence from the rivals' checks, probed offline (`lab/rival-probes/`, output in `evidence/rival-probes-2026-09-29.txt`):
     - khodrobin ignores numbers under 100, so «۲ میلیارد» for a 790 M car and «۴۰ هزار کیلومتر» for 120,000 km pass; so does «هفتصد میلیون».
     - Homerob's check against all the digits in the facts, with anything ≤10 exempt, passes «۵ میلیارد» for a 500 M deposit.
   - Evidence from the Persian libraries, tested in this pass (not kept):
     - persian-tools' `wordsToNumber` turns «0.7 میلیارد» into 1,000,000,000 and sums every number in a sentence.
     - Parsivar breaks compound numbers.
   - Why: detecting a number is safer than parsing it.
3. **One retry with the validation error, then a template built from the same facts.** Count rejections, and cache by a hash of the facts plus the prompt and guard source.
   - Evidence: khodrobin's `fallback()` and its guard-hash cache (V); templates had 0.000 hallucinations per example (Kasner 2022, M).
4. **A topic guard: a topic may appear only if a fact supports it.** khodrobin's list covers warranty, insurance, engine, inspection, seller, financing, paint, options, paperwork and superlatives. It came from real incidents: an invented mechanical warranty, and «بدون رنگ و بدون تصادف» slipping past a check that looked only at numbers (V).
   - For Carshenas, paint condition is allowed when it is an extracted fact.
   - Also: a marketplace named in the text must have an offer.
5. **The explanation states the rule's inputs; never ask a model why a car is a good deal.**
   - Evidence:
     - 1 of 426 explanations mentioned the bias that drove the answer (Turpin, M).
     - Reasoning models revealed their hints only 25–39 % of the time (Chen et al., M).
6. **An evidence ledger.** Each claim cites comparable listing ids and dates, and `unsupported_claims()` must be empty (caro `agents.py`, V).
   - Show the gap in toman computed by code: Autotrader shows the "precise variance"; the CarGurus patent example reads "$1,134 BELOW".
   - Optionally show the price at which the rating would change (CarGurus's Next Best Deal Rating, 10-K).
7. **Measure faithfulness with error spans on about 100 explanations,** using Kasner's categories and factgenie (MIT). Report the share of outputs with any error.
   - An LLM judge may triage but never gate: only 49.5–56.4 % of its span annotations are fully correct (M).
8. **No seller text in the input.** That removes the prompt-injection surface; khodrobin builds names from its vocabulary and drops flagged offers (V).

### CS-50: name matching

1. **One alias table, applied by code and shared by the crawler and the query parser.**
   - Longest alias wins; numeric aliases need digit boundaries.
   - Fold before matching: NFKC, Persian and Arabic digits, Arabic yeh and kaf, the zero-width non-joiner (khodrobin `fold()` and `build_index.py`, V).
   - Evidence: "rules over-match, while LLMs struggle with cross-script transliteration" (OpenSanctions, M).
2. **Report coverage and precision separately, with an explicit "unmatched" queue.**
   - khodrobin's 56 % counts brand, model, year and price together. An offline rebuild from its seed gives 54.4 % (1,579 of 2,902), and its precision was never measured.
   - The misses are mostly aliases: no model in 19.5 % plus 4.1 %, no brand in 13.7 % plus 3.4 %.
3. **An LLM drafts aliases offline; a person reviews them; code applies them.**
   - Evidence:
     - LLM value mappings covered 92 %, with one known failure: keeping the original value when nothing fits (Steiner and Bizer, M).
     - Name expansion scored 98.3 F1 (M).
     - Capot learns Persian and Latin pairs from sources that publish both (V).
4. **For what is left, select among the top-k pg_trgm candidates with "0 = none"** (the ComEM shape; torob-car's `word_similarity ≥ 0.6`).

### CS-51: market value (confirms it stays statistical)

1. **The number comes from a comparables median in SQL, never from a model.**
   - Evidence:
     - On real-estate data, gradient boosting had a mean absolute error of 4.30, Claude 3 Opus 5.08 and GPT-4 5.25. The authors do not suggest LLMs "should replace (at least currently) traditional regression methods" (Vacareanu, COLM 2024).
     - Claude-3.5-Sonnet given 2,048 random examples had 275.00 % mean absolute percentage error on Craigslist cars, against 6.30 % for a fine-tuned Mistral-7B (Vedula, Findings of ACL 2025).
     - Trees lead on data of about 10K rows (Grinsztajn, M).
2. **Evaluate prospectively.** Freeze values at the release cut date, and score listings first seen afterwards. Exclude the listing's own duplicate cluster from its comparables, and never feed the asking price into its own value.
   - Evidence:
     - Zillow scores the estimate "published on or just prior to the sale date". Its on-market median error is 1.83 % against 7.01 % off-market, because on-market estimates use the listing price (V).
     - Redfin: 1.88 % and 7.37 % (V).
     - ProbSAINT splits by time: the CatBoost model in use scores 6.3 % and 5.7 % (M).
     - The Cook County Assessor tests on the most recent 10 % of sales (P), and caro splits by the car's first sighting (V).
   - So Capot's 7.6 %, on a random split after filtering outliers, is not comparable.
3. **Report more than the median error:**
   - the share within 5, 10 and 20 % (Zillow on-market: 83.95 / 95.39 / 98.83 %; off-market: 38.69 / 62.71 / 83.20 %);
   - coverage, the share of listings rated;
   - bias by price band, model and age;
   - error per source.
4. **Abstain.** No rating with too few comparables, damage to the chassis or frame, or a price-type trap.
   - Evidence:
     - CarGurus gives no rating for "Too few comparable vehicles in the area", salvage or frame damage, or a price "too good to be true" (P).
     - Redfin shows no estimate without enough recent nearby sales (V).
     - Autotrader UK values only when its curve explains the adverts, and never for cars over 15 years old (P).
5. **Show a range and the dates of the comparables:** the interquartile range, the Zillow range ("A wider range generally indicates a more uncertain Zestimate") and KBB's range. Weight recent data, as Autotrader UK's 28-day window does.
6. **Pool thin trims up the catalogue:** trim, then model, then make (Autotrader UK's hierarchical curves).
7. **Gate any learned model on a baseline.** It must beat the comparables median on the time split, or the baseline ships (caro's `AcceptanceGate` and `NotBenchmarked`, V).
8. **Lifecycle hygiene:**
   - A disappearance is not a sale. A 403, 429, 5xx or timeout means unknown; only a 404 or 410 means gone. Snapshots with more than 20 % absent are excluded (caro `tracking.py`, V).
   - Keep flagged offers out of the medians. khodrobin includes them: 13 of 64 affected specs change median by up to 32.3 % when they are removed (reproduced in this pass, not kept).

## 3. Corrections to the 2026-09-28 field note

These come from reading the code.

- **khodrobin's "rules first, a local 7B model as fallback" is not wired.** `needs_model()` (`services/crawler/extract.py:134`) is never called. The LLM `/intent` endpoint is never called either: the Go API uses only `ParseQuery`. The 7B model writes explanations only.
- **Its "five-part check" is five axes:**
  - numbers of 100 or more must be in a supported set;
  - percentages must match within 0.05;
  - forbidden topics;
  - marketplace names;
  - a coherence check on loss framing.

  Numbers under 100 are ignored, which is why errors in scale words pass (probed; `evidence/rival-probes-2026-09-29.txt`). There is no labelled explanation set, and the planned prompt-injection demo has no test.
- **khodrobin's 100 % query scores come from sets used to build the rules.** Its CI thresholds are 100 / 100 / 83 (verified in its Makefile).
- **Capot's 7.6 %** is computed after removing presale listings and outliers beyond 0.35× or 3× the cohort median, before a random split. It cannot be reproduced (the data is gitignored), and the repository has no licence.
- **caro's 100 % win rate over a price sort** is on 11 synthetic queries.

## 4. What not to take, and why

- **Python frameworks as dependencies:** LangExtract, DocETL, LOTUS, Palimpzest, LangChain, LlamaIndex, TabPFN, and Splink, dedupe or Zingg at runtime.
  - The stack is TypeScript and PostgreSQL, and their optimisations target long documents.
  - Port the ideas instead; LangExtract's alignment is about 200 lines.
  - Licences: Zingg and Cook County are AGPL. MatchGPT, ComEM, BatchER, Capot and torob-car declare no licence, so take ideas only.
- **Loops that cost more for no measured gain:** self-correction, gleaning or extra passes by default (2–2.6× tokens), and ensembles of five to seven LLMs (2–3 points for 5–7× the cost).
- **Judging against the wrong reference:** model-agreed labels as gold (Mannheim found MAVE's labels full of errors), or a "champion" model as judge.
- **Model confidence treated as a probability,** and log-probability confidence on routes that don't return log-probabilities.
- **Wrong shapes for duplicate decisions:**
  - transitive closure;
  - long candidate lists;
  - batching similar pairs;
  - an LLM on every blocked pair;
  - hand-set weights (caro);
  - seller fingerprints (personal data).
- **An LLM on every uncached query** (torob-car).
- **An embedding-similarity query cache.** «زیر ۷۰۰» and «زیر ۸۰۰» embed almost identically; this is inference, not measured.
- **Hidden rewrites** (Yelp's silent location rewrite).
- **Conversational search,** backed only by press-release numbers.
- **Fine-tuning, distillation, our own GPUs, or a local 7B model on CPU:** about 10 s cold in khodrobin, fit only for precomputing.
- **Model-written numbers or reasons, or trusting "use only these facts"** in the prompt.
- **Citations for CS-64.**
  - The facts are database rows, not documents.
  - It "cannot be used together with structured outputs" (a 400 error).
  - It is Anthropic-only and was not measured through Metis.
  - For CS-52 evidence spans, aligning quotes in code is simpler than a second call.
- **Vertex check grounding.** Google Cloud would need an ADR on reachability from Iran.
- **Persian number libraries as checkers, as they are:** borrow their word tables only.
- **Rival shortcuts:**
  - an unmeasured regex checker (the E2E slot checker itself mis-rated 19.5 % of instances);
  - Homerob's check against all the digits in the facts, and its temperature of 0.6;
  - hand-bumped prompt versions;
  - Capot's merge of LLM flags, which can only add flags.
- **Valuation mistakes:**
  - random splits;
  - tuning on the test set (Belard);
  - the asking price as an input to its own value;
  - fixed percentile bands (the patent). Use percentage-gap boundaries, versioned and checked in CS-73.

## 5. Unverified items and dead links

**Refused (403) or blocked:**
- Zillow's live page and the Instacart and DoorDash sites (read through Wayback copies instead).
- Medium, and Instacart PARSE's primary post (read through zenml.io's summary).
- An MDPI paper on perceptual hashes.
- Zillow's fair-housing post and StreetEasy.
- cargurus.dev returned 429.
- DBLP was unreachable, and Mannheim's MADOC repository sits behind a bot challenge that was not bypassed.

**Taken from the paper or a single secondary source, not checked independently:**
- LinkedIn's KDD '26 and CIKM '25 venues come from the papers themselves.
- LLM-CER's SIGMOD '26 venue comes from its PDF.
- ADBIS 2025 for Korini and Bizer comes from the group page.
- Walmart's semantic-cache figures are a second-hand summary of a talk.

**No venue found:** Agarwal et al. and Chen et al. 2025.

**Not checked:**
- Whether Citations, Cohere documents or log-probabilities pass through Metis.
- Whether TabPFN weights can be downloaded from Iran.
- The khodrobin figures of "10 %" and "13 (or 10) of 93", and its latencies.
- Capot's documents disagree with themselves: 11.5 % against about 36 % «توافقی»; Divar error 18.5 % against 28 %.
- The kmbro/langextract-typescript port (Apache-2.0): only its metadata was read.

**Not found:** no public Persian classified-ad extractor that reports per-field accuracy outside the Torob field, and no Divar, Torob or Digikala post on query understanding with language models (searched 2026-09-29).
