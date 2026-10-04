import { CHECK_COPY } from '@/features/check-link/check-copy';
import { CoveredList } from '@/features/check-link/components/covered-list';
import { LinkExample } from '@/features/check-link/components/link-example';
import { readCoveredCars } from '@/features/check-link/server/check-link-queries';

// What the page offers before a link is pasted: an example of a link and the cars Carshenas reads, so the limit is known
// before anything is pasted and no answer has to be a surprise (an empty state is a place to teach, ui-design craft.md
// section 7). How to copy a link is in the box's info control, once; the list is read when the page is asked for and left
// out if the read fails.

export async function CheckStart() {
  const covered = await readCoveredCars();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <LinkExample lead={CHECK_COPY.problems.example} />
      {covered.length === 0 ? null : (
        <section aria-labelledby="check-covered-title" className="flex flex-col gap-3">
          <h2 id="check-covered-title" className="text-heading font-bold">
            {CHECK_COPY.covered.title}
          </h2>
          <CoveredList cars={covered} moreLabel={CHECK_COPY.covered.moreModels} />
        </section>
      )}
    </div>
  );
}
