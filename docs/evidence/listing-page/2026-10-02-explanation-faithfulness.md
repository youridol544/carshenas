# Explanation faithfulness on a labelled sample (CS-64)

- Date: 2026-10-02
- Method: for each sampled listing the page's explanation is built from the listing page's data (`readListingPage`, as the page reads it) and every number it quotes (a **figure**, recorded with its source by `buildExplanation`) is recomputed in SQL from the stored rows (`expectedFigures`, sharing no code with the explanation), and the text the page displays for it is compared with the text the recomputed values must be written as. A **sentence** is faithful when every group of digits in it is the text of a figure that was recomputed and matched.
- Sample: 30 listings of the latest succeeded valuation run: four of each rating and three of price_outlier, three of installment_price and four of dealer_new_car, ordered by a hash of the listing id. The explanations are made by templates from stored facts, with no language model.

- Listings whose every figure matched and every sentence is faithful: 30 of 30 (100.0 %)
- Sentences faithful: 281 of 281 (100.0 %)
- Figures recorded: 474; recomputed from the stored rows and matched: 471; a rule's own constant, read back from its home by `listing-page-data.db.test.ts`: 3

| Listing | Rating or reason | Figures | Recomputed | Faithful sentences | Faithful |
|---|---|---|---|---|---|
| 37532 | great | 18 | 18 | 9 / 9 | yes |
| 3125 | great | 19 | 19 | 10 / 10 | yes |
| 195 | great | 18 | 18 | 9 / 9 | yes |
| 39188 | great | 18 | 18 | 9 / 9 | yes |
| 4612 | good | 15 | 15 | 9 / 9 | yes |
| 3492 | good | 18 | 18 | 9 / 9 | yes |
| 39178 | good | 19 | 19 | 10 / 10 | yes |
| 348 | good | 19 | 19 | 10 / 10 | yes |
| 4897 | fair | 15 | 15 | 9 / 9 | yes |
| 11980 | fair | 19 | 19 | 10 / 10 | yes |
| 4713 | fair | 19 | 19 | 10 / 10 | yes |
| 3373 | fair | 19 | 19 | 10 / 10 | yes |
| 12959 | high | 18 | 18 | 9 / 9 | yes |
| 4745 | high | 15 | 15 | 9 / 9 | yes |
| 2419 | high | 15 | 15 | 9 / 9 | yes |
| 40973 | high | 19 | 19 | 10 / 10 | yes |
| 80971 | overpriced | 18 | 18 | 9 / 9 | yes |
| 1707 | overpriced | 18 | 18 | 9 / 9 | yes |
| 81390 | overpriced | 19 | 19 | 10 / 10 | yes |
| 1428 | overpriced | 15 | 15 | 9 / 9 | yes |
| 2259 | installment_price | 10 | 10 | 9 / 9 | yes |
| 1680 | installment_price | 13 | 13 | 9 / 9 | yes |
| 668 | installment_price | 13 | 13 | 9 / 9 | yes |
| 5515 | price_outlier | 14 | 13 | 9 / 9 | yes |
| 81225 | price_outlier | 16 | 15 | 11 / 11 | yes |
| 4029 | price_outlier | 14 | 13 | 9 / 9 | yes |
| 5329 | dealer_new_car | 10 | 10 | 9 / 9 | yes |
| 1970 | dealer_new_car | 11 | 11 | 10 / 10 | yes |
| 8878 | dealer_new_car | 10 | 10 | 9 / 9 | yes |
| 1994 | dealer_new_car | 10 | 10 | 9 / 9 | yes |
