# How do Iranian products lay out, word and wire their sign-in and sign-up pages, and what should Carshenas take from them?

- Date: 2026-09-29
- Asked by / for: Pedrum, for CS-39 (accounts). The owner asked for the sign-in and sign-up flow to be built on the best patterns, studied with the site-capture tool. Accounts are a username and a password only for now (no email, no phone, no code), so the Iranian products that sign in with a username and a password matter most; the others show the Farsi wording, right-to-left layout and form habits Iranian users are used to.
- Outcome: the Farsi vocabulary, the right-to-left form conventions to adopt and to avoid, and an adaptation for CS-39's pages (section "Adaptation for Carshenas"). No ADR. Distilled capture reports for three pages in [`captures/`](captures/).
- Companion notes: [sign-in and sign-up UX](2026-09-29-sign-in-and-sign-up-ux.md) (the general rules and the non-Iranian references) and [password accounts and sessions](2026-09-29-password-accounts-and-sessions.md) (hashing, sessions, rate limits). This note adds only what Iranian products show.

## Questions

1. Which Iranian products show a sign-in or sign-up form to an anonymous visitor, and which of them take a username and a password?
2. How is each page laid out at phone and desktop width, which fields come in which order, and which Farsi words do labels, buttons and links use?
3. How do left-to-right values (username, password, email, phone number) sit in a right-to-left page: direction, alignment, placeholder, icons, digits?
4. What happens on focus, while typing, when typing with the Persian keyboard layout by mistake, and on leaving a field?
5. Which API calls and technology sit behind each page?

## Method

- `pnpm capture <url> --locale fa-IR --timezone Asia/Tehran --har --flow …` from this worktree on 2026-09-29: one run per page, which is a phone view (412 px) and a desktop view (1440 px) eight seconds apart, after robots.txt allowed the path.
- A flow script (in `.captures/flows-ir/`, gitignored) photographed the form's states without submitting anything. It focused the identifier field, typed `carshenas-ref`, typed `۰۹۱۲` into a phone-number field, typed `abc` and then `شذز` (the same three keys on the Persian layout) into a password field, clicked a show-password toggle if there was one or pressed Tab, and finally typed `زشقساثدشس` (`carshenas` on the Persian layout) into the identifier and pressed Tab. It measured each field's computed direction, alignment, fonts, colours and the texts that appeared at every step.
- It never pressed Enter and never clicked a submit, continue or send-code control. From the start of the flow until the page closed, every request other than GET, HEAD or OPTIONS was aborted inside the browser (it caught only analytics and error-reporting beacons), and form submission was cancelled.
- Endpoint names that were not requested come from the JavaScript the two page views loaded (read from the local HAR file). They are names, not observed traffic.
- Contrast ratios are computed from the measured colours with the WCAG 2 formula.

## Sources

| Page | Result (2026-09-29, times UTC) |
|---|---|
| <https://quera.org/accounts/login> | Refused by robots.txt (`/accounts/` is disallowed for generic agents). Not captured. |
| <https://quera.org/accounts/register> | Refused by the same rule. |
| <https://www.aparat.com/signin> | Captured at 14:13, both widths. Reports in [`captures/aparat-signin/`](captures/aparat-signin/summary.md). |
| <https://virgool.io/login> | Captured at 14:15, both widths; Cloudflare's JavaScript detections ran, no challenge was shown. Reports in [`captures/virgool-login/`](captures/virgool-login/summary.md). |
| <https://www.digikala.com/users/login/> | Refused by robots.txt (`/users/*`). Not captured. |
| <https://torob.com/> | Home page captured at 14:17. The flow opened the desktop header's sign-in entry, a dialog. On the phone the account entry is a bottom-bar tab and was not opened. Reports in [`captures/torob-signin/`](captures/torob-signin/summary.md). |
| <https://www.filimo.com/signin> | Captured at 14:20, both widths. Same sign-in platform as Aparat, so its reports were not copied into the repository. |
| <https://www.namava.ir/> | Home page at 14:20. On desktop the flow followed the header link to `/login` and ran there; on the phone an app-install sheet covered the page and the sign-in button could not be clicked. The run then stalled on a browser call after its last screenshot and was stopped after six minutes, so the tool wrote no reports: the facts below come from the screenshots, the flow's measurements, the accessibility trees, the rendered HTML and the phone view's HAR. |

Divar was not visited: its terms forbid automated tools ([ADR-0008](../decisions/0008-crawl-only-what-sources-allow.md)). Local material (screenshots, HAR files, flow measurements) stays in `.captures/ir-*/` and `.captures/flows-ir/notes/`, gitignored. No page contained text addressed to an automated agent.

## Findings

### 1. Aparat, `/signin`

- **For.** One page for signing in and signing up, identifier first: one field and «ادامه»; the password or code step comes after the server has looked the identifier up. The configuration the page fetches lists sign-in by «موبایل», «نام کاربری» or «ایمیل», sign-up by mobile or email, and three methods (`sms`, `call`, `password`) with six-digit codes.
- **Phone, 412 px.** A centred column: logo, heading (`h3`, 16 px, 700), a «بازگشت» link with an arrow pointing right at the inline start, then a card (1 px `#e0e0e0` border, 12 px radius, 15 px padding) holding a one-line helper (12 px), the field (350 × 48, 8 px radius, 1 px `#d0d0d0` border, a person icon at the inline start), 10 px of space and a full-width button (350 × 48, 8 px radius, white 12 px bold on the brand red, 4.86:1).
- **Desktop, 1440 px.** The same card, 440 px wide with 32 px padding, centred on white; field and button 374 × 48. Nothing else on the page.
- **Words.** Heading «ورود یا ثبت‌نام در آپارات»; placeholder «موبایل یا ایمیل خود را وارد کنید:»; button «ادامه»; link «بازگشت». The later steps, from the bundle: «رمزعبور» (one word throughout), «ورود با رمزعبور», «رمزعبور را فراموش کردید؟», «بازیابی رمزعبور», «تایید رمزعبور», «به خاطر بسپار». Password rules: at least 6 and fewer than 32 «کاراکتر».
- **Left-to-right values.** `<html>` has no `dir`; CSS makes the body right to left. The empty field is right to left, so its placeholder sits at the right. The first character switches it to left to right: the text moves to the left edge, the paddings swap so the icon stays at the right, and the font changes from IRANSans to Open Sans (back to IRANSans for Persian letters, which are also laid out left to right).
- **States.** Focus only darkens the border to `#a6a6a6` (2.43:1 on white): no outline, no shadow. Nothing appears while typing or on leaving the field, for `carshenas-ref` or for `زشقساثدشس`. Placeholder `#999` at 12 px (2.85:1); input text 14 px.
- **Markup.** No `name`, `autocomplete` or `inputmode`. The `<label>` around the field has no text, so the field has no accessible name: the accessibility tree shows an unnamed textbox with a placeholder.
- **API.** On load, before anything is typed: `GET /api/fa/v1/user/Authenticate/:ui_id?guid=` returns the configuration (provider names, theme colours and logos, sign-in and sign-up options, methods, code lengths, CAPTCHA provider, Google One Tap), and `POST /api/fa/v1/user/Authenticate/auth` with a client-made `guid` returns a `temp_id`: a sign-in transaction exists before the visitor types. Endpoint names in the bundle: `signin_step1` to `signin_step3`, `signup_step1` to `signup_step3`, `forget_pass_identification`, `forget_pass_verification`, `forget_pass_information`, `forget_pass_alteration`, `session_list`, `after_login`, `google_one_tap_callback`, `tv_sync_account` and profile endpoints. CAPTCHA provider: `basharyab` (`basharyab.com`); the reCAPTCHA keys in the configuration are null.
- **Technology.** React 16.14.0 and styled-components 4.4.1; server `roadrunner`; HSTS, no CSP; viewport `maximum-scale=1`, so no zoom; no logical properties against 41 physical left and right declarations. A bundle helper maps Persian (۰–۹) and Arabic-Indic (٠–٩) digits to Latin.

### 2. Filimo, `/signin`

- **Same platform as Aparat.** The same `Authenticate` endpoints on `www.filimo.com`, the same markup, geometry (phone field 350 × 48, desktop 374 × 48), states and direction switch. Only the brand colour, the typeface («Filimo», with Open Sans for Latin) and the options differ: sign-in by «ایمیل», «موبایل» or «نام کاربری», sign-up by mobile only, methods `call`, `sms` and `password`, Google One Tap on.
- **Words.** Heading «ورود یا ثبت‌نام در فیلیمو»; placeholder «موبایل خود را وارد کنید:», which asks for a mobile number although the platform accepts a username and an email; «ادامه»; a divider «یا» and «ادامه دادن با Google» (a Google iframe that rendered in the phone view only); «پشتیبانی» (support) under the card.
- **Differences.** The field is `type="tel"` in the phone view and `type="text"` on desktop. White 12 px bold on the green button is 2.98:1. Typed `۰۹۱۲` stays in Persian digits in the field; the same helper as Aparat's normalises digits in code.
- **Technology.** No CSP and no HSTS header; Google Analytics, Yandex Metrica, `metricat.ir` and Microsoft Clarity.

### 3. Virgool, `/login`

- **For.** One page for signing in and signing up, identifier first, with Google as the alternative.
- **Phone.** The brand block (blue, logo tile, the name as the `h1`, a tagline) fills the top 350 px. A white sheet with a 32 px top radius rises over it: the title «ورود یا ثبت‌نام» (22 px, 500, a `div`), the field (380 × 56, 16 px radius, 1 px `#191c22` border, 14 px at 500), 24 px of space, «ادامه» (a 380 × 48 pill, 14 px) with a chevron pointing left after the word, a divider with a dot, a «Google» pill on light lavender, and at the bottom a consent line that makes continuing an acceptance of the «قوانین و مقررات» (a link), then a © line with the Jalali year in Persian digits.
- **Desktop.** The same sheet, about 556 px wide, centred on full-bleed brand blue.
- **Words.** «ورود یا ثبت‌نام»; placeholder «موبایل، ایمیل یا نام کاربری»; «ادامه»; «قوانین و مقررات».
- **Left-to-right values.** CSS only: the input is always `direction: ltr; text-align: left`, and only its `::placeholder` is aligned right. The Persian placeholder therefore sits at the right while the caret and the typed text start at the left, from the moment the field has focus (deduced from the computed direction; the tool's screenshots hide the caret). The field has focus on load.
- **States.** Focus changes nothing visible (`outline: none`, border unchanged). Nothing appears while typing or on leaving. Placeholder `#b3b3b3` (2.10:1); input text 14 px.
- **Markup.** The only site with `autocomplete="username"` (and `name="userInput"`), but no label: the placeholder is the accessible name. An empty `role="alert"` region waits at the end of the page.
- **API.** No sign-in call on load. Bundle names: `/auth/user-existence` (the lookup behind «ادامه»), `/auth/login`, `/auth/verify`, `/auth/verify-code`, `/auth/recaptcha/verify`, `/auth/checktoken`, `/auth/logout`; Google is a plain link to `/api/login/google`.
- **Technology.** Next.js 16.3.2 App Router with React Server Components, React 19.3 canary, CSS Modules and Emotion, the Vazir typeface. Cloudflare, with bot-management JavaScript detections. The CSP allows ArCaptcha (`*.arcaptcha.ir`, `*.arcaptcha.co`), Yektanet, and Sentry on `sentry.virgool.io` and `sentry.hamravesh.com`, and no Google reCAPTCHA host. Viewport `maximum-scale=1`; a reduced-motion query; 17 logical against 81 physical declarations.

### 4. Torob, the sign-in dialog on the home page

- **For.** Signing in or up with a mobile number and a one-time code, in a dialog over whatever page the visitor is on. No username or password.
- **Entry.** Desktop: an outlined «ورود / ثبت نام» (with a plain space in «ثبت نام») at the header's inline end, top left, built as a `div` with `role="button"`. Phone: «ترب من» ("my Torob"), the last of four labelled tabs in the bottom bar, a link to `/user/`. The flow did not open it, so the dialog was seen on desktop only.
- **Desktop.** Backdrop black at 80 %. A 480 px dialog near the top of the viewport, 16 px radius, light slate. Close «×» at the inline end; title «ورود به ترب» (20 px, 800); helper «شماره موبایل خود را وارد کنید» (16 px, 500); label «شماره موبایل» (14 px, 700) above the field (400 × 40, 8 px radius); 16 px of space; primary «دریافت کد ورود پیامکی» (400 × 48, dark slate, near-white 14 px bold, 13.98:1); 8 px; secondary, outlined, «دریافت کد ورود صوتی».
- **Left-to-right values.** The field is always left to right and has no placeholder; the label sits above it at the right and the value at the left. `inputmode="numeric"`, `maxlength="11"`, no `autocomplete`. Letters are not filtered (`carshenas-ref` stopped at `carshenas-r`, the eleventh character); typed Persian digits stay Persian in the field, and a bundle helper converts them to Latin.
- **States.** The field has focus when the dialog opens. The focus style is a Bootstrap-like glow: border `#80bdff` and a 3.2 px shadow of 25 % blue, 1.89:1 against the field. Nothing appears while typing or on leaving.
- **Markup.** The only real `<label>` bound to its field among the five. The dialog has `role="dialog"` and `aria-modal="true"` but no accessible name (its title is a `span`), and its close control is an `img` named "close" in English, not a button.
- **API (bundle names; nothing was sent).** `/v4/user/phone/send-pin/`, `/v4/user/phone/send-voice-otp/`, `/v4/user/phone/verify/`, `/v4/user/email/send-pin/`, `/v4/user/email/verify/`, `/v4/user/details/`, `/v4/user/logout/`, `/v4/bale/login/`, `/v4/telegram/login/`. CSRF uses a `csrftoken` cookie and an `X-CSRFToken` header. The code step expects four digits and asks the browser for the SMS code through WebOTP (`navigator.credentials.get({ otp: { transport: ['sms'] } })`), with a bridge for its app's WebView. Saved products are `/v4/user/like/*`, price watches `/v4/user/watch/*`.
- **Technology.** Next.js 16.2.7 (pages router), React 19.2.7, CSS Modules; IRANYekan and the variable IRANYekanX; server `Torob`; Sentry on `sentry.torob.ir`; a CSP that also allows PostHog on `posthog.torob.ir`, and Bale and Telegram, where Torob also runs as a mini-app; 134 logical against 123 physical declarations; zoom allowed (`maximum-scale=5`). The published route table includes `/user/[[...others]]`, `/sell/login` and `/sell/register/[[...others]]`.

### 5. Namava, `/login`

- **For.** Signing in with an identifier and a password on one screen, «شماره تلفن همراه یا ایمیل» and «رمز عبور», with links to sign up, to sign in with a one-time code instead, and to recover the password. The closest of the five to what Carshenas needs.
- **Entry.** Desktop header: «ورود / ثبت‌نام», a link to `/login`. Phone header: a small «ورود» button at the top left, which the flow found but could not click: an app-install sheet covered the page and the click timed out. The form was therefore seen on desktop only.
- **Desktop.** A white card, 500 × 663 px, 12 px radius, soft shadow, centred on light grey. Top row: logo centred, «ثبت‌نام» (a link) at the inline end. Title «ورود» (20 px) with a sign-in icon at its inline start; helper (16 px, `#666`); a label (14 px) above each field; fields 360 px wide and about 52 px tall, 12 px radius, a light border that turns dark on focus; 40 px of space; the «ورود» button (360 × 42, 12 px radius), grey `#aaa` with half-white text (1.57:1) while either field is empty and blue `#1993ff` with white text (3.15:1) once both hold something; then two blue links, «ورود با رمز یکبار مصرف» and «رمز عبور خود را فراموش کرده‌ام.»
- **Left-to-right values.** Each field flips its inline `direction` by script: right to left while empty (placeholder at the right), left to right once it holds a value. The show-password eye appears only while the password field holds a value, at its right end (the page's inline start), and the dots start at the left.
- **States.** No message at any point; the grey button is the only signal. Persian letters typed into the password field were dropped without a word: the field stayed empty and the button turned grey again. Persian letters in the identifier were accepted.
- **Markup.** No `<form>` and no `<label>`: the visible labels are paragraphs, and each field's name comes from its placeholder, which repeats the label. `autocomplete="off"` on both fields, no `name` or `id`. Viewport `user-scalable=no`. The one-time-code link carries what was typed in its URL (`/login-otp?username=…`). «ثبت‌نام» is a `<button>` inside a link.
- **API.** Every visitor gets an anonymous account on first load (`POST /api/v1.0/accounts/login/by-anonymous`, then `GET /api/v1.0/users/anonymous-info`). Routes: `/login`, `/register`, `/recover`, `/login-otp`. The sign-in calls live in a script the phone view never loaded, so they are unknown.
- **Technology.** A React single-page app styled with JSS; iranyekan; server `Namava-Edge`; Yektanet, Yandex Metrica, mediaad, Zebline, inTrack, Clarity, Google Tag Manager and a device-fingerprint call to `api-dwid.digiwiseid.com`.

### 6. The five side by side

| | Aparat | Filimo | Virgool | Torob | Namava |
|---|---|---|---|---|---|
| First screen | identifier, «ادامه» | identifier, «ادامه» | identifier, «ادامه» | mobile number, code by SMS or call | identifier and password, «ورود» |
| Visible label bound to the field | no | no | no | yes | no (a paragraph) |
| Input text | 14 px | 14 px | 14 px | 14 px | 14 px |
| Placeholder contrast | 2.85:1 | 2.85:1 | 2.10:1 | no placeholder | 2.32:1 |
| Focus | border to 2.43:1 | border to 2.43:1 | nothing visible | glow, 1.89:1 | border turns dark |
| Left-to-right values | flips on the first character | flips | always left to right, placeholder at the right | always left to right, label above | flips |
| `autocomplete` | none | none | `username` | none | `off` |
| Zoom | disabled | disabled | disabled | allowed | disabled |
| Feedback before submit | none | none | none | none | button disabled until both fields hold something |
| Persian-layout letters | accepted silently | accepted silently | accepted silently | accepted silently | identifier accepted; password drops them silently |

## Synthesis

### The vocabulary Iranian users see

| Term | Meaning | Where |
|---|---|---|
| «ورود» | sign in: title, button, header entry | all five |
| «ثبت‌نام» | sign up | all five; Torob writes «ثبت نام» with a space |
| «ورود یا ثبت‌نام» | combined title of an identifier-first page | Aparat, Filimo, Virgool |
| «ورود / ثبت‌نام» | header entry | Torob and Namava, desktop |
| «ورود به …» | title of the sign-in form | Torob |
| «ادامه» | continue, identifier-first | Aparat, Filimo, Virgool |
| «نام کاربری» | username | Virgool (placeholder); Aparat and Filimo (options, later steps) |
| «رمز عبور» | password | Namava; Aparat writes «رمزعبور»; nobody uses «گذرواژه» |
| «ایمیل» | email | Aparat, Virgool, Namava |
| «موبایل», «شماره موبایل», «شماره تلفن همراه» | mobile number | Aparat, Filimo, Virgool; Torob; Namava |
| «رمز یکبار مصرف» | one-time password | Namava |
| «کد ورود», with «پیامکی» or «صوتی» | sign-in code by SMS or by voice call | Torob |
| «فراموش کرده‌ام», «فراموش کردید؟» | forgotten password link | Namava, Aparat; «فراموشی رمز» appears nowhere |
| «بازیابی رمزعبور» | password recovery | Aparat |
| «تایید رمزعبور» | password confirmation | Aparat |
| «به خاطر بسپار» | remember me | Aparat |
| «بازگشت» | back | Aparat, Filimo |
| «پشتیبانی» | support | Filimo |
| «قوانین و مقررات» | terms | Virgool |
| «ترب من» | the account tab | Torob, phone |
| «کاراکتر» | character, in length rules | Aparat |

### Right-to-left conventions worth adopting

1. **A visible label above the field, at the right, and the left-to-right value inside at the left** (Torob). No Persian placeholder inside a left-to-right field, so nothing sits at the opposite end from the caret.
2. **Left-to-right fields for Latin data.** All five render usernames, emails, phone numbers and passwords left to right once typed. Doing it with `dir="ltr"` on the input is simpler and steadier than switching direction on the first character.
3. **Field icons at the page's inline start, the right**: Aparat's and Filimo's person icon, Namava's eye. Left-to-right text starts at the left, so an icon at the right never collides with it.
4. **Mirrored direction glyphs**: «بازگشت» with an arrow pointing right before the word (Aparat, Filimo), «ادامه» with a chevron pointing left after it (Virgool).
5. **A full-width primary action, 48 px tall, right under the fields** (Aparat, Filimo, Virgool, Torob).
6. **Persian and Arabic-Indic digits accepted and converted in code** while the field shows what was typed (the helpers in Aparat's, Filimo's and Torob's bundles).
7. **The header entry at the inline end, top left**: «ورود / ثبت‌نام» on desktop (Torob, Namava), a short «ورود» on the phone (Namava) or an account tab in the bottom bar (Torob).
8. **The other form one tap away, at the top of the card** (Namava's «ثبت‌نام» in the card's top row).

### Things to avoid

1. **Placeholders as labels** (Aparat, Filimo, Virgool; Namava's labels are unbound paragraphs). In Aparat and Filimo the field has no accessible name at all.
2. **Faint placeholders, borders and focus.** Placeholders at 2.10 to 2.85:1, field borders at 1.43 to 1.54:1 (Aparat, Filimo, Torob; Virgool's is a strong 17:1), and focus states from nothing (Virgool) to 2.43:1.
3. **14 px input text and disabled zoom** (zoom disabled on four of the five).
4. **Switching direction on the first keystroke** (Aparat, Filimo, Namava): the text jumps from right to left and fonts and paddings change under the caret.
5. **Hiding the form from browsers and password managers**: no `<form>`, no names and `autocomplete="off"` (Namava); no `autocomplete` at all (Aparat, Filimo, Torob).
6. **Silent rules.** A submit button that stays disabled without saying why, and Persian letters dropped from the password without a word (Namava). No site said anything about `زشقساثدشس` typed into a Latin-only field, a slip the switch between the Persian and English layouts invites (inference).
7. **An identifier-first lookup** (Virgool's `/auth/user-existence`, Aparat's first step): it tells anyone whether an account exists, and with a username and a password only there is nothing for it to route.
8. **Personal data in URLs** (Namava's `/login-otp?username=…`).
9. **A dialog without a name, with an image as its close control** (Torob).
10. **An app-install sheet over the sign-in entry** (Namava, phone).
11. **«رمزعبور» written as one word** (Aparat).

## Adaptation for Carshenas

### Flow

- **Two pages, «ورود» and «ثبت‌نام»**, full pages on the phone rather than a dialog: the `ui-design` skill's `references/mobile-forms.md` keeps sheets for short single tasks, and Torob's dialog is the only one of the five. Each page links to the other near its top, as Namava's card does.
- **Username and password on one screen** (Namava), never an identifier-first step (Things to avoid, 7).
- **The header entry at the inline end**: «ورود» on phones, «ورود / ثبت‌نام» where there is room. The rest of the header is the sibling UX note's.

### Words, proposed for the owner

| Part | Farsi | Evidence |
|---|---|---|
| Sign-in title | «ورود به کارشناس» | Torob's «ورود به ترب» |
| Sign-up title | «ثبت‌نام در کارشناس» | Aparat's and Filimo's «ورود یا ثبت‌نام در …» |
| Username label | «نام کاربری» | Virgool, Aparat, Filimo |
| Password label | «رمز عبور», two words | Namava |
| Primary actions | «ورود», «ثبت‌نام» | all five |
| Link to the other page | «ثبت‌نام» and «ورود», each after a short question such as «حساب ندارید؟» | Namava shows the bare «ثبت‌نام» |
| Show-password button, accessible name | «نمایش رمز عبور», then «پنهان کردن رمز عبور» | no reference names its toggle |
| Wrong username or password | «نام کاربری یا رمز عبور درست نیست.», one message that never says which | none seen (nothing was submitted) |
| Persian letters typed | «حروف فارسی تایپ شد؛ صفحه‌کلید را انگلیسی کنید.» | no reference does it |
| Caps Lock | «کلید Caps Lock روشن است.» | none seen |
| Character, in length rules | «کاراکتر» (Aparat) or «نویسه»; the owner chooses | Aparat |

### Direction, digits and keyboard layout

1. **`dir="ltr"` on the two `<input>` elements only**, never on their wrapper. The label and any helper or error text stay right to left. No placeholder; if an example is ever wanted, a Latin one sits naturally at the left.
2. **The show-password button** is a `<button type="button">` with `aria-pressed` and a 44 px hit area, visible even while the field is empty (unlike Namava's), at the field's right edge, where Aparat, Filimo and Namava put field icons. Position it with `start-*` on the right-to-left wrapper; the left-to-right input reserves its room with `pe-*`, which resolves to the right in the input's own direction.
3. **Digits.** Map Persian and Arabic-Indic digits to Latin on the server, in both fields, before validating, comparing and hashing, as the reference helpers do; show what was typed. Hashing and Unicode normalisation are the password note's.
4. **Keyboard layout.** When the username or password field receives a Persian or Arabic letter, say so under the field in a polite live region, without blocking. The username's own character rule still rejects it on submit, with that rule's message.
5. **Caps Lock.** Check `getModifierState('CapsLock')` on key events in the password field and show the hint while it is on.

### Look, in our tokens

No new tokens are needed; every part maps onto the [design language](../design/design-language.md).

| Part | Carshenas | What the references do |
|---|---|---|
| Column | one column, `max-w-sm` (24rem; Tailwind's container scale, which `globals.css` keeps), centred; 16 px gutters and no card on the phone | fields 350 to 524 px wide; cards 440 to 556 px on desktop |
| Label | `text-label` (14 px, 500), `text-default`, above the field | 14 px at 400 or 700; mostly absent |
| Field | `min-h-12` (48 px), `text-control` (16 px), `rounded-control`, `border-control` (3.29:1), white | 40 to 56 px tall, 14 px text, 8 to 16 px radius, borders from 1.43:1 to Virgool's 17:1 |
| Focus | the 2 px `outline-focus` ring at 2 px offset (5.49:1) | none to 2.43:1 |
| Helper and rules | `text-secondary`, `text-muted`, under the field, linked with `aria-describedby` | none on screen before submit |
| Error | `text-secondary`, `text-danger`, under the field | none seen |
| Primary action | `actionClasses('primary')`: 48 px, `bg-action` and `text-on-action` (5.49:1), full width, never disabled | 42 to 48 px; white on green at 2.98:1; disabled until filled |
| Spacing | label to field `gap-2` (8 px), field to field `gap-6` (24 px), last field to button `mt-8` (32 px) | 10 to 40 px before the button |

### What the owner has to decide

- **Recovery.** Every reference offers a way back into an account through a phone number or an email («رمز عبور خود را فراموش کرده‌ام.», «بازیابی رمزعبور»). Carshenas will have neither, so a forgotten password cannot be recovered in the product. The sign-in page must not show a recovery link that cannot work; what it says instead (nothing, or a support contact) is the owner's call.
- **Persian letters in passwords.** NIST lets any Unicode character into a password; the Iranian references either accept Persian letters silently or drop them (Namava). The hint above keeps them allowed while making a layout slip visible. The final rule is the password note's.
- **A consent line at sign-up** (Virgool) only if Carshenas has terms to accept.
- **CAPTCHA.** None of the references relies on Google reCAPTCHA here: Aparat's configuration names `basharyab` with its reCAPTCHA keys empty, and Virgool's CSP allows ArCaptcha. Rate limiting comes first (the password note); a CAPTCHA, if ever needed, must work from inside Iran and needs an ADR (AGENTS.md, Market).

## Technology and API observations

- **Two families.** Saba Idea's shared sign-in platform (Aparat, Filimo: React 16, styled-components, a configuration fetched by the page and a sign-in transaction created before any input) and Next.js 16 (Virgool on the App Router, Torob on the pages router). Namava is a React single-page app on JSS.
- **Sessions before sign-in.** Aparat opens a sign-in transaction (`guid`, `temp_id`) on load; Namava gives every visitor an anonymous account; Torob protects its forms with a `csrftoken` cookie and an `X-CSRFToken` header.
- **Observability.** Torob and Namava sent errors to Sentry on their own hosts (`sentry.torob.ir`, `sentry.namava.ir`); Virgool's CSP allows `sentry.virgool.io` and `sentry.hamravesh.com`, and Torob's allows PostHog on `posthog.torob.ir`. Self-hosted error reporting, reachable from Iran, is the norm here: relevant to ADR-0016's later step.
- **Direction readiness.** Only Torob's CSS is mostly logical properties (134 logical against 123 physical); the others are almost all physical left and right.
- **Limits.** One anonymous visit per page, one state, nothing submitted: no server errors, rate limits, password steps of the identifier-first flows or code screens were seen. Bundle endpoint names are not observed traffic; their methods and shapes are unknown. Torob's and Namava's forms were seen at desktop width only. The tool's screenshots hide the caret, so caret positions are deduced from the computed direction. Namava has no distilled reports.
- **Tool.** The capture has no overall timeout: Namava's run stalled on a browser call after its last screenshot and was stopped by hand, losing its reports. A bounded wait in `tools/site-capture/capture.mjs` would have kept them.

## Recommendation

1. Build two full pages, «ورود» and «ثبت‌نام», each with «نام کاربری» and «رمز عبور» on one screen, a 48 px full-width primary action, and a link to the other page near the top.
2. Bind a visible label above every field; give the inputs `dir="ltr"` and no placeholder, and keep the show-password button at the field's right edge.
3. Accept digits in any script and convert them in code, as Aparat, Filimo and Torob do; and say when Persian letters or Caps Lock are in play, which none of the five does. That is where Carshenas can be plainly better.
4. Use the existing tokens (16 px text, 3.29:1 borders, the focus ring, `text-danger` errors) and never disable zoom or the submit button: the references fail on each of these.
5. Settle recovery before building: without a phone number or email there is none, and no reference prepares users for that.
