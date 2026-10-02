import type { ChartGeometry } from '@/features/model/model-view';

// The price trend drawn (CS-67): a line for the median, a band for the middle half of the prices, a dot for each day
// or week. Time runs left to right and the plot does not mirror: Material's guidance keeps charts and graphs left to
// right in a right-to-left interface, and a time axis that ran the other way would read the history backwards for
// anyone used to charts. The wrapper says so with `dir="ltr"`; every label is its own right-to-left run, so a Persian
// number and its scale word keep their order.
//
// The lines and the band are one SVG stretched over the plot (a 0 to 100 box with a non-scaling stroke); the dots,
// the axis labels and the gridline names are HTML placed by percentage, so the text stays the size of the page's own
// text at every width instead of shrinking with the drawing. It is all server markup, with no script. The chart is a
// picture for the eyes (role img, with a label that says where the median went); the same numbers are in the table
// under it (trend-table.tsx), which is its text alternative.

export function TrendChart({ chart, label }: { chart: ChartGeometry; label: string }) {
  return (
    <div dir="ltr" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div aria-hidden="true" className="relative my-3 w-20 sm:w-24">
        {chart.yTicks.map((tick) => (
          <span
            key={tick.label}
            style={{ insetBlockStart: `${String(tick.y)}%` }}
            className="absolute inset-s-0 flex w-full -translate-y-1/2 justify-end text-meta whitespace-nowrap text-muted tabular-nums"
          >
            <bdi dir="rtl">{tick.label}</bdi>
          </span>
        ))}
      </div>
      <div role="img" aria-label={label} className="relative my-3 h-56 lg:h-72">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 size-full overflow-visible"
        >
          {chart.yTicks.map((tick) => (
            <line
              key={tick.label}
              x1="0"
              x2="100"
              y1={tick.y}
              y2={tick.y}
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
              className="stroke-chart-grid"
            />
          ))}
          <path d={chart.band} className="fill-chart-band" />
          <path
            d={chart.line}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart-line"
          />
        </svg>
        {chart.points.map((point) => (
          <span
            key={point.date}
            aria-hidden="true"
            style={{
              insetInlineStart: `${String(point.x)}%`,
              insetBlockStart: `${String(point.yMedian)}%`,
            }}
            className="absolute flex size-0 items-center justify-center"
          >
            <span className="size-3 shrink-0 rounded-full border-2 border-canvas bg-action" />
          </span>
        ))}
      </div>
      <div />
      <div aria-hidden="true" className="relative h-6">
        {chart.xTicks.map((tick) => (
          <span
            key={tick.label + String(tick.x)}
            style={{ insetInlineStart: `${String(tick.x)}%` }}
            className="absolute flex w-0 justify-center text-meta whitespace-nowrap text-muted"
          >
            <bdi dir="rtl">{tick.label}</bdi>
          </span>
        ))}
      </div>
    </div>
  );
}
