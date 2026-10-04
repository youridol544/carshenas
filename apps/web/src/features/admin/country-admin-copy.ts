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
  modelHint: 'فقط اگر کشور این مدل با برندش فرق دارد، انتخاب کنید.',
  fromMake: (country: string) => `${country}، از برند`,
  save: 'ذخیره',
  clear: 'برداشتن',
  unknown: 'نامشخص',
  result: {
    changed: {
      save: 'ذخیره شد. تا یک دقیقه‌ی دیگر در جست‌وجو و صفحه‌ها دیده می‌شود.',
      remove: 'برداشته شد.',
    },
    unchanged: 'پیش‌تر همین‌طور بود.',
    missing: 'این برند یا مدل دیگر در فهرست نیست. صفحه تازه شد.',
    problem: 'کشوری انتخاب کنید یا «برداشتن» را بزنید.',
    failed: 'ذخیره نشد. دوباره امتحان کنید.',
    invalid: 'ذخیره نشد. صفحه را تازه کنید.',
  },
  missingMakes: {
    heading: 'برندهای بدون کشور',
    lead: 'با گذاشتن کشور برند، جست‌وجوی «ماشین ژاپنی» و مانند آن این آگهی‌ها را هم پیدا می‌کند. برندهای دارای آگهی اول آمده‌اند.',
    withListings: (count: number) => formatCountOf(count, 'آگهی فعال'),
    none: 'همه‌ی برندها کشور دارند.',
    noneListed: (others: number) =>
      `همه‌ی برندهای دارای آگهی کشور دارند. برای ${formatCountOf(others, 'برند بدون آگهی')} نام مدل را جست‌وجو کنید.`,
    others: (others: number) =>
      `${formatCountOf(others, 'برند بدون آگهی')} هم کشور ندارند و با جست‌وجوی نام مدل پیدا می‌شوند.`,
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
          return `${prefix} برداشته شد، پیش‌تر ${name(from)}`;
      }
    },
  },
} as const;
