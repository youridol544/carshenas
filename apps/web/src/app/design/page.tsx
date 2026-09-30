import type { Metadata } from 'next';
import { BODY_TYPE_CODES } from '@/features/body-types/body-types';
import { BodyTypeCredits } from '@/features/body-types/components/body-type-credits';
import { BodyTypeSelector } from '@/features/body-types/components/body-type-selector';
import { DesignLanguage } from '@/features/design-language/components/design-language';

export const metadata: Metadata = {
  title: 'زبان طراحی',
  description: 'نمونه‌ی زنده‌ی قلم، رنگ‌ها، اعداد و تاریخ‌های کارشناس.',
  robots: { index: false },
};

export default function DesignPage() {
  return (
    <DesignLanguage
      bodyTypes={
        <>
          <BodyTypeSelector available={BODY_TYPE_CODES} name="body-type" legend="کدام بدنه را می‌خواهید؟" />
          <BodyTypeCredits />
        </>
      }
    />
  );
}
