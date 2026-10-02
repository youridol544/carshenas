'use client';

import { Popover } from '@base-ui/react/popover';
import { Info } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';

// The small info control beside a title (ui-design craft.md, section 5, tooltips): a button with a Farsi name that
// opens a popover, never a hover-only title attribute, because what «کم‌کارکرد» or «ارزش بازار» measures must be
// readable on a phone. A tap, Enter or Space toggles it for everyone; a real mouse also opens it by hovering for a
// moment; Escape or a press outside closes it and focus goes back to the button. The words come from the caller
// (the shared definitions in @carshenas/search), never from here.

export type InfoRow = { readonly label: string; readonly text: string };
export type InfoSection = {
  /** Unique within the content: it keys the section. */
  readonly id: string;
  readonly heading?: string;
  readonly paragraphs?: readonly string[];
  readonly rows?: readonly InfoRow[];
};
export type InfoContent = { readonly title: string; readonly sections: readonly InfoSection[] };

type InfoPopoverProps = {
  /** The button's accessible name: «توضیح درباره‌ی «کم‌کارکرد»». */
  label: string;
  closeLabel: string;
  content: InfoContent;
  /** The control is one stop of a RovingGroup. */
  roving?: boolean;
};

export function InfoPopover({ label, closeLabel, content, roving = false }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLDivElement>(null);

  // Next.js keeps a page it has left in the document, hidden, with its state (Activity): an open popover is a
  // transient thing, so it closes when its page is hidden instead of greeting the buyer on the way back.
  useLayoutEffect(
    () => () => {
      setOpen(false);
    },
    [],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={400}
        closeDelay={150}
        aria-label={label}
        {...(roving ? { 'data-roving-item': '' } : {})}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-hover data-popup-open:bg-surface-pressed data-popup-open:text-default"
      >
        <Icon icon={Info} size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={4} collisionPadding={8} className="z-50">
          <Popover.Popup
            ref={popup}
            initialFocus={popup}
            className="max-h-(--available-height) w-72 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-card border border-divider bg-surface p-4 text-default shadow-overlay transition-[opacity,scale] duration-popover ease-out outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-95 motion-safe:data-starting-style:scale-95"
          >
            <Popover.Title className="text-control font-semibold text-balance">{content.title}</Popover.Title>
            <Popover.Description render={<div />} className="mt-2 flex flex-col gap-3">
              {content.sections.map((section) => (
                <div key={section.id} className="flex flex-col gap-1">
                  {section.heading === undefined ? null : (
                    <p className="text-label font-medium text-muted">{section.heading}</p>
                  )}
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="text-secondary text-pretty">
                      {paragraph}
                    </p>
                  ))}
                  {section.rows === undefined ? null : (
                    <ul className="flex flex-col gap-2">
                      {section.rows.map((row) => (
                        <li key={row.label} className="text-secondary text-pretty">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-muted">: </span>
                          <span className="text-muted">{row.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Popover.Description>
            <Popover.Close className="-ms-2 mt-2 inline-flex min-h-11 items-center rounded-control px-2 text-control text-link underline">
              {closeLabel}
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
