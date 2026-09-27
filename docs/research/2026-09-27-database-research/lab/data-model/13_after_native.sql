-- The same fingerprint after the migration, ignoring the columns the migration added (all NULL on old rows).
\pset pager off
SELECT b.tbl, b.n_rows, a.n_rows AS n_rows_after, b.fingerprint = a.fingerprint AS unchanged
FROM fp_before b
JOIN (
  SELECT 'listing' AS tbl, count(*) AS n_rows,
         md5(string_agg((to_jsonb(l) - 'seller_account_id' - 'current_revision_id')::text, '|' ORDER BY id)) AS fingerprint FROM listing l
  UNION ALL SELECT 'listing_price_event', count(*), md5(string_agg((to_jsonb(e) - 'native_revision_id')::text, '|' ORDER BY id)) FROM listing_price_event e
  UNION ALL SELECT 'snapshot', count(*), md5(string_agg(to_jsonb(s)::text, '|' ORDER BY id)) FROM snapshot s
) a USING (tbl)
ORDER BY b.tbl;
SELECT conname, convalidated FROM pg_constraint
WHERE conrelid = 'listing'::regclass AND conname IN ('listing_owner_matches_origin', 'listing_status_valid', 'listing_native_active_is_complete', 'listing_id_origin_key')
ORDER BY conname;
SELECT origin, count(*) AS transitions FROM listing_status_transition GROUP BY origin ORDER BY origin;
