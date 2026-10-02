Table: 24996 rows.
| Query | ms | buffers | scans |
|---|---|---|---|
| all, first page, best_deal | 0.16 | 27 | Subquery, Index best_deal_idx |
| all, first page, price_asc | 0.14 | 44 | Subquery, Index price_asc_idx |
| all, first page, price_desc | 0.11 | 27 | Subquery, Index price_desc_idx |
| all, first page, mileage_asc | 0.16 | 45 | Subquery, Index mileage_idx |
| all, first page, newest | 0.15 | 44 | Subquery, Index newest_idx |
| all, first page, year_desc | 0.11 | 28 | Subquery, Index year_idx |
| catalogue karshenas-pick | 0.21 | 97 | Subquery, Index best_deal_idx |
| catalogue great-deals-under-1b | 0.15 | 51 | Subquery, Index best_deal_idx |
| catalogue clean-and-easy | 0.37 | 155 | Subquery, Index best_deal_idx |
| catalogue family | 0.23 | 99 | Subquery, Index best_deal_idx |
| catalogue low-mileage | 0.16 | 68 | Subquery, Index best_deal_idx |
| catalogue automatic | 0.29 | 158 | Subquery, Index best_deal_idx |
| catalogue ride-hailing | 0.20 | 66 | Subquery, Index best_deal_idx |
| catalogue installments | 1.40 | 1122 | Subquery, Index best_deal_idx |
| catalogue newest | 0.15 | 44 | Subquery, Index newest_idx |
| fuel plug_in_hybrid (0.02 %), best_deal | 17.29 | 4489 | Subquery, Seq |
| fuel electric (0.05 %), best_deal | 20.18 | 4489 | Subquery, Seq |
| fuel hybrid (1.7 %), best_deal | 2.52 | 1500 | Subquery, Index best_deal_idx |
| fuel dual_fuel_factory (3 %), best_deal | 1.73 | 1149 | Subquery, Index best_deal_idx |
| gearbox automatic (16 %), best_deal | 0.39 | 158 | Subquery, Index best_deal_idx |
| body_type crossover (0.3 %), best_deal | 9.70 | 7698 | Subquery, Index best_deal_idx |
| body_type suv (4.7 %), best_deal | 0.62 | 448 | Subquery, Index best_deal_idx |
| colour purple (0.05 %), best_deal | 15.78 | 4489 | Subquery, Seq |
| colour red (3 %), best_deal | 1.27 | 905 | Subquery, Index best_deal_idx |
| seller dealer (19 %), best_deal | 0.25 | 126 | Subquery, Index best_deal_idx |
| engine needs_repair (0.6 %), best_deal | 6.55 | 4284 | Subquery, Index best_deal_idx |
| chassis damaged (0.5 %), best_deal | 11.66 | 5870 | Subquery, Index best_deal_idx |
| body_condition salvage (0.2 %), best_deal | 0.56 | 191 | Subquery, Index best_deal_idx |
| city scale-city-5 (0.04 %), best_deal | 0.30 | 37 | Subquery, Index city_best_deal_idx |
| model scale.three (4.7 %), best_deal | 0.57 | 448 | Subquery, Index best_deal_idx |
| model tiny.four (0.3 %), best_deal | 9.91 | 7698 | Subquery, Index best_deal_idx |
| make tiny (0.3 %), best_deal | 10.07 | 7698 | Subquery, Index best_deal_idx |
| make scale (99.7 %), best_deal | 0.11 | 27 | Subquery, Index best_deal_idx |
| trim scale.one.rare (0.1 %), best_deal | 12.99 | 4489 | Subquery, Seq |
| trim scale.two.sport (30 %), best_deal | 0.87 | 564 | Subquery, Index best_deal_idx |
| district tehran.محله 79 (0.1 %), best_deal | 10.00 | 6072 | Subquery, Index best_deal_idx |
| district tehran.محله 40, best_deal | 9.37 | 5063 | Subquery, Index best_deal_idx |
| installments (2 %), best_deal | 2.03 | 1122 | Subquery, Index best_deal_idx |
| swap (10 %), best_deal | 0.52 | 268 | Subquery, Index best_deal_idx |
| paint_free (40 %), best_deal | 0.19 | 74 | Subquery, Index best_deal_idx |
| deal great, best_deal | 0.12 | 27 | Subquery, Index best_deal_idx |
| fuel electric + gearbox automatic, best_deal | 22.70 | 4489 | Subquery, Seq |
| price at most 400m + year from 1400, best_deal | 1.66 | 700 | Subquery, Index best_deal_idx |
| mileage under 50,000, best_deal | 0.42 | 128 | Subquery, Index best_deal_idx |
| fuel plug_in_hybrid (0.02 %), newest | 28.86 | 4489 | Subquery, Seq |
| fuel plug_in_hybrid (0.02 %), price_asc | 22.13 | 4489 | Subquery, Seq |
| fuel electric (0.05 %), newest | 16.92 | 4489 | Subquery, Seq |
| fuel electric (0.05 %), price_asc | 16.73 | 4489 | Subquery, Seq |
| words «خودرو» | 0.18 | 27 | Subquery, Index best_deal_idx |
| words «سالم» | 0.26 | 64 | Subquery, Index best_deal_idx |
| words «تمیز» | 0.37 | 154 | Subquery, Index best_deal_idx |
| words «سالم تمیز» | 0.39 | 154 | Subquery, Index best_deal_idx |
| words «خودروی 4» | 1.55 | 820 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, best_deal | 0.51 | 32 | Subquery, Index best_deal_idx |
| keyset page at 90 % depth, best_deal | 0.17 | 27 | Subquery, Index best_deal_idx |
| keyset page at 25 % depth, price_asc | 0.46 | 52 | Subquery, Index price_asc_idx, Index price_desc_idx |
| keyset page at 90 % depth, price_asc | 0.13 | 22 | Subquery, Index price_asc_idx |
| keyset page at 25 % depth, price_desc | 0.36 | 30 | Subquery, Index price_desc_idx |
| keyset page at 90 % depth, price_desc | 0.13 | 22 | Subquery, Index price_desc_idx |
| keyset page at 25 % depth, mileage_asc | 0.43 | 32 | Subquery, Index mileage_idx |
| keyset page at 90 % depth, mileage_asc | 0.50 | 42 | Subquery, Index mileage_idx |
| keyset page at 25 % depth, newest | 0.13 | 33 | Subquery, Index newest_idx |
| keyset page at 90 % depth, newest | 0.12 | 27 | Subquery, Index newest_idx |
| keyset page at 25 % depth, year_desc | 0.44 | 28 | Subquery, Index year_idx |
| keyset page at 90 % depth, year_desc | 0.31 | 34 | Subquery, Index year_idx |
| count, no filter beyond freshness | 0.88 | 447 | Seq |
| count, gearbox automatic | 6.65 | 2579 | Seq |
| count, fuel electric | 19.89 | 4489 | Seq |
| count, price at most 400m | 3.59 | 1460 | Index price_desc_idx |
| facets, gearbox automatic | 48.17 | 4489 | Seq, CTE |
| facets, fuel electric | 25.44 | 4489 | Seq, CTE |
| facets, price at most 400m | 35.80 | 3175 | Bitmap Heap, Bitmap Index price_desc_idx, CTE |
| facets, make scale + gearbox automatic | 59.75 | 8978 | Seq, CTE |
| facets, city scale-city-5 + gearbox manual | 27.96 | 4526 | Index city_best_deal_idx, CTE, Seq |
| facets, make + model + city + district | 129.65 | 22445 | Seq, CTE |
