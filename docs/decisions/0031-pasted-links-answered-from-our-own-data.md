# ADR-0031: Answer a pasted link from our own data, by code, and keep the links we have not seen as wanted

- Status: accepted by delegation (the owner's standing instruction of 2026-09-30 and the pause of the crawl on 2026-10-01, decided by the CS-65 lane on 2026-10-03)
- Date: 2026-10-03
- Deciders: Pedrum (delegated)
- Related: CS-65, CS-53, CS-64, ADR-0008, ADR-0017 points 6 and 8, ADR-0030, `docs/design/data-model.md` (layer 7 `model_demand`, layer 8 `paste_request`)

## Context

CS-65 is the demo's wow moment: a buyer pastes the link of the listing they are looking at and sees its rating. The task planned that a link whose listing we do not have is read once from Divar on the spot (ADR-0017 point 8). The owner paused the Divar crawl on 2026-10-01 and the standing rule is that nothing is requested from Divar or any listing site until they resume it. A pasted link is also public input: anyone can send any text, in a loop.

## Decision

1. **The link is read by code.** `readPastedLink` (`apps/web/src/features/check-link/link-parse.ts`) takes the first address in the text, accepts the short `/v/<token>` form and the long `/v/<slug>/<token>` form of Divar (any of its hosts, with or without a scheme), and returns the token, which is what `listing.source_listing_key` holds. Other sites, text with no address, and Divar addresses that are not one listing's each get their own plain Farsi message; only Divar is supported. It runs in the browser (a wrong paste is answered at once) and again on the server. No model is involved.
2. **The answer comes from our database only.** A token is looked up in `listing`; the answer is the listing page's own data (`readListingPage`, CS-64), so the link's answer and the page never disagree. A listing the daily valuation run did not rate is rated on the spot by the database function `paste_rate_listing(id)`, a SECURITY DEFINER wrapper of `valuation_rate_listing` on the latest succeeded run (the web role cannot read the comparables and coefficients the function reads); it writes nothing. The listing page uses the same function, so a listing crawled after the run has an analysis too.
3. **A link we have not seen is never fetched.** `record_paste_request(source, token)` keeps it in `wanted_link` (source, token, how many times it was asked, first and last time), at most 5,000 distinct ones, so a loop cannot fill the table; the token must be a safe token (a CHECK), and only the token is stored, never the pasted text. The crawler may read the table once the source runs again; the buyer is told the link was kept, and told honestly when it was not (full table). A listing we know but whose details were never read (a model not read in depth) says so.
4. **Demand is counted.** The same function counts every pasted link that resolves to a catalogue model in `model_demand` (Tehran day, model, kind `paste`; kind `search` is CS-53's), the table the superadmin's list of models buyers ask for reads. The web role can write neither table, only call the two functions.
5. **The page keeps no state but the address.** `/check?link=<canonical Divar address>` can be shared and gone Back to; the home page's hero and the search page carry the same box.

## Alternatives considered

- **Fetch a link we do not have, once, politely (the task's original plan).** Breaks the owner's pause and would make every pasted link a request to Divar; left to the crawler through `wanted_link` once the owner resumes it.
- **A model to understand the pasted text.** Not needed: the token is in the address; a model could only add cost and error.
- **The full `paste_request` table of the data model (every paste with its outcome and latency).** More than the product needs now; the log line `pasted link answered` carries the outcome and the milliseconds, and `wanted_link` and `model_demand` carry the two things a person acts on. Superseded in the data model by this record.
- **Insert from the web role directly.** A public loop could fill the tables; the caps live in the function, in the database.

## Consequences

- Positive: instant (a few database reads, no network), free, no request to any listing site, every number from the database, shareable.
- Negative: a link whose listing we have not read gets no rating until the crawl reads it; the answer for those is a clear no, with similar rated listings.
- Follow-ups: the crawler reads `wanted_link` first when a source resumes (needs the owner's resume); CS-53 reads `model_demand`; CS-70 and CS-71 may offer «بسپارش به کارشناس» on the not-found answer.
