import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusScreen } from '@/components/layout/status-screen';

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد',
};

export default function NotFound() {
  return (
    <StatusScreen
      status={404}
      title="این صفحه پیدا نشد"
      description="شاید نشانی آن تغییر کرده یا آگهی آن حذف شده باشد. از صفحهٔ اصلی دوباره جستجو کنید."
    >
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-control bg-action px-6 text-control font-semibold text-on-action transition-colors hover:bg-action-hover"
      >
        بازگشت به صفحهٔ اصلی
      </Link>
    </StatusScreen>
  );
}
