import { formatCount, formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { ENGINE_VOLUME_BOUNDS, formatEngineVolume } from '@carshenas/locale/engine-volume';
import type { SpecProblem } from '@/lib/model-spec-rules';
import type { SpecChange, SpecSource } from '@/features/admin/server/model-spec-queries';
import { originLabel } from '@carshenas/search/specs';

// The words of the superadmin's engine volume and origin section (CS-99, ADR-0039), inside the tracked-models screen.
// Numbers go through the locale formatters; no middle dot beside a digit (it reads as a zero).

const UNKNOWN = 'نامشخص';

export const SOURCE_LABELS: Record<SpecSource, string> = {
  catalogue: 'از نام تیپ در فهرست',
  seed: 'مقدار اولیه‌ی کارشناس؛ بررسی کنید',
  superadmin: 'ثبت‌شده‌ی',
};

function valuesText(volumeCc: number | null, origin: string | null): string {
  const parts = [volumeCc === null ? null : formatEngineVolume(volumeCc), originLabel(origin) ?? null].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? UNKNOWN : parts.join('، ');
}

export const MODEL_SPECS_COPY = {
  heading: 'حجم موتور و مبدأ مدل‌ها',
  lead: 'خریداران با حجم موتور («بیشتر از ۲۰۰۰ سی‌سی») و مبدأ («خارجی»، «ایرانی») جست‌وجو می‌کنند، اما آگهی‌ها معمولاً این‌ها را نمی‌نویسند. اینجا برای هر مدل، و در صورت لزوم هر تیپ، حجم موتور و مبدأ را بگذارید تا جست‌وجو و صفحه‌ها از آن استفاده کنند. هر تغییر با نام شما و زمانش ثبت می‌شود.',
  info: {
    label: 'توضیح درباره‌ی «حجم موتور و مبدأ»',
    close: 'بستن توضیح',
    title: 'حجم موتور و مبدأ از کجا می‌آید',
    inheritHeading: 'کدام مقدار به آگهی می‌رسد',
    inherit:
      'هر آگهی ابتدا حجمی را که خودش در عنوان نوشته دارد، وگرنه مقدار تیپ خودش، وگرنه مقدار مدلش. مبدأ را از تیپ و سپس مدل می‌گیرد. جایی که چیزی نباشد، نامشخص می‌ماند و حدس زده نمی‌شود.',
    unknownHeading: 'نامشخص یعنی چه',
    unknown:
      'آگهی بدون حجم موتور معلوم در جست‌وجوی «حجم موتور» نمی‌آید و صفحه‌ی نتایج می‌گوید چند آگهی همین دلیل کنار رفته است. با پرکردن مدل‌هایی که اینجا بالا آمده‌اند، این عدد کم می‌شود.',
    valuesHeading: 'چه عددی بگذارم',
    values: `حجم اسمی بر حسب سی‌سی، همان عددی که فروشنده و خریدار می‌نویسند (مثلاً ${formatCount(1600)} برای موتور ۱٫۶ لیتری)، از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)}. مبدأ: ایرانی یعنی طراحی ایرانی، ساخت مشترک یعنی طراحی خارجی که در ایران ساخته می‌شود، وارداتی یعنی ساخت خارج.`,
  },
  coverage: {
    volume: 'حجم موتور معلوم',
    origin: 'مبدأ معلوم',
    missing: 'مدل با آگهی ناقص',
    of: (known: number, all: number) => `${formatCount(known)} از ${formatCountOf(all, 'آگهی فعال')}`,
    share: (known: number, all: number) => (all === 0 ? '—' : formatPercent(known / all)),
    noneMissing: 'همه‌ی مدل‌های دارای آگهی کامل‌اند.',
  },
  search: {
    label: 'جست‌وجوی مدل در فهرست',
    placeholder: 'نام مدل یا برند، مثلاً سورنتو',
    submit: 'جست‌وجو',
    clear: 'نمایش مدل‌های دارای آگهی',
    emptyQuery: (query: string) => `مدلی با «${query}» در فهرست پیدا نشد.`,
    empty: 'هنوز مدلی آگهی ندارد. مدلی را از جست‌وجوی بالا پیدا کنید.',
    hintAll:
      'مدل‌هایی که آگهی دارند نشان داده می‌شوند؛ آن‌ها که مقدارشان ناقص است اول‌اند. هر مدل دیگری را از فهرست با جست‌وجوی نام پیدا کنید.',
    hintQuery: (query: string) => `مدل‌های فهرست که «${query}» در نامشان هست، پرآگهی‌ترین‌ها اول.`,
    shownOf: (shown: number) => `${formatCountOf(shown, 'مدل')} نشان داده شد؛ جست‌وجو را دقیق‌تر کنید.`,
  },
  model: {
    tracked: 'پوشش‌داده‌شده',
    listings: (count: number) => (count === 0 ? 'بدون آگهی فعال' : formatCountOf(count, 'آگهی فعال')),
    volumeCovered: (known: number, all: number) =>
      all === 0 ? '' : `حجم موتور برای ${formatCount(known)} از ${formatCountOf(all, 'آگهی')} معلوم است.`,
    originCovered: (known: number, all: number) =>
      all === 0 ? '' : `مبدأ برای ${formatCount(known)} از ${formatCountOf(all, 'آگهی')} معلوم است.`,
    missingBadge: 'ناقص',
    wholeModel: 'کل مدل',
    trims: (count: number, filled: number) =>
      `تیپ‌ها: ${formatCount(count)}، دارای مقدار: ${formatCount(filled)}`,
    trimListings: (count: number) => (count === 0 ? 'بدون آگهی' : formatCountOf(count, 'آگهی')),
    inherits: (volumeCc: number | null, origin: string | null) =>
      `اگر خالی بماند، مقدار مدل می‌رسد: ${valuesText(volumeCc, origin)}.`,
    inheritsNothing: 'اگر خالی بماند، مقدارش نامشخص است.',
  },
  history: {
    heading: 'تغییرها',
    empty: 'تغییری ثبت نشده است.',
    describe: (change: SpecChange) => {
      const scope = change.scope === null ? '' : `${change.scope}: `;
      switch (change.action) {
        case 'seeded':
          return `${scope}مقدار اولیه: ${valuesText(change.toVolumeCc, change.toOrigin)}`;
        case 'added':
          return `${scope}افزوده شد: ${valuesText(change.toVolumeCc, change.toOrigin)}`;
        case 'changed':
          return `${scope}از ${valuesText(change.fromVolumeCc, change.fromOrigin)} به ${valuesText(change.toVolumeCc, change.toOrigin)}`;
        case 'removed':
          return `${scope}برداشته شد (پیش‌تر ${valuesText(change.fromVolumeCc, change.fromOrigin)})`;
      }
    },
    bySeed: 'پیش‌فرض کارشناس',
  },
  form: {
    volume: 'حجم موتور (سی‌سی)',
    volumePlaceholder: 'مثلاً ۱۶۰۰',
    volumeHint: `عدد صحیح، از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)}؛ خالی یعنی نامشخص.`,
    origin: 'مبدأ',
    originUnknown: UNKNOWN,
    save: 'ذخیره',
    clear: 'برداشتن مقدارها',
  },
  problems: {
    volume_not_number: 'حجم را فقط با رقم بنویسید، مثلاً ۱۶۰۰.',
    volume_range: `حجم موتور باید از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)} سی‌سی باشد.`,
    empty: 'حجم یا مبدأ را بگذارید، یا برای پاک کردن «برداشتن مقدارها» را بزنید.',
  } satisfies Record<SpecProblem, string>,
  result: {
    changed: {
      save: 'ذخیره شد؛ جست‌وجو و صفحه‌ها تا یک دقیقه‌ی دیگر آن را می‌بینند.',
      remove: 'برداشته شد؛ مقدار از مدل می‌رسد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این مدل یا تیپ دیگر در فهرست نیست. صفحه تازه شد.',
    failed: 'ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.',
    invalid: 'فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.',
  },
  card: {
    line: (volumeCc: number | null, origin: string | null) => valuesText(volumeCc, origin),
    specLabel: 'مشخصات',
    editLink: 'ویرایش مشخصات',
  },
} as const;
