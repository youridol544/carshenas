// The one locale Carshenas speaks (ADR-0014). The root layout, the error pages and every formatter read these
// constants, so the language, the direction and the calendar are stated once; locale.test.ts checks them against
// what the runtime's Intl says about fa-IR.

/** The `lang` of the document and of every Persian island. */
export const LANGUAGE = 'fa';

/** The base direction, set once on `<html>`; never set it with CSS (W3C Internationalization). */
export const DIRECTION = 'rtl';

/** The `Intl` locale. */
export const LOCALE = 'fa-IR';

/** Jalali dates on screen; storage, URLs and APIs stay ISO-8601 (ADR-0014, point 5). */
export const CALENDAR = 'persian';

/** Persian digits (۰–۹) on screen; data keeps Latin digits. */
export const NUMBERING_SYSTEM = 'arabext';

/** Weeks start on Saturday, in the numbering of `Intl.Locale` week info (1 is Monday, 7 is Sunday). */
export const FIRST_DAY_OF_WEEK = 6;

/** Every instant is shown as a Tehran date and time, whatever the server's zone, so formatters pass it every time. */
export const TIME_ZONE = 'Asia/Tehran';
