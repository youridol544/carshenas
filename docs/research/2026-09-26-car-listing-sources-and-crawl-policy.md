# Which used-car sources can Carshenas read, and under what rules?

- Date: 2026-09-26; terms of use, verdicts, a second robots.txt reading and Divar's endpoints added 2026-09-28 (CS-5)
- Asked by / for: Pedrum ("where does it crawl?"), for ADR-0008 and CS-5
- Outcome: ADR-0008, accepted by the owner on 2026-09-28. Each source's robots.txt and terms are read and recorded here, but neither is followed, by the owner's decision for the demo. The politeness limits and the stop on any block stay.
- Update 2026-09-27: the owner decided to crawl Divar first, through its public web API, despite its terms (ADR-0008 point 3).
- Update 2026-09-28:
  - The terms of use of all five sources were read; three forbid automated access.
  - The owner decided to crawl every source whatever its terms and robots.txt say.
  - robots.txt was read twice that day.
  - Divar's car search and post endpoints were confirmed.

  The findings dated 2026-09-26 are kept as they were. The sections dated 2026-09-28 and the recommendation are current. The evidence is in [`2026-09-26-car-listing-sources-and-crawl-policy/`](2026-09-26-car-listing-sources-and-crawl-policy/).

## Questions

1. Which sites carry used-car listings or market prices in Iran?
2. Is the data in the page, and what does each robots.txt allow?
3. What is the lawful route to Divar, the largest source?
4. What can serve as an independent benchmark for our market value?
5. What does each source's terms of use say about automated access, copying and photos? (2026-09-28)
6. Which Divar endpoints return car listings and one listing's details, and what do they return? (2026-09-28)

## Sources

- **robots.txt** of each site, fetched from this machine on 2026-09-26 (quoted below) and twice on 2026-09-28 ([verbatim copies](2026-09-26-car-listing-sources-and-crawl-policy/robots-2026-09-28/)).
- **Terms of use**, read on 2026-09-28. Their clauses on access, copying and content, in Farsi with translations, are in [`terms-2026-09-28.md`](2026-09-26-car-listing-sources-and-crawl-policy/terms-2026-09-28.md).
  - Divar: <https://divar.ir/help/custom_articles/general_terms_and_conditions>, version of 1405/04/31 (2026-07-22). The address recorded on 2026-09-26, `https://divar.ir/__contact_terms/`, now answers 404.
  - Bama: <https://bama.ir/terms>, undated.
  - Karnameh: <https://karnameh.com/car-inspection/terms>, version of 1404/3/25 (2025-06-15).
  - Khodro45: <https://khodro45.com/terms-conditions/>, undated; the seller terms only.
  - Sheypoor: none published.
- **Kenar API:** <https://kenar.divar.dev/post/get_post>, <https://kenar.divar.dev/scopes/>.
- **Divar's web client**, observed on 2026-09-28 in one browser visit of <https://divar.ir/s/tehran/car> and of one listing. Each endpoint was then requested once with curl ([`divar-web-api.md`](2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md)).
- **Page-data checks and price tables** from `2026-09-26-iran-vertical-market-landscape.md`.

## Findings

### Reachability

Every site below answered from this machine. Iranian sites often block foreign IPs, so crawlers must run from an Iranian network (vision, AGENTS.md). torob.com itself serves a bot CAPTCHA to automated clients and is not a source.

### robots.txt, verbatim rules that matter (2026-09-26)

| Source | Rules | Sitemaps | Reading |
|---|---|---|---|
| **bama.ir** | `Disallow: /uploads/Bamalmages/CampaignBanner/` (plus a malformed `temp.bama.ir/robots.txt` line) | `/sitemap/car`, `/sitemap/car-filters`, `/sitemap/dealer`, `/sitemap/price` and more | Everything relevant is allowed. First source. |
| **karnameh.com** | `/*?payment_order*`, `/profile`, `/success`, `/services/car-inspection*`, `/services/car-sell*`, `/*?*post_token=*`, `/feed`, `/*/feed`, **`/pictures/car-posts`** | `sitemap.xml` | Listing pages allowed; **car photos are disallowed**, so no photo downloads from Karnameh. |
| **khodro45.com** | `*/feed/`, `*utm*`, `*?brand*`, `*?slug=*`, `*?_rsc=*`, `*?replytocom=*`, `*?p=*`, `*/j7hf4n8/*` | `sitemap-main.xml` | Crawl category and listing pages from the sitemap; never filter URLs or React Server Component (`_rsc`) requests. |
| **sheypoor.com** | `/trumpet`, `/session`, `/search`, `/pro`, **`/*?`**, with `Allow: /*page_num=` | — | Category paths only, paginated with `page_num`; no other query strings, no search. |
| **hamrah-mechanic.com** | Root query filters disallowed (`/?brand`, `/?model(s)`, `/?km` except `km=0`, `/?bodycondition`, `/?isgreatdeal`, `/?searchtext`, `/?loan`, `/?PrePayment`, `/?duration` …), plus `/dealer/cars-for-sale/`, `/vehiclevalue/`, `/unusedcarvalue/`, `/inspection/`, `/payment*`. Allowed: `/?price`, `/?year`, `/?gregorianyear`, `/?gearbox`, `/?city`, `/?bodytype`, `/?find` | `sitemap.xml` | Its valuation tools and most listing filters are off limits. The daily price table `/carprice/` is not disallowed: use it **only as a benchmark** for market value (CS-13). |
| **divar.ir** | `/my-divar/*`, `/new`, `/s/*/*?*q=*`, `/adminbot` | — | robots.txt looks permissive, but **the terms forbid manual or automated copying of ads**. No crawling. |

The last column is the reading of 2026-09-26, made from robots.txt alone. The terms read on 2026-09-28 and the owner's decisions superseded it (below).

### Divar through its official API

Kenar, Divar's open platform, fetches one post at a time, and production access needs a support ticket. That fits exactly one feature: a buyer pastes a Divar link and gets a deal rating for that one listing (CS-19). Until access is granted, the feature works with the other sources' links only. Since 2026-09-27, pasted Divar links are read through the web API instead, like the crawl (CS-19). Kenar stays an option.

### Benchmarks for market value

Three published tables estimate prices independently of us: Hamrah Mechanic's daily price table, Karnameh's used-car prices (`/car-price/used-car`, built from its own closed deals) and Bama's price pages (`/price`). Agreement with them is a check on our market value, not a training signal to copy (CS-13).

### Terms of use (read 2026-09-28)

| Source | Automated access and copying | Photos and content |
|---|---|---|
| **Divar** (version of 2026-07-22, binding since 2026-08-22) | **Forbidden, by name.** See the list below the table. | Advertisers grant Divar an exclusive three-year licence to their ads, photos included (5.4). No reuse is granted. |
| **Bama** | **Forbidden.** "Using any kind of computer technology to browse or copy the pages and information of the Bama site automatically is prosecuted." Republishing or copying ad information needs the site manager's written permission. Unauthorised use of the site's information is prosecuted, while use "for lawful purposes while explicitly naming Bama as the source" is allowed. Membership, use or browsing counts as acceptance. | Copying another advertiser's photos or wording is forbidden. User photos are deleted seven days after an ad is removed. |
| **Karnameh** | **Forbidden.** It bans "using robots and any harmful method to access the site's information" (13-1) and republishing or copying ad content (9-5). Copying, reverse engineering, data mining and commercial use need prior written permission (11). Its terms define a user as someone who requests its services. | All its content, "textual and visual", is its exclusive property (11). robots.txt also disallows `/pictures/car-posts`. |
| **Khodro45** | No clause. The published terms govern sellers only, and the buyer terms they cite are not on the site. | All content produced in its system, website and app, is the company's exclusive property. Its management reviews and publishes everything on the site. |
| **Sheypoor** | None published. The footer's «قوانین و مقررات» opens the FAQ (`/faq`), which has no terms. The HTML sitemap's link answers HTTP 410: a deleted UserVoice portal. | The footer reserves all rights to Net Tejarat Ahura (Sheypoor). |

What Divar's terms forbid, clause by clause:

- **Robots and data extraction:** "using a robot, or trying to extract data" is a breach of contract (5.1).
- **Automated methods:** "robots, scrapers, crawlers, scripts, AI agents" that extract data are forbidden (6.3).
- **APIs outside the official interfaces:** any interaction outside the official user interfaces, "including … through application programming interfaces (APIs)", is forbidden (6.3).
- **Protocol replay:** replaying or analysing the traffic between app, website and servers to extract data is forbidden (6.3).
- **Acceptance:** any access, "including searching and viewing ads", counts as accepting the terms (preamble).
- **Damages:** these include the market value of the extracted data, the lost revenue of the category and a share of Divar's brand value (6.4). Advertisers appoint Divar to sue extractors on their behalf (5.5).
- **Similar services:** copying, republishing content and building similar services are forbidden (7).

Exact clauses and translations: [`terms-2026-09-28.md`](2026-09-26-car-listing-sources-and-crawl-policy/terms-2026-09-28.md).

### robots.txt on 2026-09-28

robots.txt was read twice on 2026-09-28, at 01:32 and again at 01:59 (Asia/Tehran). No rule of 2026-09-26 changed:

- **Khodro45:** also disallows `*UTM*`, the upper-case twin of `*utm*`, and lists a second sitemap, `https://khodro45.com/mag/sitemap_index.xml`.
- **Karnameh:** lists a second sitemap, `https://karnameh.com/blog/sitemap_index.xml`.
- **api.divar.ir**, read for the first time, allows everything: `User-agent: *`, `Allow: /`.

The Khodro45 and Karnameh lines were not quoted on 2026-09-26, so whether they are new cannot be told. No file sets a `Crawl-delay`. The second reading was byte-identical to the first. The verbatim copies are in [`robots-2026-09-28/`](2026-09-26-car-listing-sources-and-crawl-policy/robots-2026-09-28/).

### Verdicts (2026-09-28)

The owner decided to crawl every source whatever its terms and robots.txt say. ADR-0008 records each question with its answer:

- **Divar**, on 2026-09-27: "its totally ok to crawl divar ...".
- **Bama and Karnameh**, on 2026-09-28. Asked how to record them, since their terms forbid automated access: "Crawl them like Divar".
- **Accepting ADR-0008**, on 2026-09-28: "just ignore what they are trying to enforce. it's a demo not a real product". Asked which reading to record, the owner chose the option "Terms and robots.txt": "Accept it with robots.txt ignored too: the crawler may fetch disallowed paths, such as Karnameh's photo folder and Sheypoor's query URLs. The 3-second floor and stop-on-block stay."

robots.txt no longer limits which URLs are fetched. Every source is held to ADR-0008 points 5 to 8:

- a descriptive User-Agent with a contact address;
- one request at a time per host, at least three seconds apart;
- a stop on any 403, 429 or challenge, without evasion;
- sellers' personal data never republished, and phone numbers kept only as keyed hashes;
- a source's request to stop or remove data honoured.

| Source | Marked | Reason | Conditions | Photos |
|---|---|---|---|---|
| Divar | Allowed with conditions | Its terms forbid it; crawled by the owner's decision of 2026-09-27 | `api.divar.ir` only: the search and post endpoints below; never a contact or chat endpoint | None: its terms grant no reuse (ADR-0010) |
| Bama | Allowed with conditions | Its terms forbid it; crawled by the owner's decision of 2026-09-28 | Its listing pages | None: its terms grant no reuse (ADR-0010) |
| Karnameh | Allowed with conditions | Its terms forbid it; crawled by the owner's decision of 2026-09-28 | Its listing pages | None: its terms grant no reuse (ADR-0010). The option the owner chose named its photo folder as fetchable, so CS-29 asks the owner |
| Khodro45 | Allowed with conditions | Its terms say nothing on automated access but claim all its content | Its listing pages, found through its sitemap | None: it claims its content (ADR-0010) |
| Sheypoor | Allowed with conditions | No terms published | Its category and listing pages. Read the terms if they reappear | None: no terms grant reuse (ADR-0010) |

In the database, each verdict becomes a `source_policy_check` row with verdict `allowed_with_conditions` and these conditions. `photos_allowed` is false, and the row keeps the robots.txt text as read, as evidence. The task that adds the source inserts the row: CS-6 for Divar, CS-7 for the others.

### Divar's web API for cars (confirmed 2026-09-28)

- **Search:** `POST https://api.divar.ir/v8/postlist/w/search` with a JSON body.
  - Cars are the category `light` («خودرو سواری و وانت»), Tehran is city `1`, and `sort_date` puts the newest first.
  - Each page lists 24 to 26 `POST_ROW`s. A row holds the post `token`, `title`, the mileage (`top_description_text`), the price (`middle_description_text`), district and recency, a paid-promotion label, the first photo and the photo count.
  - Pagination: send the response's `pagination.data` back as `pagination_data` while `pagination.has_next_page` is true.
- **Post:** `GET https://api.divar.ir/v8/posts-v2/web/{token}`.
  - The car is in `LIST_DATA`: mileage, model year in both calendars, colour, make and model with trim, gearbox, fuel, insurance and the price row «قیمت پایه». The seller's own condition ratings sit beside them.
  - The photos are in `IMAGE`, on `s100.divarcdn.com`, and the expiry is `seo.unavailable_after`.
  - `webengage.price` is a float that read 2,248,999,936 for a price of 2,249,000,000 on the post opened here. This confirms CS-2's rule never to read it.
  - `contact` carries tokens, never a number. The listing's page, the click-out target, is `https://divar.ir/v/<slug>/<token>`.
- **Evidence:**
  - The web client made exactly these two calls in one visit: the search for its next page, and the post when a listing was opened.
  - One curl request per endpoint, with a descriptive User-Agent and no cookie, got HTTP 200 JSON: 15 KB and 7 KB, about 0.5 s each.
  - Neither response carried a rate-limit header.
  - The request body, the response shapes and the calls the crawler must not make are in [`divar-web-api.md`](2026-09-26-car-listing-sources-and-crawl-policy/divar-web-api.md).

## Recommendation (revised 2026-09-28)

1. **Crawl every source.** Divar comes first, through the two endpoints above (CS-6). Bama, Karnameh, Khodro45 and Sheypoor follow (CS-7). All of them are crawled whatever their terms and robots.txt say, as the owner decided (ADR-0008 point 3), within the conditions in the verdicts.
2. **Keep the politeness limits and the stop on any block.** robots.txt is recorded but no longer followed, by the owner's choice. Following it would have cost little coverage, since every source's listing pages are allowed. A block is the one signal no decision of ours overrides, since evading it can count as circumventing an access control.
3. **Store no photos.** ADR-0010 stores a source's photos only where its robots.txt and terms allow it. None of the five sources' terms grants their reuse, and Karnameh's robots.txt forbids them too. Storing any would take an ADR that supersedes ADR-0010's condition, decided with the owner in CS-29.
4. **Use Hamrah Mechanic and the other price tables only as benchmarks (CS-13).** Read Hamrah Mechanic's terms before its table is fetched (ADR-0008 point 1).
5. **Re-read every robots.txt and terms page** before a large crawl and at least every 30 days (`policy_max_age_days`), and record any change here or in a successor note.

**The trade-off:** the crawl goes against the terms of Divar, Bama and Karnameh and against Khodro45's claim to its content, and may fetch paths a robots.txt disallows. The owner accepts that legal and reputational risk because Carshenas is a demo.

**What would change it:** a source's block (ADR-0008 point 6) or its request to stop (point 8).

The recommendation of 2026-09-26 was overtaken by the owner's decisions of 2026-09-27 and 2026-09-28. It said to crawl Bama first, never crawl Divar, and use Kenar for single pasted links.
