import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { CheckSteps } from '@/features/check-link/components/check-steps';
import { CheckAnswerView } from '@/features/check-link/components/check-answer';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { readLinkParam } from '@/features/check-link/link-parse';
import { problemOf } from '@/features/check-link/link-problem';
import { answerPastedToken } from '@/features/check-link/server/check-link-queries';

// The answer under the box, for the link the address carries (`?link=`): nothing for no link, a plain message for text that
// is no Divar listing's link (the box says it first, in the browser; this is for an address someone shared or typed), and
// otherwise what our own data says about the listing (check-link-queries.ts). It reads the address, so it streams inside
// its own boundary.

export async function CheckResult({ searchParams }: { searchParams: PageProps<'/check'>['searchParams'] }) {
  const raw = (await searchParams).link;
  const reading = readLinkParam(typeof raw === 'string' ? raw : undefined);
  if (reading.kind === 'empty') return <CheckSteps />;
  if (reading.kind !== 'divar_listing') {
    return (
      <section
        aria-labelledby="check-answer-title"
        data-check-answer
        className="flex flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
      >
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-pressed text-muted">
          <Icon icon={SearchX} size={24} />
        </span>
        <h2 id="check-answer-title" className="text-heading font-bold text-balance">
          {problemOf(reading)}
        </h2>
        <Link href="/search" className={actionClasses('secondary')}>
          {CHECK_COPY.problems.searchInstead}
        </Link>
      </section>
    );
  }
  return <CheckAnswerView answer={await answerPastedToken(reading.token)} />;
}
