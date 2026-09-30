import { formatDateTime } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import type { FreshnessPoint } from '@/features/admin/server/pipeline-queries';
import { formatAgeMinutes } from '@/features/admin/worker-format';

// A source's hourly freshness over the chart's span (CS-41 criterion 4; the owner's decision: new and gone listings
// and the median time since the last check, from freshness_measurement, drawn by hand in inline SVG). Two small charts
// on one time axis, because counts and minutes do not share a scale. Time runs left to right as on every chart, even
// in a right-to-left page (ui.md: charts are never mirrored), so each frame is set left to right. Colour carries
// nothing: the two count lines differ by solid and dashed, in the text's own neutrals; the axes are drawn at the
// control border's 3:1; a series at zero is drawn just above its axis, never on it. Every hourly point is also in a
// table under the charts, for anyone who cannot see them.

type Props = { points: readonly FreshnessPoint[]; chartHours: number; now: string; label: string };

const WIDTH = 100;
const HEIGHT = 40;
/** The room kept under the lowest value and over the highest, in view-box units, so a line never merges with an axis. */
const PAD = 2;

type Series = { values: readonly (number | null)[]; dashed: boolean; tone: 'default' | 'muted' };

function path(
  times: readonly number[],
  values: readonly (number | null)[],
  start: number,
  span: number,
  top: number,
) {
  const commands: string[] = [];
  let drawing = false;
  values.forEach((value, index) => {
    const time = times[index];
    if (value === null || time === undefined) {
      drawing = false;
      return;
    }
    const x = ((time - start) / span) * WIDTH;
    const y = HEIGHT - PAD - (top === 0 ? 0 : (value / top) * (HEIGHT - 2 * PAD));
    commands.push(`${drawing ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
    drawing = true;
  });
  return commands.join(' ');
}

function Plot({
  times,
  series,
  start,
  end,
  formatValue,
  title,
}: {
  times: readonly number[];
  series: readonly Series[];
  start: number;
  end: number;
  /** A value in the series' own unit, for the axis labels. */
  formatValue: (value: number) => string;
  title: string;
}) {
  const top = Math.max(0, ...series.flatMap((line) => line.values.filter((value) => value !== null)));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta text-muted">{title}</span>
      {/* Left to right: the value axis on the left, time running to the right. */}
      <div dir="ltr" className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        {/* The value axis's labels span the plot's height only, top and bottom. */}
        <div className="flex h-24 flex-col justify-between text-meta text-muted tabular-nums">
          <span dir="rtl">{formatValue(top)}</span>
          <span dir="rtl">{formatValue(0)}</span>
        </div>
        <svg
          aria-hidden
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          className="h-24 w-full min-w-0 border-s border-b border-control"
        >
          {series.map((line) => (
            <path
              key={`${line.tone}-${line.dashed ? 'dashed' : 'solid'}`}
              d={path(times, line.values, start, end - start, top)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={line.dashed ? '4 3' : undefined}
              vectorEffect="non-scaling-stroke"
              className={line.tone === 'default' ? 'text-default' : 'text-muted'}
            />
          ))}
        </svg>
        <div className="col-start-2 flex justify-between gap-4 text-meta text-muted">
          <time dateTime={new Date(start).toISOString()} dir="rtl">
            {formatDateTime(new Date(start))}
          </time>
          <time dateTime={new Date(end).toISOString()} dir="rtl">
            {formatDateTime(new Date(end))}
          </time>
        </div>
      </div>
    </div>
  );
}

function Swatch({ dashed, tone }: { dashed: boolean; tone: 'default' | 'muted' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 4"
      className={`h-1 w-6 ${tone === 'default' ? 'text-default' : 'text-muted'}`}
    >
      <path
        d="M0 2 H24"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashed ? '4 3' : undefined}
      />
    </svg>
  );
}

export function FreshnessChart({ points, chartHours, now, label }: Props) {
  if (points.length === 0)
    return <p className="text-secondary text-pretty text-muted">{WORKER_COPY.noChart}</p>;
  const end = Date.parse(now);
  const start = end - chartHours * 3_600_000;
  const times = points.map((point) => Date.parse(point.measuredAt));
  const age = (minutes: number | null) =>
    minutes === null ? WORKER_COPY.noActive : formatAgeMinutes(minutes);
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-1">
        <span className="text-control font-semibold">{label}</span>
        <span className="text-secondary text-pretty text-muted">{WORKER_COPY.chartLead}</span>
      </figcaption>
      <ul className="flex flex-wrap gap-4 text-meta text-muted">
        <li className="flex items-center gap-2">
          <Swatch dashed={false} tone="default" />
          {WORKER_COPY.chartAdded}
        </li>
        <li className="flex items-center gap-2">
          <Swatch dashed tone="muted" />
          {WORKER_COPY.chartGone}
        </li>
      </ul>
      <Plot
        title={`${WORKER_COPY.chartAdded}، ${WORKER_COPY.chartGone}`}
        times={times}
        start={start}
        end={end}
        formatValue={formatCount}
        series={[
          { values: points.map((point) => point.added), dashed: false, tone: 'default' },
          { values: points.map((point) => point.gone), dashed: true, tone: 'muted' },
        ]}
      />
      <Plot
        title={WORKER_COPY.chartAge}
        times={times}
        start={start}
        end={end}
        formatValue={formatAgeMinutes}
        series={[
          { values: points.map((point) => point.lastCheckMedianMinutes), dashed: false, tone: 'default' },
        ]}
      />
      <details>
        <summary className="flex min-h-11 items-center text-control text-link">
          {WORKER_COPY.chartTable}
        </summary>
        <table className="w-full text-secondary">
          <thead>
            <tr className="border-b border-divider">
              <th scope="col" className="py-2 pe-3 text-start text-label font-medium text-muted">
                {WORKER_COPY.chartTime}
              </th>
              <th scope="col" className="px-3 py-2 text-end text-label font-medium text-muted">
                {WORKER_COPY.chartAdded}
              </th>
              <th scope="col" className="px-3 py-2 text-end text-label font-medium text-muted">
                {WORKER_COPY.chartGone}
              </th>
              <th scope="col" className="py-2 ps-3 text-end text-label font-medium text-muted">
                {WORKER_COPY.chartAge}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {points.toReversed().map((point) => (
              <tr key={point.measuredAt}>
                <th scope="row" className="py-2 pe-3 text-start font-normal">
                  <time dateTime={point.measuredAt}>{formatDateTime(point.measuredAt)}</time>
                </th>
                <td className="px-3 py-2 text-end tabular-nums">{formatCount(point.added)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{formatCount(point.gone)}</td>
                <td className="py-2 ps-3 text-end tabular-nums">{age(point.lastCheckMedianMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
