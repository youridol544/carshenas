-- Fingerprint of the crawled data before the native migration.
\pset pager off
\timing on
CREATE TEMP TABLE IF NOT EXISTS fp_before AS
SELECT 'listing' AS tbl, count(*) AS n_rows, md5(string_agg(to_jsonb(l)::text, '|' ORDER BY id)) AS fingerprint FROM listing l
UNION ALL SELECT 'listing_price_event', count(*), md5(string_agg(to_jsonb(e)::text, '|' ORDER BY id)) FROM listing_price_event e
UNION ALL SELECT 'snapshot', count(*), md5(string_agg(to_jsonb(s)::text, '|' ORDER BY id)) FROM snapshot s;
SELECT * FROM fp_before ORDER BY tbl;
