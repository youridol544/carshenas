# ADR-0008: Crawl politely, record every source's rules and stop on any block; Divar first, by the owner's decision

- Status: proposed (point 3 decided by the owner on 2026-09-27)
- Date: 2026-09-26, amended 2026-09-27
- Deciders: Pedrum
- Related: ADR-0002 (the capture tool's guardrails), ADR-0006, ADR-0010, ADR-0013 (point 7), CS-5, CS-6, CS-7, CS-19, CS-29, `docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md`; the database enforces points 5 and 6 and honours point 8 through a purge (`docs/design/data-model.md`)

## Context

Carshenas reads listings from sites it does not own. Their robots.txt rules differ a lot (quoted in the research note), Divar's terms forbid manual or automated copying of ads, and bypassing bot detection can itself be treated as circumventing an access control (Reddit v. SerpApi, S.D.N.Y., 2026-07-31). The product will be shown to Torob, whose own business rests on crawling shops that registered and consented, so the way we collect data is part of the product's credibility, not a detail. Divar is also by far the largest used-car source. On 2026-09-27 the owner decided: "its totally ok to crawl divar ... add it as first priority before bama. its api lets us do it easily", pointing at the JSON API Divar's own web client calls (`POST https://api.divar.ir/v8/postlist/w/search`).

## Decision (proposed)

1. A source is crawled only after its robots.txt **and** terms of use have been read and recorded in the sources research note or its successor (CS-5 does this for the first sources), including where the owner decides to crawl against them (point 3).
2. Per source, only the URL shapes its rules allow: for example Sheypoor category paths with `page_num` only, Khodro45 sitemap URLs without filter or `_rsc` requests, Hamrah Mechanic's price table as a benchmark only.
3. **Divar is crawled, first, through its public web API** (`api.divar.ir`, the JSON its own website calls), by the owner's decision of 2026-09-27, although its terms forbid automated copying of ads: the owner accepts that risk. Every other point applies to Divar in full: its robots.txt (divar.ir and api.divar.ir) and terms are recorded (point 1), requests are polite (point 5), a block stops it without evasion (point 6), no personal data is kept (point 7), and a request from Divar to stop or remove data is honoured at once (point 8). A link a buyer pastes from Divar is read through the same API (CS-19). Official partner APIs such as Divar's Kenar stay an option, not a requirement.
4. No photo downloads where robots.txt disallows them (Karnameh). Where a source's robots.txt and recorded terms allow downloading and showing its photos, the crawler downloads them and they are stored in ArvanCloud Object Storage and shown from there (ADR-0010, owner decision of 2026-09-27, replacing the hotlinking chosen on 2026-09-26); a source that does not allow it contributes no photos, and its listings show a same-size placeholder with a link out. Whether Divar's photos are stored is decided with the owner in CS-29, given point 3.
5. Politeness: a descriptive User-Agent with a contact address, one request at a time per host, at least three seconds between requests (configurable, and longer if a `Crawl-delay` asks), conditional requests where supported, and a bounded crawl sized for the product's needs (starting with Tehran and the most-listed models).
6. On a 403, 429, CAPTCHA or challenge page the crawler stops that source and reports to a human. It never retries through other user agents, proxies, rotated IPs or evasion tooling.
7. Sellers' personal data is not republished. Phone numbers, if used at all for duplicate detection, are stored only as keyed HMAC-SHA-256 hashes, with the key in the environment and a key version for rotation; never plain, and never as salted hashes, which enumerating all phone numbers reverses (owner decision of 2026-09-27, ADR-0013). The crawler never requests a contact or phone endpoint.
8. A source's request to stop or to remove data is honoured.

## Alternatives considered

- **Divar only through its official Kenar API, one pasted listing at a time** (this ADR's proposal until 2026-09-27): no conflict with Divar's terms, but the largest source stays out of search, valuations and duplicate detection.
- **Leave Divar out entirely**: the same coverage loss without even pasted links.
- **Official APIs only**: none exist for most sources; Kenar covers single posts only.
- **Synthetic data**: no real market, so the valuations and the demo would mean nothing.

## Consequences

- Positive: the largest source feeds search, valuations and duplicate detection from the first crawl; Divar's web API returns structured JSON, which is simpler and lighter to read than HTML pages.
- Negative / risks: crawling Divar goes against its terms, a legal and reputational risk in front of Torob, which may read it as disregard for sources' rules; Divar can block the crawler at any time (point 6 then stops it for good until a human decides) or ask us to stop (point 8); its internal API can change without notice; slower crawls elsewhere; a source can change its rules, so CS-5's record must be re-checked before each large crawl.
- Follow-ups: CS-5 (read and record every source's terms and robots.txt, Divar's included, and accept or amend this ADR), CS-6 (the Divar crawler, first), CS-7 (Bama, Karnameh and Khodro45), CS-19 (pasted links, Divar through the same API), CS-29 (whether Divar's photos are stored).
