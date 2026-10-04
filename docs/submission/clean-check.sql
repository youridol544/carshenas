-- Is the crawl healthy, and is the database free of test rows? (CS-120.) Read-only. From the main checkout:
--
--   pnpm db:psql < docs/submission/clean-check.sql
--
-- Blocks 0 to 2 say the crawl and the worker are healthy (a restart every few seconds shows as many starts in
-- block 1); blocks 3 to 5 count the rows tests and hand testing leave behind. A clean database has the owner's own
-- accounts only and no other row of the kinds in blocks 3 to 5. The script changes nothing; what to do with a
-- finding is in docs/submission/open-items.md, F3 and F4.

\pset footer off
\pset null '-'

\echo
\echo '== 0. The crawl: the source must be enabled, with no cool-down and no stop'
select s.id as source, s.crawl_state, s.stop_reason, s.daily_request_budget,
       l.budget_day, l.budget_spent, l.cooldowns, l.cooldown_until, l.failure_streak,
       round(extract(epoch from now() - l.last_request_at) / 60) as minutes_since_last_request
from source s
left join crawl_lane l on l.source_id = s.id;

\echo
\echo '== 1. The worker: exactly one process alive (it beat in the last minute and has run for more than 15 seconds), and no restarts'
select count(*) filter (where stopped_at is null and beat_at > now() - interval '1 minute' and beat_at > started_at + interval '15 seconds') as processes_alive,
       count(*) filter (where started_at > now() - interval '10 minutes') as starts_in_the_last_10_minutes,
       (max(beat_at) at time zone 'Asia/Tehran')::timestamp(0) as last_beat_tehran
from worker_heartbeat;

\echo
\echo '== 2. Jobs that failed in the last 24 hours (should be none)'
select name, state, count(*) from pgboss.job where state = 'failed' and created_on > now() - interval '24 hours' group by 1, 2;

\echo
\echo '== 3. Accounts, by the shape of their name (digits and hex runs shown as #): only the owner''s own should remain'
select regexp_replace(username, '[0-9a-f]{4,}|[0-9]+', '#', 'g') as shape, role, count(*) as accounts
from account
group by 1, 2
order by 3 desc, 1;

\echo
\echo '== 4. Rows that tests and hand testing leave (each should be 0 or a number the owner can explain)'
select 'listings with a test token' as what, count(*) as rows from listing where source_listing_key ~ '^e2e' or url ~ 'test\.example'
union all select 'wanted links (links pasted that we had not read)', count(*) from wanted_link
union all select 'search files', count(*) from search_file
union all select 'marked listings', count(*) from listing_mark
union all select 'notifications', count(*) from notification
union all select 'crawl requests', count(*) from crawl_request
union all select 'listings waiting for a buyer''s re-check', count(*) from listing_recheck_request
union all select 'model demand rows (pasted links count here, one per paste)', count(*) from model_demand
union all select 'tracked models added by a superadmin (the seed ten are origin seed)', count(*) from tracked_model where origin = 'superadmin'
union all select 'model photo links set', count(*) from model_photo_link
union all select 'open review items (a text a model held for a person)', count(*) from review_item;

\echo
\echo '== 5. What the model spent today, Tehran time (the buyer's path spends nothing: search is code, explanations are templates)'
select task, count(*) as calls, round(sum(cost_usd_micros) / 1000000.0, 4) as usd
from model_spend
where created_at >= date_trunc('day', now() at time zone 'Asia/Tehran') at time zone 'Asia/Tehran'
group by 1;
