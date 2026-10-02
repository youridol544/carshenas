import type { Metadata } from 'next';
import { PlainSearchDemo } from '@/features/search-understanding/components/plain-search-demo';

export const metadata: Metadata = {
  title: 'جست‌وجوی جمله‌ای',
  description: 'نمونه‌ی زنده‌ی جست‌وجوی فارسی ساده: جمله را بنویسید، فیلترهایی که فهمیدیم را ببینید.',
  robots: { index: false },
};

export default function PlainSearchPage() {
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8">
      <h1 className="text-title text-default">جست‌وجوی جمله‌ای</h1>
      <PlainSearchDemo />
    </main>
  );
}
