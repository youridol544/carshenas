'use client';

import { Check, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { LISTING_COPY } from '@/features/listing/listing-copy';

// Share or copy the page's address (CS-64: a listing page is a shareable address, listing-patterns.md). On a phone the
// system share sheet opens when the browser has one; otherwise, and when the sheet is dismissed for a reason that is not
// the buyer's cancelling, the address is copied and the button says so. The status is a polite line that is always
// mounted; the button's label never changes, so nothing moves.

const COPY = LISTING_COPY.share;

type ShareState = 'idle' | 'copied' | 'failed';

export function ShareButton({ title }: { title: string }) {
  const [state, setState] = useState<ShareState>('idle');

  async function share() {
    const address = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: address });
        return;
      } catch (error) {
        // Cancelling the share sheet is the buyer's choice, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(address);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => {
      setState('idle');
    }, 3000);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void share();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-control text-link transition-colors hover:bg-surface-hover"
      >
        <Icon icon={state === 'copied' ? Check : LinkIcon} />
        {COPY.label}
      </button>
      <span role="status" className={`text-meta ${state === 'failed' ? 'text-danger' : 'text-muted'}`}>
        {state === 'copied' ? COPY.copied : state === 'failed' ? COPY.failed : ''}
      </span>
    </span>
  );
}
