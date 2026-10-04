import { ExternalLink, Hourglass } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { actionClasses } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { AnswerPanel } from '@/features/check-link/components/answer-panel';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { CheckAnswer } from '@/features/check-link/check-link-types';
import { SimilarSection } from '@/features/listing/components/off-market';
import { clickOutHref } from '@/features/listing/components/primary-action';
import { LISTING_COPY } from '@/features/listing/listing-copy';
import { searchHref } from '@carshenas/search/search';

// The car is one Carshenas reads and this ad is not read yet (CS-115): it says so plainly, says what happens and when to
// come back (without a time it cannot keep: while nothing is being read, it says that), and offers the best deals of the
// same model in the meantime. Nothing here is a fault: the ad will be read when its turn comes, and the same link then
// shows its rating.

const COPY = CHECK_COPY.queued;

export function QueuedAnswer({ answer }: { answer: Extract<CheckAnswer, { kind: 'queued' }> }) {
  const car = answer.car.name;
  const source = answer.sourceUrl === null ? null : clickOutHref(answer.sourceUrl);
  const modelSearch = searchHref({ filters: { model: [answer.car.key] } });
  return (
    <div className="@container flex flex-col gap-8">
      <AnswerPanel
        kind="queued"
        icon={Hourglass}
        title={COPY.title}
        actions={
          <>
            <Link href={modelSearch as Route} className={actionClasses('primary')}>
              {COPY.allOf(car)}
            </Link>
            {source === null ? null : (
              <a
                href={source}
                target="_blank"
                rel="noopener"
                aria-label={`${CHECK_COPY.result.open('دیوار')}، ${LISTING_COPY.action.opensInNewTab}`}
                className={`${actionClasses('secondary')} gap-2`}
              >
                {CHECK_COPY.result.open('دیوار')}
                <Icon icon={ExternalLink} />
              </a>
            )}
          </>
        }
      >
        <p>{answer.crawlPaused ? COPY.paused(car) : COPY.running(car)}</p>
        {answer.grantedToViewer ? <p className="text-muted">{COPY.granted}</p> : null}
      </AnswerPanel>
      {answer.suggestions.length === 0 ? null : (
        <SimilarSection
          items={answer.suggestions}
          searchLink={modelSearch}
          words={{ title: COPY.deals(car), hint: COPY.dealsHint, all: COPY.allOf(car) }}
        />
      )}
    </div>
  );
}
