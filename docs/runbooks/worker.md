# The worker: start, stop and inspect it and its job queue

The worker (`apps/worker`, CS-32) is the Node.js process that runs Carshenas's background jobs outside Next.js: crawling now, parsing, extraction, valuation and alerts later. Its jobs live in pg-boss 12 on the same PostgreSQL (ADR-0011); each crawled source has its own lane, and every request to a source is paced in the database (ADR-0018). How it logs: `docs/runbooks/logs-and-errors.md`, "The worker". The database: `docs/runbooks/local-database.md`.

## Before the first start

The worker connects as its own role, `carshenas_worker`. A `.env` from before CS-32 lacks its settings:

1. Copy these lines from `example.env` into `.env`: `CARSHENAS_WORKER_PASSWORD`, `WORKER_DATABASE_URL`, and, once a job sends requests to a source, `CRAWLER_USER_AGENT` (how the crawler names itself, with a contact address: ADR-0008 point 5).
2. `pnpm db:up`, then `pnpm db:roles` (creates the role on a volume made before it existed, and sets its password from `.env`), then `pnpm db:migrate` (installs the job queue's schema `pgboss` and the lanes' table).

A fresh clone gets all of this from `./scripts/init.sh`.

## Start and stop

| Command | What it does |
|---|---|
| `pnpm worker` | Starts the worker: JSON lines on standard output, health on `127.0.0.1:3101` |
| `pnpm worker:dev` | The same with readable lines at debug level, restarted when a file changes |
| `pnpm worker:health` | Asks the running worker; exits 0 with its report when it can work, 1 otherwise |
| Ctrl-C, or `kill -TERM <pid>` | Stops claiming jobs, lets running ones finish for up to 30 seconds (then fails them back to the queue), closes its pools, exits 0. A second Ctrl-C exits at once |

Find its process by its port, never with `pkill -f` (it can kill the shell that runs it): `ss -ltnpH 'sport = :3101'`.

Settings (all in `.env` or the environment; `apps/worker/src/env.ts` reads them):

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_DATABASE_URL` | none | `carshenas_worker`'s connection string; used by the worker's pool and by pg-boss's |
| `WORKER_HEALTH_PORT` | 3101 | The loopback port of `GET /health` |
| `CRAWLER_USER_AGENT` | none | Required once a job sends a request |
| `LOG_LEVEL`, `LOG_FORMAT`, `CARSHENAS_LOG_SQL`, `CARSHENAS_RELEASE`, `CARSHENAS_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT` | as the web app | `docs/runbooks/logs-and-errors.md` |

## What a healthy worker says

```bash
pnpm worker:health
{"status":"ok","database":{"migration":"20260929082449","latencyMs":2},"queue":{"schemaVersion":43},"lanes":[{"sourceId":"divar","queue":"crawl.divar","state":"running"}]}
```

- `database`: a real query through the worker's own pool and role, with the newest migration applied.
- `queue`: pg-boss's installed schema version, read from its own table.
- `lanes`: one per crawled source, `running` or `paused` with its `closure` (`stopped`, `paused`, `cooling_down`, `waiting`, `policy_expired`) and, when known, `until`. A paused lane is the worker doing its job, not a fault: the check still answers ok. `policy_expired` means the source's robots.txt and terms were last read more than `policy_max_age_days` (30) ago: see "Renew a source's policy check" below.

It answers 503 with `{"status":"unavailable","failing":[…]}` when the database or the queue cannot be reached or the runtime is not running, and logs why (`worker health check failed`).

## Inspect the queue

`pnpm db:psql` reads everything the worker writes (read-only sessions). Queues: `crawl.<source>` for each source's lane (every crawl kind of that source, one job at a time), one queue per job kind for other work, and `dead-letter` for jobs that failed for good.

```bash
# Jobs per queue and state
pnpm db:psql -c "select name, state, count(*) from pgboss.job group by 1, 2 order by 1, 2"

# What a lane holds, in the order it will run them
pnpm db:psql -c "select id, data->>'kind' as kind, priority, state, retry_count, start_after from pgboss.job where name = 'crawl.divar' and state in ('created', 'retry', 'active') order by priority desc, created_on"

# Recent failures with their error
pnpm db:psql -c "select name, id, data->>'kind' as kind, retry_count, output->>'type' as error, output->>'message' as message, completed_on from pgboss.job where state = 'failed' order by completed_on desc limit 20"

# Dead letters: where each came from and why
pnpm db:psql -c "select id, source_name, data->>'kind' as kind, source_output->>'message' as error, created_on from pgboss.job where name = 'dead-letter' order by created_on desc limit 20"

# Each source's pacing: next turn, the request in flight, the breaker, the last 429, and whether it is stopped
pnpm db:psql -c "select s.id, s.crawl_state, s.stop_reason, s.stopped_at, l.next_request_at, l.lease_holder, l.failure_streak, l.cooldown_until, l.cooldown_reason, l.rate_limited_at from source s left join crawl_lane l on l.source_id = s.id where s.access_method = 'crawl'"
```

## Act on a source or a job

A person decides these. Pausing and resuming a source is done in the superadmin section, **`/admin/sources`** (CS-40, ADR-0023), signed in as the superadmin:

- **Pause** («توقف خزش») an enabled source: its lane stops claiming within ten seconds, and queued jobs wait with their attempts.
- **Resume** («ازسرگیری خزش») a paused source, or one the worker stopped on a block (ADR-0008 point 6). The card shows when the blocked request started and why. Read the evidence first: the source's fetches at `stopped_at` (the query above) and the worker's `source stopped` line, whose `answer` shows a refusal found in a 200 answer. Resuming clears the stop on the source.
- Every change is recorded in `source_state_change`, with the superadmin and the time, and the stop a resume cleared; the card lists the latest five.
- A page opened before the worker stopped the source changes nothing: it says the source changed meanwhile and shows the stop. So nobody clears a stop they have not seen.

Without the web app, call the same function the section uses, which records the change under the superadmin account you name. It needs the state and the stop you saw, copied from the query above as the database printed them:

```bash
# Resume Divar, stopped on a block at the stopped_at the query printed; 'pedram' is the superadmin taking the decision.
# Read the evidence first: the worker's 'source stopped' line, whose `answer` shows a refusal found in a 200 answer
# (its start, size and JSON keys). The first stop of Divar was an answer the adapter did not know, not a block
docker compose exec -T postgres psql -U postgres -d carshenas -c "select change_source_state('divar', 'stopped_on_block', '2026-09-29 13:13:44.123456+00', 'enabled', (select id from account where username = 'pedram'))"

# Pause Divar
docker compose exec -T postgres psql -U postgres -d carshenas -c "select change_source_state('divar', 'enabled', null, 'paused', (select id from account where username = 'pedram'))"

# Keep Divar paused after reading a stop (the screen offers only a resume): the stop moves into its history, and the
# source is paused by your choice rather than stopped by the crawler
docker compose exec -T postgres psql -U postgres -d carshenas -c "select change_source_state('divar', 'stopped_on_block', '2026-09-29 13:13:44.123456+00', 'paused', (select id from account where username = 'pedram'))"
```

It answers `changed`, `unchanged` (already in that state) or `stale` (the state or the stop is not the one you gave: read it again). Locally it runs as the container's superuser, as above; on a server, as `carshenas_migrate`. A plain `update source` still works as the owner but records nothing, so do not.

Resuming a source that a second 429 stopped keeps the lane's last 429 (`crawl_lane.rate_limited_at`): for 24 hours after it the gap stays doubled and another 429 stops the source again at once. That is deliberate; to give the source a fresh start once you have raised its `min_request_interval_ms`, clear it too: `update crawl_lane set rate_limited_at = null where source_id = 'divar'`.

To send dead letters back to their queues, use pg-boss's `redrive()` from a script run as the worker (it takes a `sourceName` and a `limit`); a one-off redrive by hand is `update pgboss.job … ` only with care, since the dead-letter copy is a new job.

## How the lanes behave

- A lane runs one job at a time, across every worker process (pg-boss's `singleton` policy), highest priority first. Lanes run side by side.
- Every request takes the lane's lease in `crawl_lane`: never two in flight, and each starts at least the source's `min_request_interval_ms` (3 s or more) after the previous one ended, longer after a slow answer (five times its duration, up to 30 s).
- A job waits inside its handler for at most one gap. When the source is stopped or paused, or the lane cools down, the lane stops claiming; queued jobs keep their attempts, and the job that met the condition is put back with its attempts untouched.
- Three timeouts, 5xx or dropped connections in a row cool the lane down for about 1, 2, 4 … 60 minutes (jittered); the next request after it is the probe. The first two failed jobs spend an attempt; the one that opens the breaker, and a failed probe, go back to the queue with theirs.
- A 401, 403, or a challenge page or empty answer the source's adapter recognises stops the source until you resume it. A 429 cools the lane down for its `Retry-After` (or 15 minutes) and doubles the gap for 24 hours; a second 429 in those 24 hours stops the source.

## Divar (CS-33, CS-35)

The worker reads Divar through its public web API only: the search (`POST https://api.divar.ir/v8/postlist/w/search`) and a post (`GET https://api.divar.ir/v8/posts-v2/web/{token}`), never a contact or chat address. Divar arrives `paused` (migration `20260929104906`); set `CRAWLER_USER_AGENT` in `.env` (a descriptive name with a contact address, ADR-0008 point 5), then a person enables it on `/admin/sources`, or with the function above:

```bash
docker compose exec -T postgres psql -U postgres -d carshenas -c "select change_source_state('divar', 'paused', null, 'enabled', (select id from account where username = 'pedram'))"
```

| Job | Priority | What it does |
|---|---|---|
| `crawl.divar-discover` | 60 | Every 15 minutes (Tehran time): reads the tracked models' feed (`apps/worker/src/sources/divar/tracked-models.ts`, one search for all of them) newest first, down to the newest row the last round read (`crawl_feed.read_through_at`; the first round reads one hour back, a round at most 20 pages). Bumped and promoted rows never end a round early. A listing with no snapshot yet, or whose row shows another price than its last price event, gets a detail |
| `crawl.divar-listing` | 40 | One post: upserts the listing (`listed_at` from «انتشار آگهی»), stores its snapshot once per content (contact, map, owner id and interface rows left out, phone numbers removed, every photo URL kept), logs the request, and records a price event when the price changed; derives what the listing says from that snapshot (its attributes, photo addresses and unparsed values, CS-34), writing only what changed; a 404 marks a known listing gone |
| `crawl.divar-recheck` | 50 | A buyer's re-check (CS-35): reads the post as a detail does. Sent by `listing.drain-rechecks` |
| `crawl.divar-sweep-tracked` | 30 | The tracked models' daily sweep (CS-35): list pages only, one tracked model per slice, split into its trims when the search cuts it short (1,000 rows or more whose oldest is under 25 days old) or it fills 50 pages. Each page refreshes `last_seen_at` once a sweep, sets `source_model_key` (a finer key already known is kept), records a price event for each row whose price differs from the listing's latest (evidence: the page's `fetch_log` row), and sends `crawl.divar-backfill` for a listing with no detail yet or a re-priced one. A slice read to its end records `model_volume` and sends `crawl.divar-check` for each active listing of its key, or of a trim under it, not seen since the sweep started. The next page of a slice goes at priority 31, so slices finish one after the other |
| `crawl.divar-check` | 30 | One post a complete sweep no longer showed: gone on a 404 or 410, expired when its page is past `seo.unavailable_after`, otherwise still active with a fresh `last_checked_at` |
| `crawl.divar-backfill` | 20 | A tracked listing's detail a sweep asked for (ADR-0017's backfill): the first sweeps of a model find thousands without one, so they wait behind the sweep's own pages and stop at 80 % of the day's budget |
| `crawl.divar-sweep` | 10 | The rest of the market's weekly sweep: every car's first page names the brands, a brand of one page is swept from it and a larger one through its models, the tracked models skipped. A listing of an untracked model not seen since the sweep started is marked gone without a request (the owner's decision of 2026-09-30); tracked listings are left to their own sweep. Next page at priority 11 |
| `crawl.divar-measure` | 5 | A measurement, started by `pnpm measure:divar`: the first 50 pages of every car (depth and hourly flow; other entrants saw one search stop at about 1,200 results), every brand, the models of every brand whose first page is full, and the trims of a model the search cut short or that fills 50 pages; one count per slice in `model_volume`. A slice ends at a page of fewer than 24 rows, at an answer without a list, or where Divar's own rows give way to a divider and nearby cities' listings, whatever `has_next_page` says |

Every job is one crawl run (`crawl_run`, with its `kind` and `counts`), and every request it sent is in `fetch_log`, refused ones included, whatever came back.

Queue jobs of Divar (no request, Tehran time): `divar.start-sweep` (02:30 every day for the tracked models; 03:30 on Fridays for the rest; `sweptAt` from the database's clock), `divar.expire-listings` (every hour at :12: active listings past `expires_at` become expired, dated to it), `divar.measure-freshness` (every hour at :05: one `freshness_measurement` row for Divar and one per tracked model), and `listing.drain-rechecks` (every minute: each pending `listing_recheck_request` becomes a `crawl.divar-recheck`, unless its page was read within six hours, `fresh`, or it left the market, `off_market`).

**The daily budget** (CS-35; ADR-0017 point 5). `source.daily_request_budget` (Divar: 12,000, the owner's choice of 2026-09-30, at most 14,400) is counted in `crawl_lane.budget_day` and `budget_spent` when each request takes its lease, on the Tehran day. Each kind keeps a reserve for the kinds above it and stops when only that reserve is left (`apps/worker/src/runtime/budget.ts`): the untracked sweep and measurements at 70 % spent, backfills at 80 %, the tracked sweep and its checks at 90 %, new listings' details at 95 %, buyers' re-checks at 98 %, discovery at 100 %. The lane then claims only the kinds still open (pg-boss `minPriority`, shown as `minPriority` in the health answer); the rest stay queued with their attempts until the next Tehran day. When nothing is left the lane shows `over_budget` until Tehran midnight. To change a budget, write a migration, or as the migrate role in an emergency: `update source set daily_request_budget = <n> where id = 'divar'` (the database refuses more than half of what the interval allows).

**A slice read to its end** is judged only after its first page is read once more: a listing its seller bumped («نردبان») while the slice was being read moved above the pages already read, and would otherwise look missing. One extra request per complete slice. Sweep pages the budget holds back wait in the queue up to eight days (`retentionDays`), long enough for a weekly sweep to be replaced by the next.

**A slice the sweep doubted.** When a complete slice no longer shows more than half of its listings (and more than 20), nothing is checked or marked gone and the worker logs `sweep slice missed too many listings to believe` with the slice. Look at the slice on Divar by hand before anything else: a filter Divar renamed would look like this.

```bash
# The last hour of runs, by kind: how many, how they ended, and what they did
pnpm db:psql -c "select kind, status, count(*), sum((counts->>'newListings')::int) as new_listings, sum((counts->>'snapshotsStored')::int) as snapshots, sum((counts->>'priceEvents')::int) as price_events, round(avg(extract(epoch from finished_at - started_at))::numeric, 1) as avg_seconds from crawl_run where source_id = 'divar' and started_at > now() - interval '1 hour' group by 1, 2 order by 1, 2"

# Today's spend by kind and outcome, beside the budget (CS-35; the view source_daily_spend), and the lane's own count
pnpm db:psql -c "select kind, outcome, requests, daily_request_budget from source_daily_spend where source_id = 'divar' and tehran_day = (now() at time zone 'Asia/Tehran')::date order by kind, outcome"
pnpm db:psql -c "select budget_day, budget_spent from crawl_lane where source_id = 'divar'"

# Freshness, the latest hour: Divar and each tracked model (CS-35 criterion 6; ADR-0017 point 6)
pnpm db:psql -c "select distinct on (source_model_key) coalesce(source_model_key, 'all of Divar') as scope, measured_at, new_listings, left_market, active_listings, seen_within_48h, posting_to_first_seen_p50_minutes as posted_p50, posting_to_first_seen_p90_minutes as posted_p90, last_seen_age_p50_minutes as age_p50, last_seen_age_p90_minutes as age_p90 from freshness_measurement where source_id = 'divar' order by source_model_key nulls first, measured_at desc"

# Sweeps: the last one of each kind, slice by slice, and what the last day retired
pnpm db:psql -c "select swept_at, level, count(*) as slices, sum(active_count) as rows, count(*) filter (where not complete) as incomplete from model_volume where source_id = 'divar' and swept_at > now() - interval '8 days' group by 1, 2 order by 1 desc, 2"
pnpm db:psql -c "select status, count(*) from listing where source_id = 'divar' and delisted_at > now() - interval '1 day' group by 1"

# A measurement's counts: the largest models, and the market's total (brands of one page plus the models of the rest)
pnpm db:psql -c "select source_model_key, level, active_count, pages_read, complete from model_volume where source_id = 'divar' and swept_at = (select max(swept_at) from model_volume where source_id = 'divar') order by active_count desc limit 30"

# How long new listings of tracked models took to be stored, from their posting time
pnpm db:psql -c "select percentile_cont(array[0.5, 0.95]) within group (order by extract(epoch from s.first_fetched_at - l.listed_at) / 60) as minutes from listing l join snapshot s on s.listing_id = l.id where l.source_id = 'divar' and l.listed_at > now() - interval '1 day' and s.first_fetched_at = (select min(first_fetched_at) from snapshot where listing_id = l.id)"
```

## Re-derive listings after a parser change (CS-34)

What a listing says (its attributes, photo addresses and unparsed values; `docs/design/data-model.md`, "Added by CS-34") is derived by code from its latest snapshot: by the listing job when it stores one, and by `pnpm derive:listings` for every stored listing at once. Run the command after a change to a parser (`apps/worker/src/sources/*/attributes.ts`, whose version goes into `listing.parser_version`) or after a migration that adds an attribute, instead of crawling again. It sends no request to any source, runs as the worker's role, and can run while the worker does. It holds the listings of each batch of 50 that nobody else holds while it writes them, as the listing job holds the one it writes, and derives the ones the crawler or discovery held afterwards, one at a time, so it neither races nor deadlocks with them.

It logs one `field derived` line per field (listings that stated a value it read, a form meaning unknown, a value it could not read, or nothing), one `value not read` line per text it could not read and one `row not known` line per row it does not know, most common first, then `listings derived` with the totals (`withoutFetch`: listings whose snapshots were copied from another database without their fetches, derived from the one first fetched last; `heldElsewhere`: listings derived in the second pass; `stillHeld`: listings still held after the worker role's 5 s lock timeout, derived by the next run; `refused` and `refusedListings`: listings whose derivation the database refused, with the rule, their earlier derivation kept). A value it could not read stays in `listing_unparsed_value` with its raw text: teach the parser that form, bump its version, and run the command again. A refused derivation is a parser that let through a value the table's rules refuse: fix the parser (never the rule) and run it again. The listing job counts the same case as `derivationsRefused`, with a `a derived value was refused by the database` warning, and keeps the snapshot.

```bash
LOG_FORMAT=pretty pnpm derive:listings

# The values the parser could not read, most common first
pnpm db:psql -c "select field, raw_text, count(*) from listing_unparsed_value group by 1, 2 order by 3 desc limit 30"

# Listings not derived by the current parser version (2 for Divar since CS-50: colour, city, district)
pnpm db:psql -c "select source_id, parser_version, count(*) from listing group by 1, 2 order by 1, 2"
```

## The catalogue and each listing's match (CS-50)

The catalogue (`docs/design/data-model.md`, "Added by CS-50") is curated in code: body types and colours in `apps/worker/src/catalogue/codes.ts`, Divar's 161 makes and 807 models with their body types in `divar-catalogue.ts`, the tracked models' aliases in `aliases.ts`. The `catalogue.refresh` job brings the database up to date every ten minutes, and `pnpm catalogue:sync` does it now. It upserts the curated rows, then learns what the listings' keys name that the catalogue does not: a trim under its model (`Peugeot 206 SD V8`), or a model of its own under its make, left without a body type. It names each trim and learned model in Persian by the most common «برند و مدل» row of its posts, kept as a `suggested` alias. Then it sets every listing's `make_id`, `model_id`, `trim_id` and `catalogue_match`: `trim` or `model` when the listing's key names one, `unmatched` when the key is missing, unknown or names only a make. It never guesses. It sends no request to any source and can run beside the worker.

The command then logs one `catalogue match` line for Divar as a whole and one per tracked model (listings; matched to a trim, to the model only, or unmatched; `matchedPercent`, `trimPercent`), and the models whose body type was curated with doubt (`CURATION_DOUBTS`), for a person to confirm. A listing matched to the model only was seen in a list page, which names no trim; its details job matches it to a trim. A person's correction goes into `divar-catalogue.ts`; a curated body type never overwrites one a person set in the database, and a learned model's stays empty until someone sets it.

```bash
LOG_FORMAT=pretty pnpm catalogue:sync

# Keys the catalogue learned, with the Persian names the posts gave them
pnpm db:psql -c "select k.source_model_key, k.level, coalesce(t.name_fa, m.name_fa) from catalogue_source_key k left join trim t on t.id = k.trim_id left join model m on m.id = k.model_id where coalesce(t.name_fa, m.name_fa) is not null order by 1 limit 30"

# Models with listings but no body type (learned ones, to classify in divar-catalogue.ts)
pnpm db:psql -c "select m.name_en, count(*) from listing l join model m on m.id = l.model_id where m.body_type is null group by 1 order by 2 desc"
```

## Market values and deal ratings (CS-51)

The `valuation.run` job values the market once a Tehran day at 04:00, after the night's sweep (`docs/specs/S01-deal-ratings.md`; tables in `docs/design/data-model.md`, "Added by CS-51"). It gathers the comparables (asking prices of matched listings with year, mileage and gearbox, seen in the last 30 days, no declared damage, no dealer's zero-km post), fits the per-model price model, stores the run, then rates every active listing in SQL with `valuation_rate_listing()`. A rerun of a day replaces its run; a run that throws stays in the table as `failed`. It sends no request to any source.

```bash
# One run now (the day defaults to today in Tehran; a rerun of the day replaces it)
LOG_FORMAT=pretty pnpm valuation:run [--as-of 2026-09-30]

# The accuracy report: time split (learn before the cut, score after) and a seeded random split; --write saves it
pnpm valuation:evaluate [--as-of 2026-09-30] [--cut-days 7] [--write]

# The latest run, its models and its ratings
pnpm db:psql -c "select id, as_of_date, status, comparable_count, valued_count, rated_count from valuation_run order by id desc limit 5"
pnpm db:psql -c "select m.name_fa, s.comparable_count, s.error_pct, s.rates_listings from valuation_segment s join model m on m.id = s.model_id where s.valuation_run_id = (select max(id) from valuation_run where status = 'succeeded') order by 2 desc"
pnpm db:psql -c "select coalesce(deal_rating::text, no_rating_reason), count(*) from listing_valuation where valuation_run_id = (select max(id) from valuation_run where status = 'succeeded') group by 1 order by 2 desc"
```

## Renew a source's policy check

ADR-0008 point 1: a source's robots.txt and terms are read again at least every 30 days (`source.policy_max_age_days`). After that its lane shows `policy_expired`, no crawl run of it may start (`crawl_run_policy_guard`), and its queued jobs wait. Divar's first reading is from 2026-09-28, so it runs out on 2026-10-28. Read both again, record the reading in the sources research note, then add it as the migrate role; the lane opens within ten seconds:

```bash
docker compose exec -T postgres psql -U postgres -d carshenas -c "insert into source_policy_check (source_id, checked_at, checked_by, robots_txt, terms_url, terms_summary, verdict, conditions, photos_allowed) values ('divar', now(), '<who>', '<robots.txt as read>', 'https://divar.ir/help/custom_articles/general_terms_and_conditions', '<what the terms say>', 'allowed_with_conditions', '<the conditions, as in the previous reading>', false)"
```

## Upgrading pg-boss

pg-boss's schema belongs to the migrations, so the worker runs it with `migrate: false` and would refuse to start on a schema version it does not expect.

1. Bump the pinned version in `apps/worker/package.json` and `pnpm install`; read the release notes.
2. `pnpm db:new upgrade_job_queue_<version>`, then paste below the template's timeouts the output of `pnpm --filter @carshenas/worker pgboss:sql upgrade <installed schema version>` (the installed one: `pnpm db:psql -c "select version from pgboss.version"`). When it says the upgrade builds indexes `CONCURRENTLY`, run it again with `--split` and make one migration per part, in order: each `transaction:false` part alone in its file, with the lines it prints and nothing else (a concurrent index build cannot run inside a migration's transaction).
3. The superadmin section's grants on pg-boss's tables (`GRANT SELECT ON pgboss.job TO carshenas_admin`, CS-41) sit on tables pg-boss owns: an upgrade that drops and recreates `pgboss.job` loses them without a word, and `change_job_state()` writes its columns. Add the grant again at the end of the upgrade migration when it recreates the table, and check that `apps/web/src/server/db/pgboss-types.ts` still matches (the column test in `admin-database.db.test.ts`, run by `pnpm db:check`).
4. `pnpm db:migrate`, `pnpm db:check`, and start the worker.

## Index maintenance

pg-boss rebuilds bloated job indexes itself only when its role owns them, and the worker's does not, so that maintenance is off (`reindex: false`). When the worker logs `job queue warning` about bloated indexes, rebuild the ones it names as the owner: `REINDEX INDEX CONCURRENTLY pgboss.<index>;` (locally through the container's superuser, as above).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `WORKER_DATABASE_URL is not set` | `.env` predates the worker: see "Before the first start" |
| `password authentication failed for user "carshenas_worker"` or `role "carshenas_worker" does not exist` | `pnpm db:roles` |
| pg-boss refuses to start: schema not installed, or another version | `pnpm db:migrate`; after a pg-boss bump, the upgrade migration above |
| `listen EADDRINUSE 127.0.0.1:3101` | Another worker is running (`ss -ltnpH 'sport = :3101'`), or set `WORKER_HEALTH_PORT` |
| A lane stays `paused` with `closure: stopped` | The source was stopped on a block: `source.stop_reason` and `stopped_at` say which and when; resume it once you have read the evidence |
| A lane's jobs sit in `active` after a crash | pg-boss fails a job whose worker stopped sending heartbeats (30 s) at its next check, and the lane moves on |
| A job keeps coming back with `job of an unknown kind put back` | A worker without that job's code claimed it (an old process during a deploy). It is dead-lettered after 25 tries; stop the old process |
