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

// The country a car's brand comes from (CS-103, ADR-0041): a closed list, lower-case ISO 3166-1 codes, each with the
// name a page shows, the words buyers write for it (read by code, understand/phrases.ts) and the Latin spellings they
// type Persian words in. The country is the brand's, whoever assembled the car: «ژاپنی» is Toyota, and a Peugeot 206
// built in Iran is «فرانسوی». Where the car was built or sold from is the origin above, a separate attribute.

export const COUNTRY_CODES = [
  'ir',
  'jp',
  'kr',
  'cn',
  'de',
  'fr',
  'it',
  'us',
  'gb',
  'se',
  'cz',
  'es',
  'ro',
  'ru',
  'my',
  'in',
  'tw',
] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export type CountryDefinition = {
  readonly code: CountryCode;
  /** The name in the filter panel, the chip and the screens: «ژاپن». */
  readonly label: string;
  /**
   * The words buyers write for it, Persian and Latin letters, adjectives and nouns, as phrases (spaces and half-spaces
   * fold together). Never «ایرانی»: that word is the origin (domestic or built here), and Iran's cars are found by it.
   */
  readonly words: readonly string[];
};

export const COUNTRIES: readonly CountryDefinition[] = [
  { code: 'ir', label: 'ایران', words: [] },
  {
    code: 'jp',
    label: 'ژاپن',
    words: ['ژاپنی', 'ژاپن', 'ژاپنیه', 'japoni', 'japani', 'japan', 'japanese', 'zhaponi'],
  },
  {
    code: 'kr',
    label: 'کره جنوبی',
    words: [
      'کره ای',
      'کره‌ای',
      'کره ایه',
      'کره جنوبی',
      'koreie',
      'koreei',
      'koreai',
      'korei',
      'koree',
      'korea',
      'korean',
      'south korea',
    ],
  },
  {
    code: 'cn',
    label: 'چین',
    words: ['چینی', 'چین', 'چینیه', 'chini', 'chinie', 'chin', 'china', 'chinese'],
  },
  {
    code: 'de',
    label: 'آلمان',
    words: ['آلمانی', 'المانی', 'آلمان', 'المان', 'almani', 'almanie', 'alman', 'german', 'germany'],
  },
  {
    code: 'fr',
    label: 'فرانسه',
    words: ['فرانسوی', 'فرانسه', 'faranse', 'faransavi', 'faransei', 'farangi', 'french', 'france'],
  },
  {
    code: 'it',
    label: 'ایتالیا',
    words: ['ایتالیایی', 'ایتالیا', 'italiaei', 'italiaee', 'italiai', 'italyai', 'italian', 'italy'],
  },
  {
    code: 'us',
    label: 'آمریکا',
    words: [
      'آمریکایی',
      'امریکایی',
      'آمریکا',
      'امریکا',
      'amrikaii',
      'amrikaei',
      'amrikai',
      'amrika',
      'american',
    ],
  },
  {
    code: 'gb',
    label: 'بریتانیا',
    words: [
      'انگلیسی',
      'انگلیس',
      'بریتانیایی',
      'بریتانیا',
      'englisi',
      'engelisi',
      'english',
      'british',
      'britain',
    ],
  },
  { code: 'se', label: 'سوئد', words: ['سوئدی', 'سوئد', 'سوییدی', 'سویدی', 'sueidi', 'swedish', 'sweden'] },
  { code: 'cz', label: 'جمهوری چک', words: ['جمهوری چک', 'czech'] },
  {
    code: 'es',
    label: 'اسپانیا',
    words: ['اسپانیایی', 'اسپانیا', 'espaniaei', 'espaniai', 'spanish', 'spain'],
  },
  { code: 'ro', label: 'رومانی', words: ['رومانیایی', 'رومانی', 'romaniai', 'romanian', 'romania'] },
  { code: 'ru', label: 'روسیه', words: ['روسی', 'روسیه', 'rusi', 'rusie', 'russian', 'russia'] },
  { code: 'my', label: 'مالزی', words: ['مالزیایی', 'مالزی', 'malziai', 'malaysian', 'malaysia'] },
  { code: 'in', label: 'هند', words: ['هندی', 'هندوستان', 'hendi', 'indian'] },
  { code: 'tw', label: 'تایوان', words: ['تایوانی', 'تایوان', 'taiwani', 'taiwanese', 'taiwan'] },
];

const COUNTRY_BY_CODE: ReadonlyMap<string, CountryDefinition> = new Map(
  COUNTRIES.map((country) => [country.code, country]),
);

/** The name of a country by its code, or undefined for a value that is not one. */
export function countryLabel(code: string | null): string | undefined {
  return code === null ? undefined : COUNTRY_BY_CODE.get(code)?.label;
}

export function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_BY_CODE.has(value);
}
