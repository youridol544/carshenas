'use client';

import { Switch } from '@base-ui/react/switch';
import { startTransition, useId, useLayoutEffect, useOptimistic, useState } from 'react';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { setSearchFileAlertsMutedAction } from '@/features/search-files/search-files-actions';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import type { SearchFileState } from '@/features/search-files/search-files-rules';

// The alerts switch of one file (CS-72, ADR-0035): on unless the buyer muted this file. It takes effect at once,
// optimistically (ui-design craft.md, section 4): the action sets the target, a failure puts the switch back and says so
// with a retry. An info control beside the label explains how often alerts come, from the same numbers the matching job
// enforces. A file that is not being watched still keeps the buyer's choice, and says why nothing arrives meanwhile.

const COPY = SEARCH_FILES_COPY.alerts;

const INFO: InfoContent = {
  title: COPY.infoTitle,
  sections: [{ id: 'alerts', paragraphs: [COPY.infoLimits] }],
};

type FileAlertsProps = { id: number; muted: boolean; state: SearchFileState };

export function FileAlerts({ id, muted, state }: FileAlertsProps) {
  const [receiving, setReceiving] = useOptimistic(!muted);
  const [failure, setFailure] = useState<ToastNotice | null>(null);
  const labelId = useId();
  const descriptionId = useId();

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): a message about an earlier
  // attempt must not be waiting when the buyer comes back.
  useLayoutEffect(
    () => () => {
      setFailure(null);
    },
    [],
  );

  function change(next: boolean) {
    setFailure(null);
    startTransition(async () => {
      setReceiving(next);
      const retry = () => {
        change(next);
      };
      try {
        const result = await setSearchFileAlertsMutedAction({ id, muted: !next });
        if (result.status !== 'done')
          setFailure({
            message: result.message,
            actionLabel: SEARCH_FILES_COPY.actions.retry,
            onAction: retry,
          });
      } catch {
        setFailure({ message: COPY.failed, actionLabel: SEARCH_FILES_COPY.actions.retry, onAction: retry });
      }
    });
  }

  const description = !receiving ? COPY.off : state === 'watching' ? COPY.on : COPY.notWatching;

  return (
    <div data-file-alerts={receiving ? 'on' : 'off'} className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <span id={labelId} className="text-control font-semibold text-default">
            {COPY.label}
          </span>
          <InfoPopover label={COPY.infoLabel} closeLabel={COPY.infoClose} content={INFO} />
        </div>
        <Switch.Root
          checked={receiving}
          onCheckedChange={change}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          // A 48 × 28 px track with a hit area grown to 64 × 48 px (ui-design craft.md, section 5).
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-control bg-surface-pressed p-0.5 after:absolute after:-inset-x-2 after:-inset-y-2.5 data-checked:border-action data-checked:bg-action motion-safe:transition-colors"
        >
          {/* On moves the thumb towards the inline end, the left in this right-to-left app: translate does not flip by
              itself, so the direction is negative on purpose (ui-design SKILL.md, point 2). */}
          <Switch.Thumb className="size-5 rounded-full bg-canvas shadow-raised data-checked:-translate-x-5 motion-safe:transition-transform motion-safe:duration-press" />
        </Switch.Root>
      </div>
      <p id={descriptionId} className="text-secondary text-pretty text-muted">
        {description}
      </p>
      <ToastMessage
        notice={failure}
        dismissLabel={SEARCH_FILES_COPY.actions.dismiss}
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </div>
  );
}
