# What do CarGurus, Autolist and Jabama actually show on their home, search, listing and valuation pages, and what should Carshenas keep, change or drop for Iran?

- Date: 2026-09-30
- Asked by / for: CS-56, which feeds the m-5 interface tasks: the search page (CS-61), the home page (CS-63), the listing page (CS-64), pasted links (CS-65), the model page (CS-67), marked listings (CS-69) and search files (CS-70). ADR-0006 clones CarGurus's and Autolist's flows; the owner's plan of 2026-09-29 adds Jabama's home page (its big hero, its catalogues and its category selector with icons).
- Outcome: a keep, change or drop decision for 34 patterns (section 5), the home-page skeleton for CS-63 (section 6) and tokens in our own names (section 7). No ADR: every decision here is a design choice inside ADR-0006 and the design language. Decisions were taken on the recommendation, by the owner's standing instruction of 2026-09-29; the owner can overturn any row.

## Questions

1. What do CarGurus's home page, search results, listing page, deal-rating explanation and price-trend page show, in which order and at which sizes?
2. Where does Autolist, CarGurus's sister product, differ on the same pages, its home page included?
3. How is Jabama's home page built: the hero, the catalogues and the category selector with icons?
4. Which of these patterns should Carshenas keep, change or drop for Iranian car buyers on a Farsi, right-to-left phone, and why?

## Sources and method

Markers: **capture** (the site-capture tool's reports and screenshots, read here), **screenshot** (measured on a capture's CSS-pixel screenshot by eye against the pixel grid, about ±4 px), **help** (the site's public help centre, read here), **not seen** (a page no capture reached).

- **Tool.** `pnpm capture` (`tools/site-capture`), anonymous, locale `en-US` for the US sites and the default for Jabama, on 2026-09-30 between 07:43 and 07:56 UTC. The network left the machine from the United Kingdom (`ipinfo.io` answered `GB`). Screenshots, DOM and accessibility trees stay in `.captures/` (gitignored).
- **robots.txt**, read first with a plain HTTP client on 2026-09-30: Autolist `User-agent: * Allow: /`; Jabama an empty `User-Agent: *` group (everything allowed); CarGurus 174 rules for generic agents, which disallow listing pages (`/details`, `/Cars/inventorylisting/`), `/Cars/search` and the valuation tool, and allow the home page, results landing pages (first page only) and `/research/price-trends`. CarGurus answered 406 to a request with a custom User-Agent and 200 to curl's default. `cargurus.helpscoutdocs.com` has no robots.txt (404).
- **What each capture produced.**

  | # | Page | Result |
  |---|---|---|
  | 1 | CarGurus home, 2026-09-26 (CS-1's capture, reused, not repeated) | complete, phone and desktop |
  | 2 | CarGurus price trends, `/research/price-trends` | complete, phone and desktop; no challenge. Taken once, with the owner's approval of 2026-09-30 (task comment #2 asked for it after DataDome challenged a results page on 2026-09-26) |
  | 3 | CarGurus results, listing page, deal-rating explanation | **not captured**: robots.txt disallows the listing and search pages, and the results landing page challenged us on 2026-09-26. Described from the help centre and from Autolist, which runs on CarGurus's valuation (section 2) |
  | 4 | Autolist home | **stopped** with HTTP 403 from CloudFront on the headless run. On the owner's instruction ("try it in a real browser, not headless … really open a Chrome"), one run each for desktop and phone in headed system Chrome (`--headed --channel chrome`, no other flag, no stealth). Both loaded without a challenge |
  | 5 | Autolist results, `/toyota-camry` | complete but empty: Autolist placed the visitor in London and found 0 cars. Replaced by #6 |
  | 6 | Autolist results, `/toyota-camry-irvine-ca` (a city landing page the site links) | complete, desktop and phone (headed Chrome) |
  | 7 | Autolist listing, the first result opened as `…#…&vin=…` on the same page | complete, desktop and phone (headed Chrome) |
  | 8 | Jabama home | complete, but a promotional dialog could not be dismissed. Captured again with a flow (`.captures/flows/close-and-scroll.mjs`) that closes it, answers «بعداً دریافت می‌کنم» to the "give up the credit?" follow-up (which activates nothing) and photographs the page section by section |

- **Help centre**, read here: CarGurus's "What is IMV?" (<https://cargurus.helpscoutdocs.com/article/10-what-is-imv>), "Why doesn't this listing have a deal rating?" (`/article/26-…`), "Listing Attributes" (`/article/228-…`), "How are number of days on CarGurus counted?" (`/article/32-…`), "Saved Listings and Searches" (`/article/29-…`) and "How do I search for a car?" (`/article/19-…`).
- **Kept in the repository**, the tool's redacted reports (tokens, technology, API map; no screenshots, copy or DOM): [`captures/autolist-home/`](captures/autolist-home/), [`captures/autolist-results-irvine/`](captures/autolist-results-irvine/), [`captures/autolist-listing-phone/`](captures/autolist-listing-phone/), [`captures/cargurus-price-trends/`](captures/cargurus-price-trends/) and [`captures/jabama-home-flow/`](captures/jabama-home-flow/). The listing report's page address carried its fragment values (coordinates and the car's VIN); they were reduced by hand to `#…&vin=…`.
- **Limits.** One page view per page and viewport, one state, anonymous, from one network, in one hour; hover, dark mode and logged-in screens not seen. The US sites were read in English with US prices. Measurements are one page's computed styles, not the sites' design systems.

## Findings

### 1. CarGurus

**Home page** (capture #1, 2026-09-26).

- Order on the phone: an app banner; the header (menu, logo, saved, account); Shop, Sell and AskGuru tabs; a full-width search field (380×48, pill); a hero card with a slogan, one «shop all cars» button and a car photo; three promotion tiles (sell, finance, "Search in your own words with AI"); "Shop smarter with Guru", a row of AI prompt chips ("Great deals under $20K", "3-row SUVs for families"); a sponsored carousel; a budget calculator (down payment and monthly payment sliders giving an "Est. max budget"); a sponsored "Discover your perfect car" block; "Browse by category" chips (Under $15k, Fuel Efficient, Family Cars, Electric, Great deals …); "Browse by body type" tiles; selling; three trust points; research; popular cars; the footer.
- Desktop: the search field spans the header (1300 px) with the ZIP code at its inline end; the hero card is 1260×346 with a 24 px radius; its headline is 60 px/600 (28 px on the phone).
- Body-type tiles on the phone: 104×80, a car photograph over a 14 px label, scrolling sideways, about three and a half visible (**screenshot**).
- The three trust points are the product's pitch: "Deal ratings you can actually trust … the only site to identify overpriced"; "Fees included upfront, price changes, accident history, days on lot"; "Dealership Mode gives you real-time price checks, comparisons, and risks, right from your phone".

**Search results, listing page and deal-rating explanation** (**not seen**; **help** and section 2).

- The market value (IMV) comes from "a complex algorithm that takes into account millions of data points", updated daily, from comparable current and previous listings in the shopper's market, on "make, model, trim, year, mileage, options, and vehicle history". Ratings are Great, Good, Fair, High and Overpriced, "intended to provide shopping guidance but are not a guarantee of value" (**help**, article 10).
- No rating is shown when there are "too few comparable vehicles in the area", when theft or salvage or frame damage is reported, when "the price is too good to be true" or when it "seems too high" (**help**, article 26).
- A listing shows vehicle history (from AutoCheck), days listed, price history, a price analysis, dealer reviews and a payment estimate (**help**, article 228). "Days on CarGurus" counts the whole time the car has been for sale on the site; "days at dealership" resets when the car moves lot (**help**, article 32).
- Saved listings are a heart; a saved search is limited to "one search per make and model combination" with an option "to subscribe to updates" (**help**, article 29).
- Best-deals-first ordering: the earlier reference `listing-patterns.md` records it from CarGurus's help centre (2026-09-26); it was not seen here.

**Price trends** (capture #2).

- Order: breadcrumb; a headline that carries the number ("Used car pricing trends. Prices down 1.1% this month", 36 px/600 on the phone, 60 px on desktop, in Rund Display) with a one-line intro; "Car pricing that's driving the market", two tabs (Price decrease, Price increase) over four make cards and four model cards (photo 316×193, the change in 28 px, "Biggest decrease over the past 30 days", a pill «Shop Now»); "Pre-owned vehicle price guide": a date range, «Update chart» and «Export», a line chart of the CarGurus Index over five months with a marker where "Base price data begins"; a table of the index, nine body styles and every make with average price and the change over 30 days, 90 days and a year, each row with a checkbox that adds its line to the chart; "What's my car worth?"; an FAQ; the footer.
- Colour of change: rises are red (`#dc1d34`), falls are plain text. The page is written for buyers: a rising price is bad news.
- Phone: the table keeps all six columns at 412 px with 12 px text (**screenshot**); the chart shrinks to three month labels.
- Technology: Astro with React 19.2 islands and Radix; Graphik for text and Rund Display for headings; 9 logical against 821 physical left and right declarations in the CSS (`captures/cargurus-price-trends/tokens.md`).

### 2. Autolist, and where it differs

Autolist runs on CarGurus's valuation. Its vehicle endpoint (`GET www.autolist.com/api/vehicles/:token`) returns `imv_expected_price`, `imv_listing_price`, `imv_deal_rating` (`FAIR_PRICE` for the cars seen), `imv_localized_deal_rating` and `imv_no_deal_rating_reason` ([`captures/autolist-results-irvine/api.md`](captures/autolist-results-irvine/api.md)); the listing's "IMV" link goes to CarGurus's help article; its lead form's consent line names "emails from CarGurus". So Autolist's results and listing pages are the closest public view of how CarGurus's deal ratings reach a buyer, and are used as such below.

**Home page** (capture #4).

- A full-bleed road photograph (desktop 1425×528; phone 412×540) holds the logo again, the headline "Find your perfect car" (32 px/700, white), the detected location with a chevron, one search field (desktop 682×56, phone 380×46, radius 6 px; **screenshot**) with the placeholder "Search by make, model, body type", an "— OR —" divider and three entry buttons: Make / Model, Body Style, Price (a 575×48 segmented bar on desktop; stacked 240×48 translucent buttons with a white 1 px border on the phone).
- Below: an app promotion with awards and store badges; **Trending searches**, a mosaic of four photo tiles that are ready-made searches combining a body type and a budget ("Pickups under $10,000", "Family Vehicles under $10,000"); **Price**, four cards (Under $10,000 … $30,000), each listing three body types and "all cars" under that budget; **Body styles**, eight studio photographs of white cars in a 4×2 grid with a label under each; **Popular**, a grid of model links; three value points; footer link lists by city, model and category.
- Differs from CarGurus: the hero is a photograph with the search on it, not a card beside a photo; there is no AI prompt row, no budget calculator and no deal pitch on the home page; the body selector uses side-view car photographs, not icons.

**Search results** (captures #5 and #6).

- Desktop: a filter rail at the inline start (330 px) with «Clear filters» and a red «Save search», up to three vehicles searched at once ("Multi-Vehicle Search", announced with a tooltip), year range sliders; a top bar with the query, location, radius (50 miles) and sort; the count in 20 px bold ("2,406 Toyota Camry results") followed by removable chips and «Clear filters»; a "Need help finding the right vehicle? Help me search" banner; then one result per row (about 990×200, **screenshot**): photo 284×168 with a heart, then year, make, model and trim (18 px/700), mileage, city, the dealer; the deal rating as an icon and capitals ("FAIR DEAL"), days on market; the price (20 px/700) with "No additional dealer fees" and an estimated monthly payment; a red «Request Info».
- Phone: the header, the page title with the model's owner rating, a search field with Sort and Filter icon buttons, the chips row, the help banner, then full-width cards: photo 380×253, **a pill "↑ 17% more than similar listings"** under the photo, title, mileage, city, price, deal rating, «Request Info».
- Default sort: distance, closest first ("Sort by: Distance (Closest first)"), not best deal.
- Differs from CarGurus: Autolist's default order is distance, where CarGurus's is recorded as best deal; the phone card states the gap to similar listings in percent, which the desktop card does not.
- An empty market says only "0 Toyota Camry results" with the chips: no widening offer (capture #5).

**Listing page** (capture #7).

- It opens as a panel on the results page (`#…&vin=…`), with «Back to Search» where the logo was.
- Phone, first view: gallery 412×275 with share and heart buttons and three thumbnails; title (20 px/700); "47k miles | Irvine, CA"; a bordered box with the price, the fee note and the monthly estimate at the inline start, and the deal rating with an info button at the inline end; «Call» (outlined) and «Request Info» (solid red), each 48 px high.
- Further down: vehicle information as label and value pairs; key features in four groups; **Price analysis**: a continuous green-yellow-red bar (380×16), a marker at this car's price with a callout above it (price, fee note, rating) and the average market price below the bar; one sentence ("This vehicle is priced around the average market price."); "How deals are calculated": "We compared this car with similar 2020 Toyota Camry based on price, mileage, features, condition, dealer reputation, and other factors", with the IMV caveat. **Price history**: days on market (11), "Total price change: -$1000", a vertical timeline of dates with the change and the price, the old price struck through. Then a map, the dealer and its reviews.
- Desktop: two columns: the gallery (672×448) with the facts under it, and a sticky lead form (456 px) with name, email, optional phone, a pre-ticked "Send me price drop & new listing alerts via email" and «Send request».
- A detail to avoid: the listing says 11 days on market while its history starts on 2026-09-28, two days earlier. Days on market and the price history must come from the same record.
- Technology: Next.js 15.5 and React 19.2 behind CloudFront; Titillium Web; 20 logical against 351 physical left and right declarations; ads from Google's ad network on every page.

### 3. Jabama's home page (capture #8)

- **Hero, desktop**: a black band 0 to 635 px, full width, with floating three-dimensional travel objects (a compass, a map, a suitcase, a pin) and a faint icon grid; a thin announcement strip on top ("new features of summer ۱۴۰۵"); the header (logo at the inline start, sign-in, host sign-up and business links at the inline end); a search bar 740×82, pill-shaped, split into four fields (destination, check-in, check-out, guests) with a 40×40 black round search button at the inline end; a one-line tagline under it (16 px). No photograph and no big headline: the objects are the image, the search is the message.
- **Hero, phone**: no dark band. The logo with the tagline under it (the `h1`), a search pill 380×57 ("مقصد سفرت کجاست؟" over "جستجو مقصد سفر، تاریخ"), then a promotion carousel 380×100 with dots.
- **Category selector**: a white panel 838 px wide that overlaps the hero's bottom by 56 px (desktop), holding 12 tiles of 98×98 with a 1 px `#f5f5f5` border, an 8 px radius, a line icon (about 28 px, dark stroke with an orange accent) over a 14 px label; 7 per row on desktop, 4 per row on the phone (about 88×84, 8 px gaps), so three rows. Some tiles carry a small purple label at their top inline-start corner («جدید», «تابستان ۱۴۰۵», «سرگرمی»; 10 px/600 on `#5626d9`). Tiles link to typed searches (`/all?types=villa`, `/all?types=cottage`), to curated collections (`/landing/categories?tags=AmazingPoolCategory`) and to other products. The twelfth, «همه دسته‌ها», is text, not a link or button, in the accessibility tree.
- **Feature filters**: under the tiles, "انتخاب بر اساس ویژگی": four cards that are filters rather than places: «قیمت منصفانه» (guaranteed fair price), long-stay discount, last-minute discount, instant booking.
- **Catalogues**: each section is a heading (16 px/600 on the phone, 21 px/700 on desktop), a one-line subtitle (12 px, `#5a606c`) and an outlined «مشاهده همه» (116×32 on the phone, 99×32 on desktop, radius 8) at the inline end; on desktop also previous and next arrows (36×32). Cards scroll sideways: on the phone about 246 px wide, so the next card peeks; on desktop six cards of 249 px in the 1400 px container. A card: photo about 164 px tall with a 12 px radius, the rating with its count, the title (14 px/700), province, city and rooms (12 px), and the price in full digits with «تومان» and «/ هرشب». Sections in order: popular cities (photo tiles), «اقامتگاه با قیمت منصفانه» (on desktop on a full-bleed orange band), Tehran apartments, «پیشنهادهای اختصاصی برای شما», eco-lodges, villas near Tehran, special northern villas, then a long SEO text.
- **Chrome**: a bottom tab bar on the phone (خانه، موردعلاقه‌ها، سفرهای من، چت، حساب من) under an app-download strip; a promotional credit dialog on arrival, and, when closed, a second dialog asking whether you really want to give up the credit, with the accept button solid and first. That second step is confirm-shaming.
- **Type and tokens**: IRANYekan (a licensed Fontiran face) at 12, 14 and 16 px with line heights 16, 20 and 24 px (1.33 to 1.5), tighter than our Persian roles; radii 6, 8 and 12 px; transitions 150 to 300 ms on Tailwind's standard curve; 193 logical against 165 physical left and right declarations and 18 explicit RTL selectors.
- **Technology**: Next.js 16.2 App Router with React 19.3 canary, TanStack Query, Tailwind and Radix; the home page's search terms come from `POST gw.jabama.com/api/v3/keyword/homepage_v2`; analytics on Snowplow and Sentry hosted on its own domain, ads from Yektanet and Adexo (Iranian networks).

### 4. What the three share

- Search first: all three put a single search field in the first view, and a selector of ready-made entries directly under it.
- Ready-made searches as the home page's body: CarGurus's category chips and AI prompts, Autolist's trending searches and budget cards, Jabama's catalogues. Each is a link to a filtered search, not a separate product.
- A body or category selector with pictures: CarGurus and Autolist use car photographs, Jabama line icons.
- The deal verdict travels with every price on the US sites (the word, an icon, a colour), and the explanation lives on the listing page, never on the card.

## 5. Keep, change or drop for Iran

Decided on the recommendation (2026-09-30, the owner's standing instruction of 2026-09-29). "Where" names the task that builds it.

| # | Pattern (seen on) | Decision | Reason | Where |
|---|---|---|---|---|
| 1 | Search field first in the hero (all three) | **Keep** | Every reference does it; our search understands plain Farsi (CS-62), so one field serves both the precise and the vague buyer | CS-63 |
| 2 | Big full-bleed photograph behind the hero (Autolist) | **Change** | The owner wants a photographed hero (CS-63). Keep the photo, but on the phone put the text and search below a short photo band rather than on it: white text over a photo needs a scrim to stay at 4.5:1, and Persian text is harder to read on busy images. Self-hosted Unsplash images (CS-63 AC 2) | CS-63 |
| 3 | Dark hero with 3D objects and no headline (Jabama desktop) | **Drop** | Illustrations are Jabama's brand, and a travel mood does not fit a price tool; our motto and one intro line tell a first-time visitor what the site does | CS-63 |
| 4 | Location picker in the hero (Autolist) | **Drop** | The index covers the Tehran market only (ADR-0017); a city filter lives in search | — |
| 5 | Three entry buttons under the search: make and model, body, price (Autolist) | **Change** | Replace with the body-type selector and the catalogues below it (patterns 6 and 9); three bare buttons say less than pictures and ready-made searches | CS-63 |
| 6 | Category tiles with icons in a panel overlapping the hero (Jabama) | **Keep** | The owner likes it, and it makes the body-type choice one tap. Our tiles: the body-type icons of CS-57, 4 per row on the phone, a label under each, the whole tile a link, the last tile «همه» a real link | CS-63, CS-57 |
| 7 | Car photographs as body-type pictures (CarGurus, Autolist) | **Change** | Use drawn icons of iconic Iranian cars (CS-57), consistent in stroke, instead of studio photos we could not license | CS-57 |
| 8 | "New" labels on category tiles (Jabama) | **Drop** | Promotional noise in a selector; nothing in our categories is new in that sense | — |
| 9 | Catalogues as sideways rows with «مشاهده همه» (Jabama); ready-made searches (Autolist, CarGurus) | **Keep** | CS-58 defines catalogues as shared filter definitions; a row of listing cards that peeks at the next card shows there is more, and «مشاهده همه» opens the search page with those filters | CS-63, CS-58 |
| 10 | A catalogue built on price fairness («قیمت منصفانه», Jabama) | **Keep, as ours** | «پیشنهاد کارشناس» first (CS-63): the best deals in good condition, which only our rating can make | CS-63 |
| 11 | Budget catalogues ("under $10,000", Autolist) | **Change** | Use billion-toman bands that match the Tehran market (for example «زیر ۱ میلیارد»), from CS-58's definitions, with words for the amount on the tile | CS-58 |
| 12 | AI prompt chips and "search in your own words" (CarGurus) | **Keep** | Plain-Farsi search is our differentiator; show three or four example searches as chips that fill the field («۲۰۶ بدون رنگ زیر ۷۰۰ میلیون») | CS-62, CS-63 |
| 13 | Budget calculator with finance sliders (CarGurus) | **Drop** | Car loans in Iran are not a product we can price; installment offers are a price trick we flag, not a feature | — |
| 14 | Promotions, sponsored blocks, ads, app banners (all three) | **Drop** | No advertisers, no app; each costs first-view space and trust | — |
| 15 | Arrival dialog and a "give up the credit?" second dialog (Jabama) | **Drop** | Confirm-shaming; our craft checklist allows no interruption on arrival | — |
| 16 | Trust points on the home page ("the only site to identify overpriced", CarGurus) | **Keep, short** | One line under the catalogues saying how the rating works, linking to the explanation page, with our measured accuracy once CS-51 reports it | CS-63 |
| 17 | Bottom tab bar on the phone (Jabama) | **Drop for now** | Four destinations do not exist yet (marks and search files come with CS-69 and CS-70); a header is enough until they do | — |
| 18 | Results: one card per row, photo, title, facts, price, deal (all) | **Keep** | As in `listing-patterns.md`: one column at 412 px | CS-61 |
| 19 | Default sort by distance (Autolist) | **Change** | Best deal first, as CarGurus and ADR-0006; distance means little inside one city | CS-61 |
| 20 | Gap to similar listings in percent on the card ("↑ 17% more than similar listings", Autolist phone) | **Keep** | It is our deal badge's second half («۱۲٪ زیر ارزش بازار»). Autolist shows it with an up arrow in red; we put it next to the rating word and never rely on the arrow's direction, which is ambiguous in RTL | CS-61 |
| 21 | Deal rating as capitals with an icon ("FAIR DEAL", Autolist) | **Change** | Our five Farsi words on the deal ramp's fills; no capitals in Persian; the icon is optional and never alone | CS-61 |
| 22 | Filter rail on desktop, Sort and Filter buttons and chips on the phone (Autolist) | **Keep** | Matches `listing-patterns.md`: a batch sheet with «اعمال» and the count, chips above the results | CS-61 |
| 23 | Multi-vehicle search, up to three models (Autolist) | **Drop for now** | Useful but not in the demo's scope; search files cover "watch several cars" | — |
| 24 | "Help me search" banner in the results (Autolist) | **Change** | Our equivalent is «بسپارش به کارشناس», which turns the search into a search file (CS-70), placed after the first rows, not before them | CS-70 |
| 25 | Empty results say only "0 results" (Autolist) | **Change** | Never a dead end: say which filter emptied the list and offer to widen it (`listing-patterns.md`) | CS-61 |
| 26 | Price box with price and deal side by side above the actions (Autolist listing, phone) | **Keep** | The price and its verdict are what the buyer came for | CS-64 |
| 27 | «Call» and «Request Info» lead form, pre-ticked alert box (Autolist) | **Drop** | We are not a marketplace and never show sellers' contacts; one primary action, «دیدن آگهی در <source>», clicks out. A pre-ticked opt-in is a dark pattern | CS-64 |
| 28 | Continuous green-to-red gauge with a marker, price above, market value below (Autolist) | **Change** | Keep the marker, the callout and the market value under the bar, but draw the five discrete bands of the deal ramp (colour never alone, each band named), with the cheaper end on the right in RTL, and add the market value's date | CS-64 |
| 29 | One-sentence verdict and "How deals are calculated" (Autolist) | **Keep** | Our explanation: two or three Farsi sentences from stored facts, then the comparables behind the number, which Autolist does not show | CS-64 |
| 30 | Reasons for no rating (too few comparables, stolen, salvage, too good to be true, too high; CarGurus) | **Keep** | Say why there is no rating («بدون ارزیابی» with the reason); "too good to be true" maps to our bait-price flags | CS-51, CS-64 |
| 31 | Price history as a dated timeline, total change, days on market (Autolist, CarGurus) | **Keep, fixed** | With Jalali dates, full-digit tomans, and days on market computed from the same first-seen date as the history, so they cannot disagree as Autolist's did | CS-64, CS-69 |
| 32 | Vehicle history from a third party (AutoCheck, CarGurus) | **Change** | No such service in Iran; our equivalent is the condition chips read from the text (رنگ‌شدگی) with their source sentence | CS-52, CS-64 |
| 33 | Price-trend page: headline with the number, market movers, a chart with an index line, a table of average price and change over 30 days, 90 days and a year (CarGurus) | **Keep, per model** | CS-67's model page: today's value and range, a weekly Jalali trend, and the change over 30 and 90 days. Colour a rise as bad news for the buyer, as CarGurus does, and always print the sign; a whole-market index waits until the index covers enough models | CS-67 |
| 34 | Hearts on cards and saved searches limited to one per model (CarGurus) | **Change** | Our «نشان کردن» on cards and the listing page (CS-69) and search files with no per-model limit (CS-70) | CS-69, CS-70 |

## 6. The home page for CS-63, from these decisions

In reading order at 412 px (desktop in brackets):

1. Header: the wordmark at the inline start, sign-in at the inline end (as now).
2. Hero: a photograph band about 200 px tall (desktop: a full-width band about 440 px with the text and search over a dark scrim at the inline start), then the motto (`text-title`), one intro line (`text-secondary`) and the search field (56 px, `rounded-control`), with three example searches as chips under it (patterns 1, 2, 12).
3. Body-type selector: a panel of tiles, 4 per row, each a CS-57 icon over a `text-label` label, the last «همه» (desktop: one row of up to 8 in a panel that overlaps the hero's bottom by 48 px) (patterns 6, 7).
4. Catalogues: «پیشنهاد کارشناس» first, then CS-58's other catalogues, each a heading, one subtitle line and «مشاهده همه» at the inline end, with a sideways row of listing cards that shows about one and a half cards on the phone (desktop: four to five cards and previous and next buttons) (patterns 9, 10, 11).
5. One line on how the rating works, linking to its explanation (pattern 16).
6. Footer.

## 7. Tokens proposed for Carshenas

Measured values mapped onto the design language's existing names; nothing here is a reference site's name or brand colour.

| Need | Seen | Carshenas |
|---|---|---|
| Hero search field | 46 to 82 px tall; pill (Jabama, CarGurus) or 6 px radius (Autolist) | 56 px, `rounded-control` (10 px), `text-control`, `bg-surface` with `border-control` |
| Category tile | 88×84 (phone) and 98×98 (desktop), 8 px radius, 1 px border, icon about 28 px, 14 px label (Jabama) | A 4-column grid with 8 px gaps (`gap-2`), each at least 80 px tall, `rounded-control`, `border-divider`, a 32 px icon, `text-label` |
| Catalogue heading row | 16 to 21 px heading, 12 px subtitle, 32 px "see all" (Jabama) | `text-heading`, `text-meta` in `text-muted`, a tertiary action with a 44 px target |
| Catalogue card | about 246 px wide on the phone, 12 px photo radius (Jabama) | 240 to 264 px wide, `rounded-card`, the photo frame `rounded-control` |
| Deal gap on a card | pill with an arrow and the percent (Autolist) | the rating word on its ramp fill, then «۱۲٪ زیر ارزش بازار» in `text-label` |
| Gauge | a continuous 16 px gradient bar (Autolist) | five `bg-deal-*` bands, 12 px tall with `rounded-full` ends, marker and callout from `shadow-overlay` |
| Trend colours | rise red, fall plain (CarGurus) | a rise in `text-danger` with «+», a fall in `text-success` with «−»; the sign is always printed |

Type: Jabama sets 12 to 16 px Persian text at 1.33 to 1.5 line height; ours stays at the measured roles (1.5 to 1.75), which read better in long Persian lines. Motion: all three use 150 to 300 ms ease transitions; ours stay those of the design language, section 5.

## 8. Technology and API observations

- Jabama and CarGurus's newer pages run the same stack family as Carshenas (Next.js 16 with React 19.3 canary; Astro with React islands); Autolist is on Next.js 15.5.
- Autolist's vehicle payload exposes CarGurus's valuation fields, including a machine-readable no-rating reason (`imv_no_deal_rating_reason`). Our rating should likewise store a reason code with every «بدون ارزیابی» (CS-51).
- Only Jabama's CSS is direction-ready (193 logical against 165 physical declarations); the US sites are almost all physical (CarGurus 9 against 821, Autolist 20 against 351), so their layouts cannot be mirrored as code, only as logic.

## The capture tool

- The tool printed the listing page's fragment values (coordinates and a VIN) into its reports: its redaction removes query values but not fragment values. Fixing it belongs to the tool, not to this task; proposed as a follow-up.
- Headed system Chrome loaded Autolist where headless Chromium got HTTP 403. The run followed the owner's instruction of 2026-09-30; the capture-site skill otherwise says to stop and study the page by hand.

## Recommendation

Build CS-63's home page in the order of section 6, and let CS-61, CS-64, CS-67, CS-69 and CS-70 follow the rows of section 5 that name them. The trade-off accepted: CarGurus's own results and listing pages were not seen, and Autolist stands in for them because it shows CarGurus's valuation; the patterns taken from it are the ones both products describe (the rating words, the no-rating reasons, the price history, days on market). What would change it: a manual look at a CarGurus listing page by the owner showing a pattern Autolist lacks, such as the comparables or the dealer's rating on the card.
