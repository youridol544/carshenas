import Link from 'next/link';
import { InfoPopover } from '@/components/ui/info-popover';
import { ModelTile } from '@/features/model/components/model-tile';
import { MODEL_COPY } from '@/features/model/model-copy';
import { popularInfo } from '@/features/model/model-info';
import type { PopularModel } from '@/features/model/model-types';

// The models with the most listings, as a row of photograph tiles (CS-67): each tile opens the model's page, with its
// price, range and trend. The row is the same sideways scroller as the catalogues' (native scroll and snap, a fade on
// the side that has more); «همه‌ی مدل‌ها» opens the index. The title carries the info control of the search's own
// «مدل پرطرفدار» rule, so the page says what popular means here exactly once, from the shared definition.

const COPY = MODEL_COPY.home;
const TILE_SIZES = '(min-width: 64rem) 12rem, 10rem';

export function PopularModels({ models }: { models: readonly PopularModel[] }) {
  if (models.length === 0) return null;
  return (
    <section aria-labelledby="home-models" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
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
        </div>
        <Link
          href="/models"
          className="inline-flex min-h-11 items-center px-2 text-control text-link underline"
        >
          {COPY.all}
        </Link>
      </div>
      <ul
        aria-label={COPY.title}
        className="-mx-4 flex scroll-fade-inline snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2"
      >
        {models.map((model) => (
          <li key={`${model.makeSlug}.${model.slug}`} className="flex w-40 shrink-0 snap-start lg:w-48">
            <div className="w-full">
              <ModelTile model={model} sizes={TILE_SIZES} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
