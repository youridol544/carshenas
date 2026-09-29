import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CALENDAR,
  DIRECTION,
  FIRST_DAY_OF_WEEK,
  LANGUAGE,
  LOCALE,
  NUMBERING_SYSTEM,
  TIME_ZONE,
} from './locale.ts';

// The constants are stated rather than derived at run time; this test derives each one from the runtime's Intl
// and fails if they ever drift apart.

// Node 22 has the `textInfo` and `weekInfo` accessors, Node 24 and later the `getTextInfo()` and `getWeekInfo()`
// methods; TypeScript 5.9 types neither.
function localeInfo(locale: Intl.Locale, name: 'TextInfo' | 'WeekInfo'): unknown {
  const method: unknown = Reflect.get(locale, `get${name}`);
  if (typeof method === 'function') return Reflect.apply(method, locale, []) as unknown;
  return Reflect.get(locale, name.charAt(0).toLowerCase() + name.slice(1)) as unknown;
}

function field(info: unknown, key: string): unknown {
  return typeof info === 'object' && info !== null ? Reflect.get(info, key) : undefined;
}

test("the locale constants agree with what the runtime's Intl says about fa-IR", () => {
  const locale = new Intl.Locale(LOCALE);
  assert.equal(locale.language, LANGUAGE);
  assert.equal(field(localeInfo(locale, 'TextInfo'), 'direction'), DIRECTION);
  assert.equal(field(localeInfo(locale, 'WeekInfo'), 'firstDay'), FIRST_DAY_OF_WEEK);
  assert.equal(new Intl.DateTimeFormat(LOCALE).resolvedOptions().calendar, CALENDAR);
  assert.equal(new Intl.NumberFormat(LOCALE).resolvedOptions().numberingSystem, NUMBERING_SYSTEM);
});

test('the time zone is one the runtime knows', () => {
  assert.equal(
    new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE }).resolvedOptions().timeZone,
    TIME_ZONE,
  );
});
