# CS-59 search API evidence, 2026-10-02

Measured on the lane's copy of main (3,008 searchable listings: the 3,008 of 23,360 active listings whose details were read)
and on synthetic tables of 24,996 and 99,989 listings with the market's skew (hybrid and electric cars in a fraction of a
percent, a tenth automatic, 98.5 % in Tehran, a third rated), PostgreSQL 18.6 in Docker on a laptop shared with two other
lanes (load average 11 to 12). The lane's `last_seen_at` was moved forward so its newest sighting is two hours old (its
crawler is paused, and the table holds only the last 48 hours); nothing else of the lane's data was changed.

| File | What |
|---|---|
| `typo-before-after.txt` | the typo fallback of 2026-10-01 against the new one on the same table and the same words |
| `lane-3008-listings.md`, `scale-25k-listings.md`, `scale-100k-listings.md` | every query shape of the API with `EXPLAIN (ANALYZE, BUFFERS)`: execution time, buffers, scans (second run, cache warm) |
| `scale-25k-listings-without-rare-value-indexes.md` | the same 25,000 listings before the nine indexes on rare-valued columns |
| `hot-updates.txt` | HOT updates of a sighting by fill factor, and the expiry delete with and without an index |
| `load-results.md`, `load.py` | the API's p50, p95 and p99 under a mix of searches, on the three tables |
| (the tests) | `packages/search/test/keyset.db.test.ts`: a page of every order at five depths over 12,000 listings reads at most 600 buffers and equals an OFFSET read; `apps/worker/src/jobs/search.db.test.ts`: a build in flight never holds up a writer |

Reproduce: `pnpm --filter @carshenas/search seed:scale 25000` (a scratch database named `*_test`; `DATABASE_MIGRATE_URL`),
then `pnpm --filter @carshenas/search measure` (`DATABASE_URL`), then `python3 load.py scale` against `next start`.

## The numbers that decided things

**A page costs the rows it shows.** First pages of every order: 0.1 to 0.5 ms and 27 to 46 buffers at every size. A keyset page
at 25 % and at 90 % depth of every order, in each branch: 0.08 to 0.8 ms and 26 to 55 buffers at 100,000 listings. One OR
condition (the first version) read about 20,000 buffers at 90 % depth on 23,000 listings (database review); the test
`keyset.db.test.ts` shows it reads over 1,000 where a branch reads under 100.

**A filter on a rare value needed an index** (24,996 listings, ms and buffers, without and with the index):

| Filter (share of listings) | without | with |
|---|---|---|
| fuel plug-in hybrid (0.02 %) | 12.9 ms, 4,485 | 0.17 ms, 10 |
| fuel electric (0.05 %) | 20.5 ms, 4,485 | 0.11 ms, 9 |
| body type crossover (0.3 %) | 14.0 ms, 7,696 | 0.27 ms, 38 |
| colour purple (0.05 %) | 14.8 ms, 4,485 | 0.21 ms, 15 |
| engine needs repair (0.6 %) | 9.7 ms, 4,283 | 0.97 ms, 159 |
| chassis damaged (0.5 %) | 12.4 ms, 5,868 | 0.72 ms, 108 |
| a model of 0.3 % | 9.9 ms, 7,698 | 0.42 ms, 38 |
| a make of 0.3 % | 10.1 ms, 7,698 | 0.26 ms, 38 |
| a trim of 0.1 % | 13.9 ms, 4,485 | 0.13 ms, 10 |
| a district of 0.1 % | 8.3 ms, 6,070 | 0.68 ms, 103 |
| a count of fuel electric | 14.7 ms, 4,485 | 0.08 ms, 9 |

Without the indexes the planner read the table or walked an order's index past thousands of rows. With them it uses them for
rare values and leaves them for common ones (3 % and more), as it should. They add 1.7 MB at 25,000 listings. Measured not to
help, so not made: gearbox condition, body condition, deal rating, model of a few percent, installments (2.7 to 1.2 ms), seller.

**The facets of a filtered search** took seven scans: 72 to 173 ms on 25,000 listings. The facets whose filter is not in the
search now share one scan (a materialised CTE grouped for each): 38 to 45 ms for a broad filter, 0.2 to 0.4 ms for a rare one,
and they grow with the rows matched, about 2 µs a row (75 to 194 ms at 100,000 listings).

**HOT updates** (24,996 rows, all updated at once, three passes): fill factor 100: 0.5 %, 0.7 %, 0.7 %; 90: 11 %, 20 %, 28 %;
80: 26 %, 43 %, 56 %; 60: 73 %, 92 %, 98 %; 80 with an index on `last_seen_at`: 0 %. The expiry delete: 15.9 ms without the index
(sequential scan, 4,705 buffers) and 0.35 ms with it. Fill factor 80 and no index (ADR-0028).

**Builds.** From empty: 3,008 rows 2.0 s (the lane, 2 statements); 24,996 rows 15 s; 99,989 rows 76 s, in 50 statements of 2,000
listings each, inside one transaction whose limit the rebuild sets itself (the worker role's default is two minutes). A
rebuild that finds nothing changed: about a second for 3,000 listings (the view is read, nothing is written). The count of
listings the pages show is read from `search_facet_count`, written by every refresh.

**The typo fallback**, same table, same words (`typo-before-after.txt`): «مزدا» found 81 listings (of «مدارک», through the
prefix «مدا») and now reports no listing and the word as unmatched; «تیبا» found 7 («زیبا») and now none; `208i` found 740
listings of `207i` and now none; «ساندرو» found one listing of «سانروف» and now none; «کورلا» (neighbours swapped) found none
and now finds 96 of «کرولا». Real typos are still corrected: «کرلا», «پرایذ», «اتومتیک», «هیبرد», «سفیذ», «تهرن», «corola», «toyotta».
