// Plain-Farsi search in one function (CS-62, S03): the buyer's words in, an `Understanding` out: the search to run, the
// chips that explain it, the suggestions, the unused words and the notices. Code reads first (code-pass.ts); a model is
// asked only about what code could not read, through a step the caller provides, and its answer is validated before it
// is used (reading.ts). The step may refuse (no key, a visitor over the limit, the day's spend reached, a deadline):
// the buyer then gets what code read, the rest as unused words or a text search, and the reason. This file never
// calls a model itself: the web route and the evaluation each bind the step to the AI layer.
import { solarHijriYear } from '../year.ts';
import { readByCode } from './code-pass.ts';
import type { Lexicon } from './lexicon.ts';
import { buildUnderstanding } from './merge.ts';
import { modelInputOf, type QueryFiltersInput } from './model-input.ts';
import { claimsFromReading, type QueryReading } from './reading.ts';
import type { DegradedReason, DegradedState, Understanding } from './types.ts';

/** What the model step answers: a reading that already passed the layer's checks, or why there is none. */
export type ModelAnswer =
  | { readonly status: 'ok'; readonly reading: QueryReading; readonly cached?: boolean }
  | { readonly status: 'unavailable'; readonly reason: DegradedReason };

export type ModelStep = (input: QueryFiltersInput) => Promise<ModelAnswer>;

/** What the buyer is told when the step answered without the model it wanted. */
export const DEGRADED_MESSAGES: Readonly<Record<DegradedReason, string>> = {
  unavailable: 'فهم هوشمند جمله فعلاً در دسترس نیست؛ فقط بخشی را که با قاعده فهمیدیم اعمال کردیم.',
  visitor_limit:
    'چند بار پشت‌سر‌هم پرسیدید؛ کمی بعد دوباره امتحان کنید. فعلاً فقط بخش ساده‌ی جمله را فهمیدیم.',
  daily_cap:
    'سقف امروزِ فهم هوشمند جمله پر شده؛ فردا دوباره کار می‌کند. فعلاً فقط بخش ساده‌ی جمله را فهمیدیم.',
  busy: 'فهم هوشمند جمله الان شلوغ است؛ فقط بخش ساده‌ی جمله را فهمیدیم.',
  timeout: 'فهم هوشمند جمله دیر شد؛ فقط بخش ساده‌ی جمله را فهمیدیم.',
  invalid_answer: 'فهم هوشمند جمله این بار جواب درستی نداد؛ فقط بخش ساده‌ی جمله را فهمیدیم.',
};

export type UnderstandOptions = {
  readonly lexicon: Lexicon;
  /** The current Solar Hijri year; the process's clock when omitted. */
  readonly solarYear?: number;
  /** Absent means the model is not available here: code answers alone, and says so when it needed the model. */
  readonly model?: ModelStep;
};

/** What happened beside the answer: for the log and the evaluation, never shown to a buyer. */
export type UnderstandTrace = {
  /** Why the model was asked, or null when code settled everything. */
  readonly asked: 'left' | 'doubt' | 'long' | null;
  readonly answered: 'ok' | DegradedReason | null;
  readonly cached: boolean;
};

export async function understandQuery(
  typed: string,
  options: UnderstandOptions,
): Promise<{ understanding: Understanding; trace: UnderstandTrace }> {
  const solarYear = options.solarYear ?? solarHijriYear(new Date());
  const code = readByCode(typed, { lexicon: options.lexicon, solarYear });
  let claims = [...code.claims];
  let addressed: ReadonlySet<number> = code.addressed;
  let degraded: DegradedState | null = null;
  let modelUsed = false;
  let cached = false;
  let answered: UnderstandTrace['answered'] = null;

  if (code.needsModel !== null) {
    const answer: Awaited<ReturnType<ModelStep>> =
      options.model === undefined
        ? { status: 'unavailable', reason: 'unavailable' }
        : await options.model(modelInputOf(code, options.lexicon));
    if (answer.status === 'ok') {
      const read = claimsFromReading(answer.reading, { code, lexicon: options.lexicon, solarYear });
      // Words the model found addressed to it are treated as code found them: nothing inside them is used.
      if (read.addressed.size > 0) {
        addressed = new Set([...addressed, ...read.addressed]);
        claims = claims.filter(
          (claim) =>
            !Array.from({ length: claim.to - claim.from }, (_, o) => claim.from + o).some((i) =>
              read.addressed.has(i),
            ),
        );
      }
      claims = [...claims, ...read.claims];
      modelUsed = true;
      cached = answer.cached === true;
      answered = 'ok';
    } else {
      degraded = { reason: answer.reason, message: DEGRADED_MESSAGES[answer.reason] };
      answered = answer.reason;
    }
  }

  const understanding = buildUnderstanding({
    cleaned: code.cleaned,
    claims,
    addressed,
    filler: code.filler,
    lexicon: options.lexicon,
    modelUsed,
    degraded,
  });
  return { understanding, trace: { asked: code.needsModel, answered, cached } };
}
