import { toLatinDigits } from '@carshenas/locale/digits';
import { withPersianLetters, withoutBidiControls } from '@carshenas/locale/text';

// What a listing's own words say about a mileage the seller typed too low for the car's age (CS-101, ADR-0040). The
// structured field says «۱۰۰» for a 1400 Pars; the text decides whether that is 100 km (a car that was never driven:
// «صفر خشک», «۱۰۰ کیلومتر», «۶۰۰ دونه کار») or 100,000 km (a seller who counts in thousands: «۶۰ هزار», «۱۰۹ تا
// کیلومتر انداخته», «کارکرد ۷۳۰۰۰»). The wordings come from the 82 real listings of 2026-10-03 whose mileage CS-86 left
// unread, and from the owner's examples (docs/evidence/listing-facts/2026-10-03-mileage-in-thousands.md lists them);
// each is a pattern a seller would not write for the other reading. A wording that is only a figure of speech is left
// out on purpose: «در حد صفر» («like new») sits on cars of 1385, «موتور صفر» is an engine, «کارکرد واقعی» is real
// whichever unit the seller counts in. When the text points both ways it points nowhere. Read by code; no model.

/** What the text says the written figure means. */
export type MileageWording = {
  /** `really_low`: the figure is the kilometres driven; `thousands_text`: it counts thousands of kilometres. */
  readonly reading: 'really_low' | 'thousands_text';
  /** The words that say so, as normalised text (digits Latin, letters Persian), never longer than 120 characters. */
  readonly wording: string;
};

const ZERO_WIDTH_NON_JOINER = String.fromCodePoint(0x200c);
const TATWEEL = String.fromCodePoint(0x0640);

/** The text as the patterns read it: direction marks dropped, Persian letters and Latin digits, one space between words. */
export function normalisedText(text: string): string {
  return withPersianLetters(toLatinDigits(withoutBidiControls(text)))
    .replaceAll(ZERO_WIDTH_NON_JOINER, ' ')
    .replaceAll(TATWEEL, '')
    .replace(/\s+/g, ' ');
}

// Letters and digits of any script mark a word's edge; Persian has no \b.
const START = '(?<![\\p{L}\\p{N}])';
const END = '(?![\\p{L}\\p{N}])';
/** The start of a figure that is not the tail of a grouped one («73٬000» holds a «000» no seller means as a mileage). */
const FIGURE = `${START}(?<!\\d[,٬.])`;
const KARKARD = 'کار ?کرد(?:ه)?';
/** Money, which a «۱۰۰ هزار» or a «۱۰۰۰۰۰» may be instead of kilometres: «۱۰۰ هزار تومان تخفیف». */
const NOT_MONEY = '(?! ?(?:تومان|تومن|ریال|میلیون|تخفیف))';

function patterns(...sources: readonly string[]): readonly RegExp[] {
  return sources.map((source) => new RegExp(source, 'u'));
}

/** Wordings that say the figure is the kilometres driven, whatever it is. */
const REALLY_LOW: readonly RegExp[] = patterns(
  `${START}صفر ?خشک`,
  `${START}صفر ?(?:کیلو ?متر|کیلومتر|کیلو)`,
  `${START}بدون ${KARKARD}${END}`,
  `${START}حرکت نداشته${END}`,
  // «ماشین صفر است», «خودرو صفر می‌باشد»; «در حد صفر» and «موتور صفر» are not this.
  `${START}(?:ماشین|خودرو|خودروی|اتومبیل) صفر${END}`,
  // A figure under ten thousand with a unit that cannot mean thousands: «۴۴۰ کیلومتر», «۱۰۰ دونه کار».
  `${FIGURE}\\d{1,4} ?(?:کیلومتر|کیلو متر|کیلومتری)${END}`,
  `${FIGURE}\\d{1,4} ?(?:دونه|دانه) ?(?:${KARKARD}|کار${END}|کیلومتر)`,
  `${KARKARD} ?:? ?\\d{1,4} ?(?:دونه|دانه)${END}`,
  `${FIGURE}\\d{1,4} ${KARKARD} (?:واقعی|حقیقی)${END}`,
  // «۷۰کیلومتر راه رفته», «۷۰ راه رفته»: the figure is what the car has run.
  `${FIGURE}\\d{1,4} ?(?:کیلومتر |کیلو )?راه رفته${END}`,
);

/** The matched words of the first pattern that finds any, or undefined. */
function firstMatch(text: string, found: readonly RegExp[]): string | undefined {
  for (const pattern of found) {
    const match = pattern.exec(text);
    if (match !== null) return match[0].trim();
  }
  return undefined;
}

/** Wordings that say the figure counts thousands of kilometres, written as `figure` (a whole number, 1 or more). */
function thousandsPatterns(figure: number): readonly RegExp[] {
  const plain = String(figure * 1000);
  // «73000», «73,000», «73 000», «73.000»: the thousands grouped or not.
  const grouped = plain.replace(/\B(?=(\d{3})+(?!\d))/g, '[,٬. ]?');
  const near = `(?:${KARKARD}|کیلومتر|کیلو|km)`;
  return patterns(
    `${START}${figure} ?هزار${NOT_MONEY}`,
    `${START}${figure} ?تا ?(?:${KARKARD}|کار|کیلومتر|کیلو|انداخته)`,
    `${near} ?:? ?${START}${grouped}(?!\\d)${NOT_MONEY}`,
    `${START}${grouped}(?!\\d)${NOT_MONEY} ?${near}`,
  );
}

/**
 * What the title and description say about a mileage written as `writtenKm` (under 1,000 km, so a figure the car's age
 * makes implausible): really that low, in thousands, or nothing the code can rely on (null). A text that points both
 * ways, or a figure of 0 that cannot be thousands, is read by the stronger rule of the other reading only.
 */
export function readMileageWording(text: string, writtenKm: number): MileageWording | null {
  const words = normalisedText(text);
  const low = firstMatch(words, REALLY_LOW);
  const thousands = writtenKm >= 1 ? firstMatch(words, thousandsPatterns(writtenKm)) : undefined;
  if (low !== undefined && thousands !== undefined) return null;
  if (low !== undefined) return { reading: 'really_low', wording: low.slice(0, 120) };
  if (thousands !== undefined) return { reading: 'thousands_text', wording: thousands.slice(0, 120) };
  return null;
}
