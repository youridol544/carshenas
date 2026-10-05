import { ChevronLeft } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { actionClasses } from '@/components/ui/action-link';
import { InfoPopover } from '@/components/ui/info-popover';
import { NumericText } from '@/components/ui/numeric-text';
import { BODY_TYPES } from '@/features/body-types/body-types';
import { BodyTypePhoto } from '@/features/body-types/components/body-type-photo';
import { ModelTilePhoto } from '@/features/model/components/model-tile-photo';
import { MODEL_COPY } from '@/features/model/model-copy';
import { marketValueInfo, popularInfo, rangeInfo } from '@/features/model/model-info';
import { POPULAR_MODEL_RANK } from '@carshenas/search/filters';
import type { ModelRef, ModelStats } from '@/features/model/model-types';
import { mileageText, price, priceRange } from '@/features/model/model-view';
import { searchHref } from '@carshenas/search/search';
import { formatDate } from '@carshenas/locale/format-date';
import { formatEngineVolume } from '@carshenas/locale/engine-volume';
import { formatCount } from '@carshenas/locale/format-number';
import { countryLabel, originLabel } from '@carshenas/search/specs';

/** «۱٬۶۰۰ سی‌سی», or «۱٬۲۰۰ تا ۲٬۰۰۰ سی‌سی» when the model's engines differ. */
function engineVolumeText(min: number, max: number): string {
  return min === max ? formatEngineVolume(min) : `${formatCount(min)} تا ${formatEngineVolume(max)}`;
}

// The top of a model page (CS-67; teardown pattern 33): where the buyer is, the model's name, and what it costs today
// in four figures (the median asking price, the range most listings fall in, the market value, the usual mileage),
// each with its info control where it is a rule, and one primary action: all of the model's listings. The photograph is
// the model's own when the superadmin set one (CS-97), else the body type's sample (CS-57), labelled as a sample, never
// as this model; a set photo that does not load gives the sample back with its label. A phone shows the name and figures
// first and the photograph after them, so the price is above the fold; from 64 rem the photograph sits beside them.

const COPY = MODEL_COPY;

type StatProps = {
  /** A wide stat takes the whole row: a range is two prices and a phone's half row would break them. */
  wide?: boolean;
  label: string;
  value: string | null;
  help: string;
  info?: { label: string; content: ReturnType<typeof rangeInfo> };
};

function Stat({ wide = false, label, value, help, info }: StatProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 rounded-control bg-surface-muted px-3 pb-3 ${wide ? 'col-span-2 lg:col-span-2' : ''}`}
    >
      <dt className="flex min-h-11 items-center gap-1 text-label text-muted">
        {label}
        {info === undefined ? null : (
          <InfoPopover label={info.label} closeLabel={COPY.info.close} content={info.content} />
        )}
      </dt>
      <dd className="text-control font-bold text-pretty sm:text-heading">
        {value === null ? (
          <span className="text-muted">{COPY.stats.none}</span>
        ) : (
          <NumericText>{value}</NumericText>
        )}
      </dd>
      <dd className="text-meta text-pretty text-muted">{help}</dd>
    </div>
  );
}

type ModelHeroProps = {
  model: ModelRef;
  stats: ModelStats;
  valuedOn: string | null;
  year: number | null;
  /** The model year with the most listings, or null. */
  modalYear: number | null;
};

export function ModelHero({ model, stats, valuedOn, year, modalYear }: ModelHeroProps) {
  const bodyType = BODY_TYPES.find((candidate) => candidate.code === model.bodyType?.code);
  const searchLink = searchHref({
    filters: { model: [model.key], ...(year === null ? {} : { year: { min: year, max: year } }) },
  });
  const popular = stats.popularRank !== null && stats.popularRank <= POPULAR_MODEL_RANK;
  const range = priceRange(stats.lowToman, stats.highToman);
  return (
    <section
      aria-labelledby="model-title"
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-8"
    >
      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
        <nav aria-label={COPY.breadcrumb.label}>
          <ol className="-mx-3 flex flex-wrap items-center text-secondary text-muted">
            <li className="flex items-center gap-1">
              <Link href="/" className="inline-flex min-h-11 items-center px-3 text-link underline">
                {COPY.breadcrumb.home}
              </Link>
              <Icon icon={ChevronLeft} size={16} />
            </li>
            <li className="flex items-center gap-1">
              <Link href="/models" className="inline-flex min-h-11 items-center px-3 text-link underline">
                {COPY.breadcrumb.models}
              </Link>
              <Icon icon={ChevronLeft} size={16} />
            </li>
            <li aria-current="page" className="px-3">
              {model.name}
            </li>
          </ol>
        </nav>
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-label text-muted">
            <span>{model.makeName}</span>
            {model.bodyType === null ? null : (
              <span className="rounded-badge bg-surface-muted px-2 py-0.5">{model.bodyType.label}</span>
            )}
            {originLabel(model.spec.origin) === undefined ? null : (
              <span className="rounded-badge bg-surface-muted px-2 py-0.5" data-model-origin>
                {originLabel(model.spec.origin)}
              </span>
            )}
            {countryLabel(model.spec.country) === undefined ? null : (
              <span className="rounded-badge bg-surface-muted px-2 py-0.5" data-model-country>
                {countryLabel(model.spec.country)}
              </span>
            )}
            {model.spec.volumeMinCc === null || model.spec.volumeMaxCc === null ? null : (
              <span className="rounded-badge bg-surface-muted px-2 py-0.5" data-model-volume>
                {engineVolumeText(model.spec.volumeMinCc, model.spec.volumeMaxCc)}
              </span>
            )}
            {popular ? (
              <span className="inline-flex items-center rounded-badge bg-action-subtle ps-2 text-on-action-subtle">
                {COPY.hero.popular}
                <InfoPopover
                  label={COPY.info.popularLabel}
                  closeLabel={COPY.info.close}
                  content={popularInfo()}
                />
              </span>
            ) : null}
          </p>
          <h1 id="model-title" className="text-display font-bold text-balance">
            {model.name}
          </h1>
          <p className="text-secondary text-pretty text-muted">{COPY.hero.listings(stats.count)}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 lg:row-start-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-label font-medium text-muted">{COPY.stats.label}</h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Stat label={COPY.stats.median} value={price(stats.medianToman)} help={COPY.stats.medianHelp} />
            <Stat
              label={COPY.stats.value}
              value={price(stats.marketValueToman)}
              help={
                valuedOn === null || stats.marketValueToman === null
                  ? COPY.stats.valueNone
                  : COPY.stats.valueHelp(formatDate(valuedOn))
              }
              info={{ label: COPY.info.valueLabel, content: marketValueInfo() }}
            />
            <Stat
              wide
              label={COPY.stats.range}
              value={range}
              help={COPY.stats.rangeHelp(stats.priced)}
              info={{ label: COPY.info.rangeLabel, content: rangeInfo() }}
            />
            <Stat
              label={COPY.stats.mileage}
              value={mileageText(stats.medianMileageKm)}
              help={COPY.stats.mileageHelp}
            />
            <Stat
              label={COPY.stats.years}
              value={
                stats.firstYear === null || stats.lastYear === null
                  ? null
                  : COPY.stats.yearsValue(stats.firstYear, stats.lastYear)
              }
              help={modalYear === null ? '' : COPY.stats.yearsHelp(modalYear)}
            />
          </dl>
        </div>
        <div>
          <Link href={searchLink as Route} className={actionClasses('primary')}>
            {year === null ? COPY.hero.seeAll(stats.count) : COPY.hero.seeAllOfYear(stats.count, year)}
          </Link>
        </div>
      </div>
      {bodyType === undefined && model.photoUrl === null ? null : (
        <figure className="order-3 flex flex-col gap-2 rounded-card border border-divider bg-surface p-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:self-start">
          <ModelTilePhoto photoUrl={model.photoUrl} sizes="(min-width: 64rem) 24rem, 100vw">
            {bodyType === undefined ? null : (
              <>
                <BodyTypePhoto bodyType={bodyType} sizes="(min-width: 64rem) 24rem, 100vw" decorative />
                <figcaption className="px-1 pb-1 text-meta text-pretty text-muted">
                  {COPY.hero.photoCaption(bodyType.labelFa)}
                </figcaption>
              </>
            )}
          </ModelTilePhoto>
        </figure>
      )}
    </section>
  );
}
