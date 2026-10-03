\set ON_ERROR_STOP on
BEGIN;
SET LOCAL carshenas.purge = 'on';
-- Synthetic scale: 2,000 buyers with 3 files each, a request for each of 1,500 scopes (models and trims), each file linked to up to 3.
INSERT INTO account (username, password_hash, role)
SELECT 'x71_' || g, '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g', 'buyer'
FROM generate_series(1, 2000) g;
INSERT INTO search_file (account_id, name, search)
SELECT a.id, 'پرونده ' || n, jsonb_build_object('v', 1, 'filters', '{}'::jsonb, 'q', 'w' || a.id || '_' || n)
FROM account a, generate_series(1, 3) n WHERE a.username LIKE 'x71_%';
INSERT INTO crawl_request (model_id, trim_id)
SELECT m.id, NULL FROM model m;
INSERT INTO crawl_request (model_id, trim_id)
SELECT t.model_id, t.id FROM trim t LIMIT 1400;
INSERT INTO crawl_request_file (crawl_request_id, search_file_id)
SELECT r.id, f.id FROM (SELECT id, row_number() OVER () rn FROM crawl_request) r
JOIN (SELECT id, row_number() OVER () rn FROM search_file) f ON f.rn % 1500 = r.rn % 1500 AND f.rn % 7 < 3;
UPDATE crawl_request SET state = 'approved', decided_by_account_id = (SELECT min(id) FROM account), decided_at = now() WHERE id % 5 = 0;
ANALYZE crawl_request; ANALYZE crawl_request_file; ANALYZE search_file; ANALYZE account;
SELECT (SELECT count(*) FROM crawl_request) requests, (SELECT count(*) FROM crawl_request_file) links;

\echo === 1. scope states of a file (model in list, with this file linked)
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, r.model_id, r.trim_id, r.state, r.decline_reason, r.decided_at, l.search_file_id AS linked_file
FROM crawl_request r LEFT JOIN crawl_request_file l ON l.crawl_request_id = r.id AND l.search_file_id = 100
WHERE r.model_id IN (10, 20, 30);

\echo === 2. tracked_model_scope
EXPLAIN (ANALYZE, BUFFERS) SELECT model_id, trim_id FROM tracked_model_scope WHERE model_id IN (10, 20, 30);

\echo === 3. an account's files' requests (list cards)
EXPLAIN (ANALYZE, BUFFERS)
SELECT l.search_file_id, r.state FROM crawl_request_file l
JOIN search_file f ON f.id = l.search_file_id JOIN crawl_request r ON r.id = l.crawl_request_id
WHERE f.account_id = (SELECT id FROM account WHERE username = 'x71_77');

\echo === 4. admin list: all requests, queue first, demand
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, r.state, r.created_at, r.decided_at, r.decline_reason,
  (SELECT count(DISTINCT f.account_id) FROM crawl_request_file l JOIN search_file f ON f.id = l.search_file_id WHERE l.crawl_request_id = r.id) AS buyers,
  (SELECT count(*) FROM crawl_request_file l WHERE l.crawl_request_id = r.id) AS files
FROM crawl_request r
WHERE r.state <> 'pending' OR EXISTS (SELECT 1 FROM crawl_request_file l WHERE l.crawl_request_id = r.id)
ORDER BY CASE WHEN r.state = 'pending' THEN 0 ELSE 1 END, buyers DESC, r.created_at, r.id LIMIT 100;

\echo === 4b. admin list filtered to pending
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, (SELECT count(DISTINCT f.account_id) FROM crawl_request_file l JOIN search_file f ON f.id = l.search_file_id WHERE l.crawl_request_id = r.id) AS buyers
FROM crawl_request r WHERE r.state = 'pending'
AND EXISTS (SELECT 1 FROM crawl_request_file l WHERE l.crawl_request_id = r.id)
ORDER BY buyers DESC, r.created_at, r.id LIMIT 100;

\echo === 5. the dependent files of the listed requests
EXPLAIN (ANALYZE, BUFFERS)
SELECT l.crawl_request_id, f.id, f.name, f.status, f.search, a.username
FROM crawl_request_file l JOIN search_file f ON f.id = l.search_file_id JOIN account a ON a.id = f.account_id
WHERE l.crawl_request_id IN (SELECT id FROM crawl_request ORDER BY id LIMIT 100) ORDER BY l.created_at, f.id;

\echo === 6. demand per model
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.id, count(DISTINCT f.account_id) buyers, count(DISTINCT r.id) requests
FROM crawl_request r JOIN crawl_request_file l ON l.crawl_request_id = r.id JOIN search_file f ON f.id = l.search_file_id
JOIN model m ON m.id = r.model_id JOIN make k ON k.id = m.make_id
GROUP BY m.id, m.name_fa, m.name_en, k.name_fa, k.name_en ORDER BY buyers DESC, m.id LIMIT 8;

\echo === 7. per-file limit and per-account limit counts (the trigger)
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM crawl_request_file l WHERE l.search_file_id = 100;
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM crawl_request_file l JOIN search_file f ON f.id = l.search_file_id JOIN crawl_request r ON r.id = l.crawl_request_id
WHERE f.account_id = (SELECT id FROM account WHERE username = 'x71_77') AND r.state = 'pending';
ROLLBACK;
