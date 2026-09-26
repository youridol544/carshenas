# Which US startup is the exact product match for "Torob for X", vertical by vertical?

- Date: 2026-09-26
- Asked by / for: Pedrum ("find an exact Silicon Valley unicorn to clone, with its flows"), for ADR-0006
- Outcome: used cars → CarGurus (with Autolist, its San Francisco product) chosen in ADR-0006.

## Questions

1. For each candidate vertical, which US company is the closest exact match: a vertical search or comparison engine that aggregates offers from many sellers and helps pick the best one?
2. Is it based in the Bay Area, what was its peak valuation or exit, and what is its status in 2026?
3. Which signature flows would a clone reproduce?

## Sources

Every valuation, exit and status claim below carries its source link. Flows marked *(product knowledge)* were described from general knowledge and not re-checked on 2026-09-26.

## Findings

A living Bay Area unicorn is itself the exact match in only two verticals: loans and cards (Credit Karma) and home services (Thumbtack). Homes for sale come close through Trulia (San Francisco, acquired by Zillow). Rentals have exact Bay Area matches (Zumper, Apartment List) that are not unicorns. Elsewhere the Bay Area alternative is dead or absorbed.

| Vertical | Best exact US match (HQ, founded) | Bay Area? | Peak valuation / exit | Status 2026 | Model |
|---|---|---|---|---|---|
| Flights | **Kayak** (Stamford CT, 2004) | No | $1.8B to Priceline, May 2013 ([Skift](https://skift.com/2013/05/21/priceline-completes-acquisition-of-kayak/)) | Booking Holdings | Pay per click, commissions, ads |
| Hotels and vacation rentals | **Kayak** (stays) | No | Same | Same | Pay per click |
| Used cars | **CarGurus** (Cambridge MA, 2006) | No; owns Autolist (SF) | IPO 2017; ~$3.95B year-end peak, 2021 ([companiesmarketcap](https://companiesmarketcap.com/cargurus/marketcap/)) | Public, ~$3B ([stockanalysis](https://stockanalysis.com/stocks/carg/market-cap/)) | Dealer listing subscriptions, ads |
| New cars | **TrueCar** (Santa Monica, 2005) | No | ~$1.8B, 2014 ([companiesmarketcap](https://companiesmarketcap.com/truecar/marketcap/)) | Taken private for $227M, Jan 2026 ([Auto Remarketing](https://www.autoremarketing.com/ar/technology/fair-holdings-led-group-completes-acquisition-of-truecar-which-is-now-private/)) | Dealer subscriptions |
| Homes for sale | **Zillow** (Seattle, 2004) | No | $30.6B year-end peak, 2020 ([companiesmarketcap](https://companiesmarketcap.com/zillow/marketcap/)) | Public | Agent leads, ads, mortgages |
| Rentals | **Zumper** (SF, 2012) | **Yes** | Undisclosed; ~$181M raised ([Tracxn](https://tracxn.com/d/companies/zumper/__tfKEmIZYUJPxg-FzAqIN57A_Fufmrsgwbkqb7qmwUMY)) | Private | Paid landlord listings |
| Insurance | **The Zebra** (Austin, 2012) | No | Over $1B, Apr 2021 ([TechCrunch](https://techcrunch.com/2021/04/12/austins-newest-unicorn-insurtech-the-zebra-raises-150m-after-doubling-revenue-in-2020)) | Private | Carrier referral fees, agency commissions |
| Loans and cards | **Credit Karma** (Oakland; founded SF 2007) | **Yes** | $4B, 2018; sold to Intuit for $7.1B, Dec 2020 ([SEC](https://www.sec.gov/Archives/edgar/data/896878/000119312520309090/d51747dex9901.htm)) | Intuit unit | Lead generation |
| Rx prices | **GoodRx** (Santa Monica, 2011) | No | $12.7B at IPO, Sep 2020 ([Axios](https://www.axios.com/2020/09/23/goodrx-prices-ipo-33-per-share-valued-127-billion)) | Public, ~$0.9B (Jan 2026) | PBM fees, subscription, pharma ads |
| Doctor booking | **Zocdoc** (NYC, 2007) | No | $1.8B, Aug 2015 ([Healthcare Dive](https://www.healthcaredive.com/news/new-zocdoc-funding-raises-value-to-18b/404422/)) | Private | Per-booking fee |
| Event tickets | **SeatGeek** (NYC, 2009) | No | ~$1B round ([Sportico](https://www.sportico.com/business/finance/2022/seatgeek-valued-billion-raise-1234687076/)) | Private | Marketplace fees |
| Home services | **Thumbtack** (SF, 2008) | **Yes** | $3.2B, Jun 2021 ([Thumbtack](https://press.thumbtack.com/announcements/thumbtack-secures-275-million-investment-at-3-2-billion-valuation/)) | Private | Pay per lead |
| Jobs | **Indeed** (Austin/Stamford, 2004) | No | Sold to Recruit 2012, reported ~$1B ([Inc.](https://www.inc.com/john-mcdermott/indeed.com-sold-for-1-billion.html)) | Recruit; absorbed Glassdoor Jul 2026 | Pay per click |
| Fashion | **ShopStyle** (SF, 2007), closed 2026; living: Lyst (London), Phia (NYC) | ShopStyle yes | Undisclosed | Closed ([Wikipedia](https://en.wikipedia.org/wiki/ShopStyle)) | Affiliate |

### Used cars in detail (the chosen vertical)

- **CarGurus flows:** a daily market value per car (IMV) computed from comparable listings, and a Great / Good / Fair / High / Overpriced badge on every listing ([CarGurus help](https://cargurus.helpscoutdocs.com/article/10-what-is-imv)); days on market and price-drop history; dealer ratings; saved-search alerts; instant cash offer and financing pre-qualification.
- **Autolist** (San Francisco): a listings aggregator with the same deal badges and price-drop history; owned by CarGurus since 2020 and still running ([CarGurus IR](https://investors.cargurus.com/news-releases/news-release-details/cargurus-acquires-car-shopping-platform-autolist)).
- **Runners-up:** AutoTempest (Canada; pure cross-site metasearch, [Wikipedia](https://en.wikipedia.org/wiki/AutoTempest)); Cars.com. Carvana and Shift are retailers, not comparison engines; Shift (SF) went bankrupt in 2023 ([Bloomberg Law](https://news.bloomberglaw.com/bankruptcy-law/ex-spac-car-seller-shift-will-shut-down-file-for-bankruptcy)).

### Other verticals, briefly

- **Flights, Kayak:** parallel search across airlines and agencies with de-duplicated itineraries; Best, Cheapest and Quickest sorts; flexible-date grid; price trends and alerts *(product knowledge)*. Bay Area near-exact match Hipmunk (SF) closed in 2020 ([PhocusWire](https://www.phocuswire.com/sap-concur-shutters-hipmunk)); Google Flights (Mountain View) is a Google product.
- **Stays, Kayak:** the same hotel matched across booking sites into one price list. Pure plays are non-US (trivago, HomeToGo in Berlin); Tripping.com (SF), an exact vacation-rental metasearch, was acquired by HomeToGo in 2018 ([WIT](https://www.webintravel.com/the-wrap-hometogo-buys-tripping-com-its-largest-us-competitor/)). Airbnb and HotelTonight sell their own inventory.
- **New cars, TrueCar:** trim → price curve of what others paid → upfront dealer prices. CarWoo! (Burlingame) closed in 2014 ([Wikipedia](https://en.wikipedia.org/wiki/CarWoo)).
- **Homes, Zillow:** Zestimate, map search, saved-search alerts, price and tax history, agent leads. Trulia (SF) is near-exact; announced at $3.5B ([Zillow](https://zillow.mediaroom.com/2014-07-28-Zillow-Announces-Acquisition-of-Trulia-for-3-5-Billion-in-Stock)), about $2.5B at close ([GeekWire](https://www.geekwire.com/2015/zillow-closes-2-5-billion-acquisition-of-trulia-plans-to-cut-350-staffers/)).
- **Rentals, Zumper:** map-first search, verified listings, one reusable application. Apartment List (SF, $600M, [Inman](https://www.inman.com/2020/12/21/apartment-list-nabs-50m-funding-round-at-600m-valuation/)) ranks a shortlist by a preference quiz.
- **Insurance, The Zebra:** questionnaire → live quotes side by side → buy. Jerry (Palo Alto, $450M, [PR Newswire](https://www.prnewswire.com/news-releases/ai-based-car-ownership-super-app-jerry-secures-75-million-series-c-financing-at-450-million-valuation-301351392.html)) is the closest Bay Area match.
- **Loans, Credit Karma:** free credit scores and offers ranked by approval odds. The FTC made it pay $3M over misleading "pre-approved" labels ([FTC](https://www.ftc.gov/news-events/news/press-releases/2023/01/ftc-finalizes-order-requiring-credit-karma-pay-3-million-halt-deceptive-pre-approved-claims)), a caution for any clone's wording.
- **Home services, Thumbtack:** guided job questionnaire → ranked pros with price estimates → hire; pros pay per lead.
- **Event tickets, SeatGeek:** a Deal Score from 1 to 10 comparing the listed price with a predicted value ([SeatGeek](https://chairnerd.seatgeek.com/the-math-behind-ticket-bargains/)), the same idea as CarGurus's badge.

### Not verified

Zumper's valuation and the ShopStyle and Indeed deal prices were never disclosed; the Indeed figure is a press report. CarGurus, Zillow and TrueCar peaks are year-end market caps. Flows marked *(product knowledge)* were not re-checked.

## Recommendation

Choose by product match and market fit, not by postcode. A strictly-Bay-Area unicorn is an exact match only in loans and home services, and both fit Iran poorly (`2026-09-26-iran-vertical-market-landscape.md`). Used cars map one to one onto CarGurus, whose San Francisco product Autolist runs the same playbook: adopted in ADR-0006.
