# Divar snapshots made from real posts

The fixtures of CS-34's criterion 5: the parser (`src/sources/divar/attributes.ts`) is tested on real structure and real values. Each file is a canonical snapshot, as `readPost()` (`src/sources/divar/post.ts`, version 1) stores it, made from a real answer of Divar's post endpoint fetched on 2026-09-29 during CS-33's research (a few polite requests, at least three seconds apart).

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
