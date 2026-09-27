import { formatToman, toToman } from '@/lib/toman';

// Every type role with its size, Persian line height and a sample in its own role (design-language.md).
const ROLES = [
  { role: 'display', spec: '36px · 1.3 · 700', sample: formatToman(toToman(680_000_000)) },
  { role: 'title', spec: '24px · 1.5 · 700', sample: 'پژو ۲۰۶ تیپ ۲، مدل ۱۴۰۰' },
  { role: 'heading', spec: '20px · 1.6 · 700', sample: 'خودروهای مشابه در تهران' },
  {
    role: 'body',
    spec: '16px · 1.75 · 400',
    sample:
      'بدون رنگ و بدون تصادف، بیمهٔ شخص ثالث تا اسفند. قیمت کارشناسی‌شدهٔ بازار حدود ۶۸۰ میلیون تومان است و این آگهی «منصفانه» ارزیابی شده است.',
  },
  { role: 'control', spec: '16px · 1.5 · 600', sample: 'تأیید آگهی؛ پراید غ' },
  {
    role: 'secondary',
    spec: '14px · 1.6 · 400',
    sample: 'ارزش بازار از ۴۲ آگهی مشابه در سی روز گذشته برآورد شده است.',
  },
  { role: 'label', spec: '14px · 1.5 · 500', sample: 'معامله‌ی عالی' },
  { role: 'meta', spec: '12px · 1.5 · 400', sample: 'تهران · ۳ ساعت پیش' },
] as const;

type Role = (typeof ROLES)[number]['role'];

const classes = {
  display: 'text-display font-bold',
  title: 'text-title font-bold',
  heading: 'text-heading font-bold',
  body: 'text-body',
  control: 'text-control font-semibold',
  secondary: 'text-secondary text-muted',
  label: 'text-label font-medium',
  meta: 'text-meta text-muted',
} as const satisfies Record<Role, string>;

export function TypeRoles() {
  return (
    <ul className="flex flex-col gap-6">
      {ROLES.map(({ role, spec, sample }) => (
        <li key={role} className="flex flex-col gap-1 border-b border-divider pb-4">
          <code dir="ltr" lang="en" className="self-start text-meta text-subtle">
            text-{role} · {spec}
          </code>
          <p className={classes[role]}>{sample}</p>
        </li>
      ))}
    </ul>
  );
}
