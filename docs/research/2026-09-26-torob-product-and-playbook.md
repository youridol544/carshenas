# What does Torob do, and which of its mechanics must "Torob for X" reproduce?

- Date: 2026-09-26
- Asked by / for: Pedrum, for choosing X and shaping the product (ADR-0006, `docs/product/vision.md`)
- Outcome: the five-step playbook at the end shapes the product brief and the backlog milestones.

## Questions

1. What is Torob's product, end to end and screen by screen?
2. How does it make money?
3. How big is it?
4. What else does it build, and what does its engineering say about how it uses AI?
5. What are its closest Western analogues?

## Sources

- <https://torob.com/pages/about-us/>: Torob's own description of shop onboarding and click pricing (fetched 2026-09-26).
- Archived product page from April 2026 on web.archive.org, and its embedded data: live product pages answered the research agent with Torob's bot CAPTCHA (HTTP 490), so the walkthrough uses the archive.
- <https://cafebazaar.ir/app/ir.torob>: app FAQ ("Torob sells nothing").
- <https://torob.com/landings/guarantee/>: the Torob Guarantee terms.
- <https://dmboard.media/news/click-vizhe-torobs-way-to-promote/> (Special Click), <https://dmboard.media/news/torobjoo-intagram/> (TorobJoo), <https://limoo.host/blog/how-to-sell-on-torob/> (2025 click-price table, third party), <https://matson.online/torob-pay/> (TorobPay merchant fee, third party, unverified).
- Scale: <https://techpark.sharif.ir/babayi/> (2024), <https://peivast.com/p/226681> and <https://www.zoomit.ir/tech-iran/441799-charisma-torob-gold/> (2025), <https://quera.org/events/torob-0406> (September 2025); founding: <https://digiato.com/company/introducing-torob>, <https://financialtribune.com/articles/economy-sci-tech/18789/local-price-search-engine-launched>.
- Torob engineering posts on Virgool: <https://vrgl.ir/DsUdm> (AI ticket automation), <https://vrgl.ir/0Ds7w> (image search), <https://vrgl.ir/rNW5n> (bot blocker), <https://vrgl.ir/4472h> (database upgrade), <https://vrgl.ir/6LUdq> (moving 18 servers in one night).
- <https://jobs.torob.com/> and its public careers API (`/api/public/v1/careers/jobs`), fetched 2026-09-26.
- Analogues: <https://blog.google/products-and-platforms/products/shopping/save-money-price-insights-price-alerts/>, <https://www.prnewswire.com/news-releases/klarna-completes-acquisition-of-pricerunner-301516456.html>, <https://www.ecommercebytes.com/2019/01/07/what-happened-to-comparison-shopping-engine-nextag/>, <https://www.ecommercebytes.com/2019/04/03/ebay-to-close-shopping-com-and-ad-platform-on-may-1st/>, <https://www.pymnts.com/news/partnerships-acquisitions/2020/paypal-finalizes-4-billion-dollar-honey-acquisition/>.

## Findings

### The product

Torob is a shopping search engine. It sells nothing: buyers click out and pay on the shop's own site.

- **Supply.** An online shop registers (it must hold eNamad, Iran's e-commerce trust seal; approval takes up to 48 hours), prepays a wallet, and Torob's bots crawl its products, which takes up to a week. A content team categorises products and **merges** each into one canonical product page. Physical stores are not crawled: they find the product in Torob's catalogue and type in a price. An official WooCommerce plugin (30K+ installs) and a product API are other feeds.
- **Search results.** Filters for city, price, brand and category attributes; switches for TorobPay installments, in-person purchase, new or used, in stock only; sorting by popular (default), cheapest, newest or most sellers. Each card reads "from X toman · in N shops". Ads are labelled «آگهی».
- **Product page.** A variant picker; a main buy button ("Buy from [shop] · price · Torob Guarantee · 30 other sellers"); quick filters (guaranteed sellers, installments, my city, open now); Online and In-person tabs. Each online offer shows shop, city, score, years on Torob, warranty, shipping, **when the price last changed**, and the price, sorted by price after one labelled sponsored offer. Below: a price-change chart, reviews, specs, similar items. The page data carries a seller-ordering rule named `pdp_quality_threshold_price_penalty_v1` and an A/B-test parameter.
- **Trust.** Buyers open complaint tickets that Torob mediates; those tickets drive each shop's score. Shops with the "Torob Guarantee" badge are backed by Torob itself for non-delivery, defects or wrong items reported within 7 days.
- **Retention.** Favourites, price-drop alerts and a built-in assistant.

### Business model

- **Pay per click-out** from the shop's prepaid wallet: 350–1,700 toman per unique visitor session, rising with daily volume (Torob's page); a 2025 third-party table says 450–2,300 toman, so the exact rates are uncertain.
- **"Special Click"** (since early 2022): an hourly auction for the sponsored row on each product page; the top five bidders share it in proportion to their bids and pay their own bid per click.
- **Newer revenue:** a TorobPay merchant fee (about 6 % plus VAT, third party, unverified), Mixin subscriptions, paid TorobChat plans.

### Scale (self-reported)

Founded 2014 in Sharif University's accelerator, public around April 2015; founders Ali Babaei (CEO) and Majid Rahiminejad. About 2M daily active users (September 2024); 25M monthly active users and 10M accounts (2025); "30M+" monthly users (September 2025). Shops: about 100K (September 2024), 130K (March 2025), "200K" (September 2025). "Millions" of products. 23M app installs on Bazaar. Similarweb-style estimates (3–4M visits a month) do not see traffic from inside Iran and should be ignored.

### Other products

- **TorobPay**: buy now, pay later (25 % upfront, three interest-free monthly payments), built into search and product pages.
- **Mixin**: an AI store builder (30K+ shops) that pushes products to Torob; a separate legal company.
- **TorobChat**: an AI shopping assistant that searches products and shops, reads specs and reviews, and cites sources; free up to a weekly quota.
- Smaller: TorobJoo (find a product from an Instagram screenshot), Torob Gold (gold savings), a copy of Torob for Turkey (2024). "Torob Turbo" was a 2025 AI hackathon with Quera, not a product.

### Engineering and AI

- **Complaint-ticket automation (2025):** support staff wrote the handling rules as a flowchart; at each step the model only chooses among preset options. On a hand-checked set it handled 68 % of steps with 92 % correct; in production it handles 20–30 % of steps for about $6 a day. This is the reporting style a reviewer will expect from our AI steps.
- **Image search (2025):** FashionCLIP, then SigLIP2 embeddings in Qdrant beside the main Elasticsearch index; updates 8× faster; satisfaction up 20 %.
- **Infrastructure:** an in-house bot blocker (the CAPTCHA above), a ~1.5 TB main database upgrade, 18 servers moved in one night.
- **Search problems named on the careers page:** Persian queries with typos and Persian typed in Latin letters, attribute extraction, the same product under different names, shop matching, price validity, multi-stage ranking, personalisation.
- **The AI Product Engineer job record** (careers API, not shown on the challenge page) lists Python/Django, React, FastAPI, PostgreSQL, Elasticsearch, Redis, Docker, Kubernetes and OpenAI, Claude, Gemini and Llama models, and describes moving business logic into models through context engineering, agents, and tools that measure model accuracy.

### Western analogues

- **Google Shopping**: the closest (store comparison, price history and alerts, paid clicks), except that merchants submit feeds instead of being crawled.
- **idealo** (Germany): almost identical, including pay-per-click.
- **PriceRunner**: the same model, owned by Klarna since 2022, which mirrors Torob plus TorobPay.
- **PriceGrabber, Nextag, Shopping.com**: the earlier US pay-per-click generation; Nextag went offline in 2018, Shopping.com closed in 2019.
- **Honey**: the least similar (a coupon extension earning commission).

## Recommendation: the Torob playbook for a new vertical

1. **Collect every offer and keep it fresh**: crawl, take feeds, show when each price last changed.
2. **Merge offers into one page per item**, defined at the granularity that changes the price (for cars: make, model, trim, year, mileage band and condition), with humans reviewing the merges.
3. **Let the user decide on one page**: rank by price above a quality bar, filter by trust and location, show price history and alerts, and explain the best choice.
4. **Make trust the moat**: seller signals, time listed, flags for suspicious prices.
5. **Make money on the click-out**: pay per click and a labelled sponsored slot, then build on the same traffic.

For Carshenas these map to: multi-source crawling with snapshots (m-2), extraction, canonical trims and duplicate groups (m-3), market value and deal ratings (m-4), and the search, listing and model pages (m-5).
