# The copy lint and the copy inventory

`pnpm copy:lint` finds text that is objectively wrong in the product's Farsi: banned filler, a space where a half-space belongs, a middle dot beside a digit, a button that is a sentence. `pnpm copy:inventory` lists every file that holds user-visible text, with its string count, and splits them into the five areas the rewrite lanes work in. Both were built in CS-105 for the owner's copy feedback of 2026-10-04; the voice they enforce is `docs/design/product-voice.md` (CS-104). The lint is the mechanical half: it cannot judge tone, repetition of meaning or whether a sentence sounds native. That is the `copy-reviewer` agent's job and a person's.

The tool lives in `tools/copy-lint/` (plain Node, no dependency of its own: it reads source with the TypeScript compiler API that `apps/web` already installs, without type-checking, so it takes about a second).

## Commands

```bash
pnpm copy:lint                         # check against the baseline: exit 1 on a new violation or a worse count (part of pnpm check)
pnpm copy:lint <file>...               # the same, for these files only (the rules that compare strings see only these files)
pnpm copy:lint --all                   # list every violation, by file
pnpm copy:lint --rule half-space       # one rule (repeatable)
pnpm copy:lint --update-baseline       # lower the baseline to the current counts; refuses if anything is worse
pnpm copy:lint --baseline-rule <id>    # record the violations of a NEW or tightened rule (the one way a count goes up)
pnpm copy:lint --report out.md         # the markdown report: by rule, by area, by file, examples
pnpm copy:lint --list-rules            # the rules with their messages and fixes
pnpm copy:lint --list-files            # the copy files with their string counts
pnpm copy:inventory                    # regenerate docs/design/copy-rewrite-plan.md (--stdout to print it)
pnpm copy:test                         # the tool's own tests (part of pnpm check)
```

## What is checked, and where

**Copy files** (`tools/copy-lint/copy-files.mjs`, the single definition). A source file is a copy file when it has a string with a Persian word in it (two letters of the Arabic script in a row: «،» and digits do not count, which is why the check is not a character range) and is not a test. It is copy by name (`*-copy.ts` and `*-copy.tsx` under `apps/web/src`), by the list of shared text modules in the packages (the search definitions, the understanding messages, the notification kinds, the locale's unit words), or inline (any other file under `apps/web/src`, and the JSON data under `apps/web/public`). A file that only joins what it shows with « · » is a copy file too, for the dot rules. Persian text that no buyer reads (the worker's parsers, model instructions, the understanding vocabulary, the `/design` reference page, fixtures) is excluded in the same file, with a reason each. A file with Persian text that is neither fails the lint: decide, and add it to `SHARED_TEXT` or `EXCLUDED`.

**Units.** Every string literal, template literal (static parts, each `${...}` written as a hole), piece of JSX text and string attribute with a Persian word. Not units: comments, identifiers, import paths, object keys, type literals, `case` labels, tagged templates, strings handed to `replace`, `includes`, `new RegExp` and the like, English prose that quotes a Persian word, and the values of vocabulary keys (`words`, `aliases`).

**Kind of text** (`lib/kinds.mjs`), which decides the length budget. It comes from where the string sits: the object key it is the value of (`retry`, `hint`, `lead`), the JSX attribute (`aria-label`, `placeholder`) or the element it is the text of (`button`, `h2`). A string whose key or attribute is not known has kind `unknown` and no budget. One correction from the text: a button, label or title that ends with a full stop is a sentence, so it counts as a notice.

| Kind | Budget | Examples of its keys |
|---|---|---|
| button | 3 words and 22 characters | `retry`, `submit`, `close`, `seeAll`, `signIn`, `action`, `<button>` |
| label | 4 words | `label`, `chip`, `link`, `tab`, `<label>`, `<summary>`, `<a>` |
| name (accessible) | 10 words | `aria-label`, `alt`, any `...Label` (`infoLabel`) |
| title | 8 words | `title`, `heading`, `motto`, `...Title`, `<h1>` to `<h6>` |
| hint | 12 words | `hint`, `help`, `placeholder`, `...Hint` |
| notice | 25 words | `lead`, `body`, `intro`, `detail`, `empty`, `failed`, `...Body`, `<p>` |
| popover (one paragraph) | 45 words | `paragraphs`, `description`, `rule`, `text` |

A hole counts as one word; a ZWNJ joins («می‌خواهید» is one word). Words in JSX text are counted per piece of text between elements and expressions.

## The rules

`pnpm copy:lint --list-rules` prints each rule with its message and fix. In short:

| Rule | Finds |
|---|---|
| `banned-phrase` | Filler, translated, bureaucratic, praising or apologising phrases from `data/banned-phrases.mjs` (one list, each entry with a reason and a replacement) |
| `exclamation-mark` | `!` and its look-alikes |
| `arabic-letters`, `arabic-digits` | Arabic yeh, kaf, alef maksura, heh with yeh above, teh marbuta; Arabic-Indic digits |
| `half-space` | A space where a ZWNJ belongs: `می`, `نمی`, `ها`, `تر`, `ترین`, `ی` written as a separate word |
| `latin-digits` | Latin digits inside Persian text (not in a Latin token such as «X3», an address or a hole) |
| `middle-dot-digit`, `middle-dot-join` | A middle dot with a digit beside it; a middle dot that joins a value the file cannot see (it may be a number at run time): a Persian zero is a dot, so «۳ · ۵» reads like a number with a stray zero |
| `double-space`, `edge-space` | Doubled spaces; a space at the start or end of a whole sentence-length string |
| `repeated-sentence` | The same sentence (five words or more, no holes) twice in one file or among the files of one feature folder (`lib/screens.mjs`) |
| `english-word` | A Latin word in Persian copy, outside `data/allowed-latin.mjs` (`cc`, `km`) |
| `length-button`, `length-label`, `length-name`, `length-title`, `length-hint`, `length-notice`, `length-popover` | Over the budget of its kind |

## Letting something stay: three ways, in this order

1. **Fix the text.** This is what the rewrite lanes do.
2. **An inline comment**, for one string with a reason a reviewer would accept:

   ```ts
   // copy-lint-ignore english-word: the brand is written in Latin letters on its own site
   title: 'Telegram',
   ```

   A comment on its own line covers the whole property, statement or element that starts on the next line; a comment after code covers its own line; in JSX write `{/* copy-lint-ignore <rule>: <reason> */}`. The reason is required, the rule must be named (several are separated by commas), and a comment that suppresses nothing is itself an error.
3. **An allowlist entry** (`tools/copy-lint/allowlist.json`): `{ "rule", "file" (a path or a glob), "text" (optional, part of the string), "reason" }`. An entry without a reason, with an unknown rule, or that covers nothing on a full run is an error, so the list cannot rot. Tokens of Latin letters that are fine anywhere go in `data/allowed-latin.mjs` with a reason instead.

The rewrite tasks (CS-106 to CS-110) are accepted with **no new allowlist entry**.

## The baseline

The lint was introduced on copy that already had violations, so `tools/copy-lint/baseline.json` records them as `{ file, rule, count }`, one entry per line, and `pnpm copy:lint` fails only on a **new** violation (a file and rule not in the baseline) or a **worse count**. A count is per file and rule, so moving a line does not matter.

- A rewrite lane fixes text in its area's files, runs `pnpm copy:lint --update-baseline` and commits `baseline.json` with the change. The command only ever **lowers** a count or removes an entry, and refuses (listing the offenders) if anything is worse. When the code is better than the baseline, `pnpm copy:lint` says so and names the command.
- A conflict in `baseline.json` after a merge: take either side and run `pnpm copy:lint --update-baseline` again.
- A count goes **up** in one case: a rule that is new or was tightened. Run `pnpm copy:lint --baseline-rule <id>` once, review the diff of `baseline.json`, and say in the commit message why. (`--baseline-rule all` is for making the baseline from nothing.)
- The first report, before any rewrite, is `docs/evidence/copy/lint-baseline.md`.

## Adding a rule

The guide of CS-104 (`docs/design/product-voice.md`) adds rules after it merges. The place is `tools/copy-lint/rules/`: every `.mjs` file there except `index.mjs` and `util.mjs` is a rule module, loaded automatically.

1. Create `rules/<rule-id>.mjs` and export a rule (or an array of rules) as the default export: `id`, `summary`, `message`, `fix`, `check(unit)` (or `checkAll(units)` for a rule that compares strings), and `samples: { pass: [...], fail: [...] }`. The header of `rules/index.mjs` documents every field and the shape of a unit. A word list or a number that someone will edit belongs in `data/` or `lib/kinds.mjs`, not in the rule.
2. Write the samples. A half-space is `~`, a no-break space `_` and a hole `{}` in a sample, so the test reads in review (`test/helpers.mjs`). `pnpm copy:test` runs every sample of every rule, and **fails a rule that has no passing or no failing sample**: that is the one test per rule.
3. To ban one more phrase, add an entry to `data/banned-phrases.mjs` (id, group, why, instead, phrases or patterns, an example): the rule's test runs every entry's example. A term the guide says is never shown to a buyer goes in the `technical` group.
4. Run `pnpm copy:lint --all --rule <id>` and read what it finds: a rule that fires on text that is fine is wrong, not the text. Then `pnpm copy:lint --baseline-rule <id>` and commit.
5. Add the rule to the table above.

To teach the lint a new key, element or attribute for the length budgets, add its name to the right pattern in `lib/kinds.mjs` and a case to `test/extract.test.mjs`.

## The inventory and the areas

`pnpm copy:inventory` writes `docs/design/copy-rewrite-plan.md`: every copy file with its string count and lint violations, grouped into five areas with disjoint file lists (A public pages and the shell, B search, filters and the listing page, C accounts, notifications and buyer tools, D the superadmin section, E shared definitions and info popovers) and a separate list owned by CS-115 (check a link). The assignment is data in `tools/copy-lint/areas.mjs`: globs per area, overrides for a file that sits in one area's folder but belongs to another, and notes for shared constants, straddling files and hot spots. `pnpm copy:test` fails when a copy file is in no area or in two, and when a glob or an override matches no file. A new file with Persian text in a folder an area already covers needs nothing; one elsewhere needs an entry.

Regenerate the plan when the file set changes (a new feature folder, a moved file). Its counts are a snapshot taken before the rewrite; the lanes' own evidence tables (`docs/evidence/copy/<area>.md`) say what changed.

## Speed

The whole repository takes about a second of CPU on an idle machine (about 80 files parsed, 2,000 strings, 19 rules); `pnpm check` adds the tool's own tests, which take a few seconds. The report records the time of its run.
