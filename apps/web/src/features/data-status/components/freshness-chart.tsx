import { formatDateTime } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { STATUS_COPY } from '@/features/data-status/data-status-copy';
import { formatHours, formatMinutes } from '@/features/data-status/data-status-format';
import { FRESHNESS_TARGETS } from '@/features/data-status/data-status-rules';
import type { FreshnessPoint } from '@/features/data-status/data-status-types';

// A source's hourly median time since each active listing was last seen or checked, over the results window (CS-66),
// drawn by hand in inline SVG as the superadmin's freshness chart is. Time runs left to right as on every chart, even in
// a right-to-left page (ui.md: charts are never mirrored), so the frame is set left to right. One line in the text's
// own colour, axes at the control border's 3:1; each point is also in a table under the chart for anyone who cannot
// see it.

const WIDTH = 100;
const HEIGHT = 40;
/** Room under the lowest value and over the highest, in view-box units, so the line never merges with an axis. */
const PAD = 2;

function linePath(points: readonly FreshnessPoint[], start: number, span: number, top: number): string {
  const commands: string[] = [];
  let drawing = false;
  for (const point of points) {
    if (point.lastCheckMedianMinutes === null) {
      drawing = false;
      continue;
    }
    const x = ((Date.parse(point.measuredAt) - start) / span) * WIDTH;
    const y = HEIGHT - PAD - (top === 0 ? 0 : (point.lastCheckMedianMinutes / top) * (HEIGHT - 2 * PAD));
    // A subpath starts with a zero-length segment, so a lone point still draws a round dot.
    commands.push(drawing ? `L${x.toFixed(2)} ${y.toFixed(2)}` : `M${x.toFixed(2)} ${y.toFixed(2)} h0`);
    drawing = true;
  }
  return commands.join(' ');
}

export function FreshnessChart({ points, now }: { points: readonly FreshnessPoint[]; now: string }) {
  const window = formatHours(FRESHNESS_TARGETS.resultsWindowHours);
  if (points.length === 0)
    return <p className="text-secondary text-pretty text-muted">{STATUS_COPY.noChart(window)}</p>;
  const end = Date.parse(now);
  const start = end - FRESHNESS_TARGETS.resultsWindowHours * 3_600_000;
  const top = Math.max(0, ...points.map((point) => point.lastCheckMedianMinutes ?? 0));
  // A single measurement is a dot, not a line.
  const single = points.filter((point) => point.lastCheckMedianMinutes !== null).length === 1;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <span className="text-label font-medium">{STATUS_COPY.chartTitle}</span>
        <span className="text-secondary text-pretty text-muted">{STATUS_COPY.chartLead(window)}</span>
      </figcaption>
      {/* Left to right: the value axis on the left, time running to the right. */}
      <div dir="ltr" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
        <div className="flex h-24 flex-col justify-between text-meta text-muted tabular-nums">
          <span dir="rtl">{formatMinutes(top)}</span>
          <span dir="rtl">{formatMinutes(0)}</span>
        </div>
        <svg
          aria-hidden
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          className="h-24 w-full min-w-0 border-s border-b border-control text-default"
        >
          <path
            d={linePath(points, start, end - start, top)}
            fill="none"
            stroke="currentColor"
            strokeWidth={single ? 4 : 1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="col-start-2 flex justify-between gap-4 text-meta text-muted">
          <time dateTime={new Date(start).toISOString()} dir="rtl">
            {formatDateTime(new Date(start))}
          </time>
          <time dateTime={now} dir="rtl">
            {formatDateTime(now)}
          </time>
        </div>
      </div>
      <details>
        <summary className="flex min-h-11 items-center text-control text-link">
          {STATUS_COPY.chartTable}
        </summary>
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
                  {point.lastCheckMedianMinutes === null ? '—' : formatMinutes(point.lastCheckMedianMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
