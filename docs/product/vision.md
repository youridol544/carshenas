# Carshenas — product brief

> Status: draft v0.1 (2026-09-26). Owner: Pedrum. This is the "why" and "what" at the highest level. Feature-level detail belongs in `docs/specs/`; binding choices belong in `docs/decisions/`. The challenge this answers is summarised in [`challenge.md`](challenge.md).

## One paragraph

Carshenas (کارشناس) is a Farsi, right-to-left used-car search engine for Iran that tells a buyer whether a listing's price is fair. It gathers listings from the sites people already use, turns messy free-text ads into structured records, estimates each car's market value from comparable listings, and ranks every listing with a deal rating from «عالی» to «خیلی گران», with the reason in plain Farsi. It applies Torob's playbook (collect every offer, normalise it, rank by what the user wants, explain the best choice) to cars, and clones the proven flows of [CarGurus](https://www.cargurus.com) and its San Francisco sibling Autolist ([ADR-0006](../decisions/0006-used-cars-modeled-on-cargurus.md)).

## The name

کارشناس means expert or appraiser, and in the Iranian car market «کارشناسی» is the inspection and valuation a careful buyer pays for before handing over the money. Read in English it is *car* + *shenas*, "one who knows cars". That is the product: an appraiser's opinion on every listing, for free, before the buyer even calls the seller.

## Who it is for

| Side | Who | What they want |
|------|-----|----------------|
| Buyer (primary) | Someone buying a used car in a big city: a first car, a family car, a car for ride-hailing work | Know what a fair price is today; skip duplicated, fake and bait listings; see the best deals first; be told when a car they want gets cheaper |
| Seller | Private sellers and dealers (نمایشگاه‌ها) | Know what their car is worth before listing it; later, reach serious buyers |
| Platform (us) | Carshenas | Trust (valuations that hold up, explanations that are honest), coverage and freshness; later, revenue on the click-out to the source listing, as Torob charges shops and CarGurus charges dealers |

## Why used cars

The research is in `docs/research/2026-09-26-*.md`; the decision is ADR-0006. In short:

- **The pain is worse than in the US.** Toman prices move weekly with inflation; a car's paint and body condition («رنگ‌شدگی»), the biggest single price factor, lives in free text; many ads carry «توافقی» (negotiable) or installment-bait prices; the same car is cross-posted on several sites; no site values a listing against the whole market.
- **There is a one-to-one blueprint.** CarGurus built a public company on exactly the challenge's last two steps: a daily market value per car and a deal badge on every listing.
- **It is buildable in a week.** Four sources can be crawled under their rules (Bama, Karnameh, Khodro45, Sheypoor), Divar is readable one pasted listing at a time through its Kenar API, and three sites publish price tables to benchmark against (`docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md`).

## CarGurus and Autolist mechanics we are cloning (v1 scope candidates)

A screen-by-screen teardown of both products comes first (CS-25), so the clone follows what they actually do.

1. **Search results, best deals first**: each card shows the deal badge («معامله‌ی عالی» … «خیلی گران»), the gap to market value in percent, days on market, past price drops and the source site. Plain-Farsi search («۲۰۶ تیپ ۲ بدون رنگ، مناسب اسنپ») becomes structured filters.
2. **Listing page**: a price-versus-market gauge, the comparable listings behind the estimate, price history, condition chips extracted from the ad text, risk flags, and **«همین خودرو در … ارزان‌تر»** when the same car is listed cheaper elsewhere, which is the Torob moment.
3. **Model page**: Torob's single product page applied to cars («۲۰۶ تیپ ۲ – ۱۴۰۰»), with a market-price trend and every listing ranked by deal.
4. **"What is my car worth?"**: market value, range and trend for a make, model, trim, year, mileage and condition.
5. **Saved searches and price-drop alerts**, delivered through a Telegram bot.
6. **Paste any listing link, get an instant deal rating.**

Deferred until the core loop works: accounts beyond alerts, dealer tools and dealer ratings, paid placement, image-based condition detection, new-car sale plans (factory versus market price), native apps.

## What makes it ours rather than a clone

- A Persian condition vocabulary (بدون رنگ، یک لکه رنگ، دور رنگ، تعویض کاپوت، شاسی سالم …) extracted with measured accuracy, because in Iran it moves the price more than mileage does.
- Price types handled honestly: negotiable, installment, down-payment bait and swap offers are recognised and kept out of the market value, or flagged.
- Market value recomputed daily and always shown with its date, because the toman does not stand still.
- Intents that only exist here: dual-fuel (دوگانه‌سوز) for ride-hailing, months of third-party insurance left, plate and ownership notes.
- Cross-site duplicate detection, so a buyer sees one car once, with every place it is listed and the cheapest first.

## How it works

```
sources ──crawl──▶ raw snapshots ──LLM extraction (schema + glossary)──▶ listings
   ──canonical make/model/trim──▶ duplicate groups ──comparables──▶ market value ──▶ deal rating
   ──index──▶ search and explanation (numbers from the database, words from the model)
```

Every AI step has an evaluation set and a reported accuracy before it ships (AGENTS.md, ADR-0011).

## Locale and market constraints (non-negotiable from day one)

- UI language: **Farsi**, right-to-left layout everywhere, proper Persian typography and Persian digits (۰–۹) in the UI; Latin digits in data and APIs.
- Calendar: Jalali (شمسی) in the UI, ISO-8601/UTC in storage. Model years appear in both calendars (۱۴۰۰ and 2021); both are stored explicitly.
- Currency: Toman in the UI (تومان), stored as integers, never floats (unit decided in CS-2). Car prices run to billions of toman, so large amounts need a readable form («۱٫۲ میلیارد تومان»).
- Mobile-first: most buyers browse listings on a phone.
- Hosting, crawling and third-party services must work from inside Iran; crawlers run from an Iranian IP; anything sanctioned or geo-blocked needs an ADR with a fallback.
- Sources are read only as their robots.txt and terms allow (ADR-0008); Divar only through its official API.
- Working language of the codebase, docs, tasks and commits: **English**. Product copy: Farsi.

## Success looks like

- In the demo, a buyer searches in plain Farsi and sees listings ranked by deal, each with a correct, explained rating; the same car found on two sites shows the cheaper one; pasting a live listing link rates it within seconds.
- Measured, not asserted (targets to confirm in CS-9, CS-11 and CS-13): extraction field accuracy of at least 95 % on a hand-labelled set, duplicate-detection precision of at least 95 %, and market value within 10 % median absolute error of held-out prices and published price tables.
- Later: buyers come back through saved searches and alerts; that, not sign-ups, is the metric that matters.

## Open questions (tracked in the backlog)

- Money unit and large-number formatting (CS-2); design language and fonts (CS-3).
- Acceptance of the crawl policy after reading each source's terms (ADR-0008, CS-5). The data, search and ingestion stack was decided on 2026-09-27: PostgreSQL only (ADR-0011 to ADR-0013, CS-4).
- Which LLM provider is reachable from where the pipeline runs, and at what cost per thousand listings (CS-8).
- Where to host so reviewers inside Iran can open it without a VPN (CS-23).
