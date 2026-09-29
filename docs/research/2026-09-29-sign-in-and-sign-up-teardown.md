# How do the leading sign-in and sign-up pages work, measured, and what should Carshenas's username-and-password pages take from them?

- Date: 2026-09-29
- Asked by / for: Pedrum, for CS-39. He asked that the site-capture tool be used on the best web apps' sign-in and register flows, for their design, their APIs and anything else useful. Accounts are a username and a password only (his decision of 2026-09-29: no email, no phone, no code for now), so username-based sign-ups are the closest references.
- Outcome: evidence for CS-39. Five complete captures, two that stopped after the phone pass (the page closed itself) and one refused with HTTP 403; ten patterns to adopt, ranked; the patterns to avoid; an adaptation to Carshenas's right-to-left layout and tokens. No decision is taken here. The standards and the security design are in two sibling notes of the same day, [sign-in and sign-up UX](2026-09-29-sign-in-and-sign-up-ux.md) and [password accounts and sessions](2026-09-29-password-accounts-and-sessions.md), and the Farsi wording and right-to-left habits of Iranian products in a third, the [Iranian sign-in teardown](2026-09-29-iranian-sign-in-teardown.md); this note is the evidence from the leading international pages.

## Questions

1. How are the leading sign-in and sign-up pages laid out at 412 px and at desktop width, and in which order do they ask for what?
2. How do they label fields, show rules and report errors, when do they validate, and which requests check a username while it is typed (method, path, shape)?
3. What do their submit and pending states look like, how do sign-in and sign-up link to each other, and where do trust and legal text sit?
4. What technology is behind them, with evidence?
5. What should Carshenas adopt, what should it avoid, and how does it adapt the rest to a Farsi, right-to-left, phone-first page where usernames and passwords are left-to-right text?

## Sources and method

Findings come from the captures unless marked; their screenshots, DOM and raw bodies stay in `.captures/`, which is gitignored. Markers: **read here** (read in this session), **lab** (run in this session's scratchpad, not committed), **screenshot** (measured on a capture's CSS-pixel screenshot by edge detection, about ±2 px).

- **Tool.** `pnpm capture` (`tools/site-capture`, Playwright 1.63.0, Chromium 153), on 2026-09-29 between 14:09 and 14:31 UTC, anonymous, locale `en-US`. Each run is one phone page view (the Pixel 7 preset, 412×839 CSS px) and one desktop page view (1440×900), 8 s apart, and each page was captured once. Nothing was logged in, submitted or created.
- **Flows**, kept in `.captures/flows/`: on sign-up pages, `signup-states.mjs` focused the username field, typed `carshenas-ref-check-2026`, moved to the password field, typed `abc`, pressed Tab and clicked the show-password control (on Cal.com it first pressed the continue-with-email button, which reveals the form in place); on sign-in pages, `signin-focus.mjs` focused each field and pressed the toggle, typing nothing. Neither presses Enter, and a button is clicked only when it cannot submit a form (its `type` is `button`, or it is not a native button). Before the first real run both flows ran against a local trap page that had a default-submit button on the password's line (**lab**): the server received no POST.
- **Reading**, for each capture: `summary.md`; the phone and desktop first views and every flow screenshot, opened and described; `tokens.md`; the accessibility trees; `tech.md`; `api.md`; and the rendered DOM for form attributes. The DOM and raw bodies are never committed.
- **Documentation**, **read here**: `@github/auto-check-element` 6.0.0 (MIT, npm, last modified 2026-08-07), its README and `dist/auto-check-element.js`. It is GitHub's published element for checking a field against the server; GitHub's sign-in page registers it (`AutoCheckElement` among the window globals in that capture's `tech.md`). Next.js 16.3.5's version-matched guides in `apps/web/node_modules/next/dist/docs/01-app/02-guides/` (`server-actions.md`, "Sequential dispatch on the client"; `backend-for-frontend.md`, "Server Actions are queued").
- **Kept in the repository**: Cal.com's distilled reports, [`captures/calcom-signup/`](captures/calcom-signup/) (the tool's `--distill` copy). Its two failed-request URLs in `api.md` and `api.json` were reduced by hand to the tool's own path pattern, because the tool prints failed requests with their raw path tokens.

### What each capture produced

| # | Page | Result | Evidence used |
|---|---|---|---|
| 1 | GitHub sign-up, `https://github.com/signup` | **Stopped**: HTTP 403 on the first page view (phone). Not retried | none |
| 2 | GitHub sign-in, `https://github.com/login` | complete | all reports; 2 flow steps per viewport |
| 3 | Cal.com sign-up, `https://app.cal.com/signup` | complete; Turnstile appeared during the flow (below) | all reports; 7 flow steps per viewport; the raw username-check bodies |
| 4 | Proton sign-up, `https://account.proton.me/signup` | **Stopped after the phone pass**: the page closed itself | phone first view, 6 flow steps, accessibility tree, DOM; no tokens, technology or API report |
| 5 | Stripe sign-in, `https://dashboard.stripe.com/login` | **Stopped after the phone pass**, the same way | phone first view, 2 flow steps, accessibility tree, DOM |
| 6 | Supabase sign-in, `https://supabase.com/dashboard/sign-in` | complete | all reports; 3 flow steps per viewport |
| 7 | Figma sign-in, `https://www.figma.com/login` (optional) | complete | all reports; 2 flow steps per viewport |
| 8 | Linear log-in, `https://linear.app/login` (optional) | complete; no field on the first view, so the flow photographed nothing | all reports |

- **The two pages that closed themselves.** Both runs ended with Playwright's "Target page, context or browser has been closed" while the tool was reading the phone page after the flow. A **lab** (`closetest.mjs`) shows that a page calling `window.close()` produces exactly this error in Playwright 1.63. Stripe's page held HUMAN Security's active frame (a fixed, full-viewport iframe at z-index 999999), an iovation frame and an invisible hCaptcha; Proton's held its own challenge frames. A tab closing itself is read here as the site ending an automated visit, so neither page was captured again, as for a 403 or a challenge.
- **Turnstile on Cal.com.** Cloudflare Turnstile's interactive checkbox appeared inside Cal.com's form once the fields were being filled (desktop: after the username was typed; phone: after the password field was left). The flow never touched it, but it went on, so the widget is visible in 2 phone steps and 5 desktop steps, because the tool's challenge check does not look inside cross-origin frames. Under the capture rules that widget was a challenge and the flow should have ended there. The gap is listed under "The capture tool".
- **Limits.** One page per site, one state, anonymous, in English, headless Chromium, from one network. Computed styles do not sample hover or dark mode; the flows photograph focus. Nothing was submitted, so server error messages and pending states are read from markup, never seen. The API maps cover only what these page views requested.

## Findings

### 1. GitHub sign-up: refused

GitHub answered HTTP 403 to the first page view and the tool stopped; nothing here describes that page from memory. What the sign-in page shows about sign-up: its link carries `source=login`, and the page registers `AutoCheckElement`, the element GitHub publishes for server-checked fields (section 9).

### 2. GitHub sign-in (complete)

- **For**: signing in to an existing account with a username or an email and a password.
- **Layout.** Phone: one centred column; fields and buttons 380 px wide (16 px gutters); the logo, a centred title (20 px, weight 600, 30 px line height), the form, and a footer of legal links in a grey band at the bottom. Desktop: the same column at 352 px (x 544 to 896, **screenshot**) and nothing else. The phone layout is the desktop layout.
- **Order**: identifier, then the password with the reset link at the inline end of its label row, the primary, an "or" divider, two provider buttons, a one-line invitation to create an account, a passkey link.
- **Labels and hints**: visible labels above the fields, 14 px weight 600; no placeholders, no hints.
- **Validation**: none while typing. Both fields are `required` and the form posts natively (`action="/session" method="post"`).
- **Submit and pending** (markup): a real `<input type="submit">` with `data-disable-with`, which swaps the label for a pending text and disables the button while the request runs. The provider buttons carry the same attribute.
- **Field attributes**: identifier `autocomplete="username" autocapitalize="off" autocorrect="off" autofocus required`; password `autocomplete="current-password" required`.
- **Bot friction without a third party**: a hidden text field with a randomised name (`required_field_` and four hex characters) and a `timestamp` with a `timestamp_secret`, that is, a honeypot and a signed time-to-submit check. A hidden `return_to` keeps the destination; `webauthn-conditional` and `webauthn-support` prepare passkey autofill.
- **Legal and trust**: only the footer (terms, privacy, documentation, support, cookie settings, a do-not-share control); nothing inside the form.
- **Tokens**: fields and buttons 40 px tall at both widths; input text 16 px; radius 6 px; a 1 px grey border. Focus turns the border the link blue and adds a 1 px inset shadow of the same blue, a 2 px ring inside the box, shown on load because the identifier has `autofocus`. Transitions 80 ms.
- **Technology**: React 19.3.0 with Primer (CSS layers `primer-css-base`, `primer-react` and others), Turbo, and web components (`AutoCheckElement`, `ModalDialogElement` and others among the window globals); CSP, HSTS and `X-Frame-Options: deny`. CSS direction readiness: 366 logical against 2,118 physical left and right declarations.
- **API**: only `GET github.com/u2f/login_fragment` (query names `disable_signup`, `is_emu_login`, `mobile_ios`), the passkey fragment, once per page view.

### 3. Cal.com sign-up (complete; distilled)

- **For**: creating an account whose username becomes the public booking address.
- **Layout, phone.** The first view is a chooser: a dark primary button for one provider, an outlined one for a second, an "or" divider, an outlined continue-with-email button and a text link for SAML; then the sign-in line and third-party rating badges. Choosing email reveals the form in place, with no navigation, and a back button appears; the page grows to 962 px. Buttons 380×36 px and fields 36 px tall (**screenshot**), input text 16 px.
- **Layout, desktop.** A split screen: the form column is 416 px wide (x 152 to 568, **screenshot**) in the start half (0 to 720 px), and a product panel fills the end half (ratings, a product screenshot, three feature points). The sign-in line is pinned to the bottom of the form column. Input text drops to 14 px and buttons to 32 px.
- **Order**: username, email, password with a show toggle, the rules list, then Turnstile when it appears, the legal line, the submit, the sign-in line.
- **Username**: the public address is previewed as it is typed, as a helper line with a globe icon under the field on the phone and as a fixed prefix inside the field on desktop: one field, restyled at the breakpoint. No "available" confirmation appeared; the preview was the only feedback.
- **Live check**: `POST app.cal.com/api/username` with the JSON body `{"username": string}`, answered 200 `{"available": boolean, "premium": boolean, "suggestedUsername": string}` ([`captures/calcom-signup/api.md`](captures/calcom-signup/api.md), "Shapes"). For the test name it answered available, not premium, with an empty suggestion (raw body). There was one call per page view for 24 typed characters, so the check is debounced or runs when the field is left; the tool records no timing. The verdict is a boolean in a 200, not a status code. `premium` marks names sold as an upgrade; `suggestedUsername` offers an alternative to a taken name (not observed).
- **Password**: the rule (at least 12 characters) sits under the empty field as a grey bullet. While the password is being typed (photographed after three characters, the field still focused), the rule turns red with a cross, and the field's border and ring turn red (`aria-invalid="true"`). No strength meter and no confirmation field. No request carried the password: the only first-party POST was the username check.
- **Show password**: an icon button inside the field at the inline end, 24 to 28 px, with a tooltip on focus; its accessible name switches between show and hide, and the input's `type` between `password` and `text`.
- **Submit**: natively `disabled` until the form is valid, drawn grey at full width, so it never says why.
- **Bot friction**: Turnstile inside the form, whose token travels in a hidden `cf-turnstile-response` field. When it appears it pushes the legal line and the submit about 70 px down (phone steps 05 and 06).
- **Legal and trust**: one agreement line with links to the terms and the privacy policy, directly above the submit; rating badges as social proof.
- **Linking**: the sign-in link goes to `/auth/login`, which the page prefetches (`GET /auth/login` with `_rsc`, 4 calls).
- **Tokens**: radius 10 px on fields and buttons (8 px on small buttons, 16 px on the panel); labels 16 px weight 500 on the phone and 14 px on desktop; the title 28 px weight 700 on a 28 px line (1.0); the canvas `#f6f7f9` and white fields; transitions 150 ms; the focused toggle shows a 1 px white gap and a 2 px grey ring.
- **Markup**: `<form novalidate>`; the username has no `autocomplete`, `autocapitalize` or `spellcheck`; email `autocomplete="email"`; password `autocomplete="new-password" autocapitalize="none" autocorrect="off" spellcheck="false"`. The fields are Base UI (`base-ui-` ids, `data-slot`, and the field states `data-dirty`, `data-touched`, `data-invalid`).
- **Technology**: Next.js 16.3.6 App Router, React 19.3 (a canary build), Tailwind and Base UI; Cloudflare in front of Vercel; Sentry and Intercom; tags from Google, Meta, LinkedIn, X, OpenAI and others (the page contacted 24 hosts), including Google Analytics form-interaction events (parameter names such as `first_field_name` and `form_length`). The viewport meta disables zoom (`maximum-scale=1, user-scalable=no`). CSS direction readiness: 482 logical against 202 physical declarations, and 77 explicit RTL selectors.

### 4. Proton sign-up (phone only; stopped)

- **For**: creating a Proton account; plan, account and payment on one long page, in three numbered steps.
- **Layout, phone**: a marketing header and trust badges, plan cards with a paid plan preselected and a discount banner, then step 2 (the account) and step 3 (checkout: payment method, a card frame, billing country, the submit, the legal line, the order summary). Fields 364 px wide (24 px gutters) and 40 px tall (**screenshot**).
- **Order**: the username with a domain selector inside the field at the inline end; a link to use an existing email address instead, with an info button; the password with a show toggle; a confirmation field once the password has content; the sign-in line; checkout.
- **Username**: typed inside a cross-origin iframe from `account-api.proton.me/challenge/v4/html` (a second, hidden one sits off-screen), loaded with `Dir=ltr` and `Lang=en-US` parameters. The main document keeps an off-screen, `aria-hidden` copy of the field, whose root has `dir="ltr"` and whose input has `autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"`. About 3 s after the name was typed, before the field was left, a green check-circle appeared at the inline end of the field: availability confirmed in place, by an icon alone. The endpoint is unknown (no API report).
- **Password**: the confirmation field appears only when the first password has content. While typing, a three-segment meter sits under the field (the first segment red) with a one-word verdict and a shield icon at the inline end. On leaving the field, an error line with an icon appears under it (at least 8 characters) and the border turns red; the meter stays. Each password field has its own show toggle and `autocomplete="new-password"` with the same three switches off.
- **Focus**: a 1 px border and a tinted halo of about 3 px in the brand colour (**screenshot**).
- **Legal and trust**: badges at the top (encryption, open source, the home country), a money-back line, card-scheme logos, the agreement line under the submit, and the renewal terms in the footer.
- **Linking**: the sign-in control under the password fields is a button, not a link.

### 5. Stripe sign-in (phone only; stopped)

- **For**: signing in to the Stripe dashboard.
- **Layout, phone**: a header strip with the logo over a hairline; the title aligned to the start; fields about 349 px wide (32 px gutters) and 45 px tall; the primary 46 px; three outlined provider buttons of 42 px; a muted panel with the create-account link; a cookie banner (a `role="dialog"`) at the bottom (all **screenshot**).
- **Order**: email, focused on load; the password with the reset link at the inline end of its label row; a remember-me checkbox, checked by default; the primary; a labelled divider; Google, passkey and SSO; the create-account panel.
- **Submit**: `type="button"` with `aria-disabled="true"` and `tabindex="-1"` until both fields are filled, drawn in a pale brand tint, so the keyboard cannot reach it.
- **Markup**: `<form novalidate>`; email `type="email" autocomplete="username email" required`; password `autocomplete="current-password"`; positive `tabindex` values (1, 2 and 4) that put the reset link after the password; `aria-label` values that replace the visible labels; React Aria ids. No show-password toggle.
- **Bot protection in the DOM**: an invisible hCaptcha (checkbox and challenge frames), HUMAN Security's active and passive frames and iovation, all from `b.stripecdn.com`, and Stripe's metrics frame from `js.stripe.com`.
- **Linking**: create account goes to `/register`.

### 6. Supabase sign-in (complete)

- **For**: signing in to the Supabase dashboard.
- **Layout, phone**: the logo at the start, a greeting title with a subtitle, three provider buttons, an "or" divider, email, password, the primary and the sign-up line; the cookie banner covers the bottom. Buttons 330×42 px and fields 330×34 px (41 px gutters); 32 px between the password field and the primary (**screenshot**).
- **Layout, desktop**: a split screen. The form column is 384 px wide (x 88 to 472, **screenshot**) inside a 560 px panel closed by a divider; a customer quote with an avatar fills the end side; a documentation link sits at the top end; the legal line is at the bottom of the form panel.
- **Order**: providers, email, the password with the reset link at the inline end of its label row, the primary, the sign-up line.
- **Show password**: a 26×26 px bordered button inside the field at the inline end; `title` and `aria-label` switch between show and hide.
- **Focus**: a 2 px brand-green ring with a white gap (desktop, **screenshot**).
- **Markup**: `method="POST"`; email `type="email" autocomplete="email"`; password `autocomplete="current-password"`, of type `text` when shown; the submit is `type="submit"` and enabled at rest; `aria-describedby` on both fields.
- **Linking**: the sign-up and reset links carry the destination (`returnTo`).
- **Legal**: at the bottom of the form panel, with consent to periodic update emails bundled into it.
- **Tokens**: input text 15 px on the phone and 13 px on desktop, labels 13 px, the title 22 px weight 600 (28 px on desktop) with negative letter spacing; radius 8 to 10 px.
- **Technology**: Next.js 16.3.5 (pages router, `__NEXT_DATA__`), React 19.2.6, Tailwind, an invisible hCaptcha (`POST api.hcaptcha.com/checksiteconfig`), Usercentrics consent, Sentry, Vercel with a Cloudflare cookie. CSS direction readiness: 454 logical against 550 physical declarations.
- **API**: `GET supabase.com/dashboard/api/incident-banner`, a status notice on the sign-in page; feature flags, consent and hCaptcha configuration.

### 7. Figma sign-in (complete)

- **For**: signing in; the same view switches to sign-up in place.
- **Layout**: phone: the logo at the start, a centred title (26 px, weight 500), a provider button, an "or", two fields, a black primary, then three links (SSO, reset, create an account); fields 348×53 px, buttons 348×48 px (32 px gutters), 16 px between the fields and 24 px before the primary (**screenshot**). Desktop: the same column at 358 px, centred (x 541 to 899, **screenshot**).
- **Labels**: inside the field box at its top, 11 px uppercase monospace with letter spacing; the fields are filled grey with no border, and focus adds a 2 px dark border.
- **Markup**: email `type="email" autocomplete="username" dir="auto" autocapitalize="off" autocorrect="off"`; password `autocomplete="current-password" dir="auto"`; the submit is `type="submit"` and enabled. The SSO, reset and create-account links point to `#` and switch the view in place, with no address of their own.
- **Technology**: React 18.3.1, hashed CSS-in-JS classes, CloudFront, Segment; the viewport meta disables zoom. CSS direction readiness: 29 logical against 388 physical declarations. **API**: Statsig bootstrap and metrics calls only.

### 8. Linear log-in (complete)

- **For**: signing in; every method is a button, and email is the second.
- **Layout**: identical at both widths: a 288 px column centred on both axes, the logo, an 18 px title, four pill buttons 44 px tall (the first filled), and a sign-up line.
- **Technology**: React 19.3.0, Cloudflare; the viewport meta disables zoom. **API**: `GET constellation.linear.app/api/statuspage`, a status check on the log-in page, and a GraphQL `mutation TrackAnonymousEvent`.

### 9. GitHub's live check, from its published element

`@github/auto-check-element` 6.0.0 (**read here**; the page that would use it refused the capture):

- It posts the field as form data, `value` with a CSRF token (`authenticity_token` by default); GET is an option. **A 200 means valid; any other status means invalid, and the response body is the message** to show.
- It debounces by 300 ms and aborts the request still in flight when a newer one starts, so a late answer never overwrites a newer value.
- It checks when a changed field is left, and checks on every keystroke only after a failed check, until one passes: quiet while the person types, quick to clear an error.
- With `required`, it sets the field's custom validity (a verifying message while the request runs, the verdict after), so a native form cannot be submitted before the check has passed.
- It sets `autocomplete="off"` and `spellcheck=false` on the field it checks.

## Patterns worth adopting, ranked

1. **A form that works before JavaScript, with its pending state declared on the button.** GitHub posts natively and disables the button with a pending label (`data-disable-with`); Supabase's form also has `method="POST"`. For us: a Server Action form with `useActionState`, and the house rule for pending buttons (`.claude/skills/ui-design/references/mobile-forms.md`: label and width kept, `aria-disabled`, repeat presses ignored, the spinner after `delay-pending`).
2. **A live username check that is quiet while typing, cancels stale requests and answers in words.** GitHub's element (on leaving the field, then per keystroke after a failure; a 300 ms debounce; abort; submit blocked until it passes), Cal.com's JSON answer with a suggestion, Proton's status icon inside the field. For us: a POST Route Handler that answers `{ available, reason, suggestion? }` and a status line under the field, not an icon alone; throttled per client (the security note). Not a Server Action: Next.js 16.3.5 dispatches Server Actions "one at a time per client" and advises a Route Handler "for non-mutation requests", and a queued check could neither be aborted nor overtake the form's own action.
3. **The rules shown before typing, as a checklist.** Cal.com lists the password rule under the empty field. For us the rule stays neutral until the field is left or the form is sent (the house validation timing), then turns red with an icon, and green on the keystroke that satisfies it. No strength meter.
4. **A show-password toggle instead of a confirmation field.** Cal.com, Supabase and Proton put an icon button inside the field whose name switches; only Proton also asks for the password twice.
5. **Visible labels above the fields, 16 px input text, fields 40 to 53 px tall, one full-width primary.** Fields of 40 px (GitHub), 45 (Stripe) and 53 (Figma), and Linear's 44 px buttons, against Cal.com's 36 px and Supabase's 34 px fields (with 15 px text).
6. **The right autocomplete tokens and keyboard switches.** GitHub `username` and `current-password`; Figma `username` on its identifier; Cal.com and Proton `new-password`; `autocapitalize` and `autocorrect` off on names and passwords.
7. **The destination survives the round trip.** GitHub's hidden `return_to`, Supabase's `returnTo` on the sign-up and reset links, GitHub's `source=login` on its sign-up link.
8. **Bot friction that needs no third party.** GitHub's randomised hidden field and signed time stamp on the sign-in form, where the others load Turnstile (Cal.com), hCaptcha (Supabase, Stripe) or HUMAN Security and iovation (Stripe).
9. **One column and nothing else.** GitHub, Figma and Linear show the same column at both widths (288 to 358 px); the split screens (Cal.com, Supabase) sell a product this page does not need to sell.
10. **The switch between sign-in and sign-up in one line under the primary**, as a link with its own address (GitHub, Supabase, Linear, Cal.com; Figma's is a `#` link).

## Patterns to avoid

- **A disabled submit.** Cal.com uses native `disabled`, Stripe `aria-disabled` with `tabindex="-1"`: neither says what is missing, and Stripe's cannot be reached from the keyboard. Send, then focus the first error.
- **Zoom disabled** in the viewport meta (Cal.com, Figma, Linear), **input text under 16 px** on a phone (Supabase, 15 px), **targets under 44 px** (Cal.com's 36 px buttons and fields, Supabase's 34 px fields and 26 px toggle).
- **An error while the person is still typing**: Cal.com's rule turns red before the password field is left.
- **Success shown by an icon alone**: Proton's check-circle.
- **No autocomplete, or `autocomplete="off"`, on a new username** (Cal.com, Proton; GitHub's element sets `off`): password managers then cannot save the pair.
- **A field inside a cross-origin frame** (Proton's username): the page's accessibility tree shows only an iframe.
- **Positive `tabindex`** and **an `aria-label` that replaces a visible label** (Stripe).
- **Labels inside the field**, in uppercase monospace with letter spacing (Figma): ours sit above, and uppercase and tracking do nothing in Persian.
- **Views without addresses**: Figma's SSO, reset and sign-up links are `#`.
- **Consent bundled into the legal line** (Supabase adds update emails), **a paid plan preselected** (Proton), **marketing tags on the sign-up page** (Cal.com), and **third-party challenges and device fingerprinting** (Turnstile, hCaptcha, HUMAN Security, iovation), including **a widget that appears mid-form** and pushes the submit about 70 px down (Cal.com).
- **Title line heights of 1.0 to 1.33 with negative letter spacing** (Cal.com 28 px on 28 px, Supabase, Figma): Persian needs 1.5 and no tracking.

## Adaptation for Carshenas

**Pages and order**

- Two pages with their own addresses, sign-in and sign-up (the Farsi words are settled in the UX note and the Iranian teardown), each linking to the other in one line under the primary and carrying the validated destination.
- Sign-up: username, password with its toggle, the rules, the agreement line, the primary, the sign-in link. Sign-in: username, password with its toggle, the primary, the sign-up link. No provider buttons and no "or" divider: with one method, the page is a title, two fields and one button.
- No reset link without a recovery channel. Every sign-in page captured offers a reset link, and each of those accounts has an email address to reset through; with no email and no phone, a forgotten password can only be reset by the superadmin. The sign-in page should say so plainly instead of offering a dead link. This is the owner's product question.
- The one trust line worth having is what the account does not ask for (no phone number, no email), since sign-in in Iran usually starts with a phone number (CS-39's description); the owner judges the copy. The agreement line sits directly above the primary, as on Cal.com, so it is read before the press, links to the terms and privacy pages once they exist, and bundles nothing else.

**Right to left, with Latin inside**

- Everything around a field follows the page: the title, labels, rules, errors and links start on the right.
- The typed value runs left to right: `dir="ltr"` on the two inputs, as the house rule has it for Latin fields (`.claude/skills/ui-design/references/rtl-bidi.md`: email, URL and codes are `dir="ltr"` and left-aligned). Typing starts at the left, so the field's controls (the show toggle, the username's status icon) sit at its right edge, where they never cover the first characters. Proton reaches that picture by making the whole field root `dir="ltr"`, with its domain selector and check icon at the right end; the Iranian teardown finds the same right-edge placement on Aparat, Filimo and Namava and keeps `dir="ltr"` on the input alone, the wrapper staying right to left. Follow the Iranian teardown. If usernames may contain Persian letters (the UX note decides), the username takes `dir="auto"`, as Figma's fields do.
- The eye, check, cross and warning icons are not mirrored (`rtl-bidi.md`).
- Persian and Arabic-Indic digits typed into either field are mapped to Latin in code before validating (`toLatinDigits` in `apps/web/src/lib/digits.ts`; the Iranian teardown found the same in Aparat's, Filimo's and Torob's bundles); a number in a message, such as the minimum length, is written in Persian digits.
- A password typed while the keyboard is set to Persian is a failure none of these international pages meet; the Iranian teardown tested it on Iranian ones and proposes a polite notice under the field.

**Persian type, our tokens, phone first**

- No new token is needed; every measured value maps to an existing role:

  | Element | References, measured | Carshenas |
  |---|---|---|
  | Title | 18 to 28 px, line height 1.0 to 1.5, some with negative tracking | `text-title` (24 px, 1.5, 700), start-aligned |
  | Label | 11 px uppercase mono inside the box (Figma) to 16 px weight 500 (Cal.com, phone) | `text-label` (14 px, 1.5, 500), above the field |
  | Input text | 13 to 18 px | `text-control` (16 px, 1.5, 400) |
  | Field height | 34 (Supabase), 36 (Cal.com), 40 (GitHub, Proton), 45 (Stripe), 53 (Figma) | `min-h-12`, 48 px |
  | Radius | 6 (GitHub), 8 to 10 (Supabase, Figma), 10 (Cal.com), pill (Linear) | `rounded-control`, 10 px |
  | Border | 1 px grey, or a filled box with none (Figma) | `border-control` (3.29:1 on the canvas) on `bg-canvas` |
  | Focus | a 2 px inset ring (GitHub), tinted halos (Proton, Stripe, Supabase), a dark border (Figma) | `outline-focus`, 2 px at a 2 px offset |
  | Rule, error | a red rule line and border while typing (Cal.com); a line with an icon on leaving (Proton) | `text-secondary` in `text-muted`, then `text-danger` with an icon and `border-danger`, after leaving or sending |
  | Name available | nothing (Cal.com); an icon alone (Proton) | a `text-secondary` line in `text-success` with an icon |
  | Primary | 32 to 48 px | `actionClasses('primary')` on the `<button>`, 48 px, full width on the phone |
  | Show toggle | 24 to 28 px icon buttons | a 44 px hit area (`size-11`), a 20 px icon with a 1.5 px stroke |
  | Column | 288 to 416 px | the page gutter (`px-4`, 16 px, as GitHub and Cal.com) on the phone; `max-w-sm` (24rem, 384 px, Supabase's width) centred on desktop |

- Rhythm: label to field `gap-2` (8 px, as GitHub and Cal.com); field to its rule or error `gap-2`; between field groups `gap-6` (24 px, since a Persian rule line is 22.4 px tall); the last field group to the primary `mt-8` (32 px, as Supabase), with the sign-up's agreement line in that gap, nearer the primary than the field; the primary to the switch line `gap-6`.
- The username's status line keeps its height reserved (one `text-secondary` line) so a check result never moves the primary: the lesson of Cal.com's Turnstile.
- Motion: a rule's colour changes with `duration-press`, the status line cross-fades with `duration-popover`, the pending label waits for `delay-pending`.
- The phone layout is the only layout and desktop centres it; the primary ends the form, within thumb reach.

## Technology and API observations

- **Frameworks**: React on all five complete captures (19.x on GitHub, Cal.com, Supabase and Linear; 18.3 on Figma); Next.js on Cal.com (16.3.6, App Router) and Supabase (16.3.5, pages router).
- **Form primitives**: Base UI on Cal.com, the primitive library our design language names; React Aria on Stripe; Primer web components on GitHub.
- **Username checks**: a small JSON POST with a boolean verdict (Cal.com) or a form POST whose status code is the verdict (GitHub's element). No page sent the password before submit; on Cal.com the only first-party POST was the username check.
- **Status on the sign-in page**: Supabase's incident banner and Linear's status-page call.
- **Bot protection**: self-hosted (GitHub), Turnstile (Cal.com), hCaptcha (Supabase, Stripe), HUMAN Security and iovation (Stripe), Proton's own challenge frames. Any third-party service would need an ADR and a check that it answers from inside Iran (AGENTS.md, Market).
- **Right-to-left readiness in CSS**: only Cal.com's logical properties outnumber its physical ones (482 to 202, with 77 RTL selectors); Supabase is close (454 to 550); GitHub (366 to 2,118), Linear (234 to 874) and Figma (29 to 388) are built left to right.

## The capture tool

Three gaps showed up in this session; each could be a small follow-up:

1. A challenge inside a cross-origin frame (Turnstile's checkbox) is not seen, so a flow goes on after it.
2. A page that closes itself ends the run with a generic error and loses the reports of the viewport already captured; the tool could name it a stop and keep what it has.
3. The failed-requests table prints raw URLs, path tokens included; it should use the path patterns of the endpoint table.

## Recommendation

Build CS-39's pages the way GitHub's sign-in is built: one column, a native form with a declared pending state, bot friction that needs no third party, and the destination kept. Check the username the way GitHub's element does (on leaving the field, then per keystroke after a failure; debounced; stale requests aborted), answer with Cal.com's shape (available, and a suggestion when not), and show the password's rules before typing and a show toggle instead of a second password field, as Cal.com does. Where a reference and the house rules disagree (when to validate, an enabled primary, 48 px targets, 16 px text, zoom, labels above the field), the house rules win. The standards and the security design come from the two sibling notes.
