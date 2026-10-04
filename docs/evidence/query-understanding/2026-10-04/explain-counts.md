# The counts the one-step search asks (CS-111)

`searchListings({ search, limit: 0, countCap: 1, quiet: true })`: the existing search count, stopped at the second listing it finds
(`LIMIT 2` inside `count(*)`), so only "none or some" is read. No new SQL and no migration: the sentence flow asks it once for the
filters of a sentence that has unread words, once more for the whole, and, when the whole finds nothing, once per group it could drop.

`EXPLAIN (ANALYZE, BUFFERS)` on the lane's copy of main's data (6,683 rows in `search_document`, 2026-10-04, second run of each; the
statement is the one the function builds, `searchableWhere` with the freshness window and the tsquery `search_query()` makes):

| count | found (capped at 2) | execution ms | planning ms | buffers | scans |
|---|---|---|---|---|---|
| model 206 alone | 2 | 0.15 | 0.32 | 5 | Index model_key_idx |
| model 206 + word with 134 listings «شهرک» | 2 | 0.59 | 0.35 | 62 | Index model_key_idx |
| model 206 + word that finds none «zzqnoword» | 0 | 0.16 | 0.40 | 7 | Bitmap Heap, Bitmap Index text_idx |
| model 206 + two words, none found | 0 | 0.19 | 0.30 | 9 | Bitmap Heap, Bitmap Index text_idx |
| word alone that finds none «asdfgh» | 0 | 0.13 | 0.30 | 7 | Bitmap Heap, Bitmap Index text_idx |
| word alone, common «سفید» (794 of 6,683) | 2 | 0.06 | 0.27 | 3 | Seq |
| make with no listing («mazda») | 0 | 0.08 | 0.28 | 2 | Index make_key_idx |
| price, paint free, model, year + word that finds none | 0 | 0.14 | 0.39 | 7 | Bitmap Heap, Bitmap Index text_idx |

The worst case of one sentence is four unread groups all finding nothing together: one count for the filters, one for all four, then
four for the drops and four, three, two and one more as groups go: at most 16 of these, each under a millisecond of execution.
Measured at the web role's end, a sentence with unread words took 18 to 270 ms inside the action on a machine at load 36 (the
action's log line, `durationMs`), 4 s for the first sentence of a process (the lexicon's nine reads, now served stale while it
refreshes).
