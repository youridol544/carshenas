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
  seed: 'مقدار اولیه‌ی کارشناس. بررسی کنید.',
  superadmin: 'ثبت‌شده توسط',
};

function valuesText(volumeCc: number | null, origin: string | null): string {
  const parts = [volumeCc === null ? null : formatEngineVolume(volumeCc), originLabel(origin) ?? null].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? UNKNOWN : parts.join('، ');
}

export const MODEL_SPECS_COPY = {
  heading: 'حجم موتور، مبدأ و کشور مدل‌ها',
  lead: 'آگهی‌ها معمولاً حجم موتور، مبدأ و کشور را نمی‌نویسند. حجم و مبدأ را برای هر مدل یا تیپ بگذارید، و کشور را برای برند.',
  info: {
    label: 'توضیح درباره‌ی «مشخصات مدل‌ها»',
    close: 'بستن توضیح',
    title: 'مشخصات مدل‌ها',
    inheritHeading: 'کدام مقدار به آگهی می‌رسد',
    inherit:
      'آگهی اول حجمی را می‌گیرد که در عنوانش نوشته شده، بعد مقدار تیپ، بعد مقدار مدل. مبدأ را از تیپ و بعد از مدل می‌گیرد. اگر چیزی نباشد، نامشخص می‌ماند.',
    unknownHeading: 'نامشخص یعنی چه',
    unknown:
      'آگهی بدون حجم موتور معلوم در جست‌وجوی «حجم موتور» نمی‌آید و صفحه‌ی نتایج تعداد آن‌ها را می‌گوید. با پر کردن مدل‌های بالای فهرست، این تعداد کم می‌شود.',
    valuesHeading: 'مقدارهای مجاز',
    values: `حجم را بر حسب سی‌سی بنویسید، مثلاً ${formatCount(1600)} برای موتور ۱٫۶ لیتری، از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)}. کشور مال برند است، هرجا مونتاژ شود: پژوی مونتاژ ایران «فرانسه» است.`,
  },
  coverage: {
    volume: 'حجم موتور معلوم',
    origin: 'مبدأ معلوم',
    country: 'کشور معلوم',
    missing: 'مدل‌هایی که مقدارشان کامل نیست',
    of: (known: number, all: number) => `${formatCount(known)} از ${formatCountOf(all, 'آگهی فعال')}`,
    share: (known: number, all: number) => (all === 0 ? '—' : formatPercent(known / all)),
    bySource: (listing: number, trim: number, model: number) =>
      `از حجم‌های معلوم، ${formatCountOf(listing, 'آگهی')} از عنوان خود آگهی آمده، ${formatCountOf(trim, 'آگهی')} از مقدار تیپ و ${formatCountOf(model, 'آگهی')} از مقدار مدل، که حدودی است.`,
    noneMissing: 'همه‌ی مدل‌های دارای آگهی کامل‌اند.',
  },
  search: {
    label: 'جست‌وجوی مدل در فهرست',
    placeholder: 'نام مدل یا برند، مثلاً سورنتو',
    submit: 'جست‌وجو',
    clear: 'پاک کردن جست‌وجو',
    emptyQuery: (query: string) => `مدلی با «${query}» در فهرست پیدا نشد.`,
    empty: 'هیچ مدلی آگهی ندارد.',
    hintAll:
      'مدل‌های دارای آگهی نشان داده می‌شوند و آن‌ها که مقدارشان ناقص است اول می‌آیند. برای مدل‌های دیگر نامشان را جست‌وجو کنید.',
    hintQuery: (query: string) => `مدل‌های فهرست که «${query}» در نامشان هست، پرآگهی‌ترین‌ها اول.`,
    shownOf: (shown: number) => `${formatCountOf(shown, 'مدل')} نشان داده شد. جست‌وجو را دقیق‌تر کنید.`,
  },
  model: {
    tracked: 'پوشش‌داده‌شده',
    listings: (count: number) => (count === 0 ? 'بدون آگهی فعال' : formatCountOf(count, 'آگهی فعال')),
    volumeCovered: (known: number, all: number) =>
      all === 0 ? '' : `حجم موتور ${formatCount(known)} از ${formatCountOf(all, 'آگهی')}`,
    countryCovered: (known: number, all: number) =>
      all === 0 ? '' : `کشور ${formatCount(known)} از ${formatCountOf(all, 'آگهی')}`,
    originCovered: (known: number, all: number) =>
      all === 0 ? '' : `مبدأ ${formatCount(known)} از ${formatCountOf(all, 'آگهی')}`,
    missingBadge: 'ناقص',
    wholeModel: 'کل مدل',
    edit: 'ویرایش مشخصات',
    trims: (count: number, filled: number) =>
      `${formatCountOf(count, 'تیپ')}، ${formatCount(filled)} با مقدار`,
    trimListings: (count: number) => (count === 0 ? 'بدون آگهی' : formatCountOf(count, 'آگهی')),
    inherits: (volumeCc: number | null, origin: string | null) =>
      `اگر خالی بماند، مقدار مدل را می‌گیرد: ${valuesText(volumeCc, origin)}.`,
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
          return `${scope}برداشته شد، پیش‌تر ${valuesText(change.fromVolumeCc, change.fromOrigin)}`;
      }
    },
    bySeed: 'کارشناس',
  },
  form: {
    volume: 'حجم موتور به سی‌سی',
    volumePlaceholder: 'مثلاً ۱۶۰۰',
    volumeHint: `عدد صحیح از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)}. خالی یعنی نامشخص.`,
    origin: 'مبدأ',
    originUnknown: UNKNOWN,
    save: 'ذخیره',
    clear: 'برداشتن مقدارها',
  },
  problems: {
    volume_not_number: 'حجم را فقط با رقم بنویسید، مثلاً ۱۶۰۰.',
    volume_range: `حجم موتور باید از ${formatCount(ENGINE_VOLUME_BOUNDS.min)} تا ${formatCount(ENGINE_VOLUME_BOUNDS.max)} سی‌سی باشد.`,
    empty: 'حجم یا مبدأ را بگذارید، یا «برداشتن مقدارها» را بزنید.',
  } satisfies Record<SpecProblem, string>,
  result: {
    changed: {
      save: 'ذخیره شد. تا یک دقیقه‌ی دیگر در جست‌وجو و صفحه‌ها دیده می‌شود.',
      remove: 'برداشته شد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این مدل یا تیپ دیگر در فهرست نیست. صفحه تازه شد.',
    failed: 'ذخیره نشد. دوباره امتحان کنید.',
    invalid: 'ذخیره نشد. صفحه را تازه کنید.',
  },
  card: {
    line: (volumeCc: number | null, origin: string | null) => valuesText(volumeCc, origin),
    specLabel: 'مشخصات',
    editLink: 'ویرایش مشخصات',
  },
} as const;
