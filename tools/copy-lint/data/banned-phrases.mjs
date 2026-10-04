// THE LIST OF BANNED PHRASES AND PATTERNS: filler, machine-written and translated Farsi, bureaucratic verbs, praise and
// apologies. One list, one file; every entry says why. `pnpm copy:lint` reads it through rules/banned-phrase.mjs.
//
// To add one: append an entry below and a sample line to rules/banned-phrase.mjs only if it needs its own case (the rule's
// test already runs every entry's `examples` through the matcher: an entry without an example fails the test).
//
//   id        a short kebab-case name, unique; it shows in the report
//   group     filler | translated | bureaucratic | praise | apology | technical
//   why       one sentence in English: what is wrong with it
//   instead   one sentence in English: what to write instead
//   phrases   plain phrases, matched as whole words
//   patterns  regular-expression sources for what a phrase list cannot say, matched on the normalised text
//   examples  at least one string that must match (tested)
//   except    optional file globs where the entry does not apply (the superadmin screens may name a queue)
//
// Matching is done on text where the half-space (ZWNJ) and the no-break space are plain spaces, so write «می توانید» with
// a space and it finds «می‌توانید» too. A pattern writes a gap as `\s+`. Words match whole: «گردد» does not match inside
// «برگردد». The terms the voice guide (CS-104, docs/design/product-voice.md) says are never shown to a buyer go in the
// `technical` group at the end.

export const BANNED = [
  {
    id: 'todays-world',
    group: 'filler',
    why: 'An opening that could start any page and says nothing about the car or the product.',
    instead: 'Start with the fact the buyer needs.',
    phrases: ['در دنیای امروز', 'در دنیای امروزی', 'در جهان امروز', 'در عصر حاضر'],
    examples: ['در دنیای امروز خرید ماشین سخت است'],
  },
  {
    id: 'stay-with-us',
    group: 'filler',
    why: 'A marketing sign-off: it tells the buyer nothing and promises nothing.',
    instead: 'Say what to do next, or say nothing.',
    phrases: ['با ما همراه باشید', 'همراه ما باشید', 'با ما بمانید'],
    examples: ['برای خبرهای بیشتر با ما همراه باشید'],
  },
  {
    id: 'allows-you-to',
    group: 'translated',
    why: 'A translated «allows you to»: the product is not a host granting permission.',
    instead: 'Say what the buyer can do, directly: the verb, or «می‌توانید ...».',
    patterns: [
      'به\\s+شما\\s+این\\s+امکان\\s+را\\s+می\\s+(?:دهد|دهیم|دهند)',
      'این\\s+امکان\\s+را\\s+به\\s+شما\\s+می\\s+(?:دهد|دهیم|دهند)',
      'شما\\s+را\\s+قادر\\s+می\\s+(?:سازد|سازیم|سازند)',
      'این\\s+امکان\\s+را\\s+(?:برای\\s+شما\\s+)?فراهم\\s+می\\s+(?:کند|کنیم|آورد)',
    ],
    examples: ['این صفحه به شما این امکان را می‌دهد که آگهی‌ها را مقایسه کنید'],
  },
  {
    id: 'on-this-page-you-can',
    group: 'translated',
    why: 'A translated «on this page you can»: a page does not narrate itself.',
    instead: 'Offer the action; the page is already the place.',
    patterns: ['در\\s+این\\s+(?:صفحه|بخش)\\s+(?:شما\\s+)?می\\s+توانید'],
    examples: ['در این بخش می‌توانید قیمت را ببینید'],
  },
  {
    id: 'not-only-but-also',
    group: 'translated',
    why: 'The «not just X, but Y» contrast: a machine-written shape that delays the point.',
    instead: 'Say Y.',
    patterns: ['نه\\s+تنها[^.؟!]{0,80}بلکه', 'فقط[^.؟!]{0,60}نیست[،,]?\\s*بلکه'],
    examples: ['کارشناس نه تنها قیمت را می‌گوید بلکه دلیلش را هم می‌گوید'],
  },
  {
    id: 'passive-qarar',
    group: 'translated',
    why: 'A translated passive («was put under review»): a noun plus «قرار گرفت» instead of the verb itself.',
    instead: 'Use the verb: «بررسی شد», «استفاده می‌شود».',
    patterns: [
      'مورد\\s+\\p{L}+\\s+قرار\\s+(?:گرفت|گرفته|گرفتند|می\\s+گیرد|می\\s+گیرند|دهید|دهیم|دهند|بگیرد|بگیرند)',
    ],
    examples: ['این آگهی مورد بررسی قرار گرفت'],
  },
  {
    id: 'takes-place',
    group: 'translated',
    why: 'A translated «takes place»: a noun plus «صورت می‌گیرد» instead of the verb itself.',
    instead: 'Use the verb: «پرداخت می‌شود», not «پرداخت صورت می‌گیرد».',
    patterns: ['صورت\\s+(?:می\\s+گیرد|می\\s+گیرند|گرفت|گرفته|پذیرفت)'],
    examples: ['بررسی هر روز صورت می‌گیرد'],
  },
  {
    id: 'please-note',
    group: 'translated',
    why: 'Translated «please note that» and «it should be mentioned»: filler before the fact.',
    instead: 'State the fact.',
    patterns: [
      'لازم\\s+به\\s+(?:ذکر|توضیح|یادآوری)\\s+است',
      'شایان\\s+ذکر\\s+است',
      'قابل\\s+ذکر\\s+است',
      'همان\\s*طور\\s+که\\s+می\\s+دانید',
      'لطفا\\p{M}*\\s+توجه\\s+داشته\\s+باشید',
    ],
    examples: ['لازم به ذکر است که قیمت‌ها تقریبی است'],
  },
  {
    id: 'namudan',
    group: 'bureaucratic',
    why: 'The stilted «نمود» verb family (writing «ثبت نمایید» for «ثبت کنید»): the register of a form letter.',
    instead: 'Use «کردن»: «ثبت کنید».',
    phrases: ['نمودن', 'نموده', 'نمودید', 'نمایید', 'نمائید', 'می نمایید', 'می نماید', 'می نمایند'],
    examples: ['لطفاً ثبت نام نمایید'],
  },
  {
    id: 'gardidan',
    group: 'bureaucratic',
    why: 'The stilted «گردید» verb family (for «شد», «می‌شود»): the register of a notice board.',
    instead: 'Use «شد» or «می‌شود».',
    phrases: ['گردید', 'گردیده', 'گردیدند', 'می گردد', 'می گردند', 'گردد', 'گردند'],
    examples: ['درخواست شما ثبت گردید'],
  },
  {
    id: 'mibashad',
    group: 'bureaucratic',
    why: 'The formal copula «می‌باشد» (for «است»): the register of a form letter.',
    instead: 'Use «است» or «هستند».',
    phrases: ['می باشد', 'می باشند', 'می باشید'],
    examples: ['قیمت تقریبی می‌باشد'],
  },
  {
    id: 'bureaucratic-for',
    group: 'bureaucratic',
    why: 'The bureaucratic «جهت» and «به منظور» (for «برای»).',
    instead: 'Use «برای».',
    phrases: ['جهت', 'به منظور'],
    examples: ['جهت ثبت نام وارد شوید'],
  },
  {
    id: 'dear-user',
    group: 'filler',
    why: 'A flowery form of address: the voice is a calm expert friend, not a letter.',
    instead: 'Speak to the buyer without a title; drop the greeting.',
    phrases: [
      'کاربر گرامی',
      'کاربر عزیز',
      'مشتری گرامی',
      'مشتری عزیز',
      'همراه گرامی',
      'همراه عزیز',
      'دوست عزیز',
    ],
    examples: ['کاربر گرامی خوش آمدید'],
  },
  {
    id: 'we-are-glad',
    group: 'filler',
    why: 'Customer-service cheer: the product states facts and does not announce its feelings.',
    instead: 'Say what happened, or what the buyer can do.',
    patterns: ['خوشحال\\s+(?:می\\s+شویم|هستیم|می\\s+شوم)', 'خوشحالیم\\s+که'],
    examples: ['خوشحالیم که شما را اینجا می‌بینیم'],
  },
  {
    id: 'marketing-adjective',
    group: 'praise',
    why: 'A marketing adjective: it praises where the product should show a fact.',
    instead: 'Show the fact, number or example that earns the praise.',
    phrases: [
      'فوق العاده',
      'بی نظیر',
      'بی نظیری',
      'شگفت انگیز',
      'خیره کننده',
      'انقلابی',
      'بی رقیب',
      'بی همتا',
      'بهترین تجربه',
    ],
    examples: ['یک تجربه‌ی بی‌نظیر از خرید ماشین'],
  },
  {
    id: 'easily',
    group: 'praise',
    why: 'An empty promise of ease or speed: if it is easy it needs no word.',
    instead: 'Describe the action itself.',
    phrases: ['به راحتی', 'به سادگی', 'با یک کلیک', 'در کمترین زمان'],
    examples: ['به راحتی ماشین مناسب را پیدا کنید'],
  },
  {
    id: 'apology',
    group: 'apology',
    why: 'An apology: a limit is stated as a limit, with the way forward, never as a fault (owner, 2026-10-04).',
    instead: 'Say what is covered or what happened, then what the buyer can do.',
    phrases: ['متأسفانه', 'متاسفانه', 'پوزش می خواهیم', 'عذرخواهی می کنیم', 'ببخشید', 'شرمنده'],
    examples: ['متأسفانه این خودرو را پوشش نمی‌دهیم'],
  },
  {
    id: 'database-words',
    group: 'technical',
    why: 'How the data is stored is not something a buyer needs (owner, 2026-10-04).',
    instead: 'Say what the buyer gets, not where it lives.',
    phrases: ['پایگاه داده', 'دیتابیس', 'الگوریتم', 'پارامتر', 'ورژن'],
    except: ['apps/web/src/features/admin/**', 'apps/web/src/app/(admin)/**'],
    examples: ['اعداد از پایگاه داده خوانده می‌شود'],
  },
];
