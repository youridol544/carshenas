# EXPLAIN (ANALYZE, BUFFERS) of the new queries (CS-103), lane database, 2026-10-04, 23,752 listings and 5,975 search rows

The lane's database is a copy of main's older one; the plans are the ones the web role and the worker run, on a machine under load (other lanes were running), so the times are upper bounds. Statements are abridged to what the plan shows.

## select r.listing_id from search_document r where r.country = any(array['jp']) and r.last_seen_at >= now() - interval '
```
  ->  Index Scan using search_document_best_deal_idx on search_document r (actual time=0.535..3.314 rows=24.00 loops=1)
  Buffers: shared hit=2581
Planning Time: 0.974 ms
Execution Time: 3.350 ms
```

## select count(*) from (select 1 from search_document r where r.country = any(array['jp','kr']) and r.last_seen_at >= no
```
        ->  Seq Scan on search_document r (actual time=0.113..5.394 rows=117.00 loops=1)
  Buffers: shared hit=2270
Planning Time: 0.906 ms
Execution Time: 5.466 ms
```

## select count(*) from search_document r where r.last_seen_at >= now() - interval '48 hours' and r.fuel = 'petrol' and r
```
  ->  Seq Scan on search_document r (actual time=5.868..5.869 rows=0.00 loops=1)
  Buffers: shared hit=2270
Planning Time: 1.061 ms
Execution Time: 5.928 ms
```

## select count(*), count(sp.engine_volume_cc), count(sp.car_origin), count(sp.country) from listing l join listing_spec 
```
              ->  Nested Loop Left Join (actual time=7.057..29.334 rows=11562.50 loops=2)
                                            ->  Parallel Hash Join (actual time=6.688..15.541 rows=11562.50 loops=2)
                                                  ->  Parallel Seq Scan on listing l_1 (actual time=0.010..4.845 rows=11876.00 loops=2)
                                                        ->  Parallel Seq Scan on listing l (actual time=0.012..3.599 rows=11562.50 loops=2)
                                                        ->  Seq Scan on model_spec s (actual time=0.029..0.049 rows=3.00 loops=2)
                                                              ->  Seq Scan on model_spec t (actual time=0.006..0.055 rows=49.00 loops=2)
  Buffers: shared hit=3039
Planning Time: 5.692 ms
Execution Time: 36.151 ms
```

## with counted as (select l.model_id, count(*) active, count(sp.engine_volume_cc) v, count(sp.car_origin) o, count(sp.co
```
Nested Loop (actual time=43.532..46.964 rows=12.00 loops=1)
  ->  Nested Loop (actual time=43.520..46.941 rows=12.00 loops=1)
                                ->  Nested Loop Left Join (actual time=11.199..35.638 rows=11562.50 loops=2)
                                                  ->  Parallel Hash Join (actual time=10.715..24.652 rows=11562.50 loops=2)
                                                        ->  Parallel Seq Scan on listing l_1 (actual time=0.022..7.255 rows=11876.00 loops=2)
                                                              ->  Parallel Seq Scan on listing l (actual time=0.020..5.937 rows=11562.50 loops=2)
  Buffers: shared hit=3086
Planning Time: 3.721 ms
Execution Time: 47.365 ms
```

## select k.id, count(l.id) active from make k left join listing l on l.make_id = k.id and l.status = 'active' where not 
```
              ->  Hash Right Join (actual time=15.354..15.365 rows=40.00 loops=1)
                    ->  Seq Scan on listing l (actual time=0.010..13.065 rows=23125.00 loops=1)
                                ->  Seq Scan on make k (actual time=0.006..0.017 rows=161.00 loops=1)
                                      ->  Seq Scan on country_spec c (actual time=0.004..0.014 rows=121.00 loops=1)
  Buffers: shared hit=1481
Planning Time: 1.086 ms
Execution Time: 15.581 ms
```

## select r.listing_id, r.country, r.engine_volume_cc, r.car_origin from listing_filter_row r where r.listing_id between 
```
Hash Right Join (actual time=5.538..97.705 rows=1828.00 loops=1)
                ->  Seq Scan on valuation_run r (never executed)
  ->  Nested Loop Left Join (actual time=0.926..81.083 rows=23752.00 loops=1)
                                ->  Seq Scan on listing l_1 (actual time=0.018..25.794 rows=23752.00 loops=1)
                                            ->  Seq Scan on model_spec s (actual time=0.026..0.070 rows=3.00 loops=1)
                                                  ->  Seq Scan on model_spec t (actual time=0.012..0.132 rows=49.00 loops=1)
  Buffers: shared hit=3157
Planning Time: 13.071 ms
Execution Time: 98.305 ms
```

## An index on search_document.country, measured and not made

At 47,800 rows (the lane's table seven times over, countries spread 2 % Japan, 5 % Korea, 8 % Germany, 50 % France, the rest Iran) a page of one country takes about 60 to 70 ms with or without a b-tree on the column: the planner scans (the rows are wide, and a country keeps 2 to 50 % of them), as ADR-0028 found for the models and makes. No index is added; revisit when the table passes about 100,000 rows (`pnpm db:unused-indexes`).
