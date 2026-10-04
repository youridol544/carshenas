'use client';

import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

// A modal dialog for one short task: a sheet from the bottom of a phone, a card in the middle of a desktop (the same
// two shapes as the filter sheet and a desktop's dialogs, ui-design craft.md section 4). Focus stays inside it, the page
// behind is inert and does not scroll, Escape and a press on the backdrop close it, and focus goes back to what opened it.
// A caller whose page Next.js may keep hidden (Activity) closes it when the page goes (a layout effect that sets its
// open state to false on cleanup). It owns no words: the title, the close button's name and everything inside come from the caller.
// Its popup is its one scroll area, and only if its content is taller than the screen: the viewport around it does not
// scroll too (CS-112), which made a second scroll area in a card with padding around it.

type ModalSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
};

export function ModalSheet({ open, onOpenChange, title, closeLabel, children }: ModalSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:duration-sheet" />
        <Dialog.Viewport className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-4">
          <Dialog.Popup className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-sheet bg-surface p-4 pb-6 text-default shadow-sheet outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full motion-safe:transition-[transform,opacity] motion-safe:duration-sheet motion-safe:ease-settle md:rounded-card md:p-6 md:shadow-overlay md:data-ending-style:translate-y-0 md:data-ending-style:opacity-0 md:data-starting-style:translate-y-0 md:data-starting-style:opacity-0">
            <div className="flex items-start justify-between gap-2">
              <Dialog.Title className="text-heading font-bold text-balance">{title}</Dialog.Title>
              <Dialog.Close
                aria-label={closeLabel}
                className="-me-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover"
              >
                <Icon icon={X} />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Dialog };
