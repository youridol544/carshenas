'use client';

import { Popover } from '@base-ui/react/popover';
import { Bookmark } from 'lucide-react';
import Link from 'next/link';
import { use, useLayoutEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { actionClasses } from '@/components/ui/action-link';
import { MARKS_COPY } from '@/features/marks/marks-copy';
import { MarksContext, rememberPendingMark, markStateOf } from '@/features/marks/components/marks-provider';
import { SIGN_IN_PATH, SIGN_UP_PATH, withReturnPath } from '@/lib/return-path';

// The «نشان کردن» control (CS-69; teardown pattern 34): a bookmark on a result card's photo, a labelled button beside
// the title on the listing page, a square beside the click-out in the bar that stays in reach on a phone, and a labelled
// button on each row of the buyer's marked list. All four are one component with one behaviour: a toggle with
// aria-pressed, whose two glyphs cross-fade in one cell (ui-design craft.md, M-23), 44 px to the touch, and its name
// says which listing it is for. A signed-in buyer's press shows at once and the server confirms (marks-provider.tsx); a
// visitor's press explains why an account is needed and offers to sign in or sign up and come back with the listing
// marked. Without a provider on the page it draws nothing: the page decided it has no marks. Until the page's marks
// arrive the control is drawn and does nothing, so nothing moves when they do.

export type MarkVariant = 'card' | 'inline' | 'bar' | 'row';

const FRAMES = {
  // 36 px drawn on the photo's corner, a 44 px target; the page colour behind it keeps it readable on any photo.
  card: 'absolute inset-e-1 top-1 z-10 size-9 shrink-0 justify-center rounded-full bg-canvas text-default shadow-raised after:absolute after:-inset-1 hover:bg-surface-hover',
  inline: 'min-h-11 gap-2 rounded-control px-3 text-control text-link hover:bg-surface-hover',
  bar: 'size-12 shrink-0 justify-center rounded-control border border-control bg-surface text-default hover:bg-surface-hover',
  row: 'min-h-11 gap-2 rounded-control border border-control bg-surface px-4 text-control text-default hover:bg-surface-hover',
} as const satisfies Record<MarkVariant, string>;

const BASE = 'relative inline-flex max-w-full items-center transition-colors';

type MarkButtonProps = { listingId: number; title: string; variant: MarkVariant };

/** Two glyphs in one cell: the outline when it is off, the filled one when it is on. Neither moves anything. */
function Glyph({ on }: { on: boolean }) {
  const cell = 'col-start-1 row-start-1 motion-safe:transition-[opacity,scale] motion-safe:duration-press';
  return (
    <span aria-hidden className="grid shrink-0 place-items-center">
      <span className={`${cell} ${on ? 'scale-50 opacity-0' : ''}`}>
        <Icon icon={Bookmark} />
      </span>
      <span className={`${cell} text-link ${on ? '' : 'scale-50 opacity-0'}`}>
        <Icon icon={Bookmark} className="fill-current" />
      </span>
    </span>
  );
}

function Label({ variant }: { variant: MarkVariant }) {
  return variant === 'inline' || variant === 'row' ? (
    <span className="min-w-0 text-start">{MARKS_COPY.mark}</span>
  ) : null;
}

export function MarkButton({ listingId, title, variant }: MarkButtonProps) {
  const controller = use(MarksContext);
  if (controller === null) return null;
  const { signedIn, marked } = markStateOf(controller, listingId);
  const frame = `${BASE} ${FRAMES[variant]}`;
  if (signedIn === false)
    return <VisitorMark listingId={listingId} title={title} variant={variant} frame={frame} />;
  return (
    <button
      type="button"
      aria-pressed={marked}
      // Until the page's marks arrive the control is drawn, and does nothing.
      aria-disabled={signedIn === null ? true : undefined}
      aria-label={MARKS_COPY.markNamed(title)}
      className={frame}
      onClick={() => {
        if (signedIn === null) return;
        controller.setMarked(listingId, !marked);
      }}
    >
      <Glyph on={marked} />
      <Label variant={variant} />
    </button>
  );
}

type VisitorMarkProps = { listingId: number; title: string; variant: MarkVariant; frame: string };

/** A visitor's press: why an account, and the way in that comes back to this page with the listing marked. */
function VisitorMark({ listingId, title, variant, frame }: VisitorMarkProps) {
  const [open, setOpen] = useState(false);
  // The page they are on, with its search: known only once they press, never while rendering.
  const [here, setHere] = useState<string | undefined>(undefined);

  // A popover is a transient thing: it closes when its page is hidden (Activity) instead of greeting the buyer on the way back.
  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [],
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setHere(window.location.pathname + window.location.search);
        setOpen(next);
      }}
    >
      <Popover.Trigger aria-label={MARKS_COPY.markNamed(title)} aria-pressed={false} className={frame}>
        <Glyph on={false} />
        <Label variant={variant} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={4} collisionPadding={8} className="z-50">
          <Popover.Popup className="flex max-h-(--available-height) w-72 max-w-(--available-width) origin-(--transform-origin) flex-col gap-3 overflow-y-auto overscroll-contain rounded-card border border-divider bg-surface p-4 text-default shadow-overlay transition-[opacity,scale] duration-popover ease-out outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95">
            <Popover.Title className="text-control font-semibold text-balance">
              {MARKS_COPY.visitor.heading}
            </Popover.Title>
            <Popover.Description render={<div />} className="flex flex-col gap-2">
              <p className="text-secondary text-pretty text-muted">{MARKS_COPY.visitor.body}</p>
              <p className="text-meta text-pretty text-muted">{MARKS_COPY.visitor.returnNote}</p>
            </Popover.Description>
            <div className="flex flex-col gap-2">
              <Link
                href={withReturnPath(SIGN_IN_PATH, here)}
                className={`${actionClasses('primary')} w-full`}
                onClick={() => {
                  rememberPendingMark(listingId);
                }}
              >
                {MARKS_COPY.visitor.signIn}
              </Link>
              <Link
                href={withReturnPath(SIGN_UP_PATH, here)}
                className={`${actionClasses('secondary')} w-full`}
                onClick={() => {
                  rememberPendingMark(listingId);
                }}
              >
                {MARKS_COPY.visitor.signUp}
              </Link>
            </div>
            <Popover.Close className="-ms-2 inline-flex min-h-11 items-center self-start rounded-control px-2 text-control text-link underline">
              {MARKS_COPY.visitor.close}
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
