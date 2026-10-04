import { formatCountOf } from '@carshenas/locale/format-number';
import { countryLabel } from '@carshenas/search/specs';

// The words of the superadmin's country editing (CS-103, ADR-0041), inside the specs section of the tracked-models
// screen. Numbers go through the locale formatters; no middle dot beside a digit.

export const COUNTRY_COPY = {
  label: 'کشور',
  makeLabel: 'کشور برند',
  modelLabel: 'کشور این مدل',
  makeEmpty: 'نامشخص',
  modelEmpty: 'همان کشور برند',
  modelHint: 'فقط وقتی پر کنید که این مدل کشورش با برند فرق دارد.',
  fromMake: (country: string) => `${country} (از برند)`,
  save: 'ذخیره',
  clear: 'برداشتن',
  unknown: 'نامشخص',
  result: {
    changed: {
      save: 'ذخیره شد؛ جست‌وجو و صفحه‌ها تا یک دقیقه‌ی دیگر آن را می‌بینند.',
      remove: 'برداشته شد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این برند یا مدل دیگر در فهرست نیست. صفحه تازه شد.',
    problem: 'یک کشور انتخاب کنید، یا برای پاک کردن «برداشتن» را بزنید.',
    failed: 'ثبت نشد. پایگاه داده پاسخ نداد؛ دوباره امتحان کنید.',
    invalid: 'فرم نامعتبر بود. صفحه را تازه کنید و دوباره امتحان کنید.',
  },
  missingMakes: {
    heading: 'برندهای بدون کشور',
    lead: 'کشور برند را بگذارید تا «ماشین ژاپنی» و مانند آن این آگهی‌ها را هم بیابد. برندهای دارای آگهی اول‌اند؛ برندهای دیگر را از جست‌وجوی نام مدل پیدا کنید.',
    withListings: (count: number) => formatCountOf(count, 'آگهی فعال'),
    none: 'همه‌ی برندها کشور دارند.',
    noneListed: (others: number) =>
      `همه‌ی برندهای دارای آگهی کشور دارند؛ ${formatCountOf(others, 'برند بدون آگهی')} هنوز ندارند و از جست‌وجوی نام مدل پیدا می‌شوند.`,
    others: (others: number) =>
      `${formatCountOf(others, 'برند بدون آگهی')} هم کشور ندارند؛ از جست‌وجوی نام مدل پیدا کنید.`,
  },
  history: {
    describe: (
      action: 'seeded' | 'added' | 'changed' | 'removed',
      scope: 'make' | 'model',
      from: string | null,
      to: string | null,
    ) => {
      const prefix = scope === 'make' ? 'کشور برند' : 'کشور این مدل';
      const name = (code: string | null) => (code === null ? '' : (countryLabel(code) ?? code));
      switch (action) {
        case 'seeded':
          return `${prefix}: مقدار اولیه، ${name(to)}`;
        case 'added':
          return `${prefix}: ${name(to)}`;
        case 'changed':
          return `${prefix}: از ${name(from)} به ${name(to)}`;
        case 'removed':
          return `${prefix} برداشته شد (پیش‌تر ${name(from)})`;
      }
    },
  },
} as const;
