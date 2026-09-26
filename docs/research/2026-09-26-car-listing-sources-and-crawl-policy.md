# Which used-car sources can Carshenas read, and under what rules?

- Date: 2026-09-26
- Asked by / for: Pedrum ("where does it crawl?"), for ADR-0008 and CS-5
- Outcome: ADR-0008 (proposed). Each source's terms of use still have to be read before crawling at volume (CS-5).

## Questions

1. Which sites carry used-car listings or market prices in Iran?
2. Is the data in the page, and what does each robots.txt allow?
3. What is the lawful route to Divar, the largest source?
4. What can serve as an independent benchmark for our market value?

## Sources

- robots.txt of each site, fetched from this machine on 2026-09-26 (quoted below).
- Divar terms of use: <https://divar.ir/__contact_terms/>; Kenar API: <https://kenar.divar.dev/post/get_post>, <https://kenar.divar.dev/scopes/>.
- Page-data checks and price tables from `2026-09-26-iran-vertical-market-landscape.md`.

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

### Divar through its official API

Kenar, Divar's open platform, fetches one post at a time, and production access needs a support ticket. That fits exactly one feature: a buyer pastes a Divar link and gets a deal rating for that one listing (CS-19). Until access is granted, the feature works with the other sources' links only.

### Benchmarks for market value

Hamrah Mechanic's daily price table, Karnameh's used-car prices (`/car-price/used-car`, built from its own closed deals) and Bama's price pages (`/price`) are independent estimates. Agreement with them is a check on our market value, not a training signal to copy (CS-13).

## Recommendation

1. Crawl **Bama** first, then **Karnameh** (no photos) and **Khodro45** (sitemap URLs, no filters), then **Sheypoor** (category paths with `page_num` only).
2. **Never crawl Divar**; use Kenar for single pasted links once access is granted.
3. Use **Hamrah Mechanic** and the other price tables only as benchmarks.
4. Read each source's terms of use before crawling at volume, and record the result in ADR-0008 (CS-5). robots.txt is necessary, not sufficient.
5. Crawl politely: a descriptive User-Agent with a contact address, one request at a time per host with a delay of a few seconds, conditional requests where supported, and stop on any 403, 429 or challenge page without retrying through other identities, as the capture tool already does (ADR-0002).
