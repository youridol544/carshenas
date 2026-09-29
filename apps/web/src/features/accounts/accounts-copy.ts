import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@carshenas/accounts/password-rules';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@carshenas/accounts/username';
import type { PasswordError, UsernameError } from '@/features/accounts/accounts-types';
import { formatCount, formatCountOf } from '@/lib/format-number';

// Every word the accounts' pages say, from the UX note's copy table (docs/research/2026-09-29-sign-in-and-sign-up-ux.md,
// section 7) and the Iranian teardown's terms: «ورود», «ثبت‌نام», «نام کاربری», «رمز عبور», «کاراکتر». Numbers come
// from the rules themselves, in Persian digits joined to their noun. Tests import these instead of retyping Persian,
// which loses the zero-width non-joiner. A message that can appear under a field before the form is sent fits one line
// of a 320 px screen, so the line kept for it never grows and never moves the button: 288 px on a phone, 273 px beside
// a desktop scrollbar (a 1280 px window at 400 %); each is under 260 px at 14 px, measured in Yekan Bakh. The summary
// repeats the field's own words.

const CHARACTERS = 'کاراکتر';
const MINUTES = 'دقیقه‌ی';

export const ACCOUNT_COPY = {
  signIn: {
    title: 'ورود',
    heading: 'ورود به کارشناس',
    submit: 'ورود',
    switchQuestion: 'حساب ندارید؟',
    switchLink: 'ثبت‌نام کنید',
    forgotSummary: 'رمز عبور را فراموش کرده‌اید؟',
    forgotBody:
      'فعلاً رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، روی کادر رمز عبور پیشنهادش می‌دهد؛ وگرنه حساب تازه‌ای بسازید.',
  },
  signUp: {
    title: 'ثبت‌نام',
    heading: 'ثبت‌نام در کارشناس',
    lead: 'برای ساختن حساب فقط یک نام کاربری و رمز عبور لازم است؛ شماره موبایل و ایمیل نمی‌خواهیم.',
    submit: 'ثبت‌نام',
    switchQuestion: 'حساب دارید؟',
    switchLink: 'وارد شوید',
    recoveryNote: 'فعلاً رمز عبور فراموش‌شده بازیابی نمی‌شود؛ آن را در مرورگرتان ذخیره کنید.',
  },
  username: {
    label: 'نام کاربری',
    hint: `فقط حروف انگلیسی، عدد و زیرخط (_)؛ ${formatCount(USERNAME_MIN_LENGTH)} تا ${formatCountOf(USERNAME_MAX_LENGTH, CHARACTERS)}، که با یک حرف شروع شود.`,
    available: 'این نام کاربری آزاد است.',
    takenBeforeLink: 'این نام گرفته شده؛ مال شماست؟',
    takenLink: 'وارد شوید',
    cannotCheck: 'آزاد بودن نام هنگام ثبت‌نام بررسی می‌شود.',
    persianKeyboard: 'صفحه‌کلید فارسی است؛ آن را انگلیسی کنید.',
  },
  password: {
    label: 'رمز عبور',
    hint: `حداقل ${formatCountOf(PASSWORD_MIN_LENGTH, CHARACTERS)}؛ هرچه بلندتر، بهتر. چند کلمه با فاصله رمز خوبی می‌سازد، یا رمزی که مرورگر پیشنهاد می‌دهد.`,
    show: 'نمایش رمز عبور',
    hide: 'پنهان کردن رمز عبور',
    shown: 'رمز عبور نمایش داده می‌شود',
    hidden: 'رمز عبور پنهان شد',
    persianKeyboard: 'فارسی تایپ شد؛ صفحه‌کلید را بررسی کنید.',
    // «کلید Caps Lock روشن است.»: the Latin name is isolated in markup between the two parts (CapsLockText).
    capsLock: { before: 'کلید', after: 'روشن است.' },
  },
  menu: {
    signInLink: 'ورود / ثبت‌نام',
    signInShort: 'ورود',
    button: 'منوی حساب کاربری',
    account: 'حساب کاربری',
    admin: 'پنل مدیریت',
    signOut: 'خروج از حساب',
  },
  accountPage: {
    title: 'حساب کاربری',
    username: 'نام کاربری',
    memberSince: 'عضو از',
    superadmin: 'این حساب مدیر کارشناس است.',
  },
  errors: {
    summaryHeading: 'این موارد را درست کنید',
    titlePrefix: 'خطا: ',
    usernameEmpty: 'یک نام کاربری انتخاب کنید.',
    usernameTooShort: `نام کاربری باید حداقل ${formatCountOf(USERNAME_MIN_LENGTH, CHARACTERS)} باشد.`,
    usernameTooLong: `نام کاربری باید حداکثر ${formatCountOf(USERNAME_MAX_LENGTH, CHARACTERS)} باشد.`,
    usernameNotLatin: 'فقط حرف انگلیسی، عدد و _ بنویسید.',
    usernamePersian: 'نام کاربری را با حروف انگلیسی بنویسید.',
    usernameStartsWithoutLetter: 'نام کاربری باید با حرف انگلیسی شروع شود.',
    usernameTaken: 'این نام گرفته شده؛ مال شماست؟ وارد شوید.',
    passwordEmpty: 'یک رمز عبور انتخاب کنید.',
    passwordTooShort: `رمز عبور باید حداقل ${formatCountOf(PASSWORD_MIN_LENGTH, CHARACTERS)} باشد.`,
    passwordTooLong: `رمز عبور باید حداکثر ${formatCountOf(PASSWORD_MAX_LENGTH, CHARACTERS)} باشد.`,
    passwordCommon:
      'این رمز بسیار رایج است و زود حدس زده می‌شود. رمز دیگری انتخاب کنید؛ چند کلمه‌ی بی‌ربط کنار هم رمز خوبی می‌سازد.',
    passwordFromName: 'رمز عبور نباید از نام کاربری یا نام کارشناس ساخته شده باشد.',
    signInUsernameEmpty: 'نام کاربری را وارد کنید.',
    signInPasswordEmpty: 'رمز عبور را وارد کنید.',
    signInFailed: 'نام کاربری یا رمز عبور درست نیست.',
    // Added after three failures in a row (NN/g): «صفحه‌کلید باید انگلیسی باشد و Caps Lock خاموش. …».
    signInFailedAgain: {
      before: 'صفحه‌کلید باید انگلیسی باشد و',
      after: 'خاموش. اگر حساب ندارید، ثبت‌نام کنید.',
    },
    busy: 'همین حالا نشد؛ چند ثانیه‌ی دیگر دوباره امتحان کنید.',
  },
} as const;

/** «۳ کاراکتر دیگر»: what a new password still lacks, while it is short. */
export function charactersToGo(count: number): string {
  return `${formatCountOf(count, CHARACTERS)} دیگر`;
}

/** When a throttled person may try again, in whole minutes; under a minute is said in words. */
function tryAgainIn(seconds: number): string {
  if (seconds < 60) return 'کمتر از یک دقیقه‌ی دیگر دوباره امتحان کنید.';
  return `${formatCountOf(Math.ceil(seconds / 60), MINUTES)} دیگر دوباره امتحان کنید.`;
}

export function signInThrottledMessage(retryAfterSeconds: number): string {
  return `چند بار پشت سر هم ورود ناموفق بود. ${tryAgainIn(retryAfterSeconds)}`;
}

export function signUpThrottledMessage(retryAfterSeconds: number): string {
  return `ثبت‌نام‌های زیادی از این شبکه انجام شده است. ${tryAgainIn(retryAfterSeconds)}`;
}

/** What is wrong with a username, as the sign-up form and its summary say it. */
export function usernameErrorMessage(error: UsernameError): string {
  const messages = {
    empty: ACCOUNT_COPY.errors.usernameEmpty,
    too_short: ACCOUNT_COPY.errors.usernameTooShort,
    too_long: ACCOUNT_COPY.errors.usernameTooLong,
    not_latin: ACCOUNT_COPY.errors.usernameNotLatin,
    persian_letters: ACCOUNT_COPY.errors.usernamePersian,
    starts_without_letter: ACCOUNT_COPY.errors.usernameStartsWithoutLetter,
    taken: ACCOUNT_COPY.errors.usernameTaken,
  } as const satisfies Record<UsernameError, string>;
  return messages[error];
}

/** What is wrong with a new password, with the reason NIST asks for. */
export function passwordErrorMessage(error: PasswordError): string {
  const messages = {
    empty: ACCOUNT_COPY.errors.passwordEmpty,
    too_short: ACCOUNT_COPY.errors.passwordTooShort,
    too_long: ACCOUNT_COPY.errors.passwordTooLong,
    common: ACCOUNT_COPY.errors.passwordCommon,
    built_from_name: ACCOUNT_COPY.errors.passwordFromName,
  } as const satisfies Record<PasswordError, string>;
  return messages[error];
}

/**
 * The ids of each form's fields. Unique per form, because Next.js keeps a page it just left in the document, hidden,
 * so sign-in's fields are still there while sign-up shows; one id twice would give an input two labels.
 */
export const FIELD_IDS = {
  'sign-in': { username: 'sign-in-username', password: 'sign-in-password' },
  'sign-up': { username: 'sign-up-username', password: 'sign-up-password' },
} as const;
