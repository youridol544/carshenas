import { Search } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatDateTime } from '@carshenas/locale/format-date';
import { formatEngineVolume } from '@carshenas/locale/engine-volume';
import { formatCount } from '@carshenas/locale/format-number';
import { originLabel } from '@carshenas/search/specs';
import { actionClasses } from '@/components/ui/action-link';
import { inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { ModelSpecForm } from '@/features/admin/components/model-spec-form';
import { MODEL_SPECS_COPY as COPY, SOURCE_LABELS } from '@/features/admin/model-specs-admin-copy';
import type {
  AdminModelSpecs,
  SpecChange,
  SpecCoverage,
  SpecModel,
  SpecValues,
  TrimSpec,
} from '@/features/admin/server/model-spec-queries';
import { MAX_SPEC_QUERY_LENGTH, SPEC_MODELS_LIMIT } from '@/lib/model-spec-rules';

// The engine volume and origin of the catalogue (CS-99, ADR-0039), a section of the tracked-models screen: how much of
// what is listed has each value, a search for any catalogue model, and each model as a card with its own row, its
// trims' rows and its latest changes. The models that miss a value come first. A card is a card on every width; its
// facts are a description list so a screen reader reads each label with its value.

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

function Coverage({ coverage }: { coverage: SpecCoverage }) {
  const volumeShare = coverage.active === 0 ? 0 : coverage.withVolume / coverage.active;
  const originShare = coverage.active === 0 ? 0 : coverage.withOrigin / coverage.active;
  return (
    <dl className="grid grid-cols-1 gap-3 md:grid-cols-3" data-spec-coverage>
      <div className="flex flex-col gap-2 rounded-card border border-divider bg-surface px-4 py-3">
        <dt className="text-label text-muted">{COPY.coverage.volume}</dt>
        <dd className="flex flex-col gap-2">
          <span className="text-title font-bold" data-coverage-volume>
            {COPY.coverage.share(coverage.withVolume, coverage.active)}
          </span>
          <Bar share={volumeShare} label={COPY.coverage.volume} />
          <span className="text-secondary text-muted">
            {COPY.coverage.of(coverage.withVolume, coverage.active)}
          </span>
        </dd>
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-divider bg-surface px-4 py-3">
        <dt className="text-label text-muted">{COPY.coverage.origin}</dt>
        <dd className="flex flex-col gap-2">
          <span className="text-title font-bold" data-coverage-origin>
            {COPY.coverage.share(coverage.withOrigin, coverage.active)}
          </span>
          <Bar share={originShare} label={COPY.coverage.origin} />
          <span className="text-secondary text-muted">
            {COPY.coverage.of(coverage.withOrigin, coverage.active)}
          </span>
        </dd>
      </div>
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
  );
}

function ChangeLine({ change }: { change: SpecChange }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <span className="text-secondary text-pretty">{COPY.history.describe(change)}</span>
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

function ModelCard({ model }: { model: SpecModel }) {
  const filledTrims = model.trims.filter((trim) => trim.spec !== null).length;
  const missing = model.active > 0 && (model.withVolume < model.active || model.withOrigin < model.active);
  return (
    <li
      id={`spec-${model.key}`}
      data-spec-model={model.key}
      data-spec-missing={missing ? 'yes' : 'no'}
      className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-4"
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
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
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
      </dl>
      {model.active === 0 ? null : (
        <div className="flex flex-col gap-1 text-secondary text-pretty text-muted" data-spec-covered>
          <span>{COPY.model.volumeCovered(model.withVolume, model.active)}</span>
          <span>{COPY.model.originCovered(model.withOrigin, model.active)}</span>
        </div>
      )}
      {model.spec === null ? null : (
        <p className="-mt-2 text-secondary text-pretty text-muted" data-spec-source>
          <SourceLine spec={model.spec} />
        </p>
      )}
      <div className="border-t border-divider pt-4">
        <p className="pb-3 text-label font-medium text-default">{COPY.model.wholeModel}</p>
        <ModelSpecForm
          modelId={model.modelId}
          trimId={null}
          carName={model.carName}
          savedVolumeCc={model.spec?.volumeCc ?? null}
          savedOrigin={model.spec?.origin ?? null}
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
        {model.history.length === 0 ? (
          <p className="text-secondary text-muted">{COPY.history.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divider pt-2">
            {model.history.map((change) => (
              <ChangeLine key={`${change.at}-${change.action}-${change.scope ?? ''}`} change={change} />
            ))}
          </ul>
        )}
      </details>
    </li>
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
