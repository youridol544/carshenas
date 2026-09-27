// Which Jalali implementations match the calendar Iran publishes, and for which Solar Hijri years?
//
// Reference, in order of authority:
// 1. The Calendar Center's published leap-year list (University of Tehran Geophysics Institute), 1206 to 1498 SH:
//    kabise-1206-1498.txt, Roozbeh Pournader's CC0 transcription of its PDF, one Nowruz date per year.
// 2. Outside that list, the Center's rule: Nowruz is the day of the March equinox if the equinox comes before true
//    (apparent) noon at the 52.5° E meridian, otherwise the next day. The equinox and the Sun's transit come from
//    astronomy-engine. The same computation with 12:00 Iran Standard Time instead of true noon is reported beside it,
//    because older code (Borkowski, jalaali-js) and some sources use 12:00.
// The reference calendar is built from the Nowruz dates alone (six months of 31 days, five of 30, Esfand 29 or 30),
// so it depends on no library. Each candidate is checked on every Nowruz (Jalali to Gregorian) and on every day
// (Gregorian to Jalali), which catches bugs that only show in one direction.
//
// Years: FIRST and LAST (default 1206 to 1501). Run with TZ=UTC (npm run accuracy) so libraries that use the
// process's local time zone cannot shift a day. Prints a summary and writes results-accuracy-node<major>.json and
// results-nowruz.json (the reference Nowruz of every year, for tests that pin a runtime's calendar).
import * as Astronomy from 'astronomy-engine';
import * as jalaali from 'jalaali-js';
import { CalendarDate, GregorianCalendar, PersianCalendar, toCalendar } from '@internationalized/date';
import { getDate as fnsDate, getMonth as fnsMonth, getYear as fnsYear, newDate as fnsNewDate } from 'date-fns-jalali';
import { Temporal as TemporalFc } from 'temporal-polyfill/full';
import { Temporal as TemporalTc39 } from '@js-temporal/polyfill';
import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import { readFileSync, writeFileSync } from 'node:fs';

dayjs.extend(jalaliday);

if (process.env.TZ !== 'UTC') {
  console.error('Run with TZ=UTC');
  process.exit(1);
}

const FIRST = Number(process.env.FIRST ?? 1206);
const LAST = Number(process.env.LAST ?? 1501);
const IRST_MS = 3.5 * 3600 * 1000;
const DAY_MS = 86400 * 1000;

const iso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const isoOfUtcDate = (date) => date.toISOString().slice(0, 10);

// ---- reference ----------------------------------------------------------------------------------------------------
const official = new Map(); // sh -> Nowruz ISO date, 1206 to 1498
for (const line of readFileSync(new URL('./kabise-1206-1498.txt', import.meta.url), 'utf8').split('\n')) {
  const match = /^(\d{4})\**\s+(\d{4}-\d{2}-\d{2})$/.exec(line.trim());
  if (match) official.set(Number(match[1]), match[2]);
}

const meridian = new Astronomy.Observer(35.7, 52.5, 0); // latitude barely changes the time of transit
const astronomical = new Map(); // sh -> { trueNoon, twelve, equinoxIrst, trueNoonIrst, minutesFromTrueNoon }
for (let sh = FIRST; sh <= LAST + 1; sh++) {
  const equinox = Astronomy.Seasons(sh + 621).mar_equinox.date; // UTC
  const local = new Date(equinox.getTime() + IRST_MS); // Iran Standard Time, read through the UTC getters
  const localDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const transit = Astronomy.SearchHourAngle(Astronomy.Body.Sun, meridian, 0, new Date(localDay - IRST_MS), +1).time.date;
  astronomical.set(sh, {
    trueNoon: isoOfUtcDate(new Date(equinox < transit ? localDay : localDay + DAY_MS)),
    twelve: isoOfUtcDate(new Date(local.getTime() - localDay < 12 * 3600 * 1000 ? localDay : localDay + DAY_MS)),
    equinoxIrst: local.toISOString().slice(0, 19).replace('T', ' '),
    trueNoonIrst: new Date(transit.getTime() + IRST_MS).toISOString().slice(11, 19),
    minutesFromTrueNoon: Math.round((equinox - transit) / 60000),
  });
}
const reference = (sh) => official.get(sh) ?? astronomical.get(sh).trueNoon;

// Gregorian instant (UTC midnight) -> "sh-month-day" from the reference Nowruz dates.
const nowruzMs = [];
for (let sh = FIRST; sh <= LAST + 1; sh++) nowruzMs.push([sh, Date.parse(reference(sh))]);
function referenceJalali(ms) {
  let lo = 0;
  let hi = nowruzMs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nowruzMs[mid][1] <= ms) lo = mid;
    else hi = mid - 1;
  }
  const [sh, start] = nowruzMs[lo];
  const dayOfYear = Math.round((ms - start) / DAY_MS);
  const month = dayOfYear < 186 ? Math.floor(dayOfYear / 31) + 1 : Math.floor((dayOfYear - 186) / 30) + 7;
  const day = dayOfYear < 186 ? (dayOfYear % 31) + 1 : ((dayOfYear - 186) % 30) + 1;
  return `${sh}-${month}-${day}`;
}

// ---- candidates ----------------------------------------------------------------------------------------------------
const gregorian = new GregorianCalendar();
const persian = new PersianCalendar();
const intlPersian = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
const intlParts = (date) => {
  const parts = Object.fromEntries(intlPersian.formatToParts(date).map((p) => [p.type, p.value]));
  return `${Number.parseInt(parts.year, 10)}-${Number(parts.month)}-${Number(parts.day)}`;
};
const nativeTemporal = globalThis.Temporal;
const runtime = `Node ${process.version}, ICU ${process.versions.icu}`;

// Each candidate converts both ways: toGregorian(sh) gives the ISO date of 1 Farvardin; toJalali(date) gives "sh-m-d".
const candidates = {
  'jalaali-js': {
    toGregorian: (sh) => {
      const g = jalaali.toGregorian(sh, 1, 1);
      return iso(g.gy, g.gm, g.gd);
    },
    toJalali: (date) => {
      const j = jalaali.toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      return `${j.jy}-${j.jm}-${j.jd}`;
    },
  },
  '@internationalized/date': {
    toGregorian: (sh) => toCalendar(new CalendarDate(persian, sh, 1, 1), gregorian).toString(),
    toJalali: (date) => {
      const d = toCalendar(new CalendarDate(gregorian, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()), persian);
      return `${d.year}-${d.month}-${d.day}`;
    },
  },
  'date-fns-jalali': {
    toGregorian: (sh) => isoOfUtcDate(fnsNewDate(sh, 0, 1)),
    toJalali: (date) => `${fnsYear(date)}-${fnsMonth(date) + 1}-${fnsDate(date)}`,
  },
  'dayjs + jalaliday': {
    toGregorian: (sh) => dayjs(`${sh}-01-01`, { jalali: true }).calendar('gregory').format('YYYY-MM-DD'),
    toJalali: (date) => {
      const j = dayjs(date).calendar('jalali');
      return `${j.year()}-${j.month() + 1}-${j.date()}`;
    },
  },
  [`Intl (${runtime})`]: {
    toGregorian: (sh) => {
      const guess = Date.parse(reference(sh));
      for (let delta = -3; delta <= 3; delta++) {
        const date = new Date(guess + delta * DAY_MS);
        if (intlParts(date) === `${sh}-1-1`) return isoOfUtcDate(date);
      }
      return 'not found';
    },
    toJalali: (date) => intlParts(date),
  },
  'temporal-polyfill (defers to a native Temporal)': {
    toGregorian: (sh) => TemporalFc.PlainDate.from({ year: sh, month: 1, day: 1, calendar: 'persian' }).withCalendar('iso8601').toString(),
    toJalali: (date) => {
      const d = TemporalFc.PlainDate.from(isoOfUtcDate(date)).withCalendar('persian');
      return `${d.year}-${d.month}-${d.day}`;
    },
  },
  '@js-temporal/polyfill (reads Intl)': {
    toGregorian: (sh) => TemporalTc39.PlainDate.from({ year: sh, month: 1, day: 1, calendar: 'persian' }).withCalendar('iso8601').toString(),
    toJalali: (date) => {
      const d = TemporalTc39.PlainDate.from(isoOfUtcDate(date)).withCalendar('persian');
      return `${d.year}-${d.month}-${d.day}`;
    },
  },
};
if (nativeTemporal !== undefined) {
  candidates[`Temporal (native, ${runtime})`] = {
    toGregorian: (sh) => nativeTemporal.PlainDate.from({ year: sh, month: 1, day: 1, calendar: 'persian' }).withCalendar('iso8601').toString(),
    toJalali: (date) => {
      const d = nativeTemporal.PlainDate.from(isoOfUtcDate(date)).withCalendar('persian');
      return `${d.year}-${d.month}-${d.day}`;
    },
  };
}

// ---- compare --------------------------------------------------------------------------------------------------------
const report = {
  runtime,
  tz: process.versions.tz,
  range: `${FIRST}-${LAST} SH`,
  officialYears: [...official.keys()].filter((sh) => sh >= FIRST && sh <= LAST).length,
  astronomyAgainstOfficial: [],
  twelveAgainstTrueNoon: [],
  closeCalls: [],
  candidates: {},
};
for (let sh = FIRST; sh <= LAST; sh++) {
  const a = astronomical.get(sh);
  if (official.has(sh) && official.get(sh) !== a.trueNoon) report.astronomyAgainstOfficial.push({ sh, official: official.get(sh), ...a });
  if (a.twelve !== a.trueNoon) report.twelveAgainstTrueNoon.push({ sh, ...a });
  if (Math.abs(a.minutesFromTrueNoon) <= 15) report.closeCalls.push({ sh, ...a });
}
const firstDay = Date.parse(reference(FIRST));
const endDay = Date.parse(reference(LAST + 1)); // exclusive
for (const [name, candidate] of Object.entries(candidates)) {
  const nowruz = [];
  for (let sh = FIRST; sh <= LAST; sh++) {
    const got = candidate.toGregorian(sh);
    if (got !== reference(sh)) nowruz.push({ sh, got, reference: reference(sh) });
  }
  const days = [];
  for (let t = firstDay; t < endDay; t += DAY_MS) {
    const date = new Date(t);
    const got = candidate.toJalali(date);
    const want = referenceJalali(t);
    if (got !== want) days.push({ date: isoOfUtcDate(date), got, reference: want });
  }
  report.candidates[name] = { nowruzMismatches: nowruz.length, nowruz: nowruz.slice(0, 10), dayMismatches: days.length, days: days.slice(0, 6) };
}
report.days = (endDay - firstDay) / DAY_MS;

const major = process.versions.node.split('.')[0];
writeFileSync(new URL(`./results-accuracy-node${major}.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
const table = {};
for (let sh = FIRST; sh <= LAST + 1; sh++) table[sh] = reference(sh);
writeFileSync(new URL('./results-nowruz.json', import.meta.url), JSON.stringify(table, null, 2) + '\n');

console.log(`Solar Hijri ${FIRST} to ${LAST} (${report.days} days), ${runtime}, tz ${process.versions.tz}`);
console.log(`  astronomy (true noon at 52.5° E) against the official list (${report.officialYears} years): ${report.astronomyAgainstOfficial.length} differences`);
console.log(`  12:00 against true noon: ${report.twelveAgainstTrueNoon.map((y) => y.sh).join(', ') || 'no difference'}`);
console.log(`  equinox within 15 minutes of true noon: ${report.closeCalls.map((y) => `${y.sh} (${y.minutesFromTrueNoon} min)`).join(', ') || 'none'}`);
for (const [name, result] of Object.entries(report.candidates)) {
  const years = result.nowruz.map((m) => m.sh).join(', ');
  const firstDays = result.days.slice(0, 2).map((d) => `${d.date} gave ${d.got}, not ${d.reference}`).join('; ');
  console.log(
    `  ${name.padEnd(52)} Nowruz: ${result.nowruzMismatches}${years ? ` (${years})` : ''}; days: ${result.dayMismatches}${firstDays ? ` (${firstDays})` : ''}`,
  );
}
