import { InfoPopover } from '@/components/ui/info-popover';
import { catalogueInfo } from '@/features/search/info-content';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { CATALOGUES, type CatalogueId } from '@carshenas/search/catalogues';
import type { LabelOf } from '@carshenas/search/kinds';

// While the buyer is on a catalogue and has not changed it, its title and its one-sentence description say what these
// results are, with the same info control as in the strip: the exact conditions and the order. Changing any filter
// makes the search the buyer's own, and this goes (the address still says where it started).

export function CatalogueSummary({ id, labelOf }: { id: CatalogueId; labelOf: LabelOf }) {
  const catalogue = CATALOGUES.find((candidate) => candidate.id === id);
  if (catalogue === undefined) return null;
  return (
    <section
      aria-label={catalogue.title}
      className="flex flex-col gap-1 rounded-card bg-surface-muted p-4 pt-1"
    >
      <div className="flex items-center gap-1">
        <h2 className="text-heading font-bold text-balance">{catalogue.title}</h2>
        <InfoPopover
          label={SEARCH_COPY.catalogues.info(catalogue.title)}
          closeLabel={SEARCH_COPY.info.close}
          content={catalogueInfo(id, labelOf)}
        />
      </div>
      <p className="text-secondary text-pretty text-muted">{catalogue.description}</p>
    </section>
  );
}
