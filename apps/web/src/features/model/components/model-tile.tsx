import type { Route } from 'next';
import Link from 'next/link';
import { BODY_TYPES } from '@/features/body-types/body-types';
import { ModelTilePhoto } from '@/features/model/components/model-tile-photo';
import { BodyTypePhoto } from '@/features/body-types/components/body-type-photo';
import { MODEL_COPY } from '@/features/model/model-copy';
import type { PopularModel } from '@/features/model/model-types';
import { price } from '@/features/model/model-view';
import { modelHref } from '@/lib/model-address';
import { NumericText } from '@/components/ui/numeric-text';

// A model as a tile (CS-67): the model's own photo when the superadmin gave one (CS-97), else the body type's sample photograph, the model's name, how many listings it has and their
// median asking price; the whole tile is the link to the model's page. Used by the home page's popular models and the
// models index. The photograph is a sample of the body type, so it carries no alternative text of its own: the link's
// name is the model's.

const COPY = MODEL_COPY.index.card;

export function ModelTile({ model, sizes }: { model: PopularModel; sizes: string }) {
  const bodyType = BODY_TYPES.find((candidate) => candidate.code === model.bodyType);
  const median = price(model.medianToman);
  return (
    <Link
      href={modelHref(model) as Route}
      prefetch={false}
      data-model-tile={`${model.makeSlug}.${model.slug}`}
      className="flex h-full flex-col gap-2 rounded-card border border-divider bg-surface p-2 transition-colors hover:bg-surface-muted active:bg-surface-hover"
    >
      <ModelTilePhoto photoUrl={model.photoUrl} sizes={sizes}>
        {bodyType === undefined ? null : (
          <span className="relative block">
            <BodyTypePhoto bodyType={bodyType} sizes={sizes} decorative />
            <span
              data-sample-label
              className="absolute inset-s-1 top-1 rounded-badge bg-canvas px-1 text-meta font-medium text-default"
            >
              {COPY.sample}
            </span>
          </span>
        )}
      </ModelTilePhoto>
      <span className="flex flex-col gap-0.5 px-1 pb-1">
        <span className="text-control font-semibold text-balance">{model.name}</span>
        <span className="text-meta text-muted">{COPY.listings(model.count)}</span>
        {median === null ? null : (
          <span className="text-meta text-muted">
            {`${COPY.median}: `}
            <NumericText>{median}</NumericText>
          </span>
        )}
      </span>
    </Link>
  );
}
