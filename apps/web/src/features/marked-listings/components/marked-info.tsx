import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { MARKED_COPY } from '@/features/marked-listings/marked-copy';

// The small info control beside the marked page's title (the owner's request of 2026-10-01 for rule-like text): the cap,
// what counts as a price drop and as leaving the market. The words come from marked-copy.ts, whose cap is the rule in
// marks-rules.ts, so nothing is written twice.

const CONTENT: InfoContent = {
  title: MARKED_COPY.info.title,
  sections: [{ id: 'rules', rows: MARKED_COPY.info.rows }],
};

export function MarkedInfo() {
  return <InfoPopover label={MARKED_COPY.info.label} closeLabel={MARKED_COPY.info.close} content={CONTENT} />;
}
