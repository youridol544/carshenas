# Evidence for the sources research note

The record behind `../2026-09-26-car-listing-sources-and-crawl-policy.md`, collected for CS-5 on 2026-09-28 (Asia/Tehran).

| File | What it holds |
|---|---|
| `robots-2026-09-28/<host>.txt` | robots.txt of each host, byte for byte as fetched: `divar.ir`, `api.divar.ir`, `bama.ir`, `karnameh.com`, `khodro45.com`, `www.sheypoor.com`. This is the text a `source_policy_check` row cites. |
| `terms-2026-09-28.md` | Each source's terms of use: address, version and when it was read, with the clauses on access, copying and content. The Farsi is verbatim; the English is a translation for this record. |
| `divar-web-api.md` | Divar's car search and post endpoints: the request body, the response shapes, the headers, and the calls the crawler never makes. |

## How it was collected

- **Requests:** one at a time, at least four seconds apart, with the User-Agent `CarshenasResearch/0.1 (CS-5 robots.txt and terms check; one request at a time)`. Divar's help centre renders only in a browser, so its terms got one page view in the agent's browser. Sheypoor's FAQ was opened there too, to look for a terms link. Divar's web client was observed the same way.
- **Stop rule:** the fetch script stopped a host on any 401, 403, 429, 503 or challenge page. None occurred.
- **Nothing personal kept:** raw responses stayed in a scratch directory and were not committed, because they hold ads' texts and photos.

## Re-checking

Fetch each robots.txt again and compare it with the copy here, for example `sha256sum`. Then open each terms address in `terms-2026-09-28.md` and check its version date. Record any change in the research note or a successor, and in a new `source_policy_check` row (ADR-0008 point 1).
