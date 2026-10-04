import { EXAMPLE_LINK } from '@/features/check-link/check-copy';

// What an ad's link looks like (CS-115): the example the answers that cannot read a link show beside their words. An address
// reads left to right, so it is isolated inside the Persian sentence; the title in it is a car's name, as a seller wrote it.

export function LinkExample({ lead }: { lead: string }) {
  return (
    <div data-link-example className="flex flex-col gap-1">
      <p className="text-secondary text-muted">{lead}</p>
      <bdi
        dir="ltr"
        className="inline-block max-w-full self-start rounded-control bg-surface-pressed px-3 py-2 text-secondary text-default"
      >
        {EXAMPLE_LINK}
      </bdi>
    </div>
  );
}
