// The grey stand-ins of a view's first load (ui-design craft.md, section 3). Server Components: no hooks, nothing to
// hydrate. The look lives in globals.css (skeleton-bar, skeleton-block); everything here is inert and hidden from
// assistive technology, and the view that uses them says once, in a visually hidden status line, what is loading.

const LINE_KEYS = ['line-1', 'line-2', 'line-3'] as const;

type SkeletonTextProps = {
  lines?: 1 | 2 | 3;
  /** The last line is shorter, as the last line of a paragraph is. */
  lastLineWidth?: 'w-1/3' | 'w-1/2' | 'w-2/3' | 'w-full';
};

/** Placeholder text: each line is one line box of the text style around it, so it is as tall as the real text. */
export function SkeletonText({ lines = 1, lastLineWidth = 'w-2/3' }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className="flex flex-col">
      {LINE_KEYS.slice(0, lines).map((key, position) => (
        <span key={key} className="flex h-lh items-center">
          <span className={`skeleton-bar ${position === lines - 1 ? lastLineWidth : 'w-full'}`} />
        </span>
      ))}
    </span>
  );
}

/** Placeholder media: it fills the frame it is given, so the frame keeps the real photo's ratio. */
export function SkeletonBlock() {
  return <span aria-hidden="true" className="skeleton-block block size-full" />;
}

/** One chip-shaped stand-in, as wide and tall as the control it stands for. */
export function SkeletonPill({ className }: { className: string }) {
  return <span aria-hidden="true" className={`skeleton-block block rounded-full ${className}`} />;
}
