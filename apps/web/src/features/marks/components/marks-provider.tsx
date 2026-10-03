'use client';

import {
  createContext,
  startTransition,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useOptimistic,
  useState,
  type ReactNode,
} from 'react';
import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import { setListingMarkedAction } from '@/features/marks/marks-actions';
import { MARKS_COPY } from '@/features/marks/marks-copy';
import { PENDING_MARK_LIFETIME_MS } from '@/features/marks/marks-rules';
import type { MarkSnapshot } from '@/features/marks/marks-types';

// One place that holds the marks of the page in front of the buyer (CS-69), so every control for the same listing (the
// listing page has two) agrees at once. The server's answer for the page is not part of the page's prerendered shell:
// it is read at request time by MarksSnapshot, inside a boundary of its own, and handed to the provider as it arrives
// (SnapshotReceiver); until then a control is drawn but does nothing. What the buyer changes is shown at once
// (useOptimistic), then kept as confirmed when the action answers; a failure drops the optimistic state, which puts the
// control back, and says why in an overlay with a retry (ui-design craft.md, section 4). Nothing here refreshes the
// page: a search read again for one bookmark would be the wrong price for it.

type Changes = ReadonlyMap<number, boolean>;

export type MarksController = {
  /** The marks the server reported for this page; null until they arrive. */
  readonly known: MarkSnapshot | null;
  /** Takes what the server reported (MarksSnapshot). */
  readonly receive: (snapshot: MarkSnapshot) => void;
  /** What the buyer changed since: confirmed by the server, or still on its way. */
  readonly changes: Changes;
  /** Asks for the target state of one listing. */
  readonly setMarked: (listingId: number, marked: boolean) => void;
};

export const MarksContext = createContext<MarksController | null>(null);

const PENDING_KEY = 'carshenas.pending-mark';

/** A visitor pressed «نشان کردن» on a page and went to sign in: the listing and the page they will come back to. */
type PendingMark = { readonly listingId: number; readonly page: string; readonly at: number };

/** Remembers, for the length of the sign-in, which listing a visitor wanted marked. Storage may be blocked: then it is not remembered. */
export function rememberPendingMark(listingId: number): void {
  try {
    const pending: PendingMark = {
      listingId,
      page: window.location.pathname + window.location.search,
      at: Date.now(),
    };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // The visitor still signs in and returns; the listing is just not marked for them.
  }
}

function takePendingMark(): PendingMark | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_KEY);
    if (stored === null) return null;
    const value: unknown = JSON.parse(stored);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('listingId' in value) ||
      !('page' in value) ||
      !('at' in value) ||
      typeof value.listingId !== 'number' ||
      typeof value.page !== 'string' ||
      typeof value.at !== 'number'
    ) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    // Only the page they pressed it on honours it, and only for a while: a wish from yesterday is not a command.
    if (
      value.page !== window.location.pathname + window.location.search ||
      Date.now() - value.at > PENDING_MARK_LIFETIME_MS
    ) {
      if (Date.now() - value.at > PENDING_MARK_LIFETIME_MS) window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    window.sessionStorage.removeItem(PENDING_KEY);
    return { listingId: value.listingId, page: value.page, at: value.at };
  } catch {
    return null;
  }
}

type MarksProviderProps = {
  /** The marks, when the page already has them (the marked page); otherwise MarksSnapshot, inside, brings them. */
  initial?: MarkSnapshot;
  /** Where the failure overlay sits: above the bar that stays at the bottom of the listing page on a phone. */
  toastAboveBar?: boolean;
  children: ReactNode;
};

export function MarksProvider({ initial, toastAboveBar = false, children }: MarksProviderProps) {
  const [known, setKnown] = useState<MarkSnapshot | null>(initial ?? null);
  const [confirmed, setConfirmed] = useState<Changes>(new Map());
  const [changes, setOptimistic] = useOptimistic(
    confirmed,
    (current: Changes, change: { listingId: number; marked: boolean }) =>
      new Map(current).set(change.listingId, change.marked),
  );
  const [failure, setFailure] = useState<ToastNotice | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // Next.js keeps this page alive, hidden, after the buyer leaves it; a message about an earlier attempt must not be
  // waiting when they come back (ui-design craft.md, section 4).
  useLayoutEffect(
    () => () => {
      setFailure(null);
    },
    [],
  );

  function setMarked(
    listingId: number,
    marked: boolean,
    announced: string = marked ? MARKS_COPY.announced.marked : MARKS_COPY.announced.unmarked,
  ) {
    setFailure(null);
    startTransition(async () => {
      setOptimistic({ listingId, marked });
      const retry = () => {
        setMarked(listingId, marked, announced);
      };
      try {
        const result = await setListingMarkedAction({ listingId, marked });
        if (result.status === 'done') {
          setConfirmed((current) => new Map(current).set(listingId, marked));
          setAnnouncement(announced);
        } else {
          // Retrying the same press cannot help when the buyer is signed out, the cap is reached or the listing is gone.
          const retryable = result.reason === 'unavailable';
          setFailure({
            message: result.message,
            actionLabel: retryable ? MARKS_COPY.retry : MARKS_COPY.dismiss,
            onAction: retryable ? retry : () => undefined,
          });
        }
      } catch {
        setFailure({
          message: marked ? MARKS_COPY.failures.mark : MARKS_COPY.failures.unmark,
          actionLabel: MARKS_COPY.retry,
          onAction: retry,
        });
      }
    });
  }

  // A visitor who pressed «نشان کردن», signed in and came back to the same page finds the listing marked.
  const honourPendingMark = useEffectEvent((snapshot: MarkSnapshot) => {
    if (!snapshot.signedIn) return;
    const pending = takePendingMark();
    if (pending === null || snapshot.marked.includes(pending.listingId)) return;
    setMarked(pending.listingId, true, MARKS_COPY.announcedBack);
  });
  useEffect(() => {
    if (known !== null) honourPendingMark(known);
  }, [known]);

  return (
    <MarksContext value={{ known, receive: setKnown, changes, setMarked }}>
      {children}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ToastMessage
        notice={failure}
        dismissLabel={MARKS_COPY.dismiss}
        position={toastAboveBar ? 'above-bar' : 'default'}
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </MarksContext>
  );
}

/** Whether a listing is marked, and whether the buyer is signed in; `signedIn` is null until the page's marks arrive. */
export function markStateOf(
  controller: MarksController,
  listingId: number,
): { signedIn: boolean | null; marked: boolean } {
  const { known } = controller;
  if (known === null) return { signedIn: null, marked: false };
  if (!known.signedIn) return { signedIn: false, marked: false };
  return { signedIn: true, marked: controller.changes.get(listingId) ?? known.marked.includes(listingId) };
}
