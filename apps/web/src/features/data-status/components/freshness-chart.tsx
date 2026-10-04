import { formatDateTime } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';
import { formatHours, formatMinutes } from '@/features/data-status/data-status-format';
import { FRESHNESS_TARGETS } from '@/features/data-status/data-status-rules';
import type { FreshnessPoint } from '@/features/data-status/data-status-types';

// A source's hourly median time since each active listing was last seen or checked (CS-66), drawn by hand in inline
// SVG. The window runs from the first measurement of the last 48 hours to now, so a young index fills the chart
// instead of its last sixth, and the caption says where the measurements begin. The value axis has rounded ticks and
// a dashed line at one day, the results target, so the line reads against the promise. Time runs left to right as on
// every chart, even in a right-to-left page (ui.md: charts are never mirrored). Each point is a dot on the line, and
// every point is also in a table under the chart for anyone who cannot see it.

const WIDTH = 100;
const HEIGHT = 40;
const TARGET_MINUTES = FRESHNESS_TARGETS.resultsMedianMinutes;
const SIX_HOURS = 360;

/** The top of the value axis: above the highest point and the target, rounded up to six hours (a day past 48 hours). */
export function axisTopMinutes(highest: number): number {
  const step = highest > 2 * TARGET_MINUTES ? TARGET_MINUTES : SIX_HOURS;
  return Math.ceil((Math.max(highest, TARGET_MINUTES) * 1.15) / step) * step;
}

/** Ticks every 12 hours up to 48, then every day. */
export function axisTicks(top: number): number[] {
  const step = top > 2 * TARGET_MINUTES ? TARGET_MINUTES : 720;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top; tick += step) ticks.push(tick);
  return ticks;
}

function toY(minutes: number, top: number): number {
  return HEIGHT - (minutes / top) * HEIGHT;
}

function pathOf(
  points: readonly FreshnessPoint[],
  start: number,
  span: number,
  top: number,
  dots: boolean,
): string {
  const commands: string[] = [];
  let drawing = false;
  for (const point of points) {
    if (point.lastCheckMedianMinutes === null) {
      drawing = false;
      continue;
    }
    const x = span === 0 ? WIDTH : ((Date.parse(point.measuredAt) - start) / span) * WIDTH;
    const y = toY(point.lastCheckMedianMinutes, top);
    const at = `${x.toFixed(2)} ${y.toFixed(2)}`;
    // A zero-length segment with round caps draws a dot the size of the stroke.
    commands.push(dots ? `M${at} h0` : `${drawing ? 'L' : 'M'}${at}`);
    drawing = true;
  }
  return commands.join(' ');
}

export function FreshnessChart({ points, now }: { points: readonly FreshnessPoint[]; now: string }) {
  const window = formatHours(FRESHNESS_TARGETS.resultsWindowHours);
  if (points.length === 0)
    return <p className="text-secondary text-pretty text-muted">{STATUS_COPY.noChart(window)}</p>;
  const end = Date.parse(now);
  const windowStart = end - FRESHNESS_TARGETS.resultsWindowHours * 3_600_000;
  const first = Date.parse(points[0]?.measuredAt ?? now);
  const start = Math.max(windowStart, first);
  const fitted = first > windowStart;
  const top = axisTopMinutes(Math.max(0, ...points.map((point) => point.lastCheckMedianMinutes ?? 0)));
  /** How far up the axis a value sits, in percent of its height. */
  const height = (minutes: number) => (minutes / top) * 100;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <span className="text-label font-medium">{STATUS_COPY.chartTitle}</span>
        <span className="text-secondary text-pretty text-muted">
          {fitted ? STATUS_COPY.chartLeadSince : STATUS_COPY.chartLead(window)}
        </span>
      </figcaption>
      {/* Left to right: the value axis on the left, time running to the right. */}
      <div dir="ltr" className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-2 gap-y-1">
        <div className="relative h-32 w-16 min-w-0 text-meta text-muted">
          {axisTicks(top).map((tick) => (
            <span
              key={tick}
              dir="rtl"
              className="absolute inset-e-0 translate-y-1/2"
              style={{ insetBlockEnd: `${String(height(tick))}%` }}
            >
              {tick === 0 ? formatCount(0) : formatMinutes(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-32 min-w-0 border-s border-b border-control">
          {/* Hairlines at each tick above zero, and the day the results promise, dashed. */}
          {axisTicks(top)
            .filter((tick) => tick > 0 && tick !== TARGET_MINUTES)
            .map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="absolute inset-x-0 border-t border-divider"
                style={{ insetBlockEnd: `${String(height(tick))}%` }}
              />
            ))}
          <span
            aria-hidden
            className="absolute inset-x-0 border-t border-dashed border-control"
            style={{ insetBlockEnd: `${String(height(TARGET_MINUTES))}%` }}
          />
          <svg
            aria-hidden
            viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible text-default"
          >
            <path
              d={pathOf(points, start, end - start, top, false)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={pathOf(points, start, end - start, top, true)}
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="col-start-2 flex min-w-0 flex-wrap justify-between gap-x-4 text-meta text-muted">
          <time dateTime={new Date(start).toISOString()} dir="rtl">
            {STATUS_COPY.chartAgo(formatMinutes((end - start) / 60_000))}
          </time>
          <time dateTime={now} dir="rtl">
            {STATUS_COPY.chartNow}
          </time>
        </div>
      </div>
      <p className="flex items-center gap-2 text-meta text-muted">
        <span aria-hidden className="w-6 border-t border-dashed border-control" />
        {STATUS_COPY.chartTarget}
      </p>
      <details>
        <summary className="flex min-h-11 items-center text-control text-link">
          {STATUS_COPY.chartTable}
        </summary>
        {/* A table scrolls within its own box when its words cannot fit, never the page; no scrollbar, a fade where there is more (CS-112). */}
        <div className="scrollbar-none scroll-fade-inline overflow-x-auto">
          <table className="w-full text-secondary">
            <thead>
              <tr className="border-b border-divider">
                <th scope="col" className="py-2 pe-3 text-start text-label font-medium text-muted">
                  {STATUS_COPY.chartTime}
                </th>
                <th scope="col" className="px-3 py-2 text-end text-label font-medium text-muted">
                  {STATUS_COPY.chartActive}
                </th>
                <th scope="col" className="py-2 ps-3 text-end text-label font-medium text-muted">
                  {STATUS_COPY.chartAge}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {points.toReversed().map((point) => (
                <tr key={point.measuredAt}>
                  <th scope="row" className="py-2 pe-3 text-start font-normal">
                    <time dateTime={point.measuredAt}>{formatDateTime(point.measuredAt)}</time>
                  </th>
                  <td className="px-3 py-2 text-end tabular-nums">{formatCount(point.activeListings)}</td>
                  <td className="py-2 ps-3 text-end tabular-nums">
                    {point.lastCheckMedianMinutes === null
                      ? '—'
                      : formatMinutes(point.lastCheckMedianMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
