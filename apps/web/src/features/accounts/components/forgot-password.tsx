import { ChevronDown } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { ACCOUNT_COPY } from '@/features/accounts/accounts-copy';

// What a person who forgot their password is looking for, on the sign-in page: not a reset link that cannot work
// (nothing can be recovered until phone sign-in arrives, ADR-0020 point 11), but the honest answer, in a native
// disclosure that works without JavaScript. Its own marker goes with the flex layout, so a chevron says whether it is
// open; it turns over at once, without motion.
export function ForgotPassword() {
  return (
    <details className="group text-secondary text-muted">
      <summary className="inline-flex min-h-11 items-center gap-1 text-link">
        {ACCOUNT_COPY.signIn.forgotSummary}
        <Icon icon={ChevronDown} size={16} className="group-open:rotate-180" />
      </summary>
      <p className="text-pretty">{ACCOUNT_COPY.signIn.forgotBody}</p>
    </details>
  );
}
