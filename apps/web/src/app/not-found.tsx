import type { Metadata } from 'next';
import { StatusScreen } from '@/components/layout/status-screen';
import { ActionLink } from '@/components/ui/action-link';

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد',
};

export default function NotFound() {
  return (
    <StatusScreen
      status={404}
      title="این صفحه پیدا نشد"
      description="شاید نشانی آن تغییر کرده یا آگهی آن حذف شده باشد. از صفحه‌ی اصلی دوباره جست‌وجو کنید."
    >
      <ActionLink level="primary" href="/">
        بازگشت به صفحه‌ی اصلی
      </ActionLink>
    </StatusScreen>
  );
}
