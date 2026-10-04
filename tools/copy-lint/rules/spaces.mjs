// Spaces that should not be there.
//   double-space  two or more spaces in a row inside a string (a line break plus indentation inside a template is not).
//   edge-space    a space at the start or end of a whole string value of three words or more, such as a sentence kept
//                 in an object. Not flagged: a piece of a larger string (an operand of `+`, an argument of a call, a
//                 template, JSX text) and short pieces such as the joiner ' تا ' or ' مدل ', which are written with
//                 their spaces on purpose.
import { wordCount } from '../lib/persian.mjs';

export const doubleSpace = {
  id: 'double-space',
  summary: 'doubled spaces',
  message: 'Two or more spaces in a row.',
  fix: 'Use one space.',
  check(unit) {
    const flat = unit.form === 'jsx-text' ? unit.text : unit.text.replace(/\s*\n\s*/g, ' ');
    const found = [...flat.matchAll(/ {2,}/g)];
    return found.length === 0 ? [] : [{ text: flat.trim() }];
  },
  samples: {
    pass: ['قیمت و ارزیابی', 'قیمت {} تومان'],
    fail: ['قیمت  و ارزیابی', 'قیمت {}  تومان'],
  },
};

export const edgeSpace = {
  id: 'edge-space',
  summary: 'a space at the start or end of a string',
  message: 'A space at the start or end of a whole string.',
  fix: 'Remove it; if the string is joined to others, build the sentence in one string or one template instead.',
  check(unit) {
    if (!unit.standalone || (unit.form !== 'string' && unit.form !== 'jsx-attr')) return [];
    if (!/^\s|\s$/.test(unit.text) || wordCount(unit.text) < 3) return [];
    return [{ text: unit.text.trim() }];
  },
  samples: {
    pass: [
      'قیمت و ارزیابی آگهی',
      { text: ' تا ', standalone: true },
      { text: ' مدل ', standalone: true },
      { text: 'عکس از این آگهی ', standalone: false },
      { text: ' مدل {} سال', form: 'template' },
    ],
    fail: [' قیمت و ارزیابی آگهی', 'قیمت و ارزیابی آگهی ', 'آگهی را ببینید و برگردید '],
  },
};

export default [doubleSpace, edgeSpace];
