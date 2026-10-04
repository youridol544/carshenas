import { Search } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@carshenas/locale/format-date';
import { formatEngineVolume } from '@carshenas/locale/engine-volume';
import { formatCount } from '@carshenas/locale/format-number';
import { countryLabel, originLabel } from '@carshenas/search/specs';
import { actionClasses } from '@/components/ui/action-link';
import { inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { CountryForm } from '@/features/admin/components/country-form';
import { ModelSpecForm } from '@/features/admin/components/model-spec-form';
import { COUNTRY_COPY } from '@/features/admin/country-admin-copy';
import { MODEL_SPECS_COPY as COPY, SOURCE_LABELS } from '@/features/admin/model-specs-admin-copy';
import type {
  AdminModelSpecs,
  CountryChange,
  CountryRow,
  SpecChange,
  SpecCoverage,
  SpecModel,
  SpecValues,
  TrimSpec,
} from '@/features/admin/server/model-spec-queries';
import { MAX_SPEC_QUERY_LENGTH, SPEC_MODELS_LIMIT } from '@/lib/model-spec-rules';

// The engine volume, origin and country of the catalogue (CS-99, CS-103, ADR-0039, ADR-0041), a section of the
// tracked-models screen: how much of what is listed has each value, the makes that still have no country, a search for
// any catalogue model, and each model as a card with its facts, its coverage and, behind one disclosure (closed, so a
// page of a dozen models stays a page a person can scan), the editors (volume and origin of the model, the country of
// its make and of the model, its trims) and its latest changes. The models that miss a value come first, with a badge.
// A card is a card on every width; its facts are a description list so a screen reader reads each label with its value.

const INFO: InfoContent = {
  title: COPY.info.title,
  sections: [
    { id: 'inherit', heading: COPY.info.inheritHeading, paragraphs: [COPY.info.inherit] },
    { id: 'unknown', heading: COPY.info.unknownHeading, paragraphs: [COPY.info.unknown] },
    { id: 'values', heading: COPY.info.valuesHeading, paragraphs: [COPY.info.values] },
  ],
};

function Who({ name }: { name: string }) {
  return (
    <bdi dir="ltr" className="inline-block">
      {name}
    </bdi>
  );
}

function SourceLine({ spec }: { spec: SpecValues }) {
  if (spec.source === 'superadmin' && spec.setBy !== null) {
    return (
      <>
        {SOURCE_LABELS.superadmin} <Who name={spec.setBy} />
        {'، '}
        {formatDate(spec.setAt)}
      </>
    );
  }
  return <>{SOURCE_LABELS[spec.source]}</>;
}

function Bar({ share, label }: { share: number; label: string }) {
  const percent = Math.round(share * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-surface-pressed"
    >
      <div className="h-full rounded-full bg-action" style={{ width: `${String(percent)}%` }} />
    </div>
  );
}

function Tile({
  label,
  share,
  of,
  datum,
}: {
  label: string;
  share: number;
  of: string;
  datum: 'volume' | 'origin' | 'country';
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-divider bg-surface px-4 py-3">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="flex flex-col gap-2">
        <span className="text-title font-bold" data-coverage={datum}>
          {COPY.coverage.share(Math.round(share * 1000), 1000)}
        </span>
        <Bar share={share} label={label} />
        <span className="text-secondary text-muted">{of}</span>
      </dd>
    </div>
  );
}

function Coverage({ coverage }: { coverage: SpecCoverage }) {
  const share = (known: number) => (coverage.active === 0 ? 0 : known / coverage.active);
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-spec-coverage>
        <Tile
          label={COPY.coverage.volume}
          share={share(coverage.withVolume)}
          of={COPY.coverage.of(coverage.withVolume, coverage.active)}
          datum="volume"
        />
        <Tile
          label={COPY.coverage.origin}
          share={share(coverage.withOrigin)}
          of={COPY.coverage.of(coverage.withOrigin, coverage.active)}
          datum="origin"
        />
        <Tile
          label={COPY.coverage.country}
          share={share(coverage.withCountry)}
          of={COPY.coverage.of(coverage.withCountry, coverage.active)}
          datum="country"
        />
        <div className="flex flex-col gap-2 rounded-card border border-divider bg-surface px-4 py-3">
          <dt className="text-label text-muted">{COPY.coverage.missing}</dt>
          <dd className="flex flex-col gap-1">
            <span className="text-title font-bold" data-coverage-missing>
              {formatCount(coverage.modelsMissing)}
            </span>
            {coverage.modelsMissing === 0 ? (
              <span className="text-secondary text-muted">{COPY.coverage.noneMissing}</span>
            ) : null}
          </dd>
        </div>
      </dl>
      <p className="max-w-reading text-secondary text-pretty text-muted" data-coverage-split>
        {COPY.coverage.bySource(coverage.bySource.listing, coverage.bySource.trim, coverage.bySource.model)}
      </p>
    </div>
  );
}

function ChangeLine({ change }: { change: SpecChange | CountryChange }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <span className="text-secondary text-pretty">
        {'toCountry' in change
          ? COUNTRY_COPY.history.describe(change.action, change.scope, change.fromCountry, change.toCountry)
          : COPY.history.describe(change)}
      </span>
      <span className="text-meta text-muted">
        {change.by === null ? (
          `${COPY.history.bySeed}، ${formatDateTime(change.at)}`
        ) : (
          <>
            <Who name={change.by} />
            {'، '}
            {formatDateTime(change.at)}
          </>
        )}
      </span>
    </li>
  );
}

function TrimRow({ trim, model }: { trim: TrimSpec; model: SpecModel }) {
  const inherited =
    model.spec === null
      ? COPY.model.inheritsNothing
      : COPY.model.inherits(model.spec.volumeCc, model.spec.origin);
  return (
    <li
      data-spec-trim={trim.id}
      data-spec-trim-saved={trim.spec === null ? 'no' : 'yes'}
      className="flex flex-col gap-3 rounded-inner border border-divider p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 text-control font-medium text-balance">
          <bdi>{trim.name}</bdi>
        </h4>
        <span className="text-secondary text-muted">{COPY.model.trimListings(trim.active)}</span>
      </div>
      {trim.spec === null ? null : (
        <p className="-mt-1 text-secondary text-pretty text-muted">
          <SourceLine spec={trim.spec} />
        </p>
      )}
      <ModelSpecForm
        modelId={model.modelId}
        trimId={trim.id}
        carName={trim.name}
        savedVolumeCc={trim.spec?.volumeCc ?? null}
        savedOrigin={trim.spec?.origin ?? null}
        inheritedNote={inherited}
      />
    </li>
  );
}

function CountryFact({ model }: { model: SpecModel }) {
  const own = model.modelCountry;
  const fromMake = model.makeCountry;
  if (own === null && fromMake === null) return <span className="text-muted">{COUNTRY_COPY.unknown}</span>;
  const code = (own ?? fromMake)?.country ?? null;
  const label = code === null ? '' : (countryLabel(code) ?? code);
  return <>{own === null ? COUNTRY_COPY.fromMake(label) : label}</>;
}

function ModelCard({ model }: { model: SpecModel }) {
  const filledTrims = model.trims.filter((trim) => trim.spec !== null).length;
  const missing =
    model.active > 0 &&
    (model.withVolume < model.active || model.withOrigin < model.active || model.withCountry < model.active);
  const history = [
    ...model.history.map((change) => ({ change, at: change.at })),
    ...model.countryHistory.map((change) => ({ change, at: change.at })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);
  const makeCountry: CountryRow | null = model.makeCountry;
  return (
    <li
      id={`spec-${model.key}`}
      data-spec-model={model.key}
      data-spec-missing={missing ? 'yes' : 'no'}
      className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-control font-semibold text-balance">
          <bdi>{model.carName}</bdi>
        </h3>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {model.tracked ? (
            <span className="inline-flex rounded-badge bg-action-subtle px-2 py-0.5 text-label font-medium text-on-action-subtle">
              {COPY.model.tracked}
            </span>
          ) : null}
          {missing ? (
            <span className="inline-flex rounded-badge bg-warning-subtle px-2 py-0.5 text-label font-medium text-warning">
              {COPY.model.missingBadge}
            </span>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-0.5" data-fact="listings">
          <dt className="text-meta text-muted">آگهی</dt>
          <dd className="text-control font-medium">{COPY.model.listings(model.active)}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5" data-fact="volume">
          <dt className="text-meta text-muted">{COPY.form.volume}</dt>
          <dd className="text-control font-medium">
            {model.spec?.volumeCc == null ? (
              <span className="text-muted">{COPY.form.originUnknown}</span>
            ) : (
              formatEngineVolume(model.spec.volumeCc)
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5" data-fact="origin">
          <dt className="text-meta text-muted">{COPY.form.origin}</dt>
          <dd className="text-control font-medium">
            {originLabel(model.spec?.origin ?? null) ?? (
              <span className="text-muted">{COPY.form.originUnknown}</span>
            )}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5" data-fact="country">
          <dt className="text-meta text-muted">{COUNTRY_COPY.label}</dt>
          <dd className="text-control font-medium">
            <CountryFact model={model} />
          </dd>
        </div>
      </dl>
      {model.active === 0 ? null : (
        <p className="text-secondary text-pretty text-muted" data-spec-covered>
          {`${COPY.model.volumeCovered(model.withVolume, model.active)} ${COPY.model.originCovered(model.withOrigin, model.active)} ${COPY.model.countryCovered(model.withCountry, model.active)}`}
        </p>
      )}
      {model.spec === null ? null : (
        <p className="-mt-1 text-secondary text-pretty text-muted" data-spec-source>
          <SourceLine spec={model.spec} />
        </p>
      )}
      <details className="group rounded-inner border-t border-divider pt-1" data-spec-edit>
        <summary className="inline-flex min-h-11 items-center text-label font-medium text-link underline">
          {COPY.model.edit}
        </summary>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-3">
            <p className="text-label font-medium text-default">{COPY.model.wholeModel}</p>
            <ModelSpecForm
              modelId={model.modelId}
              trimId={null}
              carName={model.carName}
              savedVolumeCc={model.spec?.volumeCc ?? null}
              savedOrigin={model.spec?.origin ?? null}
            />
          </div>
          <div className="grid items-start gap-4 border-t border-divider pt-4 md:grid-cols-2">
            <CountryForm
              makeId={model.makeId}
              modelId={null}
              name={model.makeName}
              savedCountry={makeCountry?.country ?? null}
              emptyLabel={COUNTRY_COPY.makeEmpty}
              label={COUNTRY_COPY.makeLabel}
            />
            <CountryForm
              makeId={model.makeId}
              modelId={model.modelId}
              name={model.carName}
              savedCountry={model.modelCountry?.country ?? null}
              emptyLabel={COUNTRY_COPY.modelEmpty}
              label={COUNTRY_COPY.modelLabel}
              hint={COUNTRY_COPY.modelHint}
            />
          </div>
          {model.trims.length === 0 ? null : (
            <details className="group rounded-inner" data-spec-trims>
              <summary className="inline-flex min-h-11 items-center text-label font-medium text-link underline">
                {COPY.model.trims(model.trims.length, filledTrims)}
              </summary>
              <ul className="flex flex-col gap-3 pt-2">
                {model.trims.map((trim) => (
                  <TrimRow key={trim.id} trim={trim} model={model} />
                ))}
              </ul>
            </details>
          )}
          <details className="group rounded-inner">
            <summary className="inline-flex min-h-11 items-center text-label font-medium text-link underline">
              {COPY.history.heading}
            </summary>
            {history.length === 0 ? (
              <p className="text-secondary text-muted">{COPY.history.empty}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-divider pt-2">
                {history.map(({ change }) => (
                  <ChangeLine
                    key={`${change.at}-${change.action}-${'toCountry' in change ? `c${change.scope}` : (change.scope ?? '')}`}
                    change={change}
                  />
                ))}
              </ul>
            )}
          </details>
        </div>
      </details>
    </li>
  );
}

function MissingMakes({ data }: { data: AdminModelSpecs }) {
  const listed = data.makesWithoutCountry.filter((make) => make.active > 0);
  const others = data.makesWithoutCountryTotal - listed.length;
  return (
    <section aria-labelledby="missing-countries" className="flex flex-col gap-3" data-missing-countries>
      <div className="flex flex-col gap-1">
        <h3 id="missing-countries" className="text-control font-semibold">
          {COUNTRY_COPY.missingMakes.heading}
        </h3>
        <p className="max-w-reading text-secondary text-pretty text-muted">
          {COUNTRY_COPY.missingMakes.lead}
        </p>
      </div>
      {listed.length === 0 ? (
        <p className="text-body text-pretty text-muted" data-missing-countries-none>
          {data.makesWithoutCountryTotal === 0
            ? COUNTRY_COPY.missingMakes.none
            : COUNTRY_COPY.missingMakes.noneListed(others)}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {listed.map((make) => (
            <li
              key={make.makeId}
              data-missing-make={make.makeId}
              className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="min-w-0 text-control font-medium text-balance">
                  <bdi>{make.name}</bdi>
                </h4>
                <span className="text-secondary text-muted">
                  {COUNTRY_COPY.missingMakes.withListings(make.active)}
                </span>
              </div>
              <CountryForm
                makeId={make.makeId}
                modelId={null}
                name={make.name}
                savedCountry={null}
                emptyLabel={COUNTRY_COPY.makeEmpty}
                label={COUNTRY_COPY.makeLabel}
              />
            </li>
          ))}
        </ul>
      )}
      {others > 0 && listed.length > 0 ? (
        <p className="text-secondary text-muted">{COUNTRY_COPY.missingMakes.others(others)}</p>
      ) : null}
    </section>
  );
}

export function ModelSpecsSection({ data }: { data: AdminModelSpecs }) {
  return (
    <section aria-labelledby="specs" className="flex flex-col gap-3" data-model-specs>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <h2 id="specs" className="text-heading font-bold">
            {COPY.heading}
          </h2>
          <InfoPopover label={COPY.info.label} closeLabel={COPY.info.close} content={INFO} />
        </div>
        <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
      </div>
      <Coverage coverage={data.coverage} />
      <MissingMakes data={data} />
      <form
        method="get"
        action="#specs"
        role="search"
        aria-label={COPY.search.label}
        className="flex max-w-reading gap-2"
      >
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">{COPY.search.label}</span>
          <span aria-hidden className="pointer-events-none absolute inset-s-3 text-muted">
            <Icon icon={Search} size={20} />
          </span>
          <input
            type="search"
            name="s"
            defaultValue={data.query}
            maxLength={MAX_SPEC_QUERY_LENGTH}
            placeholder={COPY.search.placeholder}
            autoComplete="off"
            className={`${inputClasses} ps-12`}
          />
        </label>
        <button type="submit" className={actionClasses('secondary')}>
          {COPY.search.submit}
        </button>
      </form>
      <p className="max-w-reading text-secondary text-pretty text-muted">
        {data.query === '' ? COPY.search.hintAll : COPY.search.hintQuery(data.query)}
      </p>
      {data.query === '' ? null : (
        <div className="-ms-2">
          <Link
            href="/admin/tracked-models#specs"
            prefetch={false}
            className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
          >
            {COPY.search.clear}
          </Link>
        </div>
      )}
      {data.models.length === 0 ? (
        <p className="text-body text-pretty text-muted">
          {data.query === '' ? COPY.search.empty : COPY.search.emptyQuery(data.query)}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 lg:items-start" data-spec-count={data.models.length}>
          {data.models.map((model) => (
            <ModelCard key={model.key} model={model} />
          ))}
        </ul>
      )}
      {data.models.length >= SPEC_MODELS_LIMIT ? (
        <p className="text-secondary text-muted">{COPY.search.shownOf(data.models.length)}</p>
      ) : null}
    </section>
  );
}
