'use client';

import { use, useLayoutEffect } from 'react';
import { MarksContext } from '@/features/marks/components/marks-provider';
import type { MarkSnapshot } from '@/features/marks/marks-types';

// Hands the server's answer to the provider before the browser paints, so a mark that was already there is drawn
// pressed from the first frame the buyer sees after hydration.

export function SnapshotReceiver({ snapshot }: { snapshot: MarkSnapshot }) {
  const controller = use(MarksContext);
  const receive = controller?.receive;
  useLayoutEffect(() => {
    receive?.(snapshot);
  }, [receive, snapshot]);
  return null;
}
