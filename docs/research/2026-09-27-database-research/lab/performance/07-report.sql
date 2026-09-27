\pset format aligned
\echo '== top statements by total execution time'
SELECT left(regexp_replace(query, '\s+', ' ', 'g'), 70) AS query,
       calls,
       round(total_exec_time::numeric, 0) AS total_ms,
       round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 1) AS pct,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       round(max_exec_time::numeric, 1) AS max_ms,
       rows / calls AS rows_per_call,
       (shared_blks_hit + shared_blks_read) / calls AS blks_per_call,
       temp_blks_written AS temp_w
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC LIMIT 8;
\echo '== tables: sequential versus index scans'
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_tup_upd, n_tup_hot_upd, n_live_tup, n_dead_tup
FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 5;
\echo '== indexes never scanned since the reset (excluding unique and primary keys)'
SELECT s.relname AS table, s.indexrelname AS index, s.idx_scan, pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC;
\echo '== all index usage'
SELECT relname, indexrelname, idx_scan, idx_tup_read, pg_size_pretty(pg_relation_size(indexrelid)) size FROM pg_stat_user_indexes ORDER BY relname, idx_scan DESC;
