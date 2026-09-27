import { ActionLink } from '@/components/ui/action-link';

// The three levels of action side by side, from the shared primitive.
export function ActionLevels() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ActionLink level="primary" href="/">
        جست‌وجوی خودرو
      </ActionLink>
      <ActionLink level="secondary" href="#deal-ratings">
        ارزیابی‌ها
      </ActionLink>
      <ActionLink level="tertiary" href="#formats">
        مبلغ‌ها و تاریخ‌ها
      </ActionLink>
    </div>
  );
}
