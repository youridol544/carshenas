import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@carshenas/accounts/password-rules';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@carshenas/accounts/username';
import type { PasswordError, UsernameError } from '@/features/accounts/accounts-types';
import { formatCount, formatCountOf } from '@carshenas/locale/format-number';

// Every word the accounts' pages say, from the UX note's copy table (docs/research/2026-09-29-sign-in-and-sign-up-ux.md,
// section 7) and the Iranian teardown's terms: «ورود», «ثبت‌نام», «نام کاربری», «رمز عبور», «کاراکتر». Numbers come
// from the rules themselves, in Persian digits joined to their noun. Tests import these instead of retyping Persian,
// which loses the zero-width non-joiner. A message that can appear under a field before the form is sent fits one line
// of a 320 px screen, so the line kept for it never grows and never moves the button: 288 px on a phone, 273 px beside
// a desktop scrollbar (a 1280 px window at 400 %); each is under 260 px at 14 px, measured in Yekan Bakh. The summary
// repeats the field's own words. An answer after sending may take two lines: the person's own press moved the page.

const CHARACTERS = 'کاراکتر';
const MINUTES = 'دقیقه‌ی';
// A taken name's answer is one sentence: said whole after sending and in its short form while typing.
const TAKEN = 'این نام کاربری گرفته شده است. نام دیگری انتخاب کنید یا';
const SIGN_IN = 'وارد شوید';

export const ACCOUNT_COPY = {
  signIn: {
    title: 'ورود',
    heading: 'ورود به کارشناس',
    submit: 'ورود',
    switchQuestion: 'حساب ندارید؟',
    switchLink: 'ثبت‌نام کنید',
    forgotSummary: 'رمز عبور را فراموش کرده‌اید؟',
    forgotBody:
      'رمز عبور بازیابی نمی‌شود. اگر مرورگرتان آن را ذخیره کرده باشد، در کادر رمز عبور پیشنهادش می‌دهد. وگرنه حساب تازه‌ای بسازید.',
  },
  signUp: {
    title: 'ثبت‌نام',
    heading: 'ثبت‌نام در کارشناس',
    lead: 'آگهی‌ها را نشان کنید و جست‌وجوهایتان را به کارشناس بسپارید.',
    submit: 'ثبت‌نام',
    switchQuestion: 'حساب دارید؟',
    switchLink: 'وارد شوید',
    recoveryNote: 'رمز عبور فراموش‌شده بازیابی نمی‌شود. آن را در مرورگرتان ذخیره کنید.',
  },
  username: {
    label: 'نام کاربری',
    hint: `حروف انگلیسی، عدد و زیرخط. ${formatCount(USERNAME_MIN_LENGTH)} تا ${formatCountOf(USERNAME_MAX_LENGTH, CHARACTERS)}، با حرف شروع شود.`,
    available: 'این نام کاربری آزاد است.',
    // The answer after sending is ADR-0020's sentence (point 2); the live check while typing says it in one line.
    takenBeforeLink: TAKEN,
    takenLiveBeforeLink: 'گرفته شده. نام دیگری بنویسید یا',
    takenLink: SIGN_IN,
    cannotCheck: 'آزاد بودن نام هنگام ثبت‌نام معلوم می‌شود.',
    persianKeyboard: 'صفحه‌کلید فارسی است. آن را انگلیسی کنید.',
  },
  password: {
    label: 'رمز عبور',
    hint: `حداقل ${formatCountOf(PASSWORD_MIN_LENGTH, CHARACTERS)}. هرچه بلندتر، بهتر.`,
    show: 'نمایش رمز',
    hide: 'پنهان کردن رمز',
    shown: 'رمز عبور نمایش داده شد',
    hidden: 'رمز عبور پنهان شد',
    persianKeyboard: 'صفحه‌کلید فارسی است.',
    // «کلید Caps Lock روشن است.»: the Latin name is isolated in markup between the two parts (CapsLockText).
    capsLock: { before: 'کلید', after: 'روشن است.' },
  },
  menu: {
    signInLink: 'ورود / ثبت‌نام',
    signInShort: 'ورود',
    button: 'منوی حساب کاربری',
    account: 'حساب کاربری',
    marked: 'آگهی‌های نشان‌شده',
    notifications: 'اعلان‌ها',
    searchFiles: 'پرونده‌های جست‌وجو',
    admin: 'پنل مدیریت',
    signOut: 'خروج از حساب',
  },
  accountPage: {
    title: 'حساب کاربری',
    username: 'نام کاربری',
    memberSince: 'عضو از',
    superadmin: 'این حساب مدیر است.',
  },
  errors: {
    summaryHeading: 'این موارد را درست کنید',
    titlePrefix: 'خطا: ',
    usernameEmpty: 'یک نام کاربری انتخاب کنید.',
    usernameTooShort: `نام کاربری باید حداقل ${formatCountOf(USERNAME_MIN_LENGTH, CHARACTERS)} باشد.`,
    usernameTooLong: `نام کاربری باید حداکثر ${formatCountOf(USERNAME_MAX_LENGTH, CHARACTERS)} باشد.`,
    usernameNotLatin: 'فقط حروف انگلیسی، عدد و _ بنویسید.',
    usernamePersian: 'نام کاربری را با حروف انگلیسی بنویسید.',
    usernameStartsWithoutLetter: 'نام کاربری باید با حرف انگلیسی شروع شود.',
    usernameTaken: `${TAKEN} ${SIGN_IN}.`,
    passwordEmpty: 'یک رمز عبور انتخاب کنید.',
    passwordTooShort: `رمز عبور باید حداقل ${formatCountOf(PASSWORD_MIN_LENGTH, CHARACTERS)} باشد.`,
    passwordTooLong: `رمز عبور باید حداکثر ${formatCountOf(PASSWORD_MAX_LENGTH, CHARACTERS)} باشد.`,
    passwordCommon: 'این رمز خیلی رایج است. رمز دیگری انتخاب کنید، مثلاً چند کلمه‌ی بی‌ربط کنار هم.',
    passwordFromName: 'رمز عبور نباید از نام کاربری یا نام کارشناس ساخته شده باشد.',
    signInUsernameEmpty: 'نام کاربری را وارد کنید.',
    signInPasswordEmpty: 'رمز عبور را وارد کنید.',
    signInFailed: 'نام کاربری یا رمز عبور درست نیست.',
    // Added after three failures in a row (NN/g): «صفحه‌کلید باید انگلیسی باشد و Caps Lock خاموش. …».
    signInFailedAgain: {
      before: 'صفحه‌کلید باید انگلیسی باشد و',
      after: 'خاموش.',
    },
    busy: 'تعداد درخواست‌ها الان زیاد است. چند ثانیه‌ی دیگر دوباره امتحان کنید.',
  },
} as const;

/** The account button's name when notifications are unread: «منوی حساب کاربری، ۳ اعلان خوانده‌نشده». */
export function accountMenuLabelWithUnread(count: number): string {
  return `${ACCOUNT_COPY.menu.button}، ${formatCountOf(count, 'اعلان خوانده‌نشده')}`;
}

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
  return `از این شبکه ثبت‌نام‌های زیادی شده است. ${tryAgainIn(retryAfterSeconds)}`;
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
