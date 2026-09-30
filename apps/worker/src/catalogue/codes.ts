// The catalogue's code tables (CS-50): the body types a model can have and the colours a listing can state. The one
// source of both: `pnpm catalogue:sync` writes them to the body_type and colour tables, and Divar's parser reads a
// post's colour with COLOUR_BY_LABEL. Labels are Farsi; the zero-width non-joiner in them comes from ZWNJ, never typed.

const ZWNJ = String.fromCodePoint(0x200c);

export type BodyTypeCode =
  | 'sedan'
  | 'hatchback'
  | 'crossover'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'minivan'
  | 'coupe'
  | 'convertible'
  | 'wagon';

/** In the order pages show them (the body-type selector, CS-63). */
export const BODY_TYPES: readonly { readonly code: BodyTypeCode; readonly labelFa: string }[] = [
  { code: 'sedan', labelFa: 'سدان' },
  { code: 'hatchback', labelFa: `هاچ${ZWNJ}بک` },
  { code: 'crossover', labelFa: `کراس${ZWNJ}اوور` },
  { code: 'suv', labelFa: `شاسی${ZWNJ}بلند` },
  { code: 'pickup', labelFa: 'وانت' },
  { code: 'van', labelFa: 'ون' },
  { code: 'minivan', labelFa: `مینی${ZWNJ}ون` },
  { code: 'coupe', labelFa: 'کوپه' },
  { code: 'convertible', labelFa: 'کروک' },
  { code: 'wagon', labelFa: 'استیشن' },
];

export type ColourFamily =
  | 'white'
  | 'black'
  | 'grey'
  | 'silver'
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'brown'
  | 'beige'
  | 'gold'
  | 'purple'
  | 'pink'
  | 'other';

export type Colour = { readonly code: string; readonly labelFa: string; readonly family: ColourFamily };

/**
 * The colours Divar's posts name, by Divar's own word (seen in its posts on 2026-09-30, and its usual colour names);
 * a word not here is kept as an unparsed value, never guessed.
 */
export const COLOURS: readonly Colour[] = [
  { code: 'white', labelFa: 'سفید', family: 'white' },
  { code: 'pearl_white', labelFa: 'سفید صدفی', family: 'white' },
  { code: 'black', labelFa: 'مشکی', family: 'black' },
  { code: 'carbon_black', labelFa: `کربن${ZWNJ}بلک`, family: 'black' },
  { code: 'charcoal', labelFa: 'ذغالی', family: 'black' },
  { code: 'silver', labelFa: `نقره${ZWNJ}ای`, family: 'silver' },
  { code: 'titanium', labelFa: 'تیتانیوم', family: 'silver' },
  { code: 'aluminium', labelFa: 'آلومینیومی', family: 'silver' },
  { code: 'grey', labelFa: 'خاکستری', family: 'grey' },
  { code: 'ash_grey', labelFa: 'طوسی', family: 'grey' },
  { code: 'graphite', labelFa: `نوک${ZWNJ}مدادی`, family: 'grey' },
  { code: 'dolphin_grey', labelFa: 'دلفینی', family: 'grey' },
  { code: 'blue', labelFa: 'آبی', family: 'blue' },
  { code: 'navy', labelFa: `سرمه${ZWNJ}ای`, family: 'blue' },
  { code: 'silver_blue', labelFa: 'نقرآبی', family: 'blue' },
  { code: 'satin_blue', labelFa: 'اطلسی', family: 'blue' },
  { code: 'red', labelFa: 'قرمز', family: 'red' },
  { code: 'crimson', labelFa: 'زرشکی', family: 'red' },
  { code: 'cherry', labelFa: 'آلبالویی', family: 'red' },
  { code: 'cherry_red', labelFa: 'گیلاسی', family: 'red' },
  { code: 'maroon', labelFa: 'عنابی', family: 'red' },
  { code: 'aubergine', labelFa: 'بادمجانی', family: 'purple' },
  { code: 'purple', labelFa: 'بنفش', family: 'purple' },
  { code: 'lilac', labelFa: 'یاسی', family: 'purple' },
  { code: 'pink', labelFa: 'صورتی', family: 'pink' },
  { code: 'orange', labelFa: 'نارنجی', family: 'orange' },
  { code: 'yellow', labelFa: 'زرد', family: 'yellow' },
  { code: 'gold', labelFa: 'طلایی', family: 'gold' },
  { code: 'bronze', labelFa: 'برنز', family: 'gold' },
  { code: 'copper', labelFa: 'مسی', family: 'brown' },
  { code: 'brown', labelFa: `قهوه${ZWNJ}ای`, family: 'brown' },
  { code: 'mocha', labelFa: 'موکا', family: 'brown' },
  { code: 'lentil', labelFa: 'عدسی', family: 'brown' },
  { code: 'beige', labelFa: 'بژ', family: 'beige' },
  { code: 'cream', labelFa: 'کرم', family: 'beige' },
  { code: 'khaki', labelFa: 'خاکی', family: 'beige' },
  { code: 'green', labelFa: 'سبز', family: 'green' },
  { code: 'jade', labelFa: 'یشمی', family: 'green' },
  { code: 'olive', labelFa: 'زیتونی', family: 'green' },
  { code: 'other', labelFa: 'سایر', family: 'other' },
];
