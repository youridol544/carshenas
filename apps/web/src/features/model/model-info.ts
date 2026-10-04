import { deal, popularModel } from '@carshenas/search/filters';
import { sortById } from '@carshenas/search/sorts';
import type { InfoContent } from '@/components/ui/info-popover';
import { filterInfo } from '@/features/search/info-content';

// What each info control of the model page says (the owner's request of 2026-10-01, in the voice of 2026-10-04: one
// question, one or two plain sentences, no headings, no threshold of ours). Assembled from the shared definitions (the
// deal filter's own words, the popular-model rule, the best-deal order), so no sentence is written twice. The
// constants of model-rules.ts decide the page's queries and are not quoted here: a buyer cannot check them.

/** The price range: what it counts and what it leaves out. */
export function rangeInfo(): InfoContent {
  return {
    title: 'محدوده‌ی قیمت',
    sections: [
      { id: 'what', paragraphs: ['بیشتر آگهی‌های این مدل قیمتی در این محدوده دارند.'] },
      {
        id: 'rule',
        paragraphs: [
          'ارزان‌ترین و گران‌ترین قیمت‌ها حساب نمی‌شوند، تا یک قیمت غیرعادی محدوده را بی‌جهت بزرگ نکند. آگهی توافقی و قسطی هم حساب نمی‌شود.',
        ],
      },
    ],
  };
}

/** The market value: what it is, and how it differs from the median of the prices beside it. */
export function marketValueInfo(): InfoContent {
  return {
    title: 'ارزش بازار',
    sections: [
      {
        id: 'what',
        paragraphs: [
          'ارزش بازار هر خودرو از روی آگهی‌های مشابه حساب می‌شود و سال ساخت، کارکرد و وضعیتش در آن اثر دارد. با میانه‌ی قیمت آگهی‌ها فرق دارد.',
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

/** The trend: where it comes from. */
export function trendInfo(): InfoContent {
  return {
    title: 'روند قیمت',
    sections: [
      {
        id: 'what',
        paragraphs: ['هر روز میانه‌ی قیمت آگهی‌های ارزیابی‌شده‌ی هر سال ساخت را ثبت می‌کنیم.'],
      },
    ],
  };
}

/** The order of the best deals: the search's own definition of it. */
export function dealsOrderInfo(): InfoContent {
  const sort = sortById('best_deal');
  return {
    title: 'ترتیب بهترین معامله‌ها',
    sections: [{ id: 'order', paragraphs: [`${sort.label}: ${sort.description}`] }],
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
          'هم گزینه‌هایی که فروشنده انتخاب کرده و هم آنچه از متن آگهی می‌خوانیم شمرده می‌شود. آگهی‌ای که موردی را ننوشته باشد، در شمارش آن مورد نمی‌آید.',
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
        paragraphs: ['میانه‌ی قیمت آگهی‌هایی که قیمت نقدی دارند، در هر سال ساخت.'],
      },
    ],
  };
}
