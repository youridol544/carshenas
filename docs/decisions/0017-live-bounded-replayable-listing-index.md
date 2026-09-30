# ADR-0017: Keep a live, bounded index of listings, kept fresh within a request budget, with frozen releases for evaluation

- Status: accepted on 2026-09-28 by delegation. The owner asked the agent to "decide based on best strategy ... dont ask me if i accept that or not", and approves the commit that carries this record. The photo clause of point 10 is replaced by ADR-0025 (2026-09-30): pages show the source's photos from the source's own addresses.
- Date: 2026-09-28
- Deciders: Pedrum (delegated to the agent)
- Related:
  - ADRs: ADR-0008 (politeness, stop on block, personal data: all unchanged; its point 5 "a bounded crawl sized for the product's needs" is made concrete here), ADR-0010 (photos), ADR-0011, ADR-0013; CS-40, the owner-only admin section of the web app that controls the tracked models.
  - Research: `docs/research/2026-09-28-listing-data-and-freshness.md` (scale, freshness practice, the three options) and `docs/research/2026-09-28-torob-challenge-expectations-and-field.md` (what Torob will judge, what other entrants built).
  - Tasks: CS-33 to CS-35, CS-37, CS-49, CS-51, CS-53, CS-54, CS-59, CS-64 to CS-66, CS-73 and CS-75.

## Context

On 2026-09-28, before starting the crawler, the owner asked whether Carshenas should run a live crawler against sources whose terms forbid it, work only from a crawled sample, or keep nothing and turn each search into calls to the sources' own search APIs. The owner also proposed a superadmin who adds the car models to crawl, starting with the ten most listed, and sees each one's sync.

- **The brief and the employer:**
  - Torob's brief begins "crawl offers".
  - Its careers page says every search is about "relevance, data quality and price freshness" («تازگی قیمت»). One of the ten problems it lists is price validity: fresh, valid and reliable.
  - Torob's own shop protocol, Torob-Sync, lists products newest first, leaves deleted ones out and lets a shop ask for a single product to be re-read.
- **What the product claims.** A deal rating is true only of a car still for sale at the price shown, and toman prices move weekly. CarGurus recomputes its market value daily from current and earlier listings, and gives no rating when comparables are too few.
- **Scale:**
  - Divar received 8.6 million car listings in 1399, about 23,600 a day, 26 % of them in Tehran (about 6,100 a day).
  - At ADR-0008's floor of one request per three seconds, a host allows at most 28,800 requests a day.
  - One list page returns about 25 listings.
  - Reading details for all of Tehran every day would take about 75 hours of requests a day.
- **What other entrants report (unverified):** one Divar search stops at about 1,200 results, and Divar can block with an empty HTTP 200.
- **When it is judged.** Reviewers open the demo link days or weeks after it is sent.

## Decision

1. **Keep an index, and keep it live.**
   - Carshenas stores listings and derives everything from its own stored snapshots (ADR-0013).
   - A buyer's search never sends a request to a source.
   - The worker runs continuously, from an Iranian network, and keeps running while the submission is under review.
2. **Coverage.**
   - Divar: Tehran, category `light`, the passenger cars and pick-ups of divar.ir/s/tehran/car. Not the wider divar.ir/s/tehran/auto, whose heavy, rental and classic vehicles would distort market values.
   - Bama: Tehran cars, as the second source (CS-54).
   - Other cities and sources come after the demo (CS-77).
3. **Read the whole market shallowly, and only tracked models in depth.**
   - **Discovery:** list pages, newest first, often enough to store a new listing within an hour (about every 15 minutes per tracked model), stopping after a run of already-known listings. Bumped listings return to the top, so a single known listing is not enough to stop.
   - **Sweeps:** list rows only.
     - Every day for tracked models, every week for the others.
     - Sliced by the source's make and model filters, so each row belongs to a model and no search reaches its result cap.
     - A sweep refreshes when a listing was last seen and records price changes from the rows. It measures each model's volume and marks listings missing from a complete sweep.
   - **Details** (one request per listing) only for tracked models, in four cases: a listing first seen, a listing whose row changed, a listing missing from a sweep (to confirm it gone), and a listing a buyer opens whose last check is older than six hours.
   - **Expiry:** a listing past the source's own expiry (Divar's `unavailable_after`) is marked expired without a request.
4. **The superadmin controls the tracked models.**
   - The owner-only admin section of the web app (CS-40) tracks, pauses and untracks a make and model with a priority, picked from the catalogue, which is seeded from the sources' own make and model lists.
   - The start is the ten models with the most active Tehran listings in the first complete sweep. The fleet data suggests these cover about two thirds of listings.
   - Tracking a model backfills the listings the sweeps have already seen. Pausing keeps its data, dated.
   - Untracked models stay visible in the admin section with their volumes, and with the demand buyers show for them through searches and pasted links.
5. **A daily request budget per source.**
   - It is set from CS-33's measurements, at no more than half of what the floor allows (14,400 requests a day), and is configurable.
   - It is spent in this order: discovery; re-checks and pasted links a buyer triggers; details of new tracked listings; the tracked sweep and the checks it triggers; backfills; the untracked sweep. What comes last is dropped first.
   - Every run reports what it spent on what.
6. **Freshness targets, measured and shown** (CS-35, CS-66):
   - a new listing of a tracked model appears within an hour of being posted;
   - a results page shows only listings seen within the last 48 hours, with a median under 24 hours;
   - an opened listing says when it was last checked;
   - market values are recomputed daily and shown with their date.
7. **Frozen releases** (CS-49):
   - A named, dated cut of the snapshots and of what was derived from them is the input for the evaluation sets and the valuation backtest (learn before the cut, test after it).
   - The demo video is recorded on the live site in one sitting. A release supplies the numbers it quotes, and the fallback if a source blocks on the recording day.
   - Releases are never committed, because they hold the sources' content. Only redacted evaluation fixtures are (CS-48).
8. **On-demand reads for single listings only.** A pasted link (CS-65) and the re-check when a listing is opened go through the same per-host queue and floor. There is no per-search fan-out.
9. **Degraded, not broken.** When a source blocks or is paused (ADR-0008 point 6):
   - its listings keep their last data with its date;
   - its market values stay dated;
   - the pages say the source is not being updated.
10. **What the live pages show.**
    - Facts (title, price, mileage, year, district, seller type), our analysis (market value, rating, explanation, and a short quote as evidence for each condition fact), and a click-out to the source.
    - Never a seller's full description or contact details. Photos only as CS-60 decides under ADR-0010.
    - The demo deployment is unlisted: `noindex` on every page, a robots.txt that disallows everything, and a link shared only through the submission.
11. **Sources are adapters.**
    - Each source is read through the same four operations: discover, sweep, fetch and parse. `access_method` records how.
    - A partner feed or an official API is how this scales: Divar's Kenar, dealer feeds, or the way Torob onboards shops. Either would replace a crawler without touching the rest.
    - The demo says so rather than claiming an integration that does not exist.

## Alternatives considered

- **A crawled sample only:** simple and repeatable. Eleven of the 29 public entries found on 2026-09-28 did this, and eleven more used invented data. No car entry with real data retires sold listings. But its ratings go stale in a market that moves weekly. Click-outs die as the cars sell, before the reviewers open the link. It has no days on market, no price drops and no removals, and it gives no way to see whether the ratings were right. Its strength is kept as frozen releases (point 7).
- **No index; each search goes to the sources' own search APIs:** always current for what it shows. But with no stored comparables there is no market value, no cross-site duplicate and no history. Every buyer's search becomes traffic to the sources, the very pattern that gets a client blocked. And a search would take tens of seconds at ADR-0008's pace. It suits flights, where a price exists only for one search. Its strength is kept as single-listing reads (point 8).
- **A full mirror of every Divar car listing with daily details:** about 75 hours of requests a day for Tehran alone, far beyond one host's floor. Market values do not need it either, because a listing that has left the market still counts at its last asking price and date.
- **Only a hand-typed list of models, searched model by model** (the owner's idea without the sweep): simpler, but everything untracked stays invisible, new models included, and volumes are guessed rather than measured. The sweep keeps the whole market in view cheaply, and the tracked list decides where the expensive requests go.
- **Saying that production would use integrations, so no crawler:** the brief says crawl, and no partnership exists. Point 11 shows the path to one instead of claiming it.

## Consequences

- **Positive:**
  - Ratings are dated and fresh, on listings that are for sale.
  - Days on market, price history and price drops become possible.
  - Ratings can be checked against what the market did next (CS-73), which no sample allows.
  - Freshness, coverage and spend are numbers the demo can show.
  - The owner controls cost and coverage from the admin section, without touching code.
- **Negative and risks:**
  - **Legal and reputational exposure:** a crawler running continuously against Divar's and Bama's terms, from a host reviewers can find, makes ADR-0008's accepted risk visible. The display policy (point 10), the budget and the unlisted deployment limit it but do not remove it.
  - **Operations:** a worker that must stay up on an Iranian host.
  - **Fragility:** Divar's internal API and its filters can change without notice.
  - **A block during review:** leaves the site dated (point 9).
  - **Unmeasured volumes:** they come from 1399 reports, until CS-33 measures today's, which may change the budget and the number of tracked models.
- **Follow-ups:**
  - CS-33: discovery and the measurements.
  - CS-34: parsing without a model.
  - CS-35: sweeps, lifecycle, budget and freshness metrics.
  - CS-37: the unlisted, always-on deployment.
  - CS-49: releases.
  - CS-53: tracked models in the admin section.
  - CS-54: Bama.
  - CS-64: last-checked and re-check on open.
  - CS-65: demand from pasted links.
  - CS-66: the data-status page.
  - CS-73: ratings against outcomes.
  - CS-75: the demo.
