Table: 99989 rows.
| Query | ms | buffers | scans |
|---|---|---|---|
| all, first page, best_deal | 0.23 | 28 | Subquery, Index best_deal_idx |
| all, first page, price_asc | 0.30 | 44 | Subquery, Index price_asc_idx |
| all, first page, price_desc | 0.15 | 28 | Subquery, Index price_desc_idx |
| all, first page, mileage_asc | 0.23 | 46 | Subquery, Index mileage_idx |
| all, first page, newest | 0.14 | 28 | Subquery, Index newest_idx |
| all, first page, year_desc | 0.24 | 28 | Subquery, Index year_idx |
| catalogue karshenas-pick | 0.31 | 75 | Subquery, Index best_deal_idx |
| catalogue great-deals-under-1b | 0.21 | 53 | Subquery, Index best_deal_idx |
| catalogue clean-and-easy | 0.53 | 103 | Subquery, Index best_deal_idx |
| catalogue family | 0.76 | 185 | Subquery, Index best_deal_idx |
| catalogue low-mileage | 0.29 | 41 | Subquery, Index best_deal_idx |
| catalogue automatic | 0.54 | 173 | Subquery, Index best_deal_idx |
| catalogue ride-hailing | 0.31 | 82 | Subquery, Index best_deal_idx |
| catalogue installments | 2.92 | 1210 | Subquery, Index best_deal_idx |
| catalogue newest | 0.15 | 28 | Subquery, Index newest_idx |
| fuel plug_in_hybrid (0.02 %), best_deal | 0.32 | 29 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), best_deal | 0.48 | 58 | Subquery, Index fuel_idx |
| fuel hybrid (1.7 %), best_deal | 3.00 | 1464 | Subquery, Index best_deal_idx |
| fuel dual_fuel_factory (3 %), best_deal | 2.86 | 927 | Subquery, Index best_deal_idx |
| gearbox automatic (16 %), best_deal | 0.64 | 173 | Subquery, Index best_deal_idx |
| body_type crossover (0.3 %), best_deal | 1.70 | 395 | Subquery, Index body_type_idx |
| body_type suv (4.7 %), best_deal | 1.81 | 554 | Subquery, Index best_deal_idx |
| colour purple (0.05 %), best_deal | 0.57 | 65 | Subquery, Index colour_family_idx |
| colour red (3 %), best_deal | 2.58 | 874 | Subquery, Index best_deal_idx |
| seller dealer (19 %), best_deal | 0.53 | 139 | Subquery, Index best_deal_idx |
| engine needs_repair (0.6 %), best_deal | 2.54 | 1067 | Subquery, Index engine_condition_idx |
| chassis damaged (0.5 %), best_deal | 2.44 | 848 | Subquery, Index chassis_condition_idx |
| body_condition salvage (0.2 %), best_deal | 0.75 | 226 | Subquery, Index best_deal_idx |
| city scale-city-5 (0.04 %), best_deal | 0.63 | 113 | Subquery, Index city_best_deal_idx |
| model scale.three (4.7 %), best_deal | 1.32 | 554 | Subquery, Index best_deal_idx |
| model tiny.four (0.3 %), best_deal | 1.72 | 395 | Subquery, Index model_key_idx |
| make tiny (0.3 %), best_deal | 1.78 | 395 | Subquery, Index make_key_idx |
| make scale (99.7 %), best_deal | 0.18 | 28 | Subquery, Index best_deal_idx |
| trim scale.one.rare (0.1 %), best_deal | 0.36 | 48 | Subquery, Index trim_key_idx |
| trim scale.two.sport (30 %), best_deal | 1.04 | 443 | Subquery, Index best_deal_idx |
| district tehran.محله 79 (0.1 %), best_deal | 2.71 | 736 | Subquery, Index district_key_idx |
| district tehran.محله 40, best_deal | 5.79 | 1119 | Subquery, Bitmap Heap, Bitmap Index district_key_idx |
| installments (2 %), best_deal | 2.21 | 1210 | Subquery, Index best_deal_idx |
| swap (10 %), best_deal | 0.62 | 242 | Subquery, Index best_deal_idx |
| paint_free (40 %), best_deal | 0.29 | 57 | Subquery, Index best_deal_idx |
| deal great, best_deal | 0.16 | 28 | Subquery, Index best_deal_idx |
| fuel electric + gearbox automatic, best_deal | 0.30 | 58 | Subquery, Index fuel_idx |
| price at most 400m + year from 1400, best_deal | 1.22 | 661 | Subquery, Index best_deal_idx |
| mileage under 50,000, best_deal | 0.20 | 59 | Subquery, Index best_deal_idx |
| fuel plug_in_hybrid (0.02 %), newest | 0.18 | 29 | Subquery, Index fuel_idx |
| fuel plug_in_hybrid (0.02 %), price_asc | 0.19 | 29 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), newest | 0.38 | 58 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), price_asc | 0.26 | 58 | Subquery, Index fuel_idx |
| words «خودرو» | 0.20 | 28 | Subquery, Index best_deal_idx |
| words «سالم» | 0.28 | 67 | Subquery, Index best_deal_idx |
| words «تمیز» | 0.38 | 122 | Subquery, Index best_deal_idx |
| words «سالم تمیز» | 0.44 | 122 | Subquery, Index best_deal_idx |
| words «خودروی 4» | 1.40 | 590 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, best_deal | 0.79 | 36 | Subquery, Index best_deal_idx |
| keyset page at 90 % depth, best_deal | 0.27 | 28 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, price_asc | 0.65 | 55 | Subquery, Index price_asc_idx, Index price_desc_idx |
| keyset page at 90 % depth, price_asc | 0.17 | 28 | Subquery, Index price_asc_idx |
| keyset page at 25 % depth, price_desc | 0.42 | 51 | Subquery, Index price_desc_idx |
| keyset page at 90 % depth, price_desc | 0.39 | 40 | Subquery, Index price_desc_idx |
| keyset page at 25 % depth, mileage_asc | 0.69 | 35 | Subquery, Index mileage_idx |
| keyset page at 90 % depth, mileage_asc | 0.71 | 34 | Subquery, Index mileage_idx |
| keyset page at 25 % depth, newest | 0.31 | 45 | Subquery, Index newest_idx |
| keyset page at 90 % depth, newest | 0.17 | 30 | Subquery, Index newest_idx |
| keyset page at 25 % depth, year_desc | 0.32 | 31 | Subquery, Index year_idx |
| keyset page at 90 % depth, year_desc | 0.61 | 40 | Subquery, Index year_idx |
| count, no filter beyond freshness | 1.17 | 444 | Seq |
| count, gearbox automatic | 7.51 | 2651 | Seq |
| count, fuel electric | 0.20 | 58 | Index fuel_idx |
| count, price at most 400m | 3.56 | 1010 | Index price_desc_idx |
| facets, gearbox automatic | 123.68 | 17987 | Seq, CTE |
| facets, fuel electric | 0.39 | 58 | Index fuel_idx, CTE |
| facets, price at most 400m | 95.30 | 12920 | Bitmap Heap, Bitmap Index price_desc_idx, CTE |
| facets, make scale + gearbox automatic | 194.26 | 35974 | Seq, CTE |
| facets, city scale-city-5 + gearbox manual | 80.97 | 18116 | Index city_best_deal_idx, CTE, Seq |
| facets, make + model + city + district | 74.89 | 19133 | Bitmap Heap, Bitmap Index district_key_idx, CTE, Index model_key_idx |
