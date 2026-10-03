// The two facts about a car's engine and make that the catalogue holds per model and trim (CS-99, ADR-0039): its origin
// and its engine volume. One definition of the origins, read by the filter (filters.ts), by the superadmin's form and by
// the pages that show one, so a word is written once. Runs in the browser.

/** domestic: an Iranian maker's own design; joint_venture: a foreign design built in Iran; imported: built abroad. */
export const CAR_ORIGINS = ['domestic', 'joint_venture', 'imported'] as const;
export type CarOrigin = (typeof CAR_ORIGINS)[number];

export type OriginDefinition = {
  readonly value: CarOrigin;
  /** The short word of a chip, a badge and the form's list. */
  readonly label: string;
  /** What it means, with an example, for the info control and the form's hint. */
  readonly description: string;
};

export const ORIGIN_DEFINITIONS: readonly OriginDefinition[] = [
  {
    value: 'domestic',
    label: 'ایرانی',
    description: 'طراحی خودروساز ایرانی و ساخت داخل، مثل پراید، سمند، دنا و کوییک.',
  },
  {
    value: 'joint_venture',
    label: 'ساخت مشترک',
    description: 'طراحی خارجی که در ایران با مجوز یا مشارکت ساخته می‌شود، مثل پژو ۲۰۶ و ۴۰۵.',
  },
  {
    value: 'imported',
    label: 'وارداتی',
    description: 'ساخت خارج از ایران و وارد‌شده، مثل تویوتا کرولا یا بی‌ام‌و.',
  },
];

const BY_VALUE: ReadonlyMap<string, OriginDefinition> = new Map(
  ORIGIN_DEFINITIONS.map((definition) => [definition.value, definition]),
);

/** The word for an origin, or undefined for a value that is not one. */
export function originLabel(value: string | null): string | undefined {
  return value === null ? undefined : BY_VALUE.get(value)?.label;
}

export function isCarOrigin(value: string): value is CarOrigin {
  return BY_VALUE.has(value);
}
