# Search API load, 2026-10-02 (CS-59 criterion 4)

GET /api/search on the production build (`pnpm build`, `next start -p 3159`), PostgreSQL 18 in Docker on the same laptop,
`load.py` beside this file. The machine was shared with two other lanes: load average 11 to 12 during the runs (a single
`curl` of a page took 5 to 20 ms). Times are measured by the client (HTTP and JSON included); the server's own `search served`
lines are the last column.

The mix: everything, the nine catalogues, models, words (Persian, typos, an unknown word), a make with a common filter, a rare
filter value, two common filters, words inside a catalogue, a count-only call (`limit=0`) with a rare filter, half with
another order, a third with `facets=1`, a third followed by one or two more pages by cursor.

| Table | Clients | Requests | p50 | p95 | p99 | max | Req/s | Server p50 / p95 / p99 |
|---|---|---|---|---|---|---|---|---|
| lane, 3,008 searchable listings (the local dataset) | 1 | 624 | 28.2 ms | 52.4 ms | 72.5 ms | 102 ms | 32.6 | 25 / 53 / 72 ms (both runs) |
| lane | 8 | 1,237 | 111.5 ms | 160.4 ms | 200.7 ms | 271 ms | 68.9 | |
| synthetic, 24,996 listings | 1 | 621 | 20.6 ms | 82.1 ms | 113.4 ms | 174 ms | 35.1 | 20 / 70 / 111 ms (both runs) |
| synthetic, 24,996 | 8 | 1,250 | 95.3 ms | 206.1 ms | 286.8 ms | 422 ms | 71.1 | |
| synthetic, 99,989 listings | 1 | 635 | 28.7 ms | 315.7 ms | 482.0 ms | 745 ms | 14.7 | 41 / 186 / 291 ms (both runs) |
| synthetic, 99,989 | 8 | 1,300 | 113.6 ms | 554.2 ms | 886.8 ms | 1,512 ms | 41.9 | |

Criterion 4 (p95 under 300 ms on the local dataset) holds on the lane's 3,008 listings (52 ms, 160 ms with eight clients at
once) and on 25,000. At 100,000 listings the mix passes 300 ms: the third of requests that ask for facets cost 75 to 194 ms
each for a broad filter (they count every match, about 2 µs a row), and count-only calls for a common filter 7 ms. The
trigger is in ADR-0028: cache the facets per search (no words in the key) or sample them when more than about 30,000 rows match.

The first version (2026-10-01, 23,360 listings, one row for every active listing): p95 33.8 ms with one client, 223.7 ms
with eight; its `load.py` and `load-results.md` are in `../2026-10-01/`.
