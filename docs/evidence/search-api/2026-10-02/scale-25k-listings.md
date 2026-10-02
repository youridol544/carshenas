Table: 24996 rows.
| Query | ms | buffers | scans |
|---|---|---|---|
| all, first page, best_deal | 0.22 | 27 | Subquery, Index best_deal_idx |
| all, first page, price_asc | 0.19 | 44 | Subquery, Index price_asc_idx |
| all, first page, price_desc | 0.20 | 27 | Subquery, Index price_desc_idx |
| all, first page, mileage_asc | 0.17 | 45 | Subquery, Index mileage_idx |
| all, first page, newest | 0.26 | 44 | Subquery, Index newest_idx |
| all, first page, year_desc | 0.18 | 28 | Subquery, Index year_idx |
| catalogue karshenas-pick | 0.38 | 97 | Subquery, Index best_deal_idx |
| catalogue great-deals-under-1b | 0.17 | 51 | Subquery, Index best_deal_idx |
| catalogue clean-and-easy | 0.60 | 155 | Subquery, Index best_deal_idx |
| catalogue family | 0.40 | 99 | Subquery, Index best_deal_idx |
| catalogue low-mileage | 0.28 | 68 | Subquery, Index best_deal_idx |
| catalogue automatic | 0.46 | 158 | Subquery, Index best_deal_idx |
| catalogue ride-hailing | 0.30 | 66 | Subquery, Index best_deal_idx |
| catalogue installments | 2.32 | 1122 | Subquery, Index best_deal_idx |
| catalogue newest | 0.27 | 44 | Subquery, Index newest_idx |
| fuel plug_in_hybrid (0.02 %), best_deal | 0.17 | 10 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), best_deal | 0.11 | 9 | Subquery, Index fuel_idx |
| fuel hybrid (1.7 %), best_deal | 1.27 | 373 | Subquery, Index fuel_idx |
| fuel dual_fuel_factory (3 %), best_deal | 1.62 | 1149 | Subquery, Index best_deal_idx |
| gearbox automatic (16 %), best_deal | 0.29 | 158 | Subquery, Index best_deal_idx |
| body_type crossover (0.3 %), best_deal | 0.27 | 38 | Subquery, Index body_type_idx |
| body_type suv (4.7 %), best_deal | 0.68 | 448 | Subquery, Index best_deal_idx |
| colour purple (0.05 %), best_deal | 0.21 | 15 | Subquery, Index colour_family_idx |
| colour red (3 %), best_deal | 1.58 | 905 | Subquery, Index best_deal_idx |
| seller dealer (19 %), best_deal | 0.48 | 126 | Subquery, Index best_deal_idx |
| engine needs_repair (0.6 %), best_deal | 0.97 | 159 | Subquery, Index engine_condition_idx |
| chassis damaged (0.5 %), best_deal | 0.72 | 108 | Subquery, Index chassis_condition_idx |
| body_condition salvage (0.2 %), best_deal | 0.62 | 191 | Subquery, Index best_deal_idx |
| city scale-city-5 (0.04 %), best_deal | 0.30 | 37 | Subquery, Index city_best_deal_idx |
| model scale.three (4.7 %), best_deal | 1.04 | 448 | Subquery, Index best_deal_idx |
| model tiny.four (0.3 %), best_deal | 0.42 | 38 | Subquery, Index model_key_idx |
| make tiny (0.3 %), best_deal | 0.26 | 38 | Subquery, Index make_key_idx |
| make scale (99.7 %), best_deal | 0.12 | 27 | Subquery, Index best_deal_idx |
| trim scale.one.rare (0.1 %), best_deal | 0.13 | 10 | Subquery, Index trim_key_idx |
| trim scale.two.sport (30 %), best_deal | 1.12 | 564 | Subquery, Index best_deal_idx |
| district tehran.محله 79 (0.1 %), best_deal | 0.68 | 103 | Subquery, Bitmap Heap, Bitmap Index district_key_idx |
| district tehran.محله 40, best_deal | 1.00 | 179 | Subquery, Bitmap Heap, Bitmap Index district_key_idx |
| installments (2 %), best_deal | 2.64 | 1122 | Subquery, Index best_deal_idx |
| swap (10 %), best_deal | 0.81 | 268 | Subquery, Index best_deal_idx |
| paint_free (40 %), best_deal | 0.16 | 74 | Subquery, Index best_deal_idx |
| deal great, best_deal | 0.10 | 27 | Subquery, Index best_deal_idx |
| fuel electric + gearbox automatic, best_deal | 0.10 | 9 | Subquery, Index fuel_idx |
| price at most 400m + year from 1400, best_deal | 0.91 | 700 | Subquery, Index best_deal_idx |
| mileage under 50,000, best_deal | 0.26 | 128 | Subquery, Index best_deal_idx |
| fuel plug_in_hybrid (0.02 %), newest | 0.16 | 10 | Subquery, Index fuel_idx |
| fuel plug_in_hybrid (0.02 %), price_asc | 0.17 | 10 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), newest | 0.09 | 9 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), price_asc | 0.09 | 9 | Subquery, Index fuel_idx |
| words «خودرو» | 0.26 | 27 | Subquery, Index best_deal_idx |
| words «سالم» | 0.24 | 64 | Subquery, Index best_deal_idx |
| words «تمیز» | 0.61 | 154 | Subquery, Index best_deal_idx |
| words «سالم تمیز» | 0.36 | 154 | Subquery, Index best_deal_idx |
| words «خودروی 4» | 1.47 | 820 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, best_deal | 0.45 | 32 | Subquery, Index best_deal_idx |
| keyset page at 90 % depth, best_deal | 0.20 | 27 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, price_asc | 0.47 | 52 | Subquery, Index price_asc_idx, Index price_desc_idx |
| keyset page at 90 % depth, price_asc | 0.16 | 22 | Subquery, Index price_asc_idx |
| keyset page at 25 % depth, price_desc | 0.39 | 30 | Subquery, Index price_desc_idx |
| keyset page at 90 % depth, price_desc | 0.16 | 22 | Subquery, Index price_desc_idx |
| keyset page at 25 % depth, mileage_asc | 0.58 | 32 | Subquery, Index mileage_idx |
| keyset page at 90 % depth, mileage_asc | 0.63 | 42 | Subquery, Index mileage_idx |
| keyset page at 25 % depth, newest | 0.20 | 33 | Subquery, Index newest_idx |
| keyset page at 90 % depth, newest | 0.17 | 27 | Subquery, Index newest_idx |
| keyset page at 25 % depth, year_desc | 0.56 | 28 | Subquery, Index year_idx |
| keyset page at 90 % depth, year_desc | 0.37 | 34 | Subquery, Index year_idx |
| count, no filter beyond freshness | 0.96 | 447 | Seq |
| count, gearbox automatic | 5.95 | 2579 | Seq |
| count, fuel electric | 0.08 | 9 | Index fuel_idx |
| count, price at most 400m | 2.55 | 1460 | Index price_desc_idx |
| facets, gearbox automatic | 44.66 | 4489 | Seq, CTE |
| facets, fuel electric | 0.33 | 9 | Index fuel_idx, CTE |
| facets, price at most 400m | 40.50 | 3175 | Bitmap Heap, Bitmap Index price_desc_idx, CTE |
| facets, make scale + gearbox automatic | 59.66 | 8978 | Seq, CTE |
| facets, city scale-city-5 + gearbox manual | 41.92 | 4526 | Index city_best_deal_idx, CTE, Seq |
| facets, make + model + city + district | 19.51 | 2832 | Bitmap Heap, Bitmap Index district_key_idx, Bitmap Index model_key_idx, CTE, Index model_key_idx |
