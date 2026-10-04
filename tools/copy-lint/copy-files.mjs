// WHICH FILES HOLD TEXT A BUYER OR THE SUPERADMIN READS (the scope of `pnpm copy:lint` and `pnpm copy:inventory`).
//
// A source file is a copy file when it has a string with a Persian word in it (two letters of the Arabic script in a
// row; punctuation such as «،» and digits do not count) and one of these holds, tried in this order:
//
//   1. It is a test, a spec or a test-support file: not a copy file (TEST_FILE below).
//   2. It matches SHARED_TEXT: a module outside apps/web that holds words the product prints (the search
//      definitions, the notification kinds, the locale's unit words). Each entry says why.
//   3. Its name ends in `-copy.ts` or `-copy.tsx` under apps/web/src: the convention is that a feature's words live
//      in one copy file (CS-63 on), and tests import the constants instead of retyping Persian.
//   4. It matches EXCLUDED: Persian that no buyer reads (vocabulary the code matches the buyer's words against,
//      model instructions, developer reference pages, fixtures). Each entry says why.
//   5. It is under apps/web/src (or is a JSON data file under apps/web/public): any component, page or view-model file
//      with an inline Persian string is a copy file by this rule ("string contains Persian letters").
//
// A file with Persian text that none of these classifies fails `pnpm copy:lint` and `pnpm copy:test`: add it to
// SHARED_TEXT (it shows text), to EXCLUDED (it does not, say why), or move the text into a copy file.
// Globs: `*` is anything but «/», `**` anything, `{a,b}` alternatives.

/** Where to look for source files (directories, relative to the repository root, `*` for one level). */
export const SCAN_ROOTS = ['apps/web/src', 'apps/worker/src', 'packages/*/src'];

/** Data files read by the app that hold text a visitor reads (the hero photos' alt texts): `.json` under these folders. */
export const DATA_ROOTS = ['apps/web/public'];

export const TEST_FILE =
  /(?:\.test\.|\.spec\.|\.db\.test\.)(?:ts|tsx)$|(?:^|\/)(?:test-support|__tests__|__mocks__)\//;

export const SHARED_TEXT = [
  {
    glob: 'packages/search/src/{filters,catalogues,sorts,kinds,explain,mileage-reading,document,search,specs}.ts',
    reason:
      'The filter, catalogue and sort definitions: labels, descriptions, rule texts, option names, chip texts (ADR-0027), and the names of the origins and countries of origin (specs.ts, CS-99 and CS-103). Their `words` are vocabulary and are skipped.',
  },
  {
    glob: 'packages/search/src/understand/{merge,understand,intents}.ts',
    reason:
      'What the understanding step says to the buyer: its notices (merge.ts), why it ran without the model (understand.ts) and the titles and meanings of its intents (intents.ts).',
  },
  {
    glob: 'packages/notifications/src/kinds.ts',
    reason:
      'Every notification kind: the title and detail rendered from the stored payload, and the settings label and description.',
  },
  {
    glob: 'packages/locale/src/{toman,format-number}.ts',
    reason:
      'The unit words the formatters print: تومان, هزار, میلیون, میلیارد and کیلومتر. What the buyer reads in every price and mileage.',
  },
];

export const EXCLUDED = [
  {
    glob: 'apps/worker/src/**',
    reason:
      'The worker reads and parses listings and seeds the catalogue: its Persian is parser vocabulary and catalogue data, never a sentence shown to anyone (notification text is rendered from packages/notifications).',
  },
  {
    glob: 'packages/ai/**',
    reason:
      'Model instructions, glossaries and worked examples: read by a model, never by a buyer (numbers a buyer sees come from the database, never from model text).',
  },
  {
    glob: 'packages/search/src/understand/**',
    reason:
      "Vocabulary the code recognises in the buyer's own sentence: words, fillers, numbers, quantities, patterns and the test lexicon. Never shown. (merge.ts, understand.ts and intents.ts are SHARED_TEXT.)",
  },
  {
    glob: 'packages/accounts/src/**',
    reason: 'A list of passwords too common to accept: data the code matches against.',
  },
  {
    glob: 'packages/locale/src/**',
    reason:
      'Normalisation tables and digit patterns (Arabic and Persian letters and digits mapped to each other). (toman.ts and format-number.ts are SHARED_TEXT.)',
  },
  {
    glob: 'packages/observability/src/**',
    reason: 'Redaction patterns: regular expressions over digits.',
  },
  {
    glob: 'apps/web/src/app/design/**',
    reason:
      'The /design reference page and its demo: samples of type, colour and formats for developers, not product copy (noindex).',
  },
  {
    glob: 'apps/web/src/features/design-language/**',
    reason: 'The /design reference page: samples for developers, not product copy.',
  },
  {
    glob: 'apps/web/src/features/search-understanding/components/plain-search-demo.tsx',
    reason: 'The host of the /design/plain-search demo; no buyer page uses it.',
  },
  {
    glob: 'apps/web/src/app/diagnostics/**',
    reason:
      'Routes that provoke errors so the error reporting can be tested: developer tooling, not product.',
  },
  {
    glob: 'apps/web/src/features/diagnostics/**',
    reason:
      'Buttons that provoke errors so the error reporting can be tested: developer tooling, not product.',
  },
  {
    glob: 'apps/web/src/**/*-fixtures.ts',
    reason: 'Sample listings and search results used by tests and by the design pages.',
  },
  {
    glob: 'apps/web/src/server/db/*-test-database.ts',
    reason: 'Seeds for the integration tests.',
  },
];
