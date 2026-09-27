import type { Metadata } from 'next';
import { DesignLanguage } from '@/features/design-language/components/design-language';

export const metadata: Metadata = {
  title: 'زبان طراحی',
  description: 'نمونهٔ زندهٔ قلم، رنگ‌ها، اعداد و تاریخ‌های کارشناس.',
  robots: { index: false },
};

export default function DesignPage() {
  return <DesignLanguage />;
}
