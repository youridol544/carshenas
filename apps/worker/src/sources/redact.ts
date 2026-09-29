import { INVISIBLE_SEPARATORS } from './text.ts';

// Phone numbers taken out of what a listing says before it is stored (ADR-0008 point 7; docs/design/data-model.md,
// "Privacy"). Sellers sometimes write their number into a title or a description, in any digit script and grouping;
// a snapshot keeps the text with the number replaced. Mobile and landline numbers are recognised with their leading
// 0 or country code (09121234567, 0912 123 4567, +98 912 123 4567, 021-2233 4455), and a mobile number without one
// only when written in groups (912 123 4567). A bare run of ten digits is left alone: it is as likely a price.

/** What a removed phone number reads as in a stored snapshot. */
export const PHONE_REMOVED = '[شماره حذف شد]';

const DIGIT = '[0-9۰-۹٠-٩]';
// Between digits: a space, a dot, a dash, or an invisible separator, at most two.
const GAP = `[ .\\-${INVISIBLE_SEPARATORS}]{0,2}`;
const BREAK = `[ .\\-${INVISIBLE_SEPARATORS}]{1,2}`;
const PREFIX = `(?:(?:\\+|00)(?:98|۹۸|٩٨)${GAP}|[0۰٠])`;
// After the prefix: 9 for a mobile, 1 to 8 for a landline's area code; then nine more digits.
const PREFIXED = `${PREFIX}[1-9۱-۹١-٩](?:${GAP}${DIGIT}){9}`;
const GROUPED_MOBILE = `[9۹٩]${DIGIT}{2}${BREAK}${DIGIT}{3}${BREAK}${DIGIT}{2}${GAP}${DIGIT}{2}`;
const PHONE = new RegExp(`(?<![0-9۰-۹٠-٩+])(?:${PREFIXED}|${GROUPED_MOBILE})(?![0-9۰-۹٠-٩])`, 'g');

/** The text with every phone number it holds replaced by PHONE_REMOVED. */
export function withoutPhoneNumbers(text: string): string {
  return text.replace(PHONE, PHONE_REMOVED);
}
