import { formatCount } from '@carshenas/locale/format-number';

type StatusScreenProps = {
  /** The HTTP status the screen stands for, printed in Persian digits: 404 reads «۴۰۴». */
  status: number;
  title: string;
  /** One sentence that adds to the title (a cause), or nothing: the ways out are the buttons. */
  description?: string;
  /** The ways out: at most one solid primary action, then quieter ones. */
  children: React.ReactNode;
  /** A quiet line under the description, such as an error's reference code. */
  details?: React.ReactNode;
  /** Marks the root the gorilla's error-screen oracle looks for; error.tsx and global-error.tsx set it. */
  errorScreen?: boolean;
};

// The whole-page block the not-found and error screens share. It takes its ways out as children, so it holds no
// words of its own and each screen writes its own copy.
export function StatusScreen({
  status,
  title,
  description,
  children,
  details,
  errorScreen = false,
}: StatusScreenProps) {
  return (
    <main
      data-error-screen={errorScreen ? '' : undefined}
      className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-4 px-4 py-12"
    >
      <p className="text-display font-bold text-subtle">{formatCount(status)}</p>
      <h1 className="text-title font-bold text-balance">{title}</h1>
      {description === undefined ? null : <p className="text-body text-pretty text-muted">{description}</p>}
      {details}
      <div className="mt-4 flex flex-wrap gap-3">{children}</div>
    </main>
  );
}
