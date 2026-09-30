import { formatDateTime } from '@carshenas/locale/format-date';
import { formatCount } from '@carshenas/locale/format-number';
import { WORKER_COPY } from '@/features/admin/admin-copy';
import type { FreshnessPoint } from '@/features/admin/server/pipeline-queries';
import { formatAgeMinutes } from '@/features/admin/worker-format';

// A source's hourly freshness over the chart's span (CS-41 criterion 4; the owner's decision: new and gone listings
// and the median time since the last check, from freshness_measurement, drawn by hand in inline SVG). Two small charts
// on one time axis, because counts and minutes do not share a scale. Time runs left to right as on every chart, even
// in a right-to-left page (ui.md: charts are never mirrored), so the frame is set left to right. Colour carries
// nothing: the two count lines differ by solid and dashed, in the text's own neutrals, and the latest values are
// written out under the charts for anyone who cannot see them.

type Props = { points: readonly FreshnessPoint[]; chartHours: number; now: string; label: string };

const WIDTH = 100;
const HEIGHT = 40;

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
    const y = HEIGHT - (top === 0 ? 0 : (value / top) * HEIGHT);
    commands.push(`${drawing ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
    drawing = true;
  });
  return commands.join(' ');
}

function Plot({
  times,
  series,
  start,
  span,
  formatTop,
}: {
  times: readonly number[];
  series: readonly Series[];
  start: number;
  span: number;
  /** The value at the top of the frame, in the series' own unit. */
  formatTop: (top: number) => string;
}) {
  const top = Math.max(0, ...series.flatMap((line) => line.values.filter((value) => value !== null)));
  return (
    <div className="flex flex-col gap-1">
      <span dir="rtl" className="self-start text-meta text-muted tabular-nums">
        {formatTop(top)}
      </span>
      <svg
        aria-hidden
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-24 w-full border-s border-b border-divider"
      >
        {series.map((line) => (
          <path
            key={`${line.tone}-${line.dashed ? 'dashed' : 'solid'}`}
            d={path(times, line.values, start, span, top)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={line.dashed ? '4 3' : undefined}
            vectorEffect="non-scaling-stroke"
            className={line.tone === 'default' ? 'text-default' : 'text-muted'}
          />
        ))}
      </svg>
    </div>
  );
}

export function FreshnessChart({ points, chartHours, now, label }: Props) {
  if (points.length === 0)
    return <p className="text-secondary text-pretty text-muted">{WORKER_COPY.noChart}</p>;
  const end = Date.parse(now);
  const span = chartHours * 3_600_000;
  const start = end - span;
  const times = points.map((point) => Date.parse(point.measuredAt));
  const latest = points.at(-1);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <span className="text-control font-semibold">{label}</span>
        <span className="text-secondary text-pretty text-muted">{WORKER_COPY.chartLead}</span>
      </figcaption>
      <ul className="flex flex-wrap gap-4 text-meta text-muted">
        <li className="flex items-center gap-2">
          <svg aria-hidden viewBox="0 0 24 4" className="h-1 w-6 text-default">
            <path d="M0 2 H24" stroke="currentColor" strokeWidth={1.5} />
          </svg>
          {WORKER_COPY.chartAdded}
        </li>
        <li className="flex items-center gap-2">
          <svg aria-hidden viewBox="0 0 24 4" className="h-1 w-6 text-muted">
            <path d="M0 2 H24" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" />
          </svg>
          {WORKER_COPY.chartGone}
        </li>
      </ul>
      {/* Time runs left to right: the frame is left to right, its labels read as Persian inside it. */}
      <div dir="ltr" className="flex flex-col gap-4">
        <Plot
          times={times}
          start={start}
          span={span}
          formatTop={formatCount}
          series={[
            { values: points.map((point) => point.added), dashed: false, tone: 'default' },
            { values: points.map((point) => point.gone), dashed: true, tone: 'muted' },
          ]}
        />
        <div dir="rtl" className="text-meta text-muted">
          {WORKER_COPY.chartAge}
        </div>
        <Plot
          times={times}
          start={start}
          span={span}
          formatTop={formatAgeMinutes}
          series={[
            {
              values: points.map((point) => point.lastCheckMedianMinutes),
              dashed: false,
              tone: 'default',
            },
          ]}
        />
        <div className="flex justify-between gap-4 text-meta text-muted">
          <time dateTime={new Date(start).toISOString()} dir="rtl">
            {formatDateTime(new Date(start))}
          </time>
          <time dateTime={now} dir="rtl">
            {formatDateTime(now)}
          </time>
        </div>
      </div>
      {latest === undefined ? null : (
        <p className="text-secondary text-pretty">
          {`${formatDateTime(latest.measuredAt)}: ${WORKER_COPY.chartAdded} ${formatCount(latest.added)}، ${WORKER_COPY.chartGone} ${formatCount(latest.gone)}، ${WORKER_COPY.chartAge} ${latest.lastCheckMedianMinutes === null ? '—' : formatAgeMinutes(latest.lastCheckMedianMinutes)}`}
        </p>
      )}
    </figure>
  );
}
