# Divar snapshots made from real posts

The fixtures of CS-34's criterion 5: the parser (`src/sources/divar/attributes.ts`) is tested on real structure and real values. Each of the first three files is a canonical snapshot, as `readPost()` (`src/sources/divar/post.ts`, version 1) stores it, made from a real answer of Divar's post endpoint fetched on 2026-09-29 during CS-33's research (a few polite requests, at least three seconds apart); the four added by CS-86 are described in the last section.

## Personal data removed before they were committed

- The token, in `share.web_url`, is replaced by `gaFIX001` to `gaFIX003`.
- Every photo address is replaced by a made-up one on Divar's host and path (`…/webp_post/FIXTURE<n>/<token>-<n>.webp`), in the same order.
- The seller's description is replaced by «متن فروشنده در این نمونه نیامده است.».
- The district is replaced wherever it appears (`seo.web_info`, the photos' alt text, the breadcrumb's district filter) by «نارمک» and Divar's district id `70`.

The canonical form had already left out the contact, the map, the note, the dealer's id, the analytics and the line that names the street (`post.ts`).

Kept: the titles (car names and one dealer's advert line), every structured value of the car (mileage, year, colour, fuel, gearbox, insurance, price with its leading direction mark, the seller's scores, the swap and installment rows), `webengage.brand_model` and `business_type`, and the posting and expiry dates. The raw answers are not kept in the repository (ADR-0017 point 7).

## The files

| File                                   | What it shows                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private-206-both-calendars.json`      | A private seller's Peugeot 206 trim 5: «۱۳۹۲ - ۲۰۱۳», 91,000 km, «۱,۱۴۰,۰۰۰,۰۰۰ تومان», every score sound                                           |
| `dealer-206-swap-installments.json`    | A dealer's 206 trim 3 panorama, «۱۴۰۱ - ۲۰۲۲», with the «مایل به معاوضه» and «امکان خرید قسطی» rows                                                 |
| `dealer-pickup-placeholder-price.json` | A dealer's Pride pickup at «۵۰۰,۰۰۰ تومان» (a placeholder) with installments in its title, factory dual fuel, and no insurance row or gearbox score |

A fixture from a later real snapshot (lane A's live discovery, CS-35) is made the same way: through `readPost()`, then redacted as above.

## Added by CS-86: the mileage rule

Four snapshots the crawler itself stored on 2026-09-30 and 2026-10-01 (canonical already), redacted the same way, with the district and its Divar id replaced by «نارمک» and `70`, and the token by `gaFIX004` to `gaFIX007`. Each is read as of the date it was first fetched (`snapshot.first_fetched_at`, the second column), which is what the parser's mileage rule reads a car's age against. The sellers' descriptions are not kept, so what each said is written here:

| File                                | Fetched (UTC)            | What it shows                                                                                                                                                                                                               |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private-405-mileage-in-thousands.json` | 2026-09-30 13:05:50.986 | A private seller's Peugeot 405 GLX bi-fuel, «۱۳۹۷ - ۲۰۱۸», mileage «۱۰۹». The description repeats the figure («۱۰۹تا کیلومتر انداخته») and the price, 940,000,000 tomans, is a used 405's: the seller most likely means 109,000 km, the case the rule exists for. Chassis «تعیین‌نشده» and body «رنگ‌شدگی در ۱ ناحیه» are rows this parser does not read yet |
| `private-dena-1402-zero-km.json`    | 2026-10-01 06:13:55.150 | A private seller's Dena Plus, «۱۴۰۲ - ۲۰۲۳», mileage «۰», three model years before 1405; the description said it had been unused since its delivery, so this one really is zero-km, and the rule still does not store it |
| `private-207-1403-few-km.json`      | 2026-09-30 12:24:27.599 | A private seller's Peugeot 207i, «۱۴۰۳ - ۲۰۲۴», mileage «۴۰», two model years before 1405: a new car with a few kilometres, which keeps them                                                                                  |
| `private-dena-1405-few-km.json`     | 2026-10-01 05:25:32.869 | A private seller's Dena Plus, «۱۴۰۵ - ۲۰۲۶», mileage «۸۸», the fetch year's own model: a new car, which keeps its kilometres                                                                                                  |
