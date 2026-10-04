import { toLatinDigits } from './digits.ts';
import { formatCountOf } from './format-number.ts';
import { withoutBidiControls } from './text.ts';

// An engine's volume in cubic centimetres (CS-99, ADR-0039): how a stated volume is read («۱۶۰۰ سی‌سی», «۱.۶ لیتری»,
// «1400cc») and how a volume is written on screen («۱٬۶۰۰ سی‌سی»). Data holds whole cubic centimetres in Latin digits;
// a litre figure is converted (1.6 L is 1600 cc). A volume is read only when its unit is written beside it: a bare
// «۱۶۰۰» is a year, a mileage or a price until a unit says otherwise.

/** The volumes a car can have in the data: from a small kei car to a hypercar (listing_engine_volume_cc_range). */
export const ENGINE_VOLUME_BOUNDS = { min: 500, max: 9000 } as const;

const ZERO_WIDTH_NON_JOINER = String.fromCharCode(0x200c);
/** «سی‌سی», with the half-space between the two syllables. */
export const CC_UNIT_FA = `سی${ZERO_WIDTH_NON_JOINER}سی`;

/** Whether a figure is a volume the data accepts. */
export function isEngineVolume(cc: number): boolean {
  return Number.isInteger(cc) && cc >= ENGINE_VOLUME_BOUNDS.min && cc <= ENGINE_VOLUME_BOUNDS.max;
}

/** «۱٬۶۰۰ سی‌سی»: a volume in whole cubic centimetres, joined to its unit by a no-break space. */
export function formatEngineVolume(cc: number): string {
  return formatCountOf(cc, CC_UNIT_FA);
}

// Persian and Arabic digits are folded to Latin first. The decimal separators are a dot, «٫» and «/».
const SEPARATORS = `${ZERO_WIDTH_NON_JOINER} `;
const CC_WRITTEN = new RegExp(
  `(?<![\\d.٫/])(\\d{3,4})[${SEPARATORS}]*(?:cc|c\\.c\\.?|سی[${SEPARATORS}]?سی)(?![a-z])`,
  'iu',
);
const LITRE_WRITTEN = new RegExp(
  `(?<![\\d.٫/])(\\d(?:[.٫/]\\d{1,2})?)[${SEPARATORS}]*(?:لیتری|لیتر|litre|liter|lit)(?![a-z\\u0600-\\u06ff])`,
  'iu',
);
const LITRE_L = /(?<![\d.٫/])(\d[.٫/]\d)\s*l(?![a-z])/iu;

// A litre figure is easily something else: «مصرف ۸ لیتر» is fuel use, «۵ لیتر روغن» oil, «باک ۵۰ لیتری» a tank. A title's own
// volume beats the trim's and the model's, so a wrong read does damage a missing one does not: a litre figure is read
// only when it is a decimal («۱٫۶ لیتر»), or a whole number followed by «لیتری» or «لیتر موتور» or preceded by «حجم» or
// «موتور», has none of those words near it, and lies between 0.6 and 7.0 litres.
const NOT_AN_ENGINE = /مصرف|ظرفیت|روغن|باک|بنزین|گاز|سوخت|ساعت|کیلومتر|دنده|مخزن|پیمایش/u;
const AROUND = 14;

function litreContextIsEngine(plain: string, at: number, length: number, hasDecimal: boolean): boolean {
  const near = plain.slice(Math.max(0, at - AROUND), at + length + AROUND);
  if (NOT_AN_ENGINE.test(near)) return false;
  if (hasDecimal) return true;
  const after = plain.slice(at, at + length + 12);
  const before = plain.slice(Math.max(0, at - 10), at);
  return after.includes('لیتری') || /لیتر[\s‌]*موتور/u.test(after) || /(?:حجم|موتور)[\s‌]*$/u.test(before);
}

/**
 * The volume a title or a sentence states with its unit, in whole cubic centimetres, or null when it states none. «موتور
 * ۱۴۰۰ سی‌سی» and «1400cc» are 1400; «۲ لیتری» and «۱٫۶ لیتر» are 2000 and 1600. A figure outside 500 to 9,000 cc is no
 * engine (a taxi's «750 لیتر بنزین» is fuel), a litre figure in a fuel, oil, tank or gearbox context is not one either,
 * and a bare number with no unit is not read.
 */
export function readEngineVolume(text: string): number | null {
  const plain = toLatinDigits(withoutBidiControls(text));
  const cc = CC_WRITTEN.exec(plain);
  if (cc?.[1] !== undefined) {
    const value = Number(cc[1]);
    return isEngineVolume(value) ? value : null;
  }
  const litres = LITRE_WRITTEN.exec(plain) ?? LITRE_L.exec(plain);
  if (litres?.[1] !== undefined) {
    const hasDecimal = /[.٫/]/u.test(litres[1]);
    if (!litreContextIsEngine(plain, litres.index, litres[0].length, hasDecimal || LITRE_L.test(plain)))
      return null;
    const value = Math.round(Number(litres[1].replace(/[٫/]/u, '.')) * 1000);
    return value >= 600 && value <= 7000 ? value : null;
  }
  return null;
}
