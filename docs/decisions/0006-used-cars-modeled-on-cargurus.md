# ADR-0006: Build "Torob for X" as a used-car search engine modeled on CarGurus and Autolist

- Status: accepted; its risk "Divar cannot be crawled" no longer holds: the owner decided on 2026-09-27 to crawl Divar first (ADR-0008 point 3)
- Date: 2026-09-26
- Deciders: Pedrum
- Related: `docs/product/vision.md`, `docs/product/challenge.md`, `docs/research/2026-09-26-torob-product-and-playbook.md`, `docs/research/2026-09-26-us-vertical-search-analogs.md`, `docs/research/2026-09-26-iran-vertical-market-landscape.md`

## Context

Torob's AI Product Engineer challenge asks for "Torob for X": pick a market whose search could be much better, then crawl offers, normalise messy data, rank by user intent, explain the best choice, and show it in a five-minute demo. The owner wanted X to have an exact product match among well-known US startups, so that proven flows could be cloned instead of invented. Research on 2026-09-26 compared ten Iranian verticals on value and one-week feasibility, and fourteen US analogues on product match.

## Decision

X is **used cars in Iran**, starting with Tehran and the most-listed models. The reference products are **CarGurus** (a daily market value per car from comparable listings, a deal badge on every listing, price history, days on market, saved-search alerts) and **Autolist**, its San Francisco product with the same mechanics. We clone their flows, never their brand, copy or assets, and adapt them to Iran: the Persian condition vocabulary, negotiable and installment-bait prices, daily revaluation against inflation, and duplicate detection across sites. The product is named **Carshenas** (کارشناس, "appraiser"; car + shenas, "one who knows cars").

## Alternatives considered

- **Villas and vacation rentals** (Kayak stays, HomeToGo; Tripping.com in SF, absorbed in 2018): the highest feasibility score, the purest "same item, many sellers" problem, and no other applicant found; but no living US unicorn is an exact match and prices depend on dates, so crawling is heavier. Kept as the fallback.
- **Rent and home sale** (Zumper, Apartment List, Zillow, Trulia): the largest household pain, but most data is on Divar, whose terms forbid copying, and it is already the most common pick for this challenge.
- **Flights** (Kayak, Google Flights): Torob's own example, but SafarMarket already compares flights, the same ticket costs about the same everywhere, and 2026 sanctions are collapsing routes.
- **Insurance** (The Zebra, Jerry): premiums are regulated, comparators already exist, and quotes need a plate number and national ID.
- **Loans** (Credit Karma): one of the two living Bay Area unicorn matches (Thumbtack is the other), but Pishkhanak already compares loans and it would compete with TorobPay.
- **Home services** (Thumbtack): a Bay Area unicorn, but there are no public offers to crawl.

## Consequences

- Positive: a one-to-one blueprint for every screen; a rich, measurable AI surface (extraction, canonical names, duplicate detection, valuation, explanation); independent price tables to benchmark against; the demo story is concrete ("is this price fair?").
- Negative / risks: Divar, the largest source, cannot be crawled (ADR-0008), so coverage starts smaller; volatile prices force daily recomputation and dated valuations; a public repository already searches several car sites, and Torob runs a dealer-based car category, so the differentiation must be the deal rating, the explanations and the measured accuracy.
- Follow-ups: the backlog milestones m-1 to m-6; ADR-0007 (data stack) and ADR-0008 (crawl policy).
