// The words around a wish that say nothing about the car (CS-62, labelling guide "filler"): grammar, politeness, the
// verb «می‌خوام». A filler word is never shown as unused and never sent to the model as something left to read; it is
// not interpreted either. The list is short on purpose: a word that could carry a wish («تمیز», «سالم», «جدید»,
// «مناسب», «بهترین») is never here, so it is either read or shown. Words are written in their folded form (text.ts),
// and a half-space or a space between two of them makes no difference.
import { normalisePhrase, type Token } from './text.ts';

const FILLER = [
  // Naming the thing.
  'ماشین',
  'ماشینی',
  'ماشینه',
  'ماشینها',
  'ماشین ها',
  'ماشین های',
  'خودرو',
  'خودروی',
  'خودروها',
  'خودرو ها',
  'سواری',
  'اتومبیل',
  'آگهی',
  'آگهی ها',
  'آگهی های',
  'ها',
  'های',
  // Latin-letter Persian.
  'masshin',
  'mashin',
  'khodro',
  'haye',
  'ha',
  'ba',
  // Wanting, looking, buying.
  'میخوام',
  'می خوام',
  'میخواهم',
  'می خواهم',
  'میخواستم',
  'می خواستم',
  'می',
  'خوام',
  'خواهم',
  'خواستم',
  'خواهان',
  'خواستار',
  'دنبال',
  'دنبالش',
  'هستم',
  'هستیم',
  'هست',
  'است',
  'هستن',
  'هستند',
  'باشه',
  'باشد',
  'باشن',
  'باشند',
  'بشه',
  'بشود',
  'شه',
  'بود',
  'بوده',
  'داشته',
  'دارم',
  'دارد',
  'داره',
  'داشتم',
  'خرید',
  'خریدن',
  'بخرم',
  'بخریم',
  'بخرید',
  'بگیرم',
  'پیدا',
  'کن',
  'کنید',
  'کنین',
  'کنم',
  'نشان',
  'نشون',
  'بده',
  'بدید',
  'بدین',
  'برام',
  'برایم',
  'بهم',
  'من',
  'ما',
  // Politeness.
  'لطفا',
  'خواهشا',
  'ببخشید',
  'سلام',
  'درود',
  'ممنون',
  'ممنونم',
  'مرسی',
  'تشکر',
  'متشکرم',
  // Little words.
  'با',
  'و',
  'یا',
  'که',
  'را',
  'رو',
  'ای',
  'هم',
  'اگه',
  'اگر',
  'یه',
  'یک',
  'یکی',
  'ی',
  'برای',
  'واسه',
  'از',
  'به',
  'در',
  'تو',
  'این',
  'اون',
  'آن',
  'ولی',
  'اما',
  'فقط',
  'تا',
  'خیلی',
  'همه',
  'چیش',
  'چیزش',
  'هر',
  'چیه',
  'چی',
] as const;

/** The filler words, folded: a token whose folded form is in here is filler. */
export const FILLER_WORDS: ReadonlySet<string> = new Set(
  FILLER.flatMap((phrase) => normalisePhrase(phrase).split(' ')),
);

export function isFiller(token: Token): boolean {
  return token.kind === 'word' && FILLER_WORDS.has(token.norm);
}

// Words and phrases that address the system or a model rather than describe a car (OWASP LLM01: a buyer, or someone
// pasting a text, can try to change what the step does). Left short and exact: «سیستم» alone is a car's sound system.
// A trigger marks the rest of its sentence as addressed, because an instruction reaches to the end of the sentence;
// what comes before it, in the same sentence, is still the buyer's own wish.
const ADDRESSING = [
  'هوش مصنوعی',
  'ربات',
  'مدل زبانی',
  'پیام سیستم',
  'مدیر سیستم',
  'ادمین',
  'دستورات قبلی',
  'دستور قبلی',
  'دستورالعمل',
  'دستورالعمل ها',
  'دستورات',
  'نادیده بگیر',
  'نادیده بگیرید',
  'نادیده',
  'فراموش کن',
  'ignore',
  'previous instructions',
  'instructions',
  'instruction',
  'system',
  'prompt',
  'override',
  'jailbreak',
  'assistant',
  'chatgpt',
  'gpt',
  'developer',
  'admin',
  'bot',
  'ai',
] as const;

const ADDRESSING_PHRASES: ReadonlyMap<string, readonly string[]> = (() => {
  const byFirst = new Map<string, string[][]>();
  for (const phrase of ADDRESSING) {
    const words = normalisePhrase(phrase).split(' ');
    const first = words[0] ?? '';
    byFirst.set(first, [...(byFirst.get(first) ?? []), words]);
  }
  return new Map([...byFirst].map(([first, lists]) => [first, lists.map((words) => words.join(' '))]));
})();

/**
 * The tokens addressed to the system: from the first trigger of a sentence to the end of that sentence. A sentence
 * ends at a full stop, a question or exclamation mark, a semicolon, a new line, a bracket or a quote (text.ts).
 */
export function addressedTokens(tokens: readonly Token[]): ReadonlySet<number> {
  const addressed = new Set<number>();
  let from: number | undefined;
  for (const token of tokens) {
    if (token.breakBefore === 2) from = undefined;
    if (from === undefined) {
      const phrases = ADDRESSING_PHRASES.get(token.norm);
      const hit = phrases?.some((phrase) => {
        const words = phrase.split(' ');
        return words.every((word, offset) => tokens[token.index + offset]?.norm === word);
      });
      if (hit === true) from = token.index;
    }
    if (from !== undefined) addressed.add(token.index);
  }
  return addressed;
}
