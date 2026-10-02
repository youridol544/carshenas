Table: 3008 rows.
| Query | ms | buffers | scans |
|---|---|---|---|
| all, first page, best_deal | 0.11 | 27 | Subquery, Index best_deal_idx |
| all, first page, price_asc | 0.11 | 27 | Subquery, Index price_asc_idx |
| all, first page, price_desc | 0.11 | 27 | Subquery, Index price_desc_idx |
| all, first page, mileage_asc | 0.10 | 25 | Subquery, Index mileage_idx |
| all, first page, newest | 0.10 | 17 | Subquery, Index newest_idx |
| all, first page, year_desc | 0.10 | 25 | Subquery, Index year_idx |
| catalogue karshenas-pick | 0.18 | 65 | Subquery, Index best_deal_idx |
| catalogue great-deals-under-1b | 1.13 | 452 | Subquery, Bitmap Heap, Bitmap Index price_desc_idx |
| catalogue clean-and-easy | 0.33 | 148 | Subquery, Index best_deal_idx |
| catalogue family | 0.23 | 113 | Subquery, Index best_deal_idx |
| catalogue low-mileage | 0.21 | 97 | Subquery, Index best_deal_idx |
| catalogue automatic | 0.57 | 197 | Subquery, Index best_deal_idx |
| catalogue ride-hailing | 0.16 | 59 | Subquery, Index best_deal_idx |
| catalogue installments | 0.37 | 277 | Subquery, Index best_deal_idx |
| catalogue newest | 0.05 | 2 | Subquery, Index newest_idx |
| fuel plug_in_hybrid (0.02 %), best_deal | 0.07 | 3 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), best_deal | 0.08 | 4 | Subquery, Index fuel_idx |
| fuel hybrid (1.7 %), best_deal | 0.25 | 46 | Subquery, Index fuel_idx |
| fuel dual_fuel_factory (3 %), best_deal | 0.28 | 75 | Subquery, Index fuel_idx |
| gearbox automatic (16 %), best_deal | 0.28 | 197 | Subquery, Index best_deal_idx |
| body_type crossover (0.3 %), best_deal | 0.23 | 43 | Subquery, Index body_type_idx |
| body_type suv (4.7 %), best_deal | 0.06 | 2 | Subquery, Index body_type_idx |
| colour purple (0.05 %), best_deal | 0.15 | 24 | Subquery, Index colour_family_idx |
| colour red (3 %), best_deal | 0.22 | 44 | Subquery, Index colour_family_idx |
| seller dealer (19 %), best_deal | 0.95 | 770 | Subquery, Index best_deal_idx |
| engine needs_repair (0.6 %), best_deal | 0.14 | 20 | Subquery, Index engine_condition_idx |
| chassis damaged (0.5 %), best_deal | 0.12 | 15 | Subquery, Index chassis_condition_idx |
| body_condition salvage (0.2 %), best_deal | 0.13 | 44 | Subquery, Index best_deal_idx |
| city scale-city-5 (0.04 %), best_deal | 0.07 | 2 | Subquery, Index city_best_deal_idx |
| model scale.three (4.7 %), best_deal | 0.07 | 2 | Subquery, Index model_key_idx |
| model tiny.four (0.3 %), best_deal | 0.07 | 2 | Subquery, Index model_key_idx |
| make tiny (0.3 %), best_deal | 0.07 | 2 | Subquery, Index make_key_idx |
| make scale (99.7 %), best_deal | 0.06 | 2 | Subquery, Index make_key_idx |
| trim scale.one.rare (0.1 %), best_deal | 0.07 | 2 | Subquery, Index trim_key_idx |
| trim scale.two.sport (30 %), best_deal | 0.07 | 2 | Subquery, Index trim_key_idx |
| district tehran.محله 79 (0.1 %), best_deal | 0.07 | 2 | Subquery, Index district_key_idx |
| district tehran.محله 40, best_deal | 0.06 | 2 | Subquery, Index district_key_idx |
| installments (2 %), best_deal | 0.37 | 277 | Subquery, Index best_deal_idx |
| swap (10 %), best_deal | 0.28 | 205 | Subquery, Index best_deal_idx |
| paint_free (40 %), best_deal | 0.14 | 54 | Subquery, Index best_deal_idx |
| deal great, best_deal | 0.12 | 27 | Subquery, Index best_deal_idx |
| fuel electric + gearbox automatic, best_deal | 0.09 | 4 | Subquery, Index fuel_idx |
| price at most 400m + year from 1400, best_deal | 0.37 | 22 | Subquery, Bitmap Heap, Bitmap Index price_desc_idx, Bitmap Index year_idx |
| mileage under 50,000, best_deal | 0.24 | 136 | Subquery, Index best_deal_idx |
| fuel plug_in_hybrid (0.02 %), newest | 0.08 | 3 | Subquery, Index fuel_idx |
| fuel plug_in_hybrid (0.02 %), price_asc | 0.08 | 3 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), newest | 0.08 | 4 | Subquery, Index fuel_idx |
| fuel electric (0.05 %), price_asc | 0.08 | 4 | Subquery, Index fuel_idx |
| words «خودرو» | 1.45 | 803 | Subquery, Index best_deal_idx |
| words «سالم» | 1.27 | 733 | Subquery, Index best_deal_idx |
| words «تمیز» | 2.67 | 210 | Subquery, Bitmap Heap, Bitmap Index text_idx |
| words «سالم تمیز» | 4.23 | 176 | Subquery, Bitmap Heap, Bitmap Index text_idx |
| words «خودروی 4» | 3.56 | 172 | Subquery, Bitmap Heap, Bitmap Index text_idx |
| keyset page at 25 % depth, best_deal | 0.20 | 21 | Subquery, Index best_deal_idx |
| keyset page at 90 % depth, best_deal | 0.18 | 27 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, price_asc | 0.47 | 32 | Subquery, Index price_asc_idx, Index price_desc_idx |
| keyset page at 90 % depth, price_asc | 0.43 | 32 | Subquery, Index price_asc_idx, Index price_desc_idx |
| keyset page at 25 % depth, price_desc | 0.34 | 31 | Subquery, Index price_desc_idx |
| keyset page at 90 % depth, price_desc | 0.30 | 30 | Subquery, Index price_desc_idx |
| keyset page at 25 % depth, mileage_asc | 0.36 | 32 | Subquery, Index mileage_idx |
| keyset page at 90 % depth, mileage_asc | 0.38 | 32 | Subquery, Index mileage_idx |
| keyset page at 25 % depth, newest | 0.13 | 21 | Subquery, Index newest_idx |
| keyset page at 90 % depth, newest | 0.16 | 27 | Subquery, Index newest_idx |
| keyset page at 25 % depth, year_desc | 0.31 | 27 | Subquery, Index year_idx |
| keyset page at 90 % depth, year_desc | 0.33 | 26 | Subquery, Index year_idx |
| count, no filter beyond freshness | 1.20 | 201 | Seq |
| count, gearbox automatic | 2.41 | 602 | Seq |
| count, fuel electric | 0.07 | 4 | Index fuel_idx |
| count, price at most 400m | 0.12 | 37 | Index price_desc_idx |
| facets, gearbox automatic | 5.80 | 602 | Seq, CTE |
| facets, fuel electric | 0.21 | 4 | Index fuel_idx, CTE |
| facets, price at most 400m | 0.41 | 37 | Index price_desc_idx, CTE |
| facets, make scale + gearbox automatic | 2.00 | 604 | Index make_key_idx, CTE, Seq |
| facets, city scale-city-5 + gearbox manual | 2.95 | 604 | Index city_best_deal_idx, CTE, Seq |
| facets, make + model + city + district | 0.34 | 10 | Index make_key_idx, CTE, Index model_key_idx |
