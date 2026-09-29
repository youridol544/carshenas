-- migrate:up
-- Divar as a crawled source (CS-33; ADR-0008 point 3, ADR-0017), with the reading of its robots.txt and terms that
-- CS-5 recorded on 2026-09-28 (docs/research/2026-09-26-car-listing-sources-and-crawl-policy.md, verdict table;
-- terms-2026-09-28.md; robots-2026-09-28/api.divar.ir.txt). It starts paused: only a person enables it
-- (docs/runbooks/worker.md). The reading is 30 days old on 2026-10-28, after which no crawl run of Divar may start
-- until someone reads the robots.txt and terms again and records a new policy check.
-- source.min_request_interval_ms's comment is restated: robots.txt is recorded but not followed (ADR-0008 point 5 as
-- accepted), so a Crawl-delay no longer lengthens the gap; an applied migration is never edited.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

INSERT INTO source (id, origin, access_method, name_fa, base_url, listing_visibility, crawl_state, min_request_interval_ms)
VALUES ('divar', 'external', 'crawl', 'دیوار', 'https://divar.ir', 'public', 'paused', 3000);

INSERT INTO source_policy_check (
  source_id, checked_at, checked_by, robots_txt, terms_url, terms_summary, verdict, conditions, photos_allowed)
VALUES (
  'divar',
  '2026-09-27 22:29:00+00',
  'CS-5 (the agent), for the owner, who decided on 2026-09-27 to crawl Divar (ADR-0008 point 3)',
  E'User-agent: *\nAllow: /',
  'https://divar.ir/help/custom_articles/general_terms_and_conditions',
  'Terms updated 1405/04/31 (2026-07-22), binding from 2026-08-22: using a robot or trying to extract data is a breach (5.1); robots, scrapers, crawlers, scripts and AI agents, any use through APIs outside the official interfaces, and replaying the app''s traffic are forbidden (6.3); damages include the market value of the extracted data (6.4); advertisers grant Divar an exclusive three-year licence to their ads and photos (5.4). robots.txt of api.divar.ir allows everything; divar.ir disallows /my-divar/*, /new, /s/*/*?*q=* and /adminbot.',
  'allowed_with_conditions',
  'Crawled against its terms by the owner''s decision of 2026-09-27 (ADR-0008 point 3): api.divar.ir only, its search (POST /v8/postlist/w/search) and post (GET /v8/posts-v2/web/{token}) endpoints, never a contact or chat endpoint; a descriptive User-Agent; one request at a time, at least 3 s apart; stop on a 401, 403, challenge page or empty answer, and on a second 429 within 24 hours (ADR-0018); no personal data stored; removal requests honoured.',
  false);

COMMENT ON COLUMN source.min_request_interval_ms IS
  'Milliseconds between two requests to this source; at least 3000 for crawled sources (ADR-0008 point 5). robots.txt is recorded, not followed, so a Crawl-delay does not lengthen it; the lane waits longer after a slow answer and after a 429 (ADR-0018).';


-- migrate:down
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

COMMENT ON COLUMN source.min_request_interval_ms IS
  'Milliseconds between two requests to this source; at least 3000 for crawled sources, longer when robots.txt asks (Crawl-delay).';
-- Policy checks are append-only: only a purge removes one.
SET LOCAL carshenas.purge = 'on';
DELETE FROM source_policy_check WHERE source_id = 'divar';
DELETE FROM source WHERE id = 'divar';
