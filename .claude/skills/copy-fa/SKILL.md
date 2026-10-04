---
name: copy-fa
description: Write, rewrite and review the Farsi text a person reads in Carshenas - titles, buttons, labels, hints, errors, empty states, limits, popovers and info controls, notifications, page titles and descriptions, the superadmin section. Use whenever a string a buyer or the owner reads is written or changed, when reviewing a diff that adds or changes Farsi text, when text sounds translated or machine-written, is long, repeats a point, explains how the system works, apologises for a limit or uses a mood word as a button («بفهم»), and when a copy rewrite task (CS-106 to CS-110) is done. The voice is a calm, direct expert friend writing to «شما» in plain standard Farsi.
argument-hint: "[file, screen or CS-<n>]"
---

# copy-fa: the Farsi a buyer reads

The guide is `docs/design/product-voice.md` (normative, ADR-0042); read the sections you need, not the whole file: the voice and the address (2), the sentence and each element (3), repetition and the words (4), what a buyer never sees (5), typography (6), the catalogue of machine-written and translated Farsi (7), and 91 real rewrites (8). This skill is how to write and review against it. The rule `.claude/rules/copy.md` attaches to the files that hold copy; the `copy-reviewer` agent reviews in a fresh context; the copy lint (CS-105, `pnpm copy:lint` once it exists) owns what a script can see. Evidence for every rule: `docs/research/2026-10-04-product-copy-voice.md`.

## The ten rules (the guide's section 1 is the source and wins)

1. **Calm**: no «!», no hype, no alarm, no joke.
2. **A fact or nothing**: a sentence that could sit on any product's page is cut or becomes a fact.
3. **Answer first**: the verdict, then the reason, then the step.
4. **One idea per sentence**: about 15 words, never over 25; a full stop where a «؛» was.
5. **Once per screen**: title, lead, hint, button and notice are one set; an idea sits in one of them.
6. **One word per idea**: the glossary's nouns and the guide's verbs (section 4).
7. **Nothing a buyer cannot check or act on**: no database, queue, crawler, threshold, method, version or window.
8. **The patterns**: a button is a verb, a label a noun, a title short; an error says what happened and what to do; a limit is a fact with a way forward; no apology, no «لطفاً».
9. **Address**: «شما», usually unsaid, with plain standard verbs («می‌خواهید»); «ما» for what we did, never «من».
10. **Written down**: Persian digits through the formatters, half-spaces by the Academy's rules, «ه‌ی», «» for quoted words.

## Writing or changing copy

1. **Open the screen's whole set.** Every string a person reads on it: the `*-copy.ts` keys, literals in the components, the definitions in `@carshenas/search`, notification kinds. List each with its element (title, lead, hint, button, notice) and the one idea it carries. A new string is judged beside the others, never alone.
2. **One string per idea.** Keep an idea in the highest element (title, then button, then lead, then hint, then notice) and delete or fold the rest. A promise («خبرتان می‌کنیم») appears once, where the buyer decides.
3. **Cut what a buyer cannot use** (the guide's section 5 test: could they decide differently, or check it on the page?). Thresholds, windows, versions, the queue, the database, the crawler, the model: out. A figure stays only if it compares, limits or supports a verdict on the page.
4. **Write the Farsi from the idea, in the buyer's words**, from the glossary and the guide's words table. Never draft in English and translate: that is where «این امکان را به شما می‌دهد که» comes from.
5. **Use the element's pattern** (section 3): a button names the result; a limit is a fact and a way forward; an error is what happened and what to do, without repeating a retry button; an empty state is what is empty and one way forward.
6. **Check the sentence**: one idea, answer first, a verb for every action, one hedge at most, no «؛», no stacked «شما می‌توانید».
7. **Check the patterns** in `references/patterns.md` (T translated, M machine-written, V register). Swapping a tell for a synonym fixes nothing: give a fact or cut.
8. **Check the typography** (section 6). Copy Farsi from existing strings; a model drops half-spaces. Tests import the constants, never retype Persian. Run `pnpm copy:lint` when it exists.
9. **Read it aloud.** Would a calm expert friend say it to a buyer across a table? If not, rewrite.
10. **Ask the `copy-reviewer`** with the screen's files. Fix what it quotes; stop after two rounds and record the rest under "left for you to check". Taste, brand feel and whether a line lands are the owner's call and never self-approved.

## Reviewing copy yourself

Work through `references/review.md`: extract the strings with line numbers (Python, never `grep`: ugrep refuses Farsi alternations), build the screen's idea table, score each string against the rules and patterns with the file, line and a rewrite. Report only what breaks a rule; a review that finds nothing says so.

## Traps for an agent writing Farsi here

- **The half-space (U+200C) is the first thing lost.** Never type a Farsi string from scratch when an existing one carries the word; check for «می »+letter, « ها», «بی »+letter after writing.
- **Numbers never live in a string.** They come from the formatters (`@carshenas/locale`); a hand-typed «۸٪» or «۱۲ آگهی» is a bug. The guide's examples show numbers only as a formatter would fill them.
- **Copy the pattern, not the sentence.** The guide's rewrites are teaching examples; a screen's own facts decide its words.
- **Model prompts are not copy.** Text a model writes to a buyer carries placeholders code fills (`.claude/rules/ai.md`); this skill governs the words around them.
- **Do not invent claims.** «بیش از ۱۰۰۰ خودروی ارزیابی‌شده» is a number from the database or it is not written.
- **Do not widen the task.** A copy task changes strings and the tests that import them; a glossary change, a layout change or a new control is a follow-up (guide, appendix A).

## References

| File | Read when |
|---|---|
| `references/patterns.md` | judging a string against T, M and V: how to spot each pattern in a diff, what is not a violation, and the real examples |
| `references/review.md` | reviewing: the extraction script, the screen idea table, the checklist, the report and the verdict (the `copy-reviewer` agent follows it) |
| `references/worked-examples.md` | learning the process: six screens worked from the whole set to the final strings |
