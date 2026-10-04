import { Link2Off } from 'lucide-react';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { AnswerPanel } from '@/features/check-link/components/answer-panel';
import { CoveredList } from '@/features/check-link/components/covered-list';
import { LinkExample } from '@/features/check-link/components/link-example';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { CheckAnswer } from '@/features/check-link/check-link-types';

// The link is a Divar ad's, but it does not say which car (CS-115): the short form has no title, or the title names no car
// the catalogue knows, or two, or only a make some of whose models are read. It is never called unsupported, because
// nothing is known to be outside: the answer says what the link lacks and what to do (a full link, with an example), and
// shows the cars that are read so the buyer can tell whether theirs is one.

const COPY = CHECK_COPY.unreadable;

export function UnreadableAnswer({ answer }: { answer: Extract<CheckAnswer, { kind: 'unreadable' }> }) {
  const make = answer.make ?? '';
  const title = answer.reason === 'make_only' ? COPY.make_only.title(make) : COPY[answer.reason].title;
  const body = answer.reason === 'make_only' ? COPY.make_only.body(make) : COPY[answer.reason].body;
  const cars = answer.reason === 'make_only' ? answer.coveredOfMake : answer.covered;
  return (
    <AnswerPanel
      kind="unreadable"
      icon={Link2Off}
      title={title}
      actions={
        <Link href="/search" className={actionClasses('secondary')}>
          {COPY.searchInstead}
        </Link>
      }
    >
      <p>{body}</p>
      {answer.reason === 'no_title' ? <LinkExample lead={CHECK_COPY.problems.example} /> : null}
      {answer.reason === 'no_title' ? null : (
        <CoveredList cars={cars} moreLabel={CHECK_COPY.covered.moreModels} />
      )}
    </AnswerPanel>
  );
}
