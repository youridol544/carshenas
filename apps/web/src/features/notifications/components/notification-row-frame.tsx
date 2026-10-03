// The geometry of one notification in the inbox, in one place (ui-design craft.md, section 3): the real row and its
// skeleton both render this frame, so they are the same height (L-20, measured at 412 and 320 px in the task's notes).
// Every slot has a fixed height of its own type role: a title and a detail of two lines each (clamped to two, and
// reserving two), then one line each for the price and the price before (never clamped: a number is never cut), and a
// last row, the time with the mark-read button at its inline end. The button sits in that row rather than a column of
// its own, so the text keeps the width a 320 px phone needs for a full price. It has no hooks and no directive, so both
// the list (client) and the skeleton (server) render it.

type NotificationRowFrameProps = {
  /** The kind's glyph in its tinted circle, at the inline start. */
  icon: React.ReactNode;
  title: React.ReactNode;
  detail: React.ReactNode;
  price: React.ReactNode;
  /** The price before, struck through, on its own line: beside the price it wrapped on narrow phones. */
  previous: React.ReactNode;
  meta: React.ReactNode;
  /** The mark-read button, at the inline end of the last row, above the stretched link. */
  action?: React.ReactNode;
};

export function NotificationRowFrame({
  icon,
  title,
  detail,
  price,
  previous,
  meta,
  action,
}: NotificationRowFrameProps) {
  // A row with no price (a search file's digest) is compact: it reserves neither the price slots nor two lines for the
  // title and detail, so it is not a third empty. The skeleton always passes a price, so it keeps the tall frame.
  const compact = price === null;
  return (
    <div className="relative flex items-start gap-3 px-4 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-default">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className={`line-clamp-2 text-control font-semibold text-pretty text-default ${compact ? '' : 'min-h-2lh'}`}
        >
          {title}
        </div>
        {compact && detail === undefined ? null : (
          <div className={`line-clamp-2 text-secondary text-pretty text-muted ${compact ? '' : 'min-h-2lh'}`}>
            {detail}
          </div>
        )}
        {compact ? null : (
          <>
            <div className="min-h-lh text-control">{price}</div>
            <div className="min-h-lh text-meta text-subtle">{previous}</div>
          </>
        )}
        <div className="flex min-h-7 items-center justify-between gap-3">
          <div className="min-w-0 text-meta text-subtle">{meta}</div>
          <div className="relative z-10 flex shrink-0">{action}</div>
        </div>
      </div>
    </div>
  );
}
