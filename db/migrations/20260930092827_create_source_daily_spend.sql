-- migrate:up
-- What each source's requests were spent on, per Tehran day (CS-35 criterion 4; ADR-0017 point 5): every request in
-- fetch_log, by the kind of the crawl run that sent it and what came back, beside the source's daily budget. Each run
-- also keeps its own counts (crawl_run.counts); this is the day's sum, for the runbook, the superadmin section (CS-41)
-- and the data-status page (CS-66). A view over the log, so it is exact and never stale.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW source_daily_spend AS
SELECT f.source_id,
       (f.requested_at AT TIME ZONE 'Asia/Tehran')::date AS tehran_day,
       r.kind,
       f.outcome,
       count(*)::integer AS requests,
       s.daily_request_budget
FROM fetch_log f
JOIN crawl_run r ON r.id = f.crawl_run_id AND r.source_id = f.source_id
JOIN source s ON s.id = f.source_id
GROUP BY f.source_id, (f.requested_at AT TIME ZONE 'Asia/Tehran')::date, r.kind, f.outcome, s.daily_request_budget;

COMMENT ON VIEW source_daily_spend IS
  'Requests per source, Tehran day, crawl kind and outcome, with the source''s daily budget (CS-35; ADR-0017 point 5).';

GRANT SELECT ON source_daily_spend TO carshenas_worker;


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW source_daily_spend;
