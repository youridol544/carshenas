# Calendar and formatting lab (CS-2)

The scripts behind the measured findings in `../../2026-09-27-money-and-jalali-calendar.md`:

- whether each Jalali implementation matches the calendar Iran publishes;
- what the platform's `Intl` prints for Persian amounts and dates in Node and in the repository's pinned Chromium.

Rerun them with the next change that touches the calendar: CS-3's formatting utility, the first date input, or a Node or browser upgrade.

## Run

```bash
cd docs/research/2026-09-27-money-and-jalali-calendar/lab
npm install --no-package-lock     # the versions pinned in package.json; node_modules/ is ignored by git
npm run accuracy                  # TZ=UTC; years 1206 to 1501 by default
TZ=UTC FIRST=1206 LAST=1800 node jalali-accuracy.mjs
npm run platform                  # Node and headless Chromium through the repository's pinned Playwright (e2e/)
```

To compare Node versions without installing them, run `TZ=UTC npx -y -p node@26 node jalali-accuracy.mjs`.

## Files

| File | What it is | Writes |
|---|---|---|
| `kabise-1206-1498.txt` | The Calendar Center's published leap years with the Gregorian date of each Nowruz, 1206 to 1498 SH. It is Roozbeh Pournader's CC0 transcription (github.com/roozbehp/persiancalendar) of the University of Tehran Geophysics Institute's PDF. | — |
| `jalali-accuracy.mjs` | See the next section. | `results-accuracy-node<major>.json`; `results-nowruz.json`, the reference Nowruz of every year, which a test can pin a runtime against |
| `platform-check.mjs` | The same probe in Node and in Chromium. Amounts: `fa-IR` grouping, compact notation and its rounding, ranges, percent, the `IRR` currency style and `NaN`. Dates: styles, parts, ranges, relative time and week info. Also the `Asia/Tehran` offset in 2021, 2022, 2023 and 2026, native `Temporal`, the Gregorian date of every Nowruz from 1300 to 1501, and the Jalali date of every day from 1206 to 1501. | `results-platform.json` |

### What `jalali-accuracy.mjs` does

1. **Builds a reference calendar.** It takes Nowruz from the official list. Outside the list it uses the Center's rule: the day of the March equinox if the equinox comes before true noon at 52.5° E, else the next day. The equinox and the Sun's transit come from astronomy-engine.
2. **Checks the astronomy.** It reports where the astronomy disagrees with the official list, and where a 12:00 rule would disagree with the true-noon rule.
3. **Checks every candidate in both directions:** 1 Farvardin to a Gregorian date for every year, and every Gregorian day to a Jalali date. The candidates are:
   - `jalaali-js`
   - `@internationalized/date`
   - `date-fns-jalali`
   - `dayjs` with `jalaliday`
   - the runtime's `Intl`
   - `temporal-polyfill`
   - `@js-temporal/polyfill`
   - native `Temporal`, when the runtime has it

## Results on 2026-09-27

### Years 1206 to 1501 (108,111 days)

On Node 22.14.0 (ICU 76.1, tz 2024b) and Node 26.10.0 (ICU 78.3, tz 2026c):

- **The astronomy is sound.** The true-noon computation matches the official list in all 293 years.
- **Every candidate but one is right on every day.** Every candidate except `jalaliday` matches every Nowruz and every day; on Node 26 that includes native `Temporal`.
- **`jalaliday` 3.1.1 is wrong in one direction.** Its Jalali-to-Gregorian conversion is right, but its Gregorian-to-Jalali conversion is wrong on 4,320 days: every 1 January to 29 February of a Gregorian leap year comes out one day ahead. For example, 2028-01-01 gives 1406/10/12 instead of 1406/10/11.

### Years 1206 to 1800

The implementations first part on 2124-03-20: the reference says 1 Farvardin 1503, because the equinox comes about three minutes before true noon. After that, each family fails in different years.

| Implementation | Where it differs from the reference |
|---|---|
| The 33-year rule: `@internationalized/date`, `date-fns-jalali`, ICU 76, and both polyfills on Node 22 | 1503, 1635, 1668, 1701, 1734, 1767, 1800 |
| `jalaali-js` | 1503 only |
| ICU 78 (Node 26), native `Temporal`, and both polyfills on Node 26 | 1602 only, where the equinox falls within a minute of true noon |

So ICU 76 and ICU 78 disagree from 2124-03-20 on: a runtime upgrade can move dates.

### Chromium 153 (Playwright 1.63)

Chromium gives the same Jalali date as Node for all 108,111 days from 1 Farvardin 1206 to the end of 1501, and the same Nowruz for every year from 1300 to 1501. It prints amounts and dates exactly as Node 22 does; only the week info (Chromium omits `minimalDays`) and native `Temporal` differ. Node's `Intl` matches the Calendar Center day by day (`jalali-accuracy.mjs`), so Chromium does too.

### Supported range

1206 SH to 29 Esfand 1502 SH (1827-03-22 to 2124-03-19) is the range where every implementation measured except `jalaliday`, on the two ICU versions measured (76.1 and 78.3), agrees with the official calendar. The database keeps model years within 1300 to 1500.
