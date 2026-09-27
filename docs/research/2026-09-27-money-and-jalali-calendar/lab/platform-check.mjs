// What the platform itself does with Persian amounts and Jalali dates, in Node and in the repository's pinned
// Chromium: grouping, compact notation, rounding, date styles, week info, the Asia/Tehran offset before and after
// Iran dropped daylight saving time, native Temporal, the Gregorian date of every Nowruz from 1300 to 1501, and the
// Jalali date of every day from 1 Farvardin 1206 to 29 Esfand 1501 (1827-03-22 to 2123-03-20). jalali-accuracy.mjs
// checks Node's Intl against the Calendar Center's list day by day, so Chromium matching Node proves Chromium too.
import { createRequire } from 'node:module';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

// The repository's pinned Playwright, resolved through the e2e package (docs/research/<note>/lab → repo root).
const REPO = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(REPO, 'e2e')] }));

// Runs unchanged in both places, so it must not close over anything.
function probe() {
  const amounts = [750000, 12500000, 850000000, 999999999, 1000000000, 1049000000, 1250000000, 1249000000, 1990000000, 12500000000, 250000000000, 9007199254740991];
  const nf = (options) => new Intl.NumberFormat('fa-IR', options);
  const out = { runtime: typeof navigator === 'undefined' ? 'node' : navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] };
  out.numberingSystem = nf().resolvedOptions().numberingSystem;
  out.plain = Object.fromEntries(amounts.map((n) => [n, nf().format(n)]));
  out.bigint = nf().format(9007199254740993n);
  out.compactShort = Object.fromEntries(amounts.map((n) => [n, nf({ notation: 'compact' }).format(n)]));
  out.compactLong = Object.fromEntries(amounts.map((n) => [n, nf({ notation: 'compact', compactDisplay: 'long' }).format(n)]));
  out.compactTwoDecimalsTrunc = Object.fromEntries(
    amounts.map((n) => [n, nf({ notation: 'compact', maximumFractionDigits: 2, roundingMode: 'trunc' }).format(n)]),
  );
  out.compactRange = nf({ notation: 'compact' }).formatRange(1100000000, 1300000000);
  out.plainRange = nf().formatRange(1100000000, 1300000000);
  out.percent = nf({ style: 'percent', maximumFractionDigits: 1 }).format(-0.123);
  out.signedPercent = nf({ style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(-0.123);
  out.irrCurrency = nf({ style: 'currency', currency: 'IRR' }).format(12500000);
  out.nan = nf().format(Number.NaN);

  const instant = new Date('2026-09-27T12:00:00Z');
  const df = (options) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', ...options });
  out.dateCalendar = df().resolvedOptions().calendar;
  out.dateLong = df({ dateStyle: 'long' }).format(instant);
  out.dateFull = df({ dateStyle: 'full' }).format(instant);
  out.dateMedium = df({ dateStyle: 'medium' }).format(instant);
  out.dateShort = df({ dateStyle: 'short' }).format(instant);
  out.dateNumeric2 = df({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  out.dateWeekdayParts = df({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .formatToParts(instant)
    .map((p) => `${p.type}:${p.value}`)
    .join('|');
  out.timeShort = df({ timeStyle: 'short' }).format(instant);
  out.dateTimeShort = df({ dateStyle: 'long', timeStyle: 'short' }).format(instant);
  out.dateRange = df({ dateStyle: 'long' }).formatRange(instant, new Date('2026-10-02T12:00:00Z'));
  out.monthYear = df({ month: 'long', year: 'numeric' }).format(instant);
  out.relative = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' }).format(-3, 'day');
  out.relativeYesterday = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' }).format(-1, 'day');
  const locale = new Intl.Locale('fa-IR');
  out.weekInfo = JSON.stringify(locale.getWeekInfo?.() ?? locale.weekInfo ?? null);
  // Iran observed daylight saving time until 2022 (UTC+04:30 in summer), then stayed on UTC+03:30.
  const tehranClock = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(new Date(iso));
  out.tehranNoonUtc2021June = tehranClock('2021-06-01T12:00:00Z');
  out.tehranNoonUtc2022June = tehranClock('2022-06-01T12:00:00Z');
  out.tehranNoonUtc2023June = tehranClock('2023-06-01T12:00:00Z');
  out.tehranNoonUtc2026June = tehranClock('2026-06-01T12:00:00Z');
  out.nativeTemporal = typeof globalThis.Temporal;
  if (typeof globalThis.Temporal !== 'undefined') {
    const d = globalThis.Temporal.PlainDate.from({ year: 1405, month: 7, day: 5, calendar: 'persian' });
    out.nativeTemporalPersian = `${d.toString()} daysInMonth=${d.daysInMonth} inLeapYear=${d.inLeapYear}`;
    out.nativeTemporalEsfand1403 = globalThis.Temporal.PlainDate.from({ year: 1403, month: 12, day: 1, calendar: 'persian' }).daysInMonth;
  }

  // Gregorian date of 1 Farvardin for each year, as this runtime's Intl sees it.
  const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
  const nowruz = {};
  const DAY = 86400000;
  for (let sh = 1300; sh <= 1501; sh++) {
    const guess = Date.UTC(sh + 621, 2, 21);
    for (let delta = -3; delta <= 3; delta++) {
      const date = new Date(guess + delta * DAY);
      const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
      if (Number.parseInt(parts.year, 10) === sh && parts.month === '1' && parts.day === '1') nowruz[sh] = date.toISOString().slice(0, 10);
    }
  }
  out.nowruz = nowruz;
  const days = [];
  for (let t = Date.UTC(1827, 2, 22); t < Date.UTC(2123, 2, 21); t += DAY) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    days.push(`${Number.parseInt(parts.year, 10)}-${parts.month}-${parts.day}`);
  }
  out.days = days;
  return out;
}

const node = probe();
const browser = await chromium.launch();
const page = await browser.newPage();
const chrome = await page.evaluate(`(${probe.toString()})()`);
await browser.close();

const differences = {};
for (const key of Object.keys(node)) {
  if (key === 'nowruz' || key === 'days' || key === 'runtime') continue;
  const a = JSON.stringify(node[key]);
  const b = JSON.stringify(chrome[key]);
  if (a !== b) differences[key] = { node: node[key], chrome: chrome[key] };
}
let nowruzDisagreements = 0;
for (let sh = 1300; sh <= 1501; sh++) if (node.nowruz[sh] !== chrome.nowruz[sh]) nowruzDisagreements++;
let dayDisagreements = 0;
for (let i = 0; i < node.days.length; i++) if (node.days[i] !== chrome.days[i]) dayDisagreements++;
const result = {
  node: { version: process.version, icu: process.versions.icu, tz: process.versions.tz, ...node, nowruz: undefined, days: undefined },
  chrome: chrome.runtime,
  differences,
  nowruzYears: Object.keys(chrome.nowruz).length,
  nowruzDisagreements,
  days: node.days.length,
  dayDisagreements,
};
writeFileSync(new URL('./results-platform.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(
  `Node ${process.version} (ICU ${process.versions.icu}) against ${chrome.runtime}: ${Object.keys(differences).length} differing outputs ` +
    `(${Object.keys(differences).join(', ') || 'none'}); Nowruz ${nowruzDisagreements} of ${result.nowruzYears} years; ` +
    `days ${dayDisagreements} of ${result.days}. Full output in results-platform.json.`,
);
