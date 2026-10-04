// Latin words that may stand inside Persian copy (rules/english-word.mjs). Every entry has a reason; matching ignores
// case. Keep the list short: the product speaks Farsi, and a brand written in Latin letters inside a Persian sentence
// is usually better written in Persian («بی‌ام‌و»).
//
// To add one, add a line here with the reason; to allow one case only, use an inline directive
// (`// copy-lint-ignore english-word: reason`) or an entry in allowlist.json instead.

export const ALLOWED_LATIN = {
  cc: 'The unit of engine volume, as every listing and every buyer writes it («۲۰۰۰ cc»).',
  km: 'The unit of mileage in a Latin-letter column or a model name («۲۰۰ km/h»).',
};
