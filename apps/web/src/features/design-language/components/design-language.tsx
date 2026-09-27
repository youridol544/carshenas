import { ActionLevels } from '@/features/design-language/components/action-levels';
import { BidiSamples } from '@/features/design-language/components/bidi-samples';
import { ColourRoles } from '@/features/design-language/components/colour-roles';
import { DealRamp } from '@/features/design-language/components/deal-ramp';
import { FormatSamples } from '@/features/design-language/components/format-samples';
import { ListingSamples } from '@/features/design-language/components/listing-samples';
import { SampleSection } from '@/features/design-language/components/sample-section';
import { TypeRoles } from '@/features/design-language/components/type-roles';

// The living sample of docs/design/design-language.md: every token and formatter on one right-to-left page, from
// fixed data, so its visual baseline catches a change to any of them.
export function DesignLanguage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold">زبان طراحی کارشناس</h1>
        <p className="max-w-reading text-body text-pretty text-muted">
          قلم، رنگ‌ها، اعداد و تاریخ‌هایی که همهٔ صفحه‌های کارشناس از آن‌ها ساخته می‌شوند، همه در یک صفحه و از
          راست به چپ.
        </p>
      </header>
      <SampleSection id="listings" title="نمونهٔ آگهی">
        <ListingSamples />
      </SampleSection>
      <SampleSection id="deal-ratings" title="ارزیابی قیمت">
        <DealRamp />
      </SampleSection>
      <SampleSection id="formats" title="مبلغ‌ها، اعداد و تاریخ‌ها">
        <FormatSamples />
      </SampleSection>
      <SampleSection id="type" title="قلم و نقش‌های متن">
        <TypeRoles />
      </SampleSection>
      <SampleSection id="colours" title="رنگ‌ها">
        <ColourRoles />
      </SampleSection>
      <SampleSection id="bidi" title="متن چپ‌به‌راست درون متن فارسی">
        <BidiSamples />
      </SampleSection>
      <SampleSection id="actions" title="کنش‌ها">
        <ActionLevels />
      </SampleSection>
    </main>
  );
}
