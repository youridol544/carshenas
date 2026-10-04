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
      description="شاید نشانی عوض شده یا آگهی برداشته شده باشد."
    >
      <ActionLink level="primary" href="/">
        صفحه‌ی اصلی
      </ActionLink>
      <ActionLink level="secondary" href="/models">
        مدل‌های خودرو
      </ActionLink>
      <ActionLink level="secondary" href="/search">
        جست‌وجوی خودرو
      </ActionLink>
    </StatusScreen>
  );
}
