# Listing and deal patterns

Sources: Baymard Institute public articles on result lists (2023-05-30, 2024-05-08), mobile list loading (2020-01-07), applied filters (updated 2026-05-13), search no-results (updated 2025-02-18), inline validation (2024-01-09); NN/g on batch filtering (2016, updated 2025), card layouts (2016), list thumbnails (2015-12-06) and hidden costs; CarGurus help centre on Instant Market Value and deal ratings (<https://cargurus.helpscoutdocs.com/article/10-what-is-imv>, read 2026-09-26) and its release on Autolist (2020); Torob's product page as recorded in `docs/research/2026-09-26-torob-product-and-playbook.md`; Laws of UX (lawsofux.com). Items marked *inference* have no public source and are our design decision; the spec for each feature decides them finally.

Vocabulary comes from `docs/product/glossary.md` (listing, source, market value, comparable, deal rating, trim, body condition). Money formatting and the unit are in `persian-type-formatting.md` and CS-2.

## Search results

- A row shows: photo (only where the source's robots.txt and terms allow it, ADR-0010; otherwise a neutral placeholder), title as make, model, trim and year («پژو ۲۰۶ تیپ ۲، مدل ۱۴۰۰»), asking price, the deal badge with the gap to market value («۱۲٪ زیر ارزش بازار»), mileage, city, a body-condition summary («بدون رنگ»), days on market and the source or sources. Price and condition are what buyers scan for, so they are in the list, not only on the listing page (Baymard on list attributes).
- Homogeneous listings go in a uniform list, not free-form cards: "Card layouts are less scannable than lists" (NN/g). One column of rows at 412 px; two or three columns from 1024 px (*inference*).
- Thumbnails on the right in a row (NN/g's mirror rule for RTL); text starts at the right edge.
- Load 15 to 30 items, then a «نمایش بیشتر» button, which performed best on mobile (Baymard). Never infinite scroll on pages with a footer people need.
- The default sort is best deal first, as on CarGurus. Others: lowest price, lowest mileage, newest listing, newest model year. Sort is a select at the top, not a sheet of radio buttons.
- Prices are never hidden: "People view companies that hide costs as being evasive and untrustworthy" (NN/g). A negotiable listing says «توافقی» and gets no badge.

## Deal badge

- Five levels with fixed words: «معامله‌ی عالی»، «معامله‌ی خوب»، «قیمت منصفانه»، «گران»، «خیلی گران» (CarGurus: Great, Good, Fair, High, Overpriced), plus «بدون ارزیابی» when there is no price or too few comparables; CarGurus also shows no rating in that case.
- Colour never carries the level alone (WCAG 1.4.1): the word is always there; a position on a scale may reinforce it (*inference*).
- The badge sits next to the gap in percent and the market value with its date («ارزش بازار امروز: ۶۸۰ میلیون تومان»), because the market moves weekly (*inference*, from ADR-0006).
- Tapping the badge goes to the explanation on the listing page.

## Filters

- On phones filter in a batch: a sheet with all filters and one «اعمال» button carrying the result count («نمایش ۱۲۸ آگهی»). "err on the side of batch filtering and include an Apply button" (NN/g).
- Applied filters show as removable chips above the list, not as a bare count («فیلترها (۳)» is not enough) (Baymard).
- Make → model → trim narrow each other; long option lists (make, model, city) get a search field inside the filter.
- Ranges (price, mileage, model year) are two typable fields with words between them («از … تا …»), each accepting every digit script; model years accept both calendars (۱۴۰۰ and 2021) and say which one they show (*inference*).
- Car-specific facets: body condition (بدون رنگ، لکه رنگ، دور رنگ، تعویض قطعه), gearbox, fuel (including دوگانه‌سوز), seller type, deal rating, source.
- Filter state lives in the URL so results can be shared and the Back button works (Vercel guidelines on URL state).

## Search

- Plain-Farsi search («۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون») shows the filters it understood as chips at once, so the buyer can correct them; words it could not use are said, never dropped silently (*inference*).
- Normalise before matching: Arabic yeh and kaf to Persian (ي→ی, ك→ک), all digit scripts to Latin, ZWNJ tolerated in either form (alreq). Accept model names typed in Latin letters and spelled out («۲۰۶»، "206"، «دویست و شش»); Torob names typos and Latin-typed Persian among its core search problems.
- A no-results page is never a dead end (Baymard): keep the query, say which filter emptied the list, offer to widen it (a higher price, neighbouring years) (*inference* for the widening).

## Listing page

- Above the fold at 412 px: photos where allowed, title, asking price, deal badge with gap and market value, a key-facts row (year, mileage, gearbox, fuel), condition chips, city and days on market, and one primary action, «دیدن آگهی در <source>» (the click-out).
- The price-versus-market gauge is a scale of the five bands with the market value and this price marked; in RTL the cheaper end is on the right (*inference*). Numbers on it are never mirrored.
- "Why this rating": two or three Farsi sentences, then the comparable listings behind the estimate with their prices. The model only words the sentences; every number comes from the database (AGENTS.md).
- Condition chips come from the listing's text; tapping one shows the sentence it was read from, so a wrong extraction is visible (*inference*).
- Price history is this listing's own snapshots as a step chart with Jalali dates.
- «همین خودرو در منابع دیگر»: the duplicate group, cheapest first, each with price and source, like Torob's list of sellers.
- Risk flags are sentences, not bare icons («قیمت اعلام‌شده پیش‌قسط است»).
- No horizontal tabs for core content: stack sections in reading order.

## Model page

- «پژو ۲۰۶ تیپ ۲ – مدل ۱۴۰۰»: today's market value and range, a weekly trend with Jalali dates, then every listing of the model ranked by deal (Torob's product page with its sellers).

## "What is my car worth?"

- One column in the order a person thinks: make, model, trim, year, mileage, body condition, city. The result is a market value, a range and «بر اساس ۲۳ آگهی مشابه» with those comparables; when there are few, it says the estimate is uncertain instead of showing false precision (*inference*).

## Saved searches and alerts

- Saving the current filters is one tap; the first save explains the Telegram hand-off in one sentence; the saved search says what triggers a message («آگهی تازه با ارزیابی خوب یا بهتر»، «کاهش قیمت») and how to stop it (*inference*).

## Shareability

Search, listing, model and valuation pages are addressable URLs that render without login, so a buyer can send one to a family member or a mechanic.
