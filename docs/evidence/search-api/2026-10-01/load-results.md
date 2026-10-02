> Superseded on 2026-10-02: the table now holds only listings whose details were read, and the queries, the keyset and the facets changed; see `../2026-10-02/`. What follows is the first version on 23,360 listings.

# Search API load, 2026-10-01 (CS-59 criterion 4)

GET /api/search on the production build (`pnpm build`, `next start -p 3159`) against the lane's copy of main: 23,360
searchable listings, PostgreSQL 18 in Docker on the same laptop (ThinkPad E15). `load.py` (beside this file) sends a
seeded mix: everything, the nine catalogues, each tracked model, words (Persian, Latin-typed, typos, Arabic letters,
digits in every script), make and price, model and year and no paint, words inside a catalogue; half with another
order, 30 % with facets, and half followed by one or two more pages through the cursor. Wall-clock times measured by
the client, so they include HTTP and JSON.

| Clients | Requests | p50 | p95 | p99 | max | Requests/s |
|---|---|---|---|---|---|---|
| 1 | 672 | 11.6 ms | 33.8 ms | 39.5 ms | 64.4 ms | 67.1 |
| 8 | 1,323 | 87.8 ms | 223.7 ms | 328.0 ms | 507.6 ms | 74.5 |

The server's own `search served` lines over both runs (2,015 searches, network excluded): p50 21 ms, p95 156 ms,
p99 249 ms, max 340 ms. One Node process serves about 75 searches a second on this machine; with eight clients at
once, requests queue in Node and in the web pool (5 connections), which is where the p95 rises; each query itself
takes under 9 ms (plans.txt).
