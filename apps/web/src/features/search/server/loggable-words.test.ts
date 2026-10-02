import { expect, test } from 'vitest';
import { loggableWords } from './loggable-words';

// A search's words are logged for the labelled query set and the demand the superadmin sees (CS-62, CS-59), never a
// phone number a buyer might have typed into the box.

test('a number that could be a phone number never reaches the log, in any digit script or spacing', () => {
  for (const typed of [
    '09123456789',
    '0912 345 6789',
    '0912-345-6789',
    '0912.345.6789',
    '۰۹۱۲۳۴۵۶۷۸۹',
    '۰۹۱۲ ۳۴۵ ۶۷۸۹',
    '٠٩١٢٣٤٥٦٧٨٩',
    'تماس ۰۹۱۲-۳۴۵-۶۷۸۹ لطفا',
  ]) {
    const logged = loggableWords(typed) ?? '';
    expect(/[0-9۰-۹٠-٩]{3}/.exec(logged)).toBeNull();
    expect(logged).toContain('#');
  }
});

test('a model, a year and a budget in one query stay readable', () => {
  for (const typed of ['پژو ۲۰۶ تیپ ۵ ۱۳۹۷', '206 sd 1398 زیر 700 میلیون', 'دنا پلاس ۱۴۰۳']) {
    expect(loggableWords(typed)).toBe(typed);
  }
  expect(loggableWords(undefined)).toBeUndefined();
});
