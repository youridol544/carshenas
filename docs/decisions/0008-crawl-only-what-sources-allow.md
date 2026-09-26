# ADR-0008: Crawl only what each source's robots.txt and terms allow; never Divar in bulk

- Status: proposed
- Date: 2026-09-26
- Deciders: Pedrum
- Related: ADR-0002 (the capture tool's guardrails), ADR-0006, CS-5, CS-6, CS-7, CS-19, `docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md`

## Context

Carshenas reads listings from sites it does not own. Their robots.txt rules differ a lot (quoted in the research note), Divar's terms forbid manual or automated copying of ads, and bypassing bot detection can itself be treated as circumventing an access control (Reddit v. SerpApi, S.D.N.Y., 2026-07-31). The product will be shown to Torob, whose own business rests on crawling shops that registered and consented, so the way we collect data is part of the product's credibility, not a detail.

## Decision (proposed)

1. A source is crawled only after its robots.txt **and** terms of use have been read and recorded in the sources research note or its successor (CS-5 does this for the first sources).
2. Per source, only the URL shapes its rules allow: for example Sheypoor category paths with `page_num` only, Khodro45 sitemap URLs without filter or `_rsc` requests, Hamrah Mechanic's price table as a benchmark only.
3. **Divar is never crawled.** A single listing a buyer pastes is read through Divar's official Kenar API once access is granted (CS-19).
4. No photo downloads where robots.txt disallows them (Karnameh). Images are never re-hosted; the UI shows a source's image only where its terms allow, and otherwise links to the listing. The UI hotlinks the source's own image URL, and `next.config.ts` sets `images.unoptimized`, so Next.js's image optimizer never downloads, resizes or caches a copy on our server; where a source's recorded terms or its server refuse hotlinking, the listing shows a same-size placeholder with a link out (owner decision, 2026-09-26, CS-27).
5. Politeness: a descriptive User-Agent with a contact address, one request at a time per host, at least three seconds between requests (configurable, and longer if a `Crawl-delay` asks), conditional requests where supported, and a bounded crawl sized for the product's needs (starting with Tehran and the most-listed models).
6. On a 403, 429, CAPTCHA or challenge page the crawler stops that source and reports to a human. It never retries through other user agents, proxies, rotated IPs or evasion tooling.
7. Sellers' personal data is not republished. Phone numbers, if used at all for duplicate detection, are stored only as salted hashes.
8. A source's request to stop or to remove data is honoured.

## Alternatives considered

- **Crawl Divar anyway**: the largest source, but against its terms, with legal and reputational risk in front of the very company we are applying to.
- **Official APIs only**: none exist for most sources; Kenar covers single posts only.
- **Synthetic data**: no real market, so the valuations and the demo would mean nothing.

## Consequences

- Positive: a defensible, sustainable collection method that matches how the capture tool already behaves.
- Negative / risks: smaller coverage without Divar; slower crawls; a source can change its rules, so CS-5's record must be re-checked before each large crawl.
- Follow-ups: CS-5 (read terms, accept or amend this ADR), CS-6 and CS-7 (crawlers that enforce these rules in code), CS-19 (Kenar).
