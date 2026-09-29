# Divar measurement data, 2026-09-29 (CS-33)

The raw data behind section 6 of [the listing data and freshness note](../2026-09-28-listing-data-and-freshness.md), exported from the local database of the worktree that ran the crawl, so it survives that database. Every request went to Divar's public search API from an Iranian network, one at a time, at least three seconds apart, named `CarshenasBot/0.1` with a contact address. No listing's text, photo or seller data is kept: only counts, sort times and our own request log.

| File | Rows | What it holds |
|---|---|---|
| `divar-2026-09-29-model-volume.csv` | 911 | Every `model_volume` row of Divar, as the database held it: three sweeps. `12:39:35` and `12:54:09` were abandoned (a reader fix, then a false stop; the note's section 6 says why); **`13:31:57` is the measurement**. A row with `complete` false is a lower bound: the sweep was stopped at the owner's request at 18:02 UTC with 99 slices still being read, and their counts so far were saved as incomplete |
| `divar-2026-09-29-slices.csv` | 872 | The `13:31:57` sweep's slices, largest first, with what the database does not keep: how many of the rows were bumped («نردبان شده») and the newest and oldest sort times read, from the worker's `slice measured` lines and, for the slices still being read, from the next-page job that carried their counts. `ROOT` is the whole market, read 11 pages deep |
| `divar-2026-09-29-requests.csv` | 2,952 | Every crawl run of Divar and the one request it sent (`fetch_log`): when, what came back, how long it took. Two runs sent nothing; one request is the false stop of 13:13:44 UTC |

To load the counts into another database (a worktree's, or a server's), as the migrate role:

```bash
docker compose exec -T postgres psql -U postgres -d carshenas -c "\copy model_volume (source_id, source_model_key, level, swept_at, active_count, pages_read, complete) from stdin with (format csv, header)" < docs/research/2026-09-28-listing-data-and-freshness/divar-2026-09-29-model-volume.csv
```

`model_volume_sweep_unique` refuses a second copy of a row. The requests are evidence only; they are not meant to be loaded back, since `fetch_log` and `crawl_run` belong to the database that sent them.
