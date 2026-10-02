# S03: The search page

- Status: approved (decided under the owner's delegation, 2026-10-02; CS-61)
- Date: 2026-10-02
- Tasks: CS-61 (this page); plugs in CS-62 (what we understood), CS-64 (listing page), CS-55 (also listed on)
- Related: S02 (filters and catalogues), ADR-0027 (the search in the URL), ADR-0028 (the search table and API), ADR-0025 (photos from the source)

## Goal

A buyer lands on `/search`, sees the best deals first as real cards, narrows by catalogue, chip or filter, and leaves for the ad on its source. The address is the whole state.

## Flow

1. The search box, the catalogue strip (one Tab stop, arrow keys inside, a count and an info popover each), the applied filters as removable chips, the count and the order, the filters (a sticky rail at the inline start on a desktop, a batch sheet with a live count and a sticky apply bar on a phone), the cards.
2. Every change is `router.push` of `searchHref` in a transition: controls answer at once (optimistic), a thin line runs over the old results until the new ones arrive. The old results are not dimmed (dimmed text fails 4.5:1).
3. Paging is a «نمایش بیشتر» button on a keyset cursor, capped at 120 cards on the page (then: narrow the search). Focus goes to the first new card; a polite message says how many came. A cursor the API refuses offers a fresh first page.
4. Focus: when the control that changed the search is gone (a removed chip, a suggestion), focus lands on the results count.

## Rules

- A card: photo from the source's own address (placeholder on none or failure), title with the model year, price in full digits, deal badge from the ramp with the gap, the market value it is measured against, mileage, gearbox, place, up to three condition facts, source, seller type, days on market. The whole card is one link, to the ad on its source in a new tab (`listingLink`), until CS-64.
- Names from the catalogue are shown with Persian digits unless a digit belongs to a Latin code (`nameOnScreen`).
- Counts above the API's cap read «بیش از …». A listing the valuation did not rate wears a neutral badge; negotiable and instalment listings have no badge.
- No results: the filters that would bring results back, each with its count, the best as the solid action; «clear all». An empty index and an API failure (with retry and the reference code) have their own states.
- Parameters the schema could not use are named. A typo word the search replaced, and a word that matched nothing, are named under the box.
- The source filter appears only when more than one source has listings.
- Every filter and catalogue has an info popover whose text comes from the definitions in `@carshenas/search`.

## Plugging in CS-62

`SearchScreen` takes an `understanding` node, rendered under the search box and above the words notice; compose it in `app/(site)/search/page.tsx`. It reads `q` from the address and links with `searchHref`.

## Acceptance

See CS-61's criteria; evidence in `e2e/tests/app/search.spec.ts` (phone and desktop), the stress matrix and the gorilla.
