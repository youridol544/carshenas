import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import type { LucideIcon } from 'lucide-react';

// The frame every answer that is not a rating shares (CS-65, CS-115): an icon, the heading that says what the answer is,
// the words that say what is known and what happens, and the actions. The heading carries the focus when the buyer asked
// for the answer (answer-focus.tsx). `kind` tells the four states apart for the tests and the stylesheet; it is never shown.

export type PanelKind = 'queued' | 'outside' | 'unreadable' | 'off_market' | 'limited' | 'problem';

export function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

export function AnswerPanel({
  kind,
  icon,
  title,
  children,
  actions,
}: {
  kind: PanelKind;
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="check-answer-title"
      data-check-answer
      data-answer-kind={kind}
      className="flex max-w-3xl flex-col items-start gap-3 rounded-card border border-divider bg-surface-muted p-6"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-pressed text-muted">
        <Icon icon={icon} size={24} />
      </span>
      <h2 id="check-answer-title" tabIndex={-1} className="text-heading font-bold text-balance">
        {title}
      </h2>
      {children === undefined ? null : (
        <div className="flex w-full flex-col gap-3 text-body text-pretty text-default">{children}</div>
      )}
      {actions === undefined ? null : <Actions>{actions}</Actions>}
    </section>
  );
}
