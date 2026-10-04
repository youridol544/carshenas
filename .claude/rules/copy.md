---
paths:
  - "apps/web/src/**/*-copy.ts"
  - "apps/web/src/**/*-info.ts"
  - "apps/web/src/**/*-view.ts"
  - "apps/web/src/**/*-explanation.ts"
  - "apps/web/src/**/components/**/*.tsx"
  - "apps/web/src/app/**/*.tsx"
  - "packages/search/src/filters.ts"
  - "packages/search/src/catalogues.ts"
  - "packages/search/src/sorts.ts"
  - "packages/search/src/explain.ts"
  - "packages/search/src/mileage-reading.ts"
  - "packages/notifications/src/kinds.ts"
---

# Farsi copy: every string a person reads

Load the `copy-fa` skill before you write or change a string here; `docs/design/product-voice.md` (ADR-0042) is the guide, and `docs/research/2026-10-04-product-copy-voice.md` has the evidence. This file is the short list every change must satisfy. The copy lint (CS-105) refuses what a script can see; the `copy-reviewer` agent judges the rest.

- **Voice**: a calm, direct expert friend. No «!», no hype, no alarm, no joke, no emoji.
- **Address**: «شما», usually unsaid, with plain standard verbs («می‌خواهید»، «ببینید»). Never «تو» or spoken forms («می‌خوای، می‌تونی، رو، یه») and never written-formal ones («نمایید، گردید، می‌باشد، لطفاً»). «ما» for what the product did; never «من»; the name «کارشناس» is not a subject.
- **Shape**: one idea per sentence, about 15 words and never over 25, the answer first, a verb for every action, a full stop where a «؛» was.
- **A set, not a string**: the title, lead, hint, button and notice of a screen are written together; an idea appears once. A retry button makes a retry sentence unnecessary. A promise («خبرتان می‌کنیم») is made once.
- **One word per idea**: the glossary's nouns and the guide's verbs («تلاش دوباره»، «برداشتن»، «پاک کردن»، «دیدن»، «جست‌وجو»، «لینک»). A string that names a concept differently is a bug.
- **Nothing a buyer cannot check or act on**: no database, server, queue, crawler, threshold, window, method, version, model or AI. A number appears only if it compares, limits or supports a verdict on the page, and comes from the database through `@carshenas/locale`, never from model text.
- **Patterns**: a button is a verb that names the result, a label a noun, a title short; an error says what happened and what to do; a limit is a fact with a way forward («فعلاً»، «هنوز»، «متأسفانه» never describe what the product cannot do); no «لطفاً»، no «با موفقیت»، no «مشکلی پیش آمد» when more is known.
- **Typography**: Persian digits through the formatters (a hand-typed number or percent is a bug); half-spaces by the Academy's rules, copied from existing strings, never retyped; «ه‌ی» for the ezafe after a silent «ه»; «» for quoted words; no « · » beside a digit; no ASCII digit in Farsi text; Persian «ی» and «ک» only.
- **Tests and code**: tests import the copy constants and never retype Persian (the half-space is lost); a string a model writes to a buyer carries placeholders that code fills (`.claude/rules/ai.md`).
- **The superadmin section** may use its operational words («خزش»، «توقف») where the owner acts on them, under the same voice rules; none of them reaches a buyer string.
- **Before you finish**: read each changed string aloud against the screen's other strings, run `pnpm copy:lint` when it exists, then ask the `copy-reviewer` agent. Taste and tone are the owner's: list them under "left for you to check", never self-approved.
