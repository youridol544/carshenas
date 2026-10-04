// Helpers for the tests. Samples are written with visible stand-ins for the characters nobody can see:
//   «~»  a half-space (the zero-width non-joiner, U+200C)
//   «_»  a no-break space (U+00A0)
//   «{}» a hole of a template literal (PLACEHOLDER)
// so a sample can be read in review, and an editor that drops an invisible character cannot change what it tests.
import { NBSP, PLACEHOLDER, ZWNJ, hasPersianWord, isEnglishProse } from '../lib/persian.mjs';

export const fa = (text) => text.replaceAll('~', ZWNJ).replaceAll('_', NBSP).replaceAll('{}', PLACEHOLDER);

/** A unit as the extractor would make it, for a rule that looks at one string. */
export function makeUnit(sample, defaults = {}) {
  const spec = typeof sample === 'string' ? { text: sample } : sample;
  const text = fa(spec.text);
  return {
    file: spec.file ?? 'apps/web/src/features/sample/sample-copy.ts',
    line: spec.line ?? 1,
    column: 1,
    endLine: spec.line ?? 1,
    text,
    form: spec.form ?? 'string',
    kind: spec.kind ?? 'unknown',
    key: spec.key,
    attribute: spec.attribute,
    element: spec.element,
    standalone: spec.standalone ?? true,
    persian: spec.persian ?? (hasPersianWord(text) && !isEnglishProse(text)),
    dot: /[·•⋅∙]/.test(text),
    hasHoles: text.includes(PLACEHOLDER),
    raw: text,
    ...defaults,
  };
}
