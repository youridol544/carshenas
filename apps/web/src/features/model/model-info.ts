import { formatCountOf, formatPercent } from '@carshenas/locale/format-number';
import { deal, popularModel } from '@carshenas/search/filters';
import { sortById } from '@carshenas/search/sorts';
import type { InfoContent } from '@/components/ui/info-popover';
import { filterInfo } from '@/features/search/info-content';
import { SEARCH_COPY } from '@/features/search/search-copy';
import {
  BAND_HIGH_FRACTION,
  BAND_LOW_FRACTION,
  CHANGE_TOLERANCE_DAYS,
  CHANGE_WINDOWS_DAYS,
  RANGE_HIGH_FRACTION,
  RANGE_LOW_FRACTION,
  TREND_DAILY_UNTIL_DAYS,
  TREND_MIN_LISTINGS,
  TREND_MIN_POINTS,
} from '@/features/model/model-rules';

// What each info control of the model page says (the owner's request of 2026-10-01): assembled from the shared
// definitions (the deal filter's own words, the popular-model rule, the best-deal order) and from the constants the
// model queries use, so no number is written twice and no sentence can drift from the query behind it.

const INFO = SEARCH_COPY.info;

/** The price range: what it leaves out. */
export function rangeInfo(): InfoContent {
  const share = formatPercent(RANGE_HIGH_FRACTION - RANGE_LOW_FRACTION);
  return {
    title: 'محدوده‌ی قیمت',
    sections: [
      {
        id: 'what',
        paragraphs: [
          'قیمتی که بیشتر آگهی‌های این مدل در آن می‌گنجند. فقط آگهی‌هایی که قیمت نقدی نوشته‌اند شمرده می‌شوند؛ توافقی و قسطی کنار می‌روند.',
        ],
      },
      {
        id: 'rule',
        heading: INFO.rule,
        paragraphs: [
          `${formatPercent(RANGE_LOW_FRACTION)} ارزان‌ترین و ${formatPercent(1 - RANGE_HIGH_FRACTION)} گران‌ترین قیمت‌ها کنار گذاشته می‌شود تا یک آگهی بسیار ارزان یا بسیار گران محدوده را بی‌جهت باز نکند؛ می‌ماند ${share} میانی.`,
        ],
      },
    ],
  };
}

/** The market value: the deal filter's own explanation, then how this page sums it up. */
export function marketValueInfo(): InfoContent {
  return {
    title: 'ارزش بازار',
    sections: [
      { id: 'what', paragraphs: [deal.description] },
      {
        id: 'rule',
        heading: INFO.rule,
        paragraphs: [
          'ارزش بازار هر آگهی برای خودروی همان آگهی حساب می‌شود (سال ساخت، کارکرد، وضعیت). این‌جا میانه‌ی آن ارزش‌ها را می‌بینید: ارزش خودروی معمولیِ آگهی‌شده، نه قیمت درخواستیِ فروشنده‌ها.',
        ],
      },
    ],
  };
}

/** The ratings' bands, from the deal filter's own rules. */
export function ratingsInfo(): InfoContent {
  const content = filterInfo(deal);
  return { title: 'ارزیابی قیمت آگهی‌ها', sections: content.sections };
}

/** The trend: where it comes from, how a point is made, when a change is stated. */
export function trendInfo(): InfoContent {
  return {
    title: 'روند قیمت',
    sections: [
      {
        id: 'what',
        paragraphs: [
          'روند قیمت از ثبت‌های روزانه‌ی خود کارشناس ساخته می‌شود: هر روز آگهی‌های ارزیابی‌شده‌ی یک سال ساخت از این مدل را می‌شمارد و میانه‌ی قیمتشان را نگه می‌دارد. از تاریخ ثبت آگهی‌ها حساب نمی‌شود، چون آگهی‌های فروش‌رفته در آن نیستند و نمودار را گمراه می‌کردند.',
        ],
      },
      {
        id: 'rule',
        heading: INFO.rule,
        rows: [
          {
            label: 'نقطه',
            text: `هر روز دست‌کم ${formatCountOf(TREND_MIN_LISTINGS, 'آگهی')} ارزیابی‌شده از آن سال ساخت لازم است؛ با آگهی کمتر نقطه‌ای نمی‌گذاریم.`,
          },
          {
            label: 'نوار',
            text: `${formatPercent(BAND_HIGH_FRACTION - BAND_LOW_FRACTION)} میانیِ قیمت‌ها، از ${formatPercent(BAND_LOW_FRACTION)} تا ${formatPercent(BAND_HIGH_FRACTION)} ردیف قیمت‌ها.`,
          },
          {
            label: 'روز و هفته',
            text: `تا ${formatCountOf(TREND_DAILY_UNTIL_DAYS, 'روز')} تاریخچه هر نقطه یک روز است؛ بیشتر از آن هر نقطه یک هفته (از شنبه) است.`,
          },
          {
            label: 'نمودار',
            text: `دست‌کم ${formatCountOf(TREND_MIN_POINTS, 'نقطه')} لازم است؛ پیش از آن می‌گوییم تاریخچه هنوز کوتاه است.`,
          },
          {
            label: 'تغییر',
            text: `تغییر ${CHANGE_WINDOWS_DAYS.map((days) => formatCountOf(days, 'روز')).join(' و ')} پیش فقط وقتی گفته می‌شود که ثبتی نزدیک به همان روز (با ${formatCountOf(CHANGE_TOLERANCE_DAYS, 'روز')} اختلاف) داشته باشیم.`,
          },
        ],
      },
    ],
  };
}

/** The order of the best deals: the search's own definition of it. */
export function dealsOrderInfo(): InfoContent {
  const sort = sortById('best_deal');
  return {
    title: 'ترتیب بهترین معامله‌ها',
    sections: [{ id: 'order', heading: INFO.order, paragraphs: [`${sort.label}: ${sort.description}`] }],
  };
}

/** «مدل پرطرفدار»: the filter's own description and rule. */
export function popularInfo(): InfoContent {
  return filterInfo(popularModel);
}

/** The condition facts: what is counted. */
export function factsInfo(): InfoContent {
  return {
    title: 'آگهی‌ها چه می‌گویند',
    sections: [
      {
        id: 'what',
        paragraphs: [
          'شمارش آگهی‌های این مدل بر پایه‌ی آنچه فروشنده نوشته یا از متن آگهی خوانده شده است. آگهی‌ای که چیزی درباره‌ی موردی ننوشته در شمارش آن مورد نیست.',
        ],
      },
    ],
  };
}

/** The by-year table. */
export function yearsInfo(): InfoContent {
  return {
    title: 'قیمت به تفکیک سال ساخت',
    sections: [
      {
        id: 'what',
        paragraphs: [
          'میانه‌ی قیمت آگهی‌هایی که قیمت نقدی نوشته‌اند، در هر سال ساخت (شمسی). میانه یعنی نیمی از آگهی‌ها ارزان‌تر و نیمی گران‌تر از آن هستند.',
        ],
      },
    ],
  };
}
