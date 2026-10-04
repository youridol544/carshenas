import Link from 'next/link';
import { InfoPopover } from '@/components/ui/info-popover';
import { CardRail } from '@/features/home/components/card-rail';
import { ModelTile } from '@/features/model/components/model-tile';
import { MODEL_COPY } from '@/features/model/model-copy';
import { popularInfo } from '@/features/model/model-info';
import type { PopularModel } from '@/features/model/model-types';

// The models with the most listings, as a row of photograph tiles (CS-67): each tile opens the model's page, with its
// price, range and trend. The row is the same sideways scroller as the catalogues' (CardRail: native scroll and snap, no
// scrollbar, a fade on the side that has more, previous and next buttons for a mouse); «همه‌ی مدل‌ها» opens the index.
// The title carries the info control of the search's own «مدل پرطرفدار» rule, so the page says what popular means here
// exactly once, from the shared definition.

const COPY = MODEL_COPY.home;
const TILE_SIZES = '(min-width: 64rem) 12rem, 10rem';

export function PopularModels({ models }: { models: readonly PopularModel[] }) {
  if (models.length === 0) return null;
  return (
    <section aria-labelledby="home-models">
      <CardRail
        label={COPY.title}
        heading={
          <>
            <div className="flex items-center gap-1">
              <h2 id="home-models" className="text-heading font-bold">
                {COPY.title}
              </h2>
              <InfoPopover
                label={MODEL_COPY.info.popularLabel}
                closeLabel={MODEL_COPY.info.close}
                content={popularInfo()}
              />
            </div>
            <p className="max-w-reading text-secondary text-pretty text-muted">{COPY.lead}</p>
          </>
        }
        seeAll={
          <Link
            href="/models"
            className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
          >
            {COPY.all}
          </Link>
        }
      >
        {models.map((model) => (
          <li key={`${model.makeSlug}.${model.slug}`} className="flex w-40 shrink-0 snap-start lg:w-48">
            <div className="w-full">
              <ModelTile model={model} sizes={TILE_SIZES} />
            </div>
          </li>
        ))}
      </CardRail>
    </section>
  );
}
