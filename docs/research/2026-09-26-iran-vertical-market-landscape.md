# Where in Iran would a Torob-style vertical search engine be most valuable and feasible to prototype in a week?

- Date: 2026-09-26
- Asked by / for: Pedrum, for choosing X (ADR-0006)
- Outcome: villas scored highest on feasibility and used cars on value; used cars chosen because it also has an exact US blueprint (ADR-0006). Villas remain the fallback.

## Questions

1. For each candidate vertical: who are the main platforms, does an aggregator already exist, and what is the user's main pain?
2. Can a prototype read the data: public pages, embedded JSON, official APIs, and what do robots.txt and terms allow?
3. Which three verticals are both most valuable and buildable in about a week?

## Sources

Each claim below links its source. Test fetches were made from this machine on 2026-09-26: every Iranian site answered with its data in the page HTML, except torob.com, which served a bot CAPTCHA.

## Findings

### Context: 2026 is not a normal year

Iran had a nationwide internet blackout from 8 January to late May 2026, the longest on record, and access is still partly restricted ([Wikipedia](https://en.wikipedia.org/wiki/2026_Internet_blackout_in_Iran), [Cloudflare](https://blog.cloudflare.com/iran-internet-partially-restored-may-2026/), [NPR](https://www.npr.org/2026/05/28/g-s1-124610/iranians-back-online)). On 8 September 2026 the US sanctioned the remaining 27 Iranian airlines, and international flights are collapsing ([Al Jazeera, 8 Sep](https://www.aljazeera.com/news/2026/9/8/us-increases-pressure-on-iran-with-sanctions-targeting-aviation-sector), [23 Sep](https://www.aljazeera.com/news/2026/9/23/us-aviation-sanctions-disrupt-iran-flights-push-travellers-overland)). Travel data is therefore thin and unstable.

### Overview (rating 1–5 combines value to users and one-week feasibility)

| Vertical | Main players | Existing aggregator? | Key pain | Prototype data access | Rating |
|---|---|---|---|---|---|
| Flights | Alibaba, Flytoday, Mrbilit, Flightio, Snapptrip | Yes, mature: SafarMarket; Sepehr360 for charters | The same ticket costs about the same everywhere; refund rules differ; cancellations | Live per-query searches only; official feeds are B2B contracts | 2 |
| Used cars | Divar, Sheypoor, Bama, Karnameh, Hamrah Mechanic, Khodro45 | Weak | Free-text condition, duplicates, negotiable and installment-bait prices, volatility | Easy: all six embed listing data in the page; Divar's terms forbid copying | **4** |
| New cars | Carmakers, dealers; price tables on Bama, Hamrah Mechanic, Karnameh | Yes, daily factory-versus-market tables | Factory–market gap up to ~45 %; lottery and pre-sale terms | Easy | 3 |
| Rent and sale | Divar (~70 % of ads in a 2022 report), Sheypoor, Kilid | Partial | Deposit-to-rent conversion, fake and duplicate ads | Divar's terms forbid copying; Kilid allows crawlers | **4**, crowded |
| Insurance | Azki (merged with Bimito), BimeBazar, Bimeh.com | Yes, these are the comparators | Regulated premiums; claims service is hard to compare | Quotes need a plate number and national ID | 2 |
| Villas / hotels | Jabama, Jajiga, Shab, Otaghak, Homsa; hotels via Alibaba, Snapptrip | Villas weak; hotels yes | The same villa on several sites at different prices; wartime gouging | Prices in page data on 3 of 4 villa sites | **Villas 5** / hotels 2 |
| Tours | Agencies via Lastsecond, SafarMarket | Yes | Packages differ in hotel, airline, times | Plain HTML | 3 |
| Doctors | Paziresh24, Doctoreto, DrDr | None | Waiting time and insurance, not price (fees are state tariffs) | Loaded in the browser; health data | 1 |
| Gold | Milli, Talasea, Wallgold, Digikala; jewellers | Partial: TalaMarketCap, TGJU, Torob | Making fee, profit and VAT hide the price per gram | Easy | 3 |
| Loans / BNPL | SnappPay, Digipay, TorobPay, Azki Vam | Yes: Pishkhanak, Rade | Headline rate hides fees and guarantees | Eligibility needs login | 2 |

### Used cars (chosen)

- Each platform runs its own valuation: Hamrah Mechanic's daily price table ([HM](https://www.hamrah-mechanic.com/carprice/)), Karnameh from its own closed deals ([Karnameh](https://karnameh.com/car-price/used-car)), Khodro45 inspections and auctions ([Khodro45](https://khodro45.com/)). None rates every listing against the whole market.
- Cross-site search is weak. Ganje claims 15+ ad sources, by its own account ([Ganje](https://ganje.ir/)). Torob's car category is dealer-based (1,000+ cars from 240 dealers as of 2018, [Pedal](https://www.pedal.ir/news/%D9%85%D9%82%D8%A7%DB%8C%D8%B3%D9%87-%D9%82%DB%8C%D9%85%D8%AA-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AA%D8%B1%D8%A8/)). A public repository already searches Divar, Bama, Karnameh and Hamrah Mechanic together ([torob-car](https://github.com/pejmanS21/torob-car)), without deal ratings or cross-site duplicate detection.
- Divar, Bama, Karnameh and Hamrah Mechanic embed price, mileage, year, trim and body condition in their pages. Divar's terms forbid manual or automated copying of ads ([terms](https://divar.ir/__contact_terms/)); its official API, Kenar, fetches one ad at a time and production access needs a support ticket ([Kenar](https://kenar.divar.dev/post/get_post), [scopes](https://kenar.divar.dev/scopes/)). Source-by-source rules: `2026-09-26-car-listing-sources-and-crawl-policy.md`.

### New cars

The factory–market gap reached ~45 % ([Gadgetnews, 14 Jun 2026](https://gadgetnews.net/1165928/the-gap-between-factory-and-market-car-prices-reached-45-percent/)); some models rose 610M toman in a month ([Vananews, 25 Sep 2026](https://vananews.com/fa/news/666963/)). Bama already publishes factory, market and dealer prices daily ([Bama](https://bama.ir/price)), so the only fresh angle is comparing sale plans. Deferred.

### Rent and sale

The legal cap on renewal increases is 25 % but real increases run 30–50 % ([Mehr](https://www.mehrnews.com/news/6952319/)); fake ads push prices up ([Hamshahri](https://www.hamshahrionline.ir/news/1047203/)); the market converts deposit to rent at about 3 % a month ([Kilid](https://kilid.com/mag/buy-and-rent-advice/renting-home/1829/)). Large pain, but depends on Divar and is already the most common pick for this challenge ([torob-khaneh](https://github.com/kiana-nb/torob-khaneh), [Homerob](https://github.com/MohammadJavadHeidari/Homerob)).

### Flights

SafarMarket is a mature comparison engine and says itself that a ticket costs the same everywhere and only seller fees differ ([SafarMarket](https://safarmarket.com/flights)), so there is little spread to show. Domestic fares are effectively deregulated (Tehran–Mashhad over 10–11M toman, [Kojaro](https://www.kojaro.com/news-desk/310394-domestic-flights-price-surge-iran/)); static pages carry no fares ([Alibaba](https://www.alibaba.ir/flights/THR-MHD)).

### Insurance, doctors, gold, loans

- Insurance: Azki leads after merging with Bimito ([DMBoard](https://dmboard.media/news/azki-bimito-merge/)); Central Insurance sets base third-party premiums; quotes need plate and national ID ([Azki](https://www.azki.com/car-insurance/third-party-insurance)).
- Doctors: visit fees are state tariffs ([ILNA](https://www.ilna.ir/%D8%A8%D8%AE%D8%B4-%D8%B3%D8%A7%DB%8C%D8%B1-%D8%B1%D8%B3%D8%A7%D9%86%D9%87-%D9%87%D8%A7-10/1773946-%D9%88%DB%8C%D8%B2%DB%8C%D8%AA-%D9%BE%D8%B2%D8%B4%DA%A9%D8%A7%D9%86-%D8%AF%D8%B1-%DA%86%D9%82%D8%AF%D8%B1-%D8%B4%D8%AF-%D9%81%D9%87%D8%B1%D8%B3%D8%AA-%D8%AA%D8%B9%D8%B1%D9%81%D9%87-%D9%87%D8%A7)), so there is nothing to price-compare.
- Gold: TalaMarketCap already tracks 12 digital-gold platforms ([TalaMarketCap](https://www.talamarketcap.com/)); jewellery price = gold × weight + making fee + ~7 % profit + VAT.
- Loans: Pishkhanak already compares 562 loans from 32 banks ([Pishkhanak](https://pishkhanak.com/loans)), and a loan comparator would compete with TorobPay.

### Villas (the fallback)

Hosts list the same villa on several platforms; the tool Miaan syncs calendars and prices across Jabama, Jajiga, Otaghak and Shab ([Miaan](https://miaan.ir/)), which is exactly Torob's "same product, many sellers" problem. No tool matches the same villa across platforms. Jajiga, Otaghak and Shab put prices in page data (Shab's Ramsar page alone lists 624 units); Jabama loads listings in the browser. All four robots.txt files are permissive. Villa rents rose sharply during the war, outside the tourism ministry's oversight ([Didar](https://www.didarnews.ir/fa/news/196911/)).

### What other applicants built (public repositories found, search limited)

Two housing entries, a used-car search engine (not labelled as an entry), cloud and VPS comparison ([Fardinak](https://github.com/Fardinak/torob-aipe-challenge)) and B2B procurement ([toro-bb](https://github.com/aminreza3303/toro-bb)). No villa entry was found.

## Recommendation

Top three for value and one-week feasibility: villas (uncontested, purest Torob mechanic), used cars (highest-value messy market, six sources with listing data in their pages, four of them crawlable under their rules, benchmarks to validate against), rent (largest household pain, but Divar-dependent and crowded). Used cars won because it also has an exact US blueprint in CarGurus (`2026-09-26-us-vertical-search-analogs.md`); see ADR-0006.
