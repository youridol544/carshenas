import { Info } from 'lucide-react';
import { AnswerPanel } from '@/features/check-link/components/answer-panel';
import { AskModel } from '@/features/check-link/components/ask-model';
import { CoveredList } from '@/features/check-link/components/covered-list';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { CheckAnswer } from '@/features/check-link/check-link-types';

// The car is not one Carshenas reads (CS-115, ADR-0046): the limit comes first, in the heading, naming the car; then the
// short list of the cars it does read; then the one way forward, asking for the model, whose state (placed, accepted,
// declined with the reason) replaces the button once the buyer has asked. It never says or suggests that the link did not
// work: the link was understood, and this is what Carshenas does and does not read.

export function OutsideAnswer({ answer }: { answer: Extract<CheckAnswer, { kind: 'outside' }> }) {
  const name = answer.car.kind === 'model' ? answer.car.model.name : answer.car.name;
  return (
    <AnswerPanel kind="outside" icon={Info} title={CHECK_COPY.outside.title(name)}>
      <CoveredList
        cars={answer.covered}
        lead={CHECK_COPY.covered.lead}
        moreLabel={CHECK_COPY.covered.moreModels}
      />
      <AskModel
        link={answer.link}
        request={answer.request}
        models={answer.car.kind === 'make' ? answer.car.models : null}
      />
    </AnswerPanel>
  );
}
