import type { Metadata } from 'next';
import { ButtonStates } from '@/features/design-language/components/button-states';

export const metadata: Metadata = {
  title: 'حالت‌های دکمه',
  description: 'نمونه‌ی زنده‌ی دکمه‌ی کارشناس در هر سطح و هر حالت.',
  robots: { index: false },
};

export default function ButtonStatesPage() {
  return <ButtonStates />;
}
