# ADR-0008: Crawl politely and stop on any block; sources' robots.txt and terms are recorded but not followed, for the demo

- Status: accepted on 2026-09-28 by the owner, who chose the reading "Terms and robots.txt" (below)
- Date: 2026-09-26, amended 2026-09-27 and 2026-09-28
- Deciders: Pedrum
- Related:
  - ADRs: ADR-0002 (the capture tool's guardrails), ADR-0006, ADR-0010, ADR-0013 (point 7).
  - Tasks: CS-5, CS-6, CS-7, CS-13, CS-19, CS-29.
  - Research: `docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md`, which holds each source's robots.txt and terms as read on 2026-09-28, the verdicts and Divar's endpoints.
  - Database: it enforces points 5 and 6 and honours point 8 through a purge (`docs/design/data-model.md`).

## Context

Carshenas reads listings from sites it does not own.

**robots.txt.** Every source's robots.txt allows its listing pages. Some paths are disallowed:

- Karnameh's photos;
- Khodro45's filter and `_rsc` URLs;
- Sheypoor's query strings other than `page_num`;
- Divar's account pages and search-query pages.

**Terms of use**, read on 2026-09-28 (CS-5), are stricter:

- **Divar** forbids robots, scrapers, crawlers and AI agents, and any use of its services through APIs outside its official interfaces. It sets damages that include the market value of the extracted data.
- **Bama** forbids automated browsing or copying.
- **Karnameh** forbids robots, copying and data mining.
- **Khodro45** claims all the content on its site.
- **Sheypoor** publishes no terms.

**Other factors.** Bypassing bot detection can itself be treated as circumventing an access control (Reddit v. SerpApi, S.D.N.Y., 2026-07-31). The product will be shown to Torob, whose own business rests on crawling shops that registered and consented. Divar is by far the largest used-car source.

The owner decided in four steps:

1. **2026-09-27:** "its totally ok to crawl divar ... add it as first priority before bama. its api lets us do it easily". This pointed at the JSON API Divar's own web client calls.
2. **2026-09-28, on Bama and Karnameh.** Asked how to record them, since their terms forbid automated access as Divar's do, the owner answered: "Crawl them like Divar".
3. **2026-09-28, on acceptance.** Asked whether to accept this ADR once it recorded the findings (per-source rules, Divar's two endpoints, the three-second floor, stop on any block), the owner answered: "just ignore what they are trying to enforce. it's a demo not a real product".
4. **2026-09-28, the reading.** Asked which reading of that answer to record, the owner chose "Terms and robots.txt": accept this ADR with sources' terms and robots.txt not followed, while the three-second floor and the stop on any block stay.

## Decision

1. **Record before crawling.** A source is crawled only after its robots.txt and terms of use have been read and recorded in the sources research note or its successor. CS-5 did so for Divar, Bama, Karnameh, Khodro45 and Sheypoor on 2026-09-28. Both are read again before a large crawl and at least every 30 days (the database's `policy_max_age_days`), so the record stays current.
2. **Which URLs.** robots.txt does not limit which URLs are fetched. The crawler reads what the product needs:
   - Divar through `api.divar.ir` only: its search (`POST /v8/postlist/w/search`) and post (`GET /v8/posts-v2/web/{token}`) endpoints.
   - Bama, Karnameh, Khodro45 and Sheypoor through their listing pages, Khodro45's found through its sitemap.
   - Hamrah Mechanic's price table, used as a benchmark only.

   The crawler never logs in and never requests a page that needs an account.
3. **Terms of use and robots.txt are recorded, not followed.**
   - Every source is crawled whatever its terms and robots.txt say, because Carshenas is a demo, not a product in operation. The decisions: 2026-09-27 for Divar's terms, and 2026-09-28 for the terms and robots.txt of all five sources.
   - The owner accepts the risk.
   - Every other point applies in full, to Divar as to the rest.
   - A link a buyer pastes is read the same way as the crawl (CS-19).
   - Official partner APIs such as Divar's Kenar stay an option, not a requirement.
4. **Photos.** ADR-0010 stores a source's photos only where its robots.txt and recorded terms allow downloading and showing them. Karnameh's robots.txt disallows them, and none of the five sources' terms grants reuse of its photos. So no source's photos are downloaded, and listings show a same-size placeholder with a link out. Storing any would take an ADR that supersedes ADR-0010's condition, decided with the owner (CS-29).
5. **Politeness.**
   - A descriptive User-Agent with a contact address.
   - One request at a time per host, at least three seconds apart. The gap is configurable and never shorter. No source set a `Crawl-delay` on 2026-09-28.
   - Conditional requests where supported.
   - A bounded crawl sized for the product's needs, starting with Tehran and the most-listed models.
6. **Stop on any block.** On a 403, 429, CAPTCHA or challenge page, the crawler stops that source and reports to a human. It never retries through other user agents, proxies, rotated IPs or evasion tooling.
7. **No personal data.** Sellers' personal data is not republished. Phone numbers, if used at all for duplicate detection, are stored only as keyed HMAC-SHA-256 hashes, with the key in the environment and a key version for rotation (owner decision of 2026-09-27, ADR-0013). They are never stored plain, and never as salted hashes, which enumerating every phone number reverses. The crawler never requests a contact or phone endpoint.
8. **Removal requests.** A source's request to stop or to remove data is honoured.

## Alternatives considered

- **Divar only through its official Kenar API, one pasted listing at a time** (this ADR's proposal until 2026-09-27). No conflict with Divar's terms, but the largest source stays out of search, valuations and duplicate detection.
- **Crawl only the sources whose terms allow it** (Khodro45 and Sheypoor), and ask Bama and Karnameh for the written permission their terms mention. Proposed on 2026-09-28 and declined by the owner for the demo.
- **Follow robots.txt while not following the terms.** Proposed as the recommended reading on 2026-09-28; the owner chose to follow neither.
- **Leave Divar out entirely.** The same coverage loss, without even pasted links.
- **Official APIs only.** None exist for most sources, and Kenar covers single posts only.
- **Synthetic data.** No real market, so the valuations and the demo would mean nothing.

## Consequences

- **Positive:** every source feeds search, valuations and duplicate detection from the first crawl. Divar's web API returns structured JSON, which is simpler and lighter to read than HTML pages.
- **Legal and reputational risk:**
  - The crawl goes against the terms of Divar, Bama and Karnameh and against Khodro45's claim to its content.
  - It may fetch paths a robots.txt disallows.
  - Torob may read both as disregard for sources' rules.
  - Divar's terms name API use and crawlers, and set damages that include the market value of the extracted data and the lost revenue of the category.
- **Blocks and requests to stop:** any source can block the crawler at any time, and point 6 then stops that source until a human decides. A source can also ask us to stop (point 8).
- **Fragility:** Divar's internal API can change without notice.
- **Speed:** the three-second floor makes crawls slow; 2,000 Tehran listings on Divar take about 1.7 hours.
- **Rule changes:** a source can change its rules, so the record is read again before each large crawl (point 1).
- **The capture tool is unchanged:** it keeps its own robots.txt rule for studying interfaces (ADR-0002).
- **Follow-ups:**
  - CS-6: the Divar crawler, first.
  - CS-7: Bama, Karnameh, Khodro45 and Sheypoor.
  - CS-13: read Hamrah Mechanic's terms before fetching its table.
  - CS-19: pasted links, read the same way as the crawl.
  - CS-29: whether any photos are stored at all, which would supersede ADR-0010's condition.
