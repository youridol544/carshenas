import { Link2Off } from 'lucide-react';
import { AnswerFocus } from '@/features/check-link/components/answer-focus';
import { AnswerPanel } from '@/features/check-link/components/answer-panel';
import { CheckAnswerView } from '@/features/check-link/components/check-answer';
import { CheckSteps } from '@/features/check-link/components/check-steps';
import { LinkExample } from '@/features/check-link/components/link-example';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { problemOf } from '@/features/check-link/link-problem';
import { answerPastedLink } from '@/features/check-link/server/check-link-queries';
import { readLinkParam } from '@/lib/pasted-link';

// The answer under the box, for the link the address carries (`?link=`): the steps for no link, a plain message for text that
// is no Divar listing's link (the box says it first, in the browser; this is for an address someone shared or typed), and
// otherwise what our own data and the catalogue's names say about the listing (check-link-queries.ts). It reads the address,
// so it streams inside its own boundary. Another site is told only that Divar's ads are what is read for now.

export async function CheckResult({ searchParams }: { searchParams: PageProps<'/check'>['searchParams'] }) {
  const raw = (await searchParams).link;
  const reading = readLinkParam(typeof raw === 'string' ? raw : undefined);
  if (reading.kind === 'empty') return <CheckSteps />;
  if (reading.kind !== 'divar_listing') {
    return (
      <>
        <AnswerPanel kind="problem" icon={Link2Off} title={problemOf(reading)}>
          {reading.kind === 'other_site' ? null : <LinkExample lead={CHECK_COPY.problems.example} />}
        </AnswerPanel>
        <AnswerFocus />
      </>
    );
  }
  return <CheckAnswerView answer={await answerPastedLink({ token: reading.token, slug: reading.slug })} />;
}
