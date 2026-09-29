# What will Torob's reviewers judge, what did other entrants build, and where can Carshenas win?

- Date: 2026-09-28
- Asked by / for: Pedrum, before starting CS-33: "put yourself in place of a top tier tech company in silicon valley who is running this challenge? what do you expect from me? to solve it minimally? to say in real world we have integrations with these websites and there is no need for crawler? ... search github for torob ai product engineer submissions ... i want to beat everybody." For ADR-0017 and CS-75.
- Outcome:
  - The reviewers' checklist and the map of Torob's ten search problems in `docs/product/challenge.md`.
  - ADR-0017: a live, bounded index.
  - The storyboard below, linked from CS-75.
  - The backlog re-sequenced on 2026-09-28. The critical path comes first; alerts and three sources move after the demo (m-7).

## Questions

1. What do the challenge page, the job record and the careers home page ask for, read on 2026-09-28?
2. What do companies that hire through work samples reward, and what would a demanding reviewer expect here?
3. Which entries are public, what did they build, and how did each get its data?
4. Where is the field weak, and what would make Carshenas the strongest entry?
5. What should five minutes of video show?

## Sources

**Torob, primary, read on 2026-09-28:**

- The challenge page, <https://jobs.torob.com/ai-product-engineer>, opened in the agent's browser after solving the careers page's puzzle. As in `docs/product/challenge.md`, the solution is not recorded.
- The public careers API, <https://jobs.torob.com/api/public/v1/careers/jobs>, fetched with curl. It holds the AI Product Engineer record, published 2026-09-05, with its responsibilities and requirements.
- The careers home page, <https://jobs.torob.com/>, and its script. They hold the ten problems behind every search, the interview path and the hall of fame.
- Torob-Sync, Torob's shop integration documentation, <https://github.com/Torob/Torob-Sync>, opened by the research agent.
- Torob's design contest, <https://jobs.torob.com/torob-design-contest>. The research agent opened it, but its judging sentences rest on a sub-agent's reading.
- Torob's engineering post on ticket automation, <https://vrgl.ir/DsUdm> (2025-05-27), as summarised in `2026-09-26-torob-product-and-playbook.md`.

**Hiring through work samples** (all via sub-agent, not opened by the agent):

- Linear:
  - <https://linear.app/now/why-and-how-we-do-work-trials-at-linear> (2023-12-13)
  - <https://linear.app/now/how-we-hire-at-linear> (2026-04-28)
- PostHog's handbook: <https://posthog.com/handbook/people/hiring-process/engineering-superday>.
- Canva: <https://www.canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews/> (2025-06-11).
- Fly.io:
  - its hiring documentation, <https://docs.fly.io/hiring/hiring/>
  - Thomas Ptacek's essay, <https://sockpuppet.org/blog/2015/03/06/the-hiring-post/> (2015-03-06)
- Y Combinator: <https://www.ycombinator.com/library/J8-yc-application-tips-include-a-demo> (2021-09-06).

**The entrants:** a GitHub search on 2026-09-28, through the API and shallow clones, plus web searches. It covered repository names, descriptions and READMEs, code, commits and the `torob` topic. Each repository's README and code were read on that date, and what a repository says about itself is self-reported. The repositories that matter most:

- Cars:
  - <https://github.com/sobhanaz/khodrobin>
  - <https://github.com/mhnasajpour/Capot>
  - <https://github.com/pejmanS21/torob-car> and its crawler <https://github.com/pejmanS21/drill>
  - <https://github.com/sahandmusanezhad/caro>
  - <https://github.com/ArminRmt/torob-contest>
  - <https://github.com/zeinabmontazeri/torob-khodro>
  - <https://github.com/hfeizbakhshian/torob-repair>
- Homes:
  - <https://github.com/MohammadJavadHeidari/Homerob>
  - <https://github.com/kiana-nb/torob-khaneh>
  - <https://github.com/aliiiheydar/maskan-ai>
  - <https://github.com/pooya79/TorobRent>
  - <https://github.com/AlirezaZandi/torob-rental>
  - <https://github.com/abolfazlghalandary/TorobKhane>
  - <https://github.com/Ehsan-Jahanbakhsh/torob-property>
- Insurance: <https://github.com/MME1893/Torob-Bimeh> and <https://github.com/SasanKolahi/torob-bimeh>.
- Travel: <https://github.com/mjavadalavi/torob-ticket> and <https://github.com/MSNP1381/Torob_flight_search>.

Eleven more cover courses, phones, doctors, food, B2B buying, servers, cloud hosting, equipment rental, medicines, exchange rates and events.

## Findings

### 1. What Torob asks

The full record is in `docs/product/challenge.md`. What matters for judging:

- **The hall of fame's three words:** "tasteful, bold and usable" («باسلیقه، جسورانه و قابل استفاده»). It was empty on 2026-09-28.
- **The video:** it shows the problem, the product and "your important decisions".
- **The job record:** building ways to evaluate AI accuracy is a responsibility, not a nicety. So is knowing "when to get help from AI and when it is better to go another way".
- **The careers page:** every search is about relevance, data quality and price freshness, and it lists ten problems behind a search.
- **After a submission is chosen**, the engineering path includes a technical interview or a task reviewed in a session. The repository will be read, not only the video watched.

### 2. What work-sample reviewers reward

All via sub-agent.

- **Linear:** a paid trial of two to five days on a real project, judged on judgement, product sense and communication.
- **PostHog:** "ship a working core feature early", with "deliberate choices about what to … skip".
- **Canva:** scores scoping, and whether candidates catch the flaws in code an AI wrote.
- **Fly.io:** grades work samples against a fixed rubric.
- **Y Combinator:** a rough demo, "even a CSV", beats none.
- **Torob's own signals:**
  - Its design contest says a design that "could go into the product now" scores higher, that correctness alone is not enough, and that "data isn't always complete".
  - Its own AI work is reported against a labelled set: 68 % of steps handled, 92 % of those right.

**Reading:** a demanding reviewer wants a working slice on real data that they can use themselves. They want scope chosen on purpose and the choices explained, AI measured and used only where it beats code, and taste. The same reviewer penalises polish without substance, and a plan without a product.

### 3. The field

**The count.** Thirty public repositories are, or very likely are, entries, 29 of them real: 8 for cars, 7 for homes, 2 for insurance, 2 for travel and 11 for other markets. Their data:

| How data is obtained | Entries |
|---|---|
| A scheduled crawler feeds real data | 3: khodrobin (cars), TorobKhane (homes), torob-abr (cloud hosting) |
| A one-off snapshot of real data | 11 |
| The sources are called on each search, and nothing is kept | 4: insurance, travel and exchange rates |
| Invented, fixture or hand-typed data | 11 |

**The car entries:**

| Entry | Data | AI and its measurement | Can a reviewer use it? | What stands out |
|---|---|---|---|---|
| **khodrobin** «خودروبین», sobhanaz; created 2026-09-06, last push 2026-09-09 | Live: five sites every three hours, one request a second per site, backing off on 429, treating Divar's empty HTTP 200 as a block. It reads Divar from the schema.org data in its pages, where prices are in rials. From 33,770 captures of 15,763 unique listings, 8,837 (56 %) were resolved to a spec; its committed seed has 3,075 rows, 194 of them from Divar | Rules first, a local 7B model as fallback. Precomputed explanations pass a five-part hallucination check. 92 labelled queries, and CI fails if the score drops. Nothing measures the reading of listings | Its URL refused connections on 2026-09-28. A 4:50 video is planned in its roadmap: the same car on three sites, `make eval` on camera, a prompt-injection test, uploaded to Aparat | The rival to beat. It rates at the level of a spec (make, model, trim, gearbox, year, mileage band), not per listing. Sold listings stay in its medians forever. It hotlinks photos |
| **Capot** «کاپوت», mhnasajpour | A snapshot of 22,820 cars from four sites, not committed | A gradient-boosted price model on log price: median error 7.6 %, mean 14.4 %, R² 0.929, on a random 20 % hold-out. Prices negotiable listings. Search precision at 5 is 93.2 % on 38 queries | No URL, no video | The best-measured valuation in the field, but no product to open |
| **torob-car** «ترب‌کار», pejmanS21 | A committed snapshot of 14,652 Divar rows, 4,922 of them motorcycles, plus about 900 from other sites. It exposes the coordinates of 14,528 listings | Query parsing and a chat assistant, with 10 unscored test cases | No URL, no video | The most features (search, compare, estimate with a range, alerts). Its crawler can observe removals, but the app never uses it |
| **caro**, sahandmusanezhad | Tiny Bama runs (155 and 228 listings) | Statistical gates, and no model in decisions | Its own script calls the shortlist "not filmable today" | Ideas worth keeping: "a disappearance is not a sale", "unknown is not absent" |
| Five more | Hand-started crawls, samples or placeholders | None, or small | None | — |

**Correction (2026-09-29, CS-43), from reading the entries' code.** Details are in `2026-09-29-prompting-context-engineering-and-agents/similar-work.md`, section 3.
- **khodrobin's model fallback is not wired.** Its "rules first, a local 7B model as fallback" never runs: `needs_model()` is never called, and its Go API uses only its rule parser. The 7B model writes explanations only.
- **khodrobin's hallucination check** has five axes, and it ignores numbers under 100.
  - A false «۲ میلیارد» or «۴۰ هزار کیلومتر» passes, as do number words and invented claims. This was probed offline: `2026-09-29-prompting-context-engineering-and-agents/evidence/rival-probes-2026-09-29.txt`.
  - Its 100 % query scores come from sets that were used to build its rules.
- **Homerob's number check** passed every false case in the same probe.
- **Capot's 7.6 % median error** is measured after removing presale listings and prices beyond 0.35× or 3× the cohort median, on a random split. Its data is not in the repository, so it cannot be reproduced.

**Elsewhere:**

- **Homes:**
  - torob-khaneh is the most complete package: real data (one crawl of 698 homes), a live site and a 3:52 video on Aparat. But it has no model, and its data is frozen.
  - Homerob has good product sense, and checks the numbers in its explanations. It runs on 50 hand-exported listings from one city.
- **Insurance:**
  - Torob-Bimeh aggregates live, but through the author's copied browser logins, with no evaluation, and its CI fails.
  - The other insurance entry uses invented premiums.
- **Travel:** one flight search silently invents flights when calls fail.
- **How the field crawls:** many entries fake a Chrome identity or retry through 429s. Only one entry checks robots.txt in code, and its sites are fictional.
- **What reviewers can reach:** four live URLs answered on 2026-09-28, and five entries have a real demo video.
- **Parsing traps other entrants documented:**
  - Divar's schema.org prices are in rials.
  - Bama labels prices IRR but publishes tomans.
  - Jalali and Gregorian years mix within one feed.
  - Divar uses 1,000,000 km to mean "unknown".
  - About 11.5 % of listings are «توافقی».
  - Down payments are posted as full prices.
  - CS-34 turns these into tests.
- **How long the challenge has run:** the earliest repository that names it was created on 2026-07-17.
- **A reported deadline, not verified:** khodrobin's hand-off note of 2026-09-08 speaks of "a 300-person challenge" with "submission 20 Sep". Torob's page showed no deadline on 2026-09-28, its form was open and its hall of fame empty. Entries in private repositories, or submitted as video only, cannot be seen.

### 4. Where the field is weak

1. **A fresh index with a listing lifecycle.** No car entry with real data retires sold or removed listings, records price drops or counts days on market. Two good lifecycle designs exist, but only on invented data. This is ADR-0017, CS-35 and CS-64.
2. **Measured AI where the data is messy.** Nobody reports per-field accuracy on real listings, for trim, paint condition (رنگ‌شدگی), mileage or installment and «حواله» traps. This is CS-34, CS-48 and CS-52.
3. **A rating for each listing, with its comparables and confidence.** khodrobin rates specs; Capot has a model but no product. This is CS-51 and CS-64.
4. **One car followed over time.** Nobody tracks reposts and price changes of one car across days and sites. This is CS-55, the vehicle and its membership history in `docs/design/data-model.md`. There is a risk to the demo, though. khodrobin says cross-site duplicates are rare, and Capot linked 1,058 among about 22,800 listings, roughly 5 %. So CS-55 measures the cross-posting rate first, and if «ارزان‌تر در ...» proves rare, the demo leads with one car's price history across reposts instead.
5. **Something a reviewer in Tehran can open, with fresh data, plus a video they can play.** No car entry has this. That means a live URL inside Iran (CS-37), and a video uploaded to the form or on Aparat, never on YouTube, which is filtered in Iran (CS-75).
6. **Visible, polite and private crawling.** Rare in the field. This is ADR-0008, the display policy in ADR-0017, and snapshots without coordinates or contact data.
7. **Cost and speed per query.** Only khodrobin reports them. This is CS-52 (cost per thousand listings), CS-59 (latency at the 95th percentile) and CS-65 (five seconds).
8. **Explanations checked for faithfulness, and ranking checked for usefulness.**
   - Guards against invented numbers exist in two entries, but nobody reports a faithfulness rate on a labelled set (CS-64).
   - Nobody shows that the ranking helps a buyer. A small blind comparison against a price sort would be unique, and it is optional, after the demo path.
9. **Resistance to hostile listing text.** Listings are written by sellers, and a model that reads them can be instructed by them. khodrobin plans to show a prompt-injection test on camera, so Carshenas needs one too (CS-52).

**Targets from the field:**

- The valuation should beat Capot's 7.6 % median error, measured on a split by time, which is harder and more honest than Capot's random split (CS-51).
- Identification should beat khodrobin's 56 % (8,837 of 15,763 unique listings) on the tracked models (CS-50).

### 5. A five-minute storyboard

| Time | Scene | What it proves |
|---|---|---|
| 0:00–0:25 | A buyer holds a Divar link to a 206 at 1.25 billion toman: is it fair? Prices move weekly, condition hides in the text, the same car is on two sites, and a quarter of car listings contradict their own fields (Divar's statistic). | The problem, in the market's own numbers |
| 0:25–1:05 | Plain-Farsi search («۲۰۶ تیپ ۲ بدون رنگ زیر ۱٫۳ میلیارد، مناسب اسنپ»). The understood filters appear as chips, and results are ranked by deal, with badges and gaps. | Ranking by user intent |
| 1:05–1:55 | A listing: the gauge; the comparables behind the market value, dated; condition chips with the sentence each came from; price history; «همین خودرو در باما ۴۰ میلیون ارزان‌تر». | Explaining the best choice; normalising messy data; the Torob moment |
| 1:55–2:25 | Paste a live Divar link: a verdict in seconds, with "checked just now". | Usable by the reviewer, on their own input |
| 2:25–3:05 | The superadmin tracks a new model: the backfill fills it, and its sync appears. Then the public data-status page. | A live index, and control over it |
| 3:05–4:05 | How it works: sources, parser, LLM, catalogue, duplicates, valuation, search. The measured numbers: extraction accuracy and cost per thousand listings; valuation error on listings posted after the release date; duplicate precision; freshness. Then a listing that tries to instruct the model, which changes nothing. | AI where it earns its place, with evidence; safe with hostile text |
| 4:05–4:40 | The decisions: live rather than a sample; polite and bounded, stopping on a block, no personal data; a partner feed is the production path; what was cut. | Judgement |
| 4:40–5:00 | What the ratings predict (CS-73), and what comes next. | Learn and iterate |

Record on the live site in one sitting, and choose the example cars that day, because listings change hour to hour. The live moments prove the index is live: a Divar listing posted that day, and the status page. The numbers quoted come from a frozen release (CS-49), which is also the fallback if a source blocks on the recording day. Submit the live link. Upload the video to the form (up to 200 MB) or put it on Aparat, never on YouTube, which is filtered in Iran. Put the numbers and a short map of the repository in the form's optional notes.

## Recommendation

**What a demanding reviewer expects, in answer to the owner's questions:**

- **Not a minimal solution, and not "production would use integrations, so no crawler".** The brief begins "crawl offers". Show a bounded, polite, live crawler, and the adapter a partner feed would replace, which is how Torob itself onboards shops.
- **A deliberate scope, done end to end:** Tehran; the tracked models, the ten most listed to start; Divar and Bama. Alerts and three more sources are cut (m-7).
- **Evidence for every claim:**
  - per-field accuracy of the parser and the model, with the cost;
  - valuation error on listings posted after a release's cut date;
  - duplicate precision;
  - ratings checked against what the market did next (CS-73);
  - freshness.
- **Freshness as a feature.** It is one of the three things Torob says every search is about, and the reason a live index beats a sample (ADR-0017).
- **Ship first, then deepen.** Deploy the worker as soon as the crawler works, so history builds up (CS-37). Submit when the demo path works: the hall of fame is empty, the role may be filled, and one rival's notes speak of a submission date of 2026-09-20, which is unverified. It is worth asking Torob whether submissions are reviewed in batches.
- **Beat the strongest car entry where it is weakest.** khodrobin never retires sold listings, rates specs rather than listings, measures only its query parsing, and its site was down on 2026-09-28.

**Order of work**, the backlog queue as renumbered on 2026-09-29 (`backlog task list --status "To Do" --sort ordinal`). The task numbers run in the order of work:

1. **Data flowing and deployed, CS-32 to CS-38:** the worker, the Divar crawler, parsing, freshness, the repository, then the deploy (CS-37). The deploy puts the database, the worker and the web app as it stands on an Iranian host, and every later task redeploys. CI (CS-38) follows.
2. **Accounts, the superadmin section and worker observability, CS-39 to CS-41.**
3. **The AI foundation, CS-42 to CS-47, before any task calls a model:** Metis AI, the research on prompting and agents, the choice of the AI layer, the layer itself, a model for each step, and the Claude Code skill, rules and reviewer for AI features.
4. **Labels, catalogue, valuation, extraction and tracked models, CS-48 to CS-53.**
5. **Second source and duplicates, CS-54 and CS-55.**
6. **Screens, CS-56 to CS-67:** the teardown, the body-type icons, the shared filters and catalogues, search, the photo decision, the search page, plain-Farsi search, the home page, the listing page, pasted links, the status page and the model page.
7. **The product working for the buyer, CS-68 to CS-72:** the inbox, marked listings, search files, crawl requests the superadmin approves, and proactive matching.
8. **Evidence, CS-73 and CS-74.**
9. **Recording and submission, CS-75.**
10. **After the demo:** CS-76 and CS-77.
