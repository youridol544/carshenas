// The geometry of one notification in the inbox, in one place (ui-design craft.md, section 3): the real row and its
// skeleton both render this frame, so their slots cannot drift. Each slot reserves at least one line of its own type
// role: a title and a detail of one or two lines, one price line and one meta line. It has no hooks and no directive,
// so both the list (client) and the skeleton (server) render it.

type NotificationRowFrameProps = {
  /** The kind's glyph in its tinted circle, at the inline start. */
  icon: React.ReactNode;
  title: React.ReactNode;
  detail: React.ReactNode;
  price: React.ReactNode;
  meta: React.ReactNode;
  /** The unread mark and the mark-read button, at the inline end, above the stretched link. */
  aside?: React.ReactNode;
};

export function NotificationRowFrame({ icon, title, detail, price, meta, aside }: NotificationRowFrameProps) {
  return (
    <div className="relative flex items-start gap-3 py-4 ps-4 pe-2">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-default">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="line-clamp-2 min-h-lh text-control font-semibold text-pretty text-default">
          {title}
        </div>
        <div className="line-clamp-2 min-h-lh text-secondary text-pretty text-muted">{detail}</div>
        <div className="min-h-lh text-control">{price}</div>
        <div className="min-h-lh text-meta text-subtle">{meta}</div>
      </div>
      <div className="relative z-10 flex w-11 shrink-0 flex-col items-center">{aside}</div>
    </div>
  );
}
