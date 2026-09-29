# Divar's web API for cars, confirmed on 2026-09-28

Evidence for CS-5 (criterion 5) and the Divar crawler (CS-6). On 2026-09-27 at 22:09 UTC (01:39 on 2026-09-28 in Tehran), the agent's browser, Playwright's Chromium, opened <https://divar.ir/s/tehran/car> and then one listing from it. Each endpoint was then requested once with curl, at 22:12:55 and 22:13:01 UTC. The raw responses stayed in a scratch directory and were not kept, because they hold ads' texts and photos. This record keeps names, shapes and a few example values: a price, a mileage, a district.

robots.txt: `api.divar.ir` answers `User-agent: *` and `Allow: /`. The rules of `divar.ir` (`/my-divar/*`, `/new`, `/s/*/*?*q=*`, `/adminbot`) do not cover the API host (copies in `robots-2026-09-28/`).

## Search: one page of car listings

`POST https://api.divar.ir/v8/postlist/w/search`, with `Content-Type: application/json`.

This is the first page with only what the crawler needs. The curl replay sent exactly this body and got 26 listings back:

```json
{
  "city_ids": ["1"],
  "search_data": {
    "form_data": { "data": { "category": { "str": { "value": "light" } } } },
    "server_payload": {
      "@type": "type.googleapis.com/widgets.SearchData.ServerPayload",
      "additional_form_data": { "data": { "sort": { "str": { "value": "sort_date" } } } }
    }
  }
}
```

- `light` is the category «خودرو سواری و وانت» (cars and pick-ups), the page `divar.ir/s/tehran/car`. `1` is Tehran. `sort_date` (newest first) is the web client's default.
- **Next pages:** add `pagination_data`, set to the previous response's `pagination.data` unchanged, while `pagination.has_next_page` is true. The web client fetched its second page this way, after showing the first 26 listings.
- **Extra fields:** the web client also sends `disable_recommendation`, `map_state`, `user_selected_location` and `previous_user_selected_location`. The minimal body answered without them.
- **Filters:** brand and model, price and year are further keys of `search_data.form_data.data`. CS-6 confirms the ones it uses from the web client before relying on them.

The response came back as HTTP 200, `application/json`, brotli-encoded, 15 KB for 26 listings. Its top-level keys are `list_top_widgets`, `list_widgets`, `list_bottom_widgets`, `search_data`, `action_log`, `search_bar`, `pagination`, `search_id`, `seo_details` and `show_no_search_result_notice`.

Each listing is a `list_widgets[]` item with `widget_type` `POST_ROW`. Across 26 and 24 rows on two pages, every item was a `POST_ROW`. Its `data` holds:

| Key | Content |
|---|---|
| `token` | The post's id (also in `action.payload.token`); the listing's page, the click-out target, is `https://divar.ir/v/<slug>/<token>` |
| `title` | The ad's title |
| `top_description_text` | Mileage in Persian digits with ASCII commas, «۲۷۰,۰۰۰ کیلومتر» |
| `middle_description_text` | The asking price the same way, «۹۸۰,۰۰۰,۰۰۰ تومان»: the field CS-2 chose |
| `bottom_description_text` | Recency, seller type and district, «در ابوذر», «نمایشگاه در ...» |
| `red_text` | A paid promotion, «نردبان شده», or empty |
| `image_url`, `image_count` | The first photo, on `s100.divarcdn.com`; how many photos the ad has |
| `action.payload.web_info` | `title`, `city_persian`, `district_persian` |
| `has_chat`, `layout_type`, `image_top_left_tag`, `should_indicate_seen_status`, `tracker_session_id` | Interface details |

The row's `action_log.server_side_info.info` repeats the token with its `sort_date`.

## Paging, and where a search ends (measured on 2026-09-29, CS-33)

The first market measurement read 2,950 search pages (the listing data and freshness note, section 6, and its data folder). What they showed about paging:

- **A full page is 24 rows.** The first page of a search can add promoted rows («پله شده») on top.
- **`has_next_page` does not mark the end.** A first page said a next page follows with 23 rows (brand IM) and with one (Buick); 256 slices of the 13:31 sweep ended on such a short page. The answers are gRPC-gateway JSON (`grpc-status: 0`), which leaves out an empty list and a false flag: a `pagination` without `has_next_page` means false.
- **Past a slice's last row:** page 2 of IM, asked 17 minutes after page 1, came back HTTP 200 in 30 ms as JSON without `list_widgets`. The crawler took it for a quiet block and stopped Divar at 13:13:44 UTC (`fetch_log` of that day, the one `blocked` row) until the owner resumed it; the body was not kept. An empty list left out of a search answer explains it.
- **Where a Tehran search's own rows run out, Divar goes on** with widgets that are not listings, then other listings, and still says more follow:
  - a `SUGGESTION_ROW` titled «آگهی‌های پیشنهادی در شهرهای اطراف» at the end of a page, then listings from nearby cities (389 slices);
  - a `DIVIDER_ROW` and a `SELECTOR_ROW` titled «آگهی‌های مشابه», then similar listings (73 slices);
  - with no row at all, a `SELECTOR_ROW` titled «نتیجهٔ دقیقی پیدا نشد» (54 slices).
- **No full page held any widget but `POST_ROW`.**
- **A cursor still worked 16 minutes after its page** (the whole market's page 2).
- **The cap other entrants reported** (about 1,200 results, 50 pages) was not reached: the whole-market walk read 11 pages before the owner stopped the sweep.

What the crawler does (`apps/worker/src/sources/divar/search.ts`, `answers.ts`; `apps/worker/src/jobs/divar.ts`): it reads rows only up to the first widget that is not a `POST_ROW`; takes a page of fewer than 24 rows as the last; reads an answer without `list_widgets` but with the rest of a search answer (`search_id`, `search_data` or `pagination`) as an empty page; still stops on `{}`, an empty body, an error object or HTML; and reads at most 50 pages of a slice (51 of the whole market, to test the cap).

## Post: one listing

`GET https://api.divar.ir/v8/posts-v2/web/{token}`. The web client adds `?tracker_session_id=…`, which is not needed.

The response came back as HTTP 200, 7 KB. Its top-level keys are `sections`, `share`, `seo`, `contact`, `webengage`, `analytics` and `city`.

- **`sections[]`**, by `section_name`:
  - `BREADCRUMB`, `TITLE`, `DESCRIPTION` (the seller's own text), `TAGS`, `MAP`, `NOTE` and `STATIC`.
  - `IMAGE`: an `IMAGE_CAROUSEL` whose items each have `image.url` and `image.thumbnail_url`, WebP files under `https://s100.divarcdn.com/static/photo/`.
  - `LIST_DATA`: the car.
  - `BUSINESS_SECTION`: present for a dealer.
- **`LIST_DATA`** widgets carry `title` and `value` pairs:
  - A `GROUP_INFO_ROW` holds کارکرد (mileage), مدل (سال تولید) (the model year in both calendars, «۱۳۹۶ - ۲۰۱۷») and رنگ (colour).
  - `UNEXPANDABLE_ROW`s hold برند و مدل (make, model and trim in one string), مهلت بیمهٔ شخص ثالث (months left on third-party insurance), گیربکس, نوع سوخت, and the price row قیمت پایه. The price value starts with U+200F (the right-to-left mark) and groups digits with ASCII commas, as CS-2 recorded.
  - `SCORE_ROW`s, under «ارزیابی فروشنده», are the seller's own condition ratings: موتور, وضعیت شاسی‌ها, بدنه, گیربکس. They are claims, not inspections.
- **`seo.unavailable_after`** is when the ad expires. `share.web_url` is the listing's page.
- **`webengage.price`** is a float. On the listing opened here it read 2,248,999,936 for an asking price of 2,249,000,000 tomans: the rounding CS-2 warned about. Never read it.
- **`contact`** holds only `contact_uuid` and an action log. The browser's copy also carried `contact_encrypted_data` and feature flags. Neither response contains a phone number. The number sits behind a separate contact call that needs a signed-in user, and the crawler never makes that call (ADR-0008 point 7).

## Headers, limits and pace

- Both responses came through Sotoon CDN (`server: Sotoon CDN`, `x-datacenter: hwb`) as gRPC-gateway JSON (`grpc-status: 0`). CORS admits only `https://divar.ir`, which does not concern a server-side client.
- Neither response carried `Retry-After` or `X-RateLimit-*` headers, so Divar publishes no limit to follow. ADR-0008's floor of three seconds between requests applies, and a 403, 429 or challenge stops the source (ADR-0008 point 6).
- The curl requests sent no cookie and a descriptive User-Agent (`CarshenasResearch/0.1 (CS-5 endpoint check; one request at a time)`). Each answered in about 0.5 s.
- **Pace:** N listings take about N / 26 search calls plus N post calls. At three seconds each, 2,000 Tehran listings take about 1.7 hours.

## Calls the web client makes that the crawler does not

These are interface state and telemetry:

- `POST /v8/search-bookmark/web/get-search-bar-empty-state`
- `POST /v8/my-divar/web/menu`
- `POST /v8/post-stats/receive-post-stats-batch`
- `POST /v8/actionlog/send`
- `POST /v1/client-exporter/send-report`

The crawler also never calls any contact or chat endpoint.
