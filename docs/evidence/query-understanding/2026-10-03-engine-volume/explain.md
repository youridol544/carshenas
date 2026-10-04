# EXPLAIN (ANALYZE, BUFFERS) of the new queries (CS-99, CS-100), lane database, 2026-10-03, 23,752 listings and 5,975 search rows

## select r.listing_id from search_document r where r.engine_volume_cc >= 2000 and r.last_seen_at >= now() - inte
```
  Buffers: shared hit=100
        Buffers: shared hit=100
        ->  Index Scan using search_document_engine_volume_idx on search_document r (actual time=0.028..0.391 rows=61.00 loops=1)
              Index Cond: (engine_volume_cc >= 2000)
              Index Searches: 1
              Buffers: shared hit=91
  Buffers: shared hit=453
Planning Time: 1.108 ms
Execution Time: 0.500 ms
```

## select count(*) from (select 1 from search_document r where r.engine_volume_cc between 1400 and 1800 and r.las
```
  Buffers: shared hit=563
        Buffers: shared hit=563
        ->  Seq Scan on search_document r (actual time=0.023..1.229 rows=1001.00 loops=1)
              Buffers: shared hit=563
  Buffers: shared hit=378
Planning Time: 0.929 ms
Execution Time: 1.412 ms
```

## select count(*) from search_document r where r.car_origin = 'imported' and r.last_seen_at >= now() - interval 
```
  Buffers: shared hit=2246
  ->  Seq Scan on search_document r (actual time=4.791..5.335 rows=1.00 loops=1)
        Buffers: shared hit=2246
  Buffers: shared hit=384
Planning Time: 1.048 ms
Execution Time: 5.398 ms
```

## select count(*) from search_document r where r.last_seen_at >= now() - interval '48 hours' and r.fuel = 'petro
```
  Buffers: shared hit=2246
  ->  Seq Scan on search_document r (actual time=0.237..5.049 rows=36.00 loops=1)
        Buffers: shared hit=2246
  Buffers: shared hit=388
Planning Time: 0.933 ms
Execution Time: 5.099 ms
```

## select m.id, count(l.id), count(coalesce(l.engine_volume_cc, ts.engine_volume_cc, ms.engine_volume_cc)), count
```
  Buffers: shared hit=10171
        Buffers: shared hit=10171
              Buffers: shared hit=10168
                    Buffers: shared hit=1684
                          Buffers: shared hit=1660
                                Buffers: shared hit=1636
                                ->  Seq Scan on model m (actual time=0.008..0.079 rows=807.00 loops=1)
                                      Buffers: shared hit=9
                                ->  Index Scan using listing_model_year_idx on listing a (actual time=0.001..0.001 rows=0.01 loops=807)
                                      Index Cond: (model_id = m.id)
                                      Index Searches: 807
                                      Buffers: shared hit=1627
                          ->  Index Only Scan using make_pkey on make k (actual time=0.003..0.003 rows=1.00 loops=12)
                                Index Cond: (id = m.make_id)
```

## select l.id, l.engine_volume_cc, ts.engine_volume_cc, ms.engine_volume_cc, ts.car_origin, ms.car_origin from l
```
  Buffers: shared hit=11
          Buffers: shared hit=4
                  Buffers: shared hit=4
                  ->  Index Scan using listing_pkey on listing (actual time=0.038..0.038 rows=1.00 loops=1)
                        Index Searches: 1
                        Buffers: shared hit=4
        Buffers: shared hit=9
        ->  Index Scan using listing_pkey on listing l (actual time=0.053..0.053 rows=1.00 loops=1)
              Index Cond: (id = (InitPlan 2).col1)
              Index Searches: 1
              Buffers: shared hit=7
        ->  Index Scan using model_spec_once_per_scope_unique on model_spec ts (actual time=0.017..0.017 rows=1.00 loops=1)
              Index Cond: ((model_id = l.model_id) AND (trim_id = l.trim_id))
              Index Searches: 1
```

The admin screen's per-model coverage query (the fifth) executes in 25.7 ms (10,171 buffers) on 23,125 active listings, once per page view of a superadmin screen; the search filter queries run in 0.5 to 5.4 ms, the volume ones through `search_document_engine_volume_idx`. The «unknown» note's count (the third and fourth) is a scan of the matching rows, 5 ms at 5,975 rows, run only when the volume or origin filter is in the search.
