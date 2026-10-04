'use client';

import { useState, useTransition } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { Spinner } from '@/components/ui/spinner';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { askCrawlAction } from '@/features/search-files/crawl-requests-actions';
import { CRAWL_REQUESTS_COPY } from '@/lib/crawl-requests-copy';
import type { AskResult } from '@/lib/crawl-requests-types';

// «ثبت درخواست» (CS-71): one press asks for every model the file names that is not yet asked for. The press is a
// transition, so the button says it is working and cannot be pressed twice; the page refreshes with the truth when the
// action answers (the card then shows each model's state), and a refusal says why beside the button, with a retry only
// where trying again can help.

const COPY = CRAWL_REQUESTS_COPY.card;

function messageOf(result: AskResult): string | null {
  switch (result.status) {
    case 'asked':
      return null;
    case 'declined':
      return COPY.errors.declined;
    case 'too_many':
      return COPY.errors.tooMany;
    case 'file_limit':
      return COPY.errors.fileLimit;
    case 'account_limit':
      return COPY.errors.accountLimit;
    case 'not_needed':
      return COPY.errors.notNeeded;
    case 'nothing_to_ask':
      return COPY.errors.notNeeded;
    case 'gone':
    case 'signed_out':
    case 'failed':
      return result.message;
  }
}

export function AskCrawlButton({ fileId, count }: { fileId: number; count: number }) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<ToastNotice | null>(null);

  function ask() {
    setNotice(null);
    start(async () => {
      try {
        const result = await askCrawlAction({ id: fileId });
        const message = messageOf(result);
        if (message !== null) setNotice({ message, actionLabel: COPY.retry, onAction: ask });
      } catch {
        setNotice({ message: COPY.errors.failed, actionLabel: COPY.retry, onAction: ask });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-ask-crawl
        aria-busy={pending}
        aria-disabled={pending}
        data-pending={pending ? '' : undefined}
        onClick={pending ? undefined : ask}
        className={`${actionClasses('secondary')} self-start`}
      >
        {count > 1 ? COPY.submitMany(count) : COPY.submit}
        <Spinner />
      </button>
      <ToastMessage
        notice={notice}
        dismissLabel={COPY.dismiss}
        onDismiss={() => {
          setNotice(null);
        }}
      />
    </>
  );
}
