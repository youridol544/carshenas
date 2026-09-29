# Should Carshenas crawl live, work from a crawled sample, or search the sources at query time, and how does a live index stay fresh within ADR-0008's limits?

- Date: 2026-09-28
- Asked by / for: Pedrum, before starting CS-33: "are we going to have a live crawler for divar, bama, ... regardless of their policy? ... are we planning to download a sample of crawled results and only work with those? or we have a live planner?" The owner named three options (a live crawler, a crawled sample, or no stored listings with query-time searches of the sources' APIs) and proposed a superadmin who chooses the tracked car models. For ADR-0017.
- Outcome: **ADR-0017** (accepted by delegation, 2026-09-28): a live, bounded index kept fresh within a daily request budget per source, tracked models read in depth, frozen releases for evaluation, and on-demand reads for single listings only. It produced tasks CS-34, CS-35, CS-49, CS-53, CS-66 and CS-73, and changed CS-33, CS-37, CS-51, CS-54, CS-59, CS-64 and CS-65 (numbers as renumbered on 2026-09-29). CS-33 then measured Divar's Tehran market (section 6, data in `2026-09-28-listing-data-and-freshness/`): busier than the 1399 figures, and ten tracked models fit the budget.

## Questions

1. How large is Divar's used-car category, in Tehran and nationally, and how quickly does it turn over?
2. How do aggregators get listings and keep them fresh, and what does Torob itself do?
3. How often does CarGurus recompute its market value, from what, and when does it give no rating?
4. What does each of the owner's three options cost and buy under ADR-0008's floor of one request per three seconds per host?
5. What did other challenge entrants who read Divar run into?

## Sources

Collected on 2026-09-28 by a research agent and its sub-agents, and sent to no listing source. Markers:

- **opened**: the agent fetched the page.
- **via sub-agent**: a sub-agent reported reading it at this address, and the agent did not open it.
- **snippet**: seen only in a search result or in another repository's notes.

Numbers marked **estimate** were calculated here, not published.

**Divar, Bama, Karnameh and Khodro45, as reported in the press (self-reported by each company):**

- Divar's own reports:
  - TCCIM news, Divar's 1398 figures, 2020-09-02, opened: <https://news.tccim.ir/story?nid=64850>.
  - Digiato, Divar's 1399 report, 2021-08-08, opened: <https://digiato.com/article/2021/08/08/%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4-%D8%B3%D8%A7%D9%84-%DB%B9%DB%B9-%D8%AF%DB%8C%D9%88%D8%A7%D8%B1>.
  - Eghtesad Online, Divar's 1399 report, 2021-08-12, opened: <https://www.eghtesadonline.com/بخش-عمومی-30/553013-انتشار-میلیون-آگهی-در-دیوار>.
  - Zoomit, Divar's 1400 report, 2022-07-13, opened: <https://www.zoomit.ir/tech-iran/384229-divar-application-annual-report/>. This is the latest annual report; the English Wikipedia article (read 2026-09-28) cites none later.
- Divar's own statistics since then:
  - Asriran, Divar's most-listed cars, 2025-02-03, opened: <https://www.asriran.com/fa/news/1034871/%D8%A7%D8%B2-%D9%BE%D8%B1%D8%A2%DA%AF%D9%87%DB%8C%E2%80%8C%D8%AA%D8%B1%DB%8C%D9%86-%D8%AA%D8%A7-%D9%BE%D8%B1%D8%A8%D8%A7%D8%B2%D8%AF%DB%8C%D8%AF%D8%AA%D8%B1%DB%8C%D9%86-%D9%85%D8%A7%D8%B4%DB%8C%D9%86%E2%80%8C%D9%87%D8%A7-%D8%AF%D8%B1-%D8%AF%DB%8C%D9%88%D8%A7%D8%B1>. It gives a ranking without counts.
  - Fararu, proof of ownership for free car listings, 2025-02-18, opened: <https://fararu.com/fa/news/834602/>.
  - Peivast, interview with Divar's chief executive, 2025-03-09, opened: <https://peivast.com/p/224543>.
  - Peivast, Divar's car-listing quality statistics, 2025-12-27, opened: <https://peivast.com/p/251323>.
  - Zoomit, the same announcement and paid car listings, 2025-12-27, opened: <https://www.zoomit.ir/iran-news/454623-divar-launches-ad-quality-reward-scheme/>.
  - Donya-e-Eqtesad, Divar's price estimator, 2022-07-27, opened: <https://donya-e-eqtesad.com/%D8%A8%D8%AE%D8%B4-%D9%88%D8%A8-%DA%AF%D8%B1%D8%AF%DB%8C-96/3885539-%D8%A8%D8%B1%D8%B1%D8%B3%DB%8C-%D9%82%D8%A7%D8%A8%D9%84%DB%8C%D8%AA-%D8%AA%D8%AE%D9%85%DB%8C%D9%86-%D9%82%DB%8C%D9%85%D8%AA-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AF%D8%B1-%D8%B3%D8%A7%DB%8C%D8%AA-%D8%AF%DB%8C%D9%88%D8%A7%D8%B1>.
- Bama's 1400 report:
  - Peivast, 2022-08-22, opened: <https://peivast.com/p/140407>.
  - Donya-e-Eqtesad, 2022-06-26, opened: <https://donya-e-eqtesad.com/%D8%A8%D8%AE%D8%B4-%D8%B4%D8%B1%DA%A9%D8%AA-%D9%87%D8%A7-104/3893850-%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4-%D8%B3%D8%A7%D9%84%D8%A7%D9%86%D9%87-%D8%A7%D8%B2-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AF%D8%B1-%D8%B3%D8%A7%D9%84-%D9%85%D9%86%D8%AA%D8%B4%D8%B1-%D8%B4%D8%AF>.
- Karnameh's reports:
  - Digiato, 1401, 2023-06-11, opened: <https://digiato.com/iran-technology-news/carname-car-market-sales-assistant>.
  - Tejarat News, 1402, 2024-07-28, opened: <https://tejaratnews.com/%D8%A8%D8%AE%D8%B4-%D8%AA%D8%AD%D9%84%DB%8C%D9%84-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-58/925369-%DA%AF%D8%B2%D8%A7%D8%B1%D8%B4-%D9%88%D8%B6%D8%B9%DB%8C%D8%AA-%D8%A8%D8%A7%D8%B2%D8%A7%D8%B1-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AF%D8%B1-%D8%B3%D8%A7%D9%84>.
- Khodro45's 1404 report:
  - Pedal, 2026-09-09, opened: <https://www.pedal.ir/news/746712-khodro45-annual-market-report/>.
  - Zoomit, 2026-09-09, opened: <https://www.zoomit.ir/report/466735-khodro45-annual-report-1404/>.
- The passenger-car fleet by model: Agah, 2023-05-17, opened: <https://ava.agah.com/news/daily-report/%D8%A2%D8%AE%D8%B1%DB%8C%D9%86-%D8%A2%D9%85%D8%A7%D8%B1-%D8%AE%D9%88%D8%AF%D8%B1%D9%88%D9%87%D8%A7%DB%8C-%DA%A9%D8%B4%D9%88%D8%B1--%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF%D8%9B-%D9%BE%D8%B1%DA%86%D9%85%D8%AF%D8%A7%D8%B1-%D8%AC%D9%85%D8%B9%DB%8C%D8%AA-%D8%AF%D8%B1-%D8%A8%DB%8C%D9%86-%D8%A7%D9%86%D9%88%D8%A7%D8%B9-%D8%AE%D9%88%D8%AF%D8%B1%D9%88%D9%87%D8%A7%DB%8C-%D8%B3%D9%88%D8%A7%D8%B1%DB%8C>. It credits the Statistical Centre of Iran, whose own publication was not seen.
- Weak sources, used for colour only:
  - A posting guide, undated, opened: <https://robatland.com/divar/divar-ads/>. It is the source of the one-month listing lifetime and the 72-hour wait to re-post.
  - Mehr, 2025-11-01, opened: a Khodro45 advertorial.
  - Gadgetnews, 2026-05-04, opened: the car sellers' union on a stalled market.

**How listings are kept fresh:**

- Torob-Sync, Torob's own integration documentation, opened. It is primary.
  - <https://github.com/Torob/Torob-Sync>
  - <https://raw.githubusercontent.com/Torob/Torob-Sync/master/product_api_v3.md>
  - <https://raw.githubusercontent.com/Torob/Torob-Sync/master/product_webhook.md>
- Google, all via sub-agent:
  - Vehicle listings feed setup, updated 2024-11-20: <https://developers.google.com/vehicle-listings/integration-process/feed-setup>.
  - Merchant Center help: <https://support.google.com/merchants/answer/12159029> and related pages.
  - Search Central, Gary Illyes on caching, 2024-12-09: <https://developers.google.com/search/blog/2024/12/crawling-december-caching>.
  - Crawl budget, updated 2026-07-22: <https://developers.google.com/crawling/docs/crawl-budget>.
- CarGurus and phantom inventory, all via sub-agent:
  - CarGurus 10-K for 2018: <https://www.sec.gov/Archives/edgar/data/1494259/000156459019005473/carg-10k_20181231.htm>.
  - CarGurus 10-K for 2021: <https://www.sec.gov/Archives/edgar/data/1494259/000095017022002023/carg-20211231.htm>.
  - DealershipNews, 2019-07-09: <https://dealershipnews.com/2019/07/09/cargurus-com-pulling-vehicles-off-search-results-page-that-havent-been-sold/>.
- Zyte on DeltaFetch, 2016-07-20, via sub-agent: <https://www.zyte.com/blog/scrapy-tips-from-the-pros-july-2016/>.
- Skyscanner partner help on caching, updated 2025-11-07, via sub-agent: <https://skyscannerpartnersupport.zendesk.com/hc/en-us/articles/20917168737181-Cache>.
- Kayak help on pricing, via sub-agent: <https://www.kayak.com/c/help/pricing/>.
- Papers and standards, all via sub-agent:
  - Cho and Garcia-Molina, SIGMOD 2000: <https://dl.acm.org/doi/10.1145/342009.335391>. The sub-agent took its claims from Olston and Najork's summary.
  - Cho and Garcia-Molina, TODS 2003: <https://dl.acm.org/doi/10.1145/958942.958945>.
  - Olston and Najork, "Web Crawling", 2010: <http://i.stanford.edu/~olston/publications/crawling_survey.pdf>.
  - Kolobov et al., SIGIR 2019: <https://www.microsoft.com/en-us/research/publication/optimal-freshness-crawl-under-politeness-constraints/>.
  - RFC 5861: <https://www.rfc-editor.org/rfc/rfc5861.html>.

**CarGurus's market value:**

- CarGurus help, "What is IMV?", updated 2026-05-14, opened: <https://cargurus.helpscoutdocs.com/article/10-what-is-imv>.
- CarGurus help, listings without a rating, updated 2021-07-28, opened: <https://cargurus.helpscoutdocs.com/article/26-why-are-some-listings-without-pricing>.
- Via sub-agent:
  - CarGurus S-1, 2017: <https://www.sec.gov/Archives/edgar/data/1494259/000104746917005904/a2233230zs-1.htm>.
  - Patent US20140257934A1: <https://patents.google.com/patent/US20140257934>. It describes a method, not necessarily today's practice.
  - WardsAuto interview with the chief executive, 2019-11-11: <https://www.wardsauto.com/dealers/cargurus-ceo-defends-business-model>.

**Other challenge entrants' repositories**, opened; self-reported and unaudited:

- <https://github.com/pejmanS21/torob-car> and its crawler <https://github.com/pejmanS21/drill>
- <https://github.com/sobhanaz/khodrobin>
- <https://github.com/AlirezaZandi/torob-rental>
- <https://github.com/shojaee76-cmyk/divar-mcp>

## Findings

### 1. Scale and turnover

| Figure | Value | Source |
|---|---|---|
| Car listings on Divar, 1398 | 9.6 million, its largest category; Divar's share of Tehran car sales 19.3 % | TCCIM, 2020 |
| Car listings on Divar, 1399 | 8.6 million: about 23,600 a day nationally (estimate), 26 % in Tehran, so about 6,100 a day there (estimate) | Eghtesad Online, 2021 |
| Most-listed cars | 1399: Pride sedan, 206, 405, Pars, Samand, with Pride above twice the 206. Early 2025: Pride, then Pars, then 405 | Digiato, 2021; Asriran, 2025 |
| Messy data, from Divar's own statistics | 24 % of car listings have fields that contradict their text; 20 % misstate body condition; over half lack full photos | Peivast, 2025-12-27 |
| Fewer, more genuine listings | Car listings became paid, and free car listings need proof of ownership, piloted in Mashhad and Qom | Zoomit and Peivast, 2025-12-27; Fararu, 2025-02-18 |
| Online share of car sales | 20–25 %, by Divar's chief executive; 35–40 % happen through acquaintances | Peivast, 2025-03-09 |
| Bama, 1400 | 1,135,169 listings (about 3,100 a day), 81 % from private sellers | Peivast and Donya-e-Eqtesad, 2022 |
| All platforms | Karnameh analysed about 4 million car listings in 1401 and 7.5 million in 1402, re-posts included | Digiato, 2023; Tejarat News, 2024 |
| Fleet mix, end of 1401 | Pride 28 %, 405 12 %, Tiba 10 %, 206 8 %, Pars 7 %, Samand 6 %: the top six families are about 71 % (sum, estimate) | Agah, 2023 |
| Long tail | Khodro45 handled 3,458 distinct models in 1404; its top trim (206 Tip 2) was 3.8 % of its deals | Pedal and Zoomit, 2026-09-09 |

- **What is not published:**
  - Divar has published no count of car listings since 1399 and no annual report since 1400.
  - Nothing gives the number of live car listings or the time a car takes to sell.
- **Estimates for today:**
  - At 1399 volumes and an average of 15 to 17.5 days on the site (Little's law on Divar's all-category totals, estimate), Tehran holds about 90,000 to 110,000 live car listings. Today's number is probably lower, now that car listings are paid.
  - Every Divar listing carries its own expiry (`seo.unavailable_after`, recorded in `2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md`).
  - A posting guide says a listing lasts a month and cannot be re-posted for 72 hours after deletion (weak).
- **Ambiguities in the sources:**
  - Zoomit's "13 %" for vehicles covers "leisure and vehicles" together.
  - Bama's "3.5 million cars changed hands in 1400" counts all cars, not only used ones.
- **CS-33 measures the live figures** (its criterion 5) before the budget in ADR-0017 is fixed.

### 2. How listings are kept fresh

- **Torob, the employer, publishes its protocol** (Torob-Sync, opened):
  - It pages a shop's products newest-added first, which every shop must support, and newest-updated first, which large shops must support.
  - A deleted product is simply absent from the list.
  - A shop can call a webhook, limited to 20 requests a minute, so Torob re-reads specific products "without waiting for periodic crawls".
  - This is discovery newest first, removal by absence, and a single-item re-read on demand.
- **The large car sites take feeds, not crawls** (via sub-agent):
  - CarGurus takes inventory from dealer systems and data licensors (10-K). In 2019 it hid listings after a number of leads, to fight "phantom inventory" of sold cars that the feeds kept showing (DealershipNews).
  - Google's vehicle listings take dealer feeds at least daily. They remove cars that go missing within hours and hide everything three days after the last good feed.
  - Google Shopping expires a product 30 days after its last refresh.
- **Techniques** (via sub-agent):
  - Discover newest first and stop at items already seen. Scrapy's DeltaFetch made 51 requests instead of 1,051 on a re-run.
  - Detect change with content hashes rather than conditional requests: Google reports that only 0.017 % of its fetches are cacheable. Carshenas's snapshots are already content-addressed (`docs/design/data-model.md`).
  - Removal signals, from strongest: a 404 or 410; the source's own expiry; absence from a complete pass, confirmed by one request.
- **Theory** (via sub-agent):
  - Cho and Garcia-Molina (2000) found that revisiting a bounded set evenly beats revisiting it in proportion to how often items change, and that items changing faster than they can be revisited are best given up.
  - The same authors (2003) weight revisits by importance.
  - Olston and Najork (2010) weight them by how embarrassing a stale item would be to users. For Carshenas that is what a results page or an opened listing shows.
  - Kolobov et al. (2019, Bing) derive the optimal schedule under a per-host politeness limit, which is ADR-0008's situation.
- **Re-checking on read** (via sub-agent):
  - Skyscanner caches fares for 1 to 36 hours and prices again when the booking panel opens on a fare more than ten minutes old.
  - HTTP's `stale-while-revalidate` (RFC 5861) is the same idea.
  - No car aggregator was found doing it. For Carshenas it would be a small, visible distinction: "checked 12 minutes ago".

### 3. CarGurus's market value and ratings

- **Daily recomputation** from "comparable current and previous car listings in your market" (help, 2026-05-14, opened). A listing that left the market still counts. The 2021 10-K describes regression over "tens of millions" of data points, sold cars included (via sub-agent).
- **No rating** when there are "too few comparable vehicles in the area", for a reported theft, a salvage title or frame damage, or when a price is too good to be true or too high (help, 2021-07-28, opened). New cars get no rating (via sub-agent).
- **The thresholds are not published:**
  - The patent scores a listing as the fair price minus the asking price, divided by the price spread.
  - The chief executive described roughly 15 % great deals, 70 % in the middle and 15 % overpriced (WardsAuto, 2019, via sub-agent).
  - None of CarGurus, Autolist or Kelley Blue Book publishes an accuracy figure.
- **Divar's own estimator** offers a price "only for brand-models with sufficient accuracy" (Donya-e-Eqtesad, 2022, opened).

### 4. The three options, costed under ADR-0008's floor

These are estimates at 1399 volumes. One request every three seconds allows at most 28,800 requests a day per host, and a list page returns about 25 listings.

| Option | Requests a day (estimate) | Hours at the floor | What it buys | What it cannot do |
|---|---|---|---|---|
| **Live, all of Tehran:** discovery about 250 list pages, details of about 6,100 new listings, a daily sweep of about 4,000 list pages, and up to 6,100 checks that listings are gone | about 16,500 | about 13.7 | Everything below, for every model | Leaves little room for re-checks and pasted links; the budget sits near half of the floor's ceiling |
| **Live, ten tracked models** (about two thirds of listings, estimate): discovery, details of about 4,000 new listings, a daily sweep of tracked models, a weekly sweep of the rest, and the checks that listings are gone | about 11,000 | about 9 | Fresh ratings, days on market, price history and drops, removals, alerts later, and ratings checked against outcomes | Untracked models get volumes only, until the superadmin tracks them |
| **Full mirror**: details of every live listing every day | about 90,000 or more | about 75 | Nothing the rows do not already give | Impossible under the floor |
| **Crawled sample**: for example 20,000 listings with details, once | about 20,000, once | about 17, once | Repeatable evaluations; a stable demo | Stale ratings in a market that moves weekly; dead click-outs by the time reviewers look; no days on market, drops or removals; no way to see whether a rating was right |
| **Query-time search of the sources** | tens to hundreds per buyer search | tens of seconds to minutes per search | Always current for the rows it shows | No stored comparables, so no market value; no duplicates; no history; every buyer's search becomes traffic to the sources, the pattern that gets a client blocked |

### 5. What other entrants ran into

All of these are self-reported in their repositories and unverified here.

- **Divar's search cap:** one search stops at about 1,200 results. torob-rental paged past it using `last_post_date`.
- **Divar's rate limits:**
  - torob-rental's post endpoint answered 429 within a few hundred requests at eight a second, and kept refusing for minutes.
  - divar-mcp cites "~30 requests/minute".
  - The three-second floor (20 a minute) is under both.
- **Divar's quiet blocks:** Divar can block with an empty HTTP 200 (khodrobin). ADR-0008's stop now counts an empty answer where listings were expected as a block (CS-33 criterion 2).
- **How the car entrants handle removals and blocks:**
  - torob-car's crawler marks a listing removed only on a 404 or 410.
  - khodrobin crawls five car sources every three hours (15,763 unique listings, by its README) and keeps a snapshot so its demo survives a block.

### 6. Measured on 2026-09-29 (CS-33)

The crawler's first live measurement of Divar's Tehran cars (category `light`), from this machine on an Iranian network: 2,950 search requests between 12:39 and 18:02 UTC, every one answered HTTP 200 (84 ms on average), each at least 3.008 s after the previous answer (median 3.015 s), and no request to any address but the search. The sweep of 13:31:57 UTC read every brand's first page, split each brand whose first page was full into its models, and read each slice page by page; the owner stopped it at 18:02 with the largest 98 models still being read, whose counts so far are kept as lower bounds. The raw data is in [`2026-09-28-listing-data-and-freshness/`](2026-09-28-listing-data-and-freshness/README.md).

| Figure | Measured | How |
|---|---|---|
| Active car listings in Tehran | **at least 49,347** (measured); about 130,000 to 150,000 (estimate) | 773 slices read to their end hold 26,869; the 98 largest, stopped mid-way, had 22,478 so far. The estimate is the posting rate below times the 15 to 17.5 days on the site that section 1 assumed (Little's law) |
| Listings posted an hour, all of Tehran | **365** (8,800 a day), plus 183 bumped | The whole market's newest 264 rows spanned 28.9 minutes; 88 were bumped («نردبان شده»). Section 1's 1399 estimate was 6,100 a day |
| How deep one search goes | **at least 11 pages** (264 rows, 29 minutes of the whole market) | Every page said more follow; the sweep stopped before the 50 pages (about 1,200 results) other entrants reported as the cap. At the ten tracked models' pace, 1,200 rows are about five hours of their feed, and about 21 hours of Peugeot 206's alone |
| Listings posted a day by the ten largest models | **3,085** (5,861 with bumps) | Rows posted a day on the pages read, per model (table below) |

The ten models with the most listings, ranked by listings posted a day on the pages read. The largest passed what the sweep read, so their counts are lower bounds and cannot rank them; the posting rate follows the number of active listings where listings last alike and, unlike all sort events, is not raised by dealers' bumps. They are the seeded tracked models (`apps/worker/src/sources/divar/tracked-models.ts`, CS-33 criterion 7).

| # | Model (Divar's `brand_model`) | Posted a day | With bumps | Rows read (lower bound) |
|---|---|---|---|---|
| 1 | Peugeot 206 | 887 | 1,338 | 240 in 4.3 hours |
| 2 | Peugeot 207i | 671 | 1,320 | 240 in 4.4 hours |
| 3 | Peugeot Pars | 509 | 741 | 240 in 7.8 hours |
| 4 | Dena plus | 294 | 850 | 240 in 6.8 hours |
| 5 | Samand Soren | 157 | 649 | 240 in 8.9 hours |
| 6 | Peugeot 405 | 142 | 183 | 240 in 1.3 days |
| 7 | Quick manual | 129 | 221 | 216 in 1.0 day |
| 8 | Pride 131 | 127 | 182 | 240 in 1.3 days |
| 9 | Toyota Corolla | 85 | 254 | 240 in 0.9 days |
| 10 | Samand LX | 84 | 123 | 240 in 2.0 days |

Next came Pride Sedan (82 a day), Renault Tondar 90 (73) and Saina manual (59): places 9 to 11 are close, and a longer measurement may swap them. By all sort events, bumps included, Saina manual would be tenth instead of Samand LX.

**The daily budget this implies for the ten tracked models** (estimates, ADR-0017 point 5):

| Work | Requests a day | Basis |
|---|---|---|
| Discovery, every 15 minutes | about 340 | 5,861 rows a day at 24 a page, plus the page that reaches each round's mark |
| Details of new listings | about 3,100 | 3,085 posted a day |
| Details of listings whose price moved | about 300 | A guess: one bump in ten shows another price |
| Daily sweep of the tracked models (CS-35) | about 2,000 or more | Their active listings (posting rate times 15 days, about 46,000) at 24 a page; more, since a model this large must be sliced finer than one search's cap |
| Weekly sweep of the other models (CS-35) | about 500 to 600 | The rest of the market (84,000 to 104,000, estimate) at 24 a page, once a week |
| Checks that a listing has gone | up to about 3,000 | As many leave as arrive; fewer where a listing's own expiry tells |
| **Total** | **about 9,300** | Within ADR-0017's ceiling of 14,400 (half of what one request per three seconds allows), leaving about a third for buyers' re-checks and pasted links |

**How Divar's search ended a slice** (772 slices of the 13:31 sweep; the paging section of the Divar API note has the details): 389 with a divider and nearby cities' listings, 256 with a short page that still said more follow, 73 with a divider and "similar listings", 54 with "no exact result". None of them may be counted, which the crawler learned on the day: the first attempt at 12:39 met the nearby cities' listings, and the second, at 12:54, stopped Divar at 13:13 on an answer without a list past a slice's last row, a false alarm the owner resumed after the fix.

**Not measured:** the time from a listing's posting to its snapshot (criterion 1's hour), since discovery had no tracked models until the measurement ended, and the depth of the reported cap. CS-35 publishes both as freshness figures.

## Recommendation

Adopt a **live, bounded, replayable index** (ADR-0017):

- keep a live index;
- read the whole Tehran market shallowly from list pages, sliced by make and model;
- read tracked models in depth, the ten most listed to start, chosen by the superadmin;
- give each source a daily budget of at most half of what the floor allows, spent in a fixed priority order;
- confirm removals with one request, or mark a listing expired from its own expiry;
- re-check a listing when a buyer opens it;
- publish the freshness figures;
- cut frozen releases for evaluations, backtests and the recorded demo.

This is Torob's own pattern (Torob-Sync): newest first, removal by absence, and a re-read on request.

**The trade-off accepted:** a crawler that runs all the time against Divar's and Bama's terms, which ADR-0008 already accepted, now running continuously and visibly. The display policy, the budget and an unlisted deployment limit it.

**What would change it:**

- CS-33's measurements (section 6): Tehran posts about 8,800 car listings a day, above the 1399 figures, and ten tracked models need about 9,300 requests a day, within the budget; so ten are tracked, not all of Tehran.
- A block. The site degrades to dated data (ADR-0017 point 9).
- A partnership. A feed replaces the crawler behind the same adapter (point 11).
