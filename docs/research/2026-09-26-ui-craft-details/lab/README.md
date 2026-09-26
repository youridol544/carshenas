# Font measurement lab (CS-26)

The scripts that produced the font-dependent numbers in `../typography.md` and `../visual.md`: Persian line heights, clipping, label centring, `text-box` trimming, vertical metrics and icon-stroke stems. CS-3 reruns them against the font it chooses and records the results in `docs/design/design-language.md`. Everything runs on the repository's pinned Playwright (headless Chromium), resolved through `e2e/`; nothing is installed.

## Fonts

Downloaded into this folder (ignored by git), with the same layout the scripts expect:

```bash
cd docs/research/2026-09-26-ui-craft-details/lab
curl -sLO https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/vazirmatn-v33.003.zip && unzip -q vazirmatn-v33.003.zip -d vazirmatn
curl -sLO https://github.com/aminabedi68/Estedad/releases/download/8.5/Estedad-v8.5.zip && unzip -q Estedad-v8.5.zip -d estedad
```

`common.js` names the files (`FONTS`) and serves them to the page under unique family names, so a font installed on the machine cannot stand in for the file. To measure another font, add it to `FONTS`.

## Scripts

| Script | Measures | Used for |
|---|---|---|
| `node lab-equiv.js` | the Persian line height that leaves the same white space between lines as Latin gets at its reference value, per size | the reading-text and heading values (typography M4) |
| `node lab-clip.js` | ink cut off under `overflow: hidden` per font, weight, size and line height, for ordinary text and the stress string «تأیید آگهی؛ پراید غ» | the 1.3 and 1.5 floors for controls and clamped text (M3); writes `results-clip.json` |
| `node lab-button.js` | where eight real labels sit in 48, 44 and 28 px flex-centred buttons across line heights | centring with the box, not with line height (M17); writes `results-button.json` |
| `node lab-trim.js` | ink outside the box under `text-box: trim-both` with each edge pair | why `cap alphabetic` trimming is not used on Persian (T-6) |
| `node lab-stem.js` | the alef stem per weight as a share of the font size | icon strokes matched to their label (V-2) |
| `python3 metrics.py <font.ttf>…` | hhea, typo and win metrics, `USE_TYPO_METRICS`, features and scripts (needs fontTools) | vertical-metrics checks (M1, T-7) |

Measured on 2026-09-26 with `lab-stem.js`: Vazirmatn 33.003 stems are 8.25 % of the font size at weight 400, 10.40 % at 500, 11.33 % at 600 and 12.23 % at 700; Estedad 8.5 is 7.86 %, 9.59 %, 11.30 % and 13.23 %.
