import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate } from '@carshenas/locale/format-date';
import { Icon } from '@/components/ui/icon';
import { InfoPopover } from '@/components/ui/info-popover';
import { NumericText } from '@/components/ui/numeric-text';
import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import { MODEL_COPY, modelYear } from '@/features/model/model-copy';
import { trendInfo } from '@/features/model/model-info';
import {
  chartLabel,
  changeText,
  price,
  trendView,
  type Change,
  type TrendView,
} from '@/features/model/model-view';
import { TrendChart } from '@/features/model/components/trend-chart';
import { TrendTable } from '@/features/model/components/trend-table';
import { readModelTrend } from '@/features/model/server/model-queries';

// The price trend section (CS-67; teardown pattern 33): the latest median asking price for one model year with how it
// moved over 30 and 90 days, the chart, and the numbers. It is honest about its history: the valuation has run only
// since 2026-09-30, so a model's trend is a few days long, and the section says so (a short history, a missing 30- or
// 90-day change) instead of drawing a line it cannot stand behind. A rise is bad news for a buyer and is coloured so
// (text-danger), a fall is good (text-success), and the sign is always printed.

const COPY = MODEL_COPY.trend;
const CHART_HEIGHT = 'h-56 lg:h-72';

function ChangeCard({ change }: { change: Change }) {
  const text = change.ratio === null ? null : changeText(change.ratio);
  const tone =
    text === null || text.tone === 'flat'
      ? 'text-muted'
      : text.tone === 'rise'
        ? 'text-danger'
        : 'text-success';
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-control bg-surface-muted p-3">
      <dt className="text-label text-muted">{COPY.change.over(change.days)}</dt>
      <dd className={`flex flex-wrap items-center gap-x-2 text-control font-semibold ${tone}`}>
        {text === null ? (
          <span className="text-secondary font-normal text-muted">{COPY.change.notYet(change.days)}</span>
        ) : (
          <>
            {text.tone === 'flat' ? null : (
              <Icon icon={text.tone === 'rise' ? TrendingUp : TrendingDown} size={20} />
            )}
            {text.figure === null ? null : <bdi dir="ltr">{text.figure}</bdi>}
            <span className="text-label font-normal">{text.words}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div
      className={`flex ${CHART_HEIGHT} flex-col items-start justify-center gap-2 rounded-card border border-dashed border-control bg-surface-muted p-4`}
    >
      <p className="text-control font-semibold">{title}</p>
      <p className="max-w-reading text-secondary text-pretty text-muted">{body}</p>
    </div>
  );
}

function Body({ view, cohort }: { view: TrendView; cohort: string }) {
  const latest = view.days.at(-1);
  if (view.status === 'none' || latest === undefined) {
    return <Message title={COPY.none.title} body={COPY.none.body} />;
  }
  const first = view.days[0];
  const label = chartLabel(view, cohort);
  if (view.chart === null || label === null) {
    // One card: what the history is, the days it has so far as dots with their price, and when the chart comes.
    return (
      <div className="flex flex-col gap-3 rounded-card border border-dashed border-control bg-surface-muted p-4">
        <p className="text-control font-semibold">{COPY.short.title}</p>
        <p className="max-w-reading text-secondary text-pretty text-muted">
          {COPY.short.body(view.drawn.length)}
        </p>
        <ul aria-label={COPY.short.listed} className="flex flex-col gap-2">
          {[...view.days].reverse().map((day) => (
            <li key={day.date} className="flex items-center gap-2 text-secondary">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-action" />
              <span className="text-muted">{formatDate(day.date)}</span>
              <span className="font-medium">
                <NumericText>{price(day.medianToman) ?? ''}</NumericText>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-meta text-muted">{COPY.short.tomorrow}</p>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-title font-bold">
            <NumericText>{price(latest.medianToman) ?? ''}</NumericText>
          </span>
          <span className="text-secondary text-muted">{`${COPY.median} ${COPY.latest(formatDate(latest.date))}`}</span>
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          {view.changes.map((change) => (
            <ChangeCard key={change.days} change={change} />
          ))}
        </dl>
      </div>
      <figure className="flex flex-col gap-2">
        <TrendChart chart={view.chart} label={label} />
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-action" />
            {COPY.legendLine}
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 rounded-badge bg-action-subtle" />
            {COPY.legendBand}
          </span>
          <span>{view.granularity === 'day' ? COPY.daily : COPY.weekly}</span>
          {first === undefined ? null : <span>{COPY.sinceDay(formatDate(first.date))}</span>}
        </figcaption>
      </figure>
      <p className="max-w-reading text-meta text-pretty text-muted">{COPY.scope}</p>
      <TrendTable days={view.days} cohort={cohort} />
    </>
  );
}

type TrendSectionProps = { modelId: number; year: number; chosen: boolean };

export async function TrendSection({ modelId, year, chosen }: TrendSectionProps) {
  const view = trendView(await readModelTrend(modelId, year));
  const cohort = COPY.cohort(year);
  return (
    <section aria-labelledby="model-trend" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 id="model-trend" className="text-heading font-bold">
            {`${COPY.title}، ${modelYear(year)}`}
          </h2>
          <InfoPopover
            label={MODEL_COPY.info.trendLabel}
            closeLabel={MODEL_COPY.info.close}
            content={trendInfo()}
          />
        </div>
        {chosen ? null : (
          <>
            <p className="w-fit rounded-badge bg-action-subtle px-2 py-0.5 text-label text-on-action-subtle">
              {COPY.defaultYear(year)}
            </p>
            <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.cohortNote(year)}</p>
          </>
        )}
      </div>
      <Body view={view} cohort={cohort} />
    </section>
  );
}

export function TrendSectionSkeleton() {
  return (
    <section className="flex skeleton-delayed flex-col gap-4">
      <p role="status" className="sr-only">
        {MODEL_COPY.loading}
      </p>
      <div aria-hidden="true" className="w-48 text-heading">
        <SkeletonText lastLineWidth="w-full" />
      </div>
      <div aria-hidden="true" className="w-64 text-title">
        <SkeletonText lastLineWidth="w-full" />
      </div>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
        <div className="h-16 overflow-hidden rounded-control">
          <SkeletonBlock />
        </div>
        <div className="h-16 overflow-hidden rounded-control">
          <SkeletonBlock />
        </div>
      </div>
      <div aria-hidden="true" className={`${CHART_HEIGHT} overflow-hidden rounded-card`}>
        <SkeletonBlock />
      </div>
    </section>
  );
}
