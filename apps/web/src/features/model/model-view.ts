import { toPersianDigits } from '@carshenas/locale/digits';
import { formatDate, formatDayMonth } from '@carshenas/locale/format-date';
import { formatMileage, formatPercent } from '@carshenas/locale/format-number';
import {
  formatTomanCompact,
  formatTomanEstimate,
  formatTomanEstimateRange,
  toToman,
} from '@carshenas/locale/toman';
import { MODEL_COPY } from '@/features/model/model-copy';
import {
  CHANGE_TOLERANCE_DAYS,
  CHANGE_WINDOWS_DAYS,
  TREND_DAILY_UNTIL_DAYS,
  TREND_MIN_LISTINGS,
  TREND_MIN_POINTS,
} from '@/features/model/model-rules';
import type { TrendDay, YearRow } from '@/features/model/model-types';

// What the model page draws, worked out from the database's plain numbers (CS-67): the trend's points and their
// geometry, the changes, the by-year bars. Pure functions, so the rules (when a point exists, when a change is stated,
// where a dot sits) are tested without a browser. Every number a buyer sees comes from the rows; this file only
// chooses which to show and where.

const DAY_MS = 86_400_000;

export const price = (toman: number | null): string | null =>
  toman === null ? null : formatTomanEstimate(toToman(toman));

export const priceRange = (low: number | null, high: number | null): string | null =>
  low === null || high === null || low > high ? null : formatTomanEstimateRange(toToman(low), toToman(high));

export const yearText = (year: number): string => toPersianDigits(String(year));

export const mileageText = (km: number | null): string | null => (km === null ? null : formatMileage(km));

// Dates.

function utcOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Whole days from one ISO day to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / DAY_MS);
}

/** The Saturday that starts the week an ISO day is in (a week starts on Saturday in Iran). */
export function weekStart(iso: string): string {
  const at = new Date(utcOf(iso));
  const sinceSaturday = (at.getUTCDay() + 1) % 7;
  return new Date(at.getTime() - sinceSaturday * DAY_MS).toISOString().slice(0, 10);
}

// The trend.

export type TrendPoint = TrendDay & {
  /** Where it sits in the chart, in percent of the plot's width from the left, and of its height from the top. */
  readonly x: number;
  readonly yMedian: number;
  readonly yLow: number;
  readonly yHigh: number;
  readonly dateText: string;
};

export type ChartGeometry = {
  /** The path of the median, in the plot's 0 to 100 box. */
  readonly line: string;
  /** The band between the low and high prices, as a closed path. */
  readonly band: string;
  readonly yTicks: readonly { readonly y: number; readonly label: string }[];
  readonly xTicks: readonly { readonly x: number; readonly label: string }[];
  readonly points: readonly TrendPoint[];
};

export type Change = {
  readonly days: number;
  /** The share the median moved by, 0.03 for three percent up; null when the history does not reach that far back. */
  readonly ratio: number | null;
};

export type TrendView = {
  readonly status: 'none' | 'short' | 'ready';
  readonly granularity: 'day' | 'week';
  /** The days with enough listings, oldest first, before any weekly choice: the table lists these. */
  readonly days: readonly TrendDay[];
  /** The days or weeks drawn. */
  readonly drawn: readonly TrendDay[];
  readonly spanDays: number;
  readonly changes: readonly Change[];
  readonly chart: ChartGeometry | null;
};

/** Days with too few listings are not points: a median of three cars says nothing about a market. */
export function eligibleDays(days: readonly TrendDay[]): TrendDay[] {
  return days.filter((day) => day.count >= TREND_MIN_LISTINGS).sort((a, b) => a.date.localeCompare(b.date));
}

/** The last day of each Saturday-week that has one. */
export function weeklyPoints(days: readonly TrendDay[]): TrendDay[] {
  const lastOfWeek = new Map<string, TrendDay>();
  for (const day of days) lastOfWeek.set(weekStart(day.date), day);
  return [...lastOfWeek.values()];
}

/** How the median moved over each window, from the point nearest to «that many days before the latest». */
export function changesOver(days: readonly TrendDay[]): Change[] {
  const latest = days.at(-1);
  return CHANGE_WINDOWS_DAYS.map((window) => {
    if (latest === undefined) return { days: window, ratio: null };
    let nearest: TrendDay | undefined;
    let nearestOff = Number.POSITIVE_INFINITY;
    for (const day of days) {
      if (day.date === latest.date) continue;
      const off = Math.abs(daysBetween(day.date, latest.date) - window);
      if (off < nearestOff) {
        nearest = day;
        nearestOff = off;
      }
    }
    if (nearest === undefined || nearestOff > CHANGE_TOLERANCE_DAYS || nearest.medianToman <= 0) {
      return { days: window, ratio: null };
    }
    return { days: window, ratio: latest.medianToman / nearest.medianToman - 1 };
  });
}

/** A round step for an axis: 1, 2, 2.5 or 5 times a power of ten that is at least `raw`. */
export function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const factor = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return factor * power;
}

const X_INSET = 4;
const X_SPAN = 100 - 2 * X_INSET;
const MAX_X_LABELS = 4;
const AXIS_TICKS = 3;

function geometryOf(drawn: readonly TrendDay[]): ChartGeometry {
  const low = Math.min(...drawn.map((day) => day.lowToman));
  const high = Math.max(...drawn.map((day) => day.highToman));
  const step = niceStep(Math.max(high - low, high * 0.02) / AXIS_TICKS);
  const bottom = Math.floor(low / step) * step;
  const top = Math.max(Math.ceil(high / step) * step, bottom + step);
  const y = (value: number) => ((top - value) / (top - bottom)) * 100;
  const first = drawn[0]?.date ?? '';
  const span = Math.max(daysBetween(first, drawn.at(-1)?.date ?? first), 1);
  const x = (date: string) =>
    drawn.length === 1 ? 50 : X_INSET + (daysBetween(first, date) / span) * X_SPAN;
  const points = drawn.map((day): TrendPoint => ({
    ...day,
    x: x(day.date),
    yMedian: y(day.medianToman),
    yLow: y(day.lowToman),
    yHigh: y(day.highToman),
    dateText: formatDayMonth(day.date),
  }));
  const at = (value: number) => value.toFixed(2);
  const line = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${at(point.x)} ${at(point.yMedian)}`)
    .join(' ');
  const band = [
    ...points.map((point, i) => `${i === 0 ? 'M' : 'L'}${at(point.x)} ${at(point.yHigh)}`),
    ...[...points].reverse().map((point) => `L${at(point.x)} ${at(point.yLow)}`),
    'Z',
  ].join(' ');
  const yTicks: { y: number; label: string }[] = [];
  for (let value = bottom; value <= top + step / 1000; value += step) {
    yTicks.push({ y: y(value), label: formatTomanCompact(toToman(Math.round(value))) });
  }
  // Labels on the points' own dates, at most MAX_X_LABELS, the first and the last always among them.
  const every = Math.max(1, Math.ceil((points.length - 1) / (MAX_X_LABELS - 1)));
  const xTicks = points
    .filter((_, i) => i === points.length - 1 || i % every === 0)
    .filter(
      (point, i, kept) =>
        i === kept.length - 1 || kept[i + 1] === undefined || (kept[i + 1]?.x ?? 0) - point.x >= 18,
    )
    .map((point) => ({ x: point.x, label: point.dateText }));
  return { line, band, yTicks, xTicks, points };
}

export function trendView(days: readonly TrendDay[]): TrendView {
  const eligible = eligibleDays(days);
  const first = eligible[0];
  const last = eligible.at(-1);
  const spanDays = first === undefined || last === undefined ? 0 : daysBetween(first.date, last.date);
  const granularity = spanDays <= TREND_DAILY_UNTIL_DAYS ? 'day' : 'week';
  const drawn = granularity === 'day' ? eligible : weeklyPoints(eligible);
  const status = drawn.length >= TREND_MIN_POINTS ? 'ready' : drawn.length > 0 ? 'short' : 'none';
  return {
    status,
    granularity,
    days: eligible,
    drawn,
    spanDays,
    changes: changesOver(eligible),
    chart: status === 'ready' ? geometryOf(drawn) : null,
  };
}

/** The sentence a screen reader gets for the chart: what it shows and where the median went. */
export function chartLabel(view: TrendView, cohort: string): string | null {
  const first = view.drawn[0];
  const last = view.drawn.at(-1);
  if (first === undefined || last === undefined || view.chart === null) return null;
  return MODEL_COPY.trend.chartLabel(
    cohort,
    formatDate(first.date),
    formatDate(last.date),
    price(first.medianToman) ?? '',
    price(last.medianToman) ?? '',
  );
}

export type ChangeText = {
  readonly tone: 'rise' | 'fall' | 'flat';
  /** «+۳٪», «−۵٪» with the sign always printed; the words say the direction too. */
  readonly figure: string | null;
  readonly words: string;
};

/** A change as a buyer reads it: a rise is bad news and a fall good, the sign is always printed (teardown 33). */
export function changeText(ratio: number): ChangeText {
  const whole = Math.round(Math.abs(ratio) * 100);
  if (whole === 0) return { tone: 'flat', figure: null, words: MODEL_COPY.trend.change.flat };
  const rising = ratio > 0;
  return {
    tone: rising ? 'rise' : 'fall',
    figure: `${rising ? '+' : '−'}${formatPercent(whole / 100)}`,
    words: rising ? MODEL_COPY.trend.change.rise : MODEL_COPY.trend.change.fall,
  };
}

// The model year the trend is drawn for when the buyer has not chosen: the year with the most listings, the newer
// one among equals.
export function modalYear(years: readonly YearRow[]): number | null {
  let best: YearRow | undefined;
  for (const row of years) {
    if (best === undefined || row.count > best.count || (row.count === best.count && row.year > best.year)) {
      best = row;
    }
  }
  return best?.year ?? null;
}

/** Each year's median as a share of the highest median, for the bars of the by-year table. */
export function yearBars(years: readonly YearRow[]): { row: YearRow; share: number }[] {
  const top = Math.max(0, ...years.map((row) => row.medianToman ?? 0));
  return years.map((row) => ({
    row,
    share: top === 0 || row.medianToman === null ? 0 : row.medianToman / top,
  }));
}

/** A share of listings that state a fact, only when enough state it for the share to mean something. */
export function factShare(fact: { of: number; yes: number }): number | null {
  return fact.of >= TREND_MIN_LISTINGS ? fact.yes / fact.of : null;
}
