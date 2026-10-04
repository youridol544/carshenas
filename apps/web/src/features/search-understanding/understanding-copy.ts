// Words the plain-Farsi search says (CS-62, CS-111). Plain, short, in the glossary's terms; the copy lanes rewrite them here
// and nowhere else. What the understanding itself says about a typo, a city or a make that is not collected is written
// by code in @carshenas/search (understand/merge.ts); what the search page says about the words left out is in
// features/search/search-copy.ts.
export const UNDERSTANDING_COPY = {
  /** A number no car has («قیمت ۱ تومان»): not a filter, not a word to look for, said once. */
  implausible: (words: string) => `«${words}» برای خودرو عدد ممکنی نیست و نادیده گرفته شد.`,
  /** Unread groups beyond the ones that are looked for in the listings' text. */
  unsearched: (words: readonly string[]) =>
    `این بخش‌های جمله خوانده نشد: ${words.map((one) => `«${one}»`).join('، ')}.`,
} as const;
