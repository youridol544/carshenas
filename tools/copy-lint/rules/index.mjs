// THE PLACE TO ADD A RULE. Every other `.mjs` file in this folder is a rule module and is loaded automatically:
// create `rules/<rule-id>.mjs`, export a rule (or an array of rules) as the default export, and run `pnpm copy:test`.
// Nothing else needs registering, and a rule without samples fails that test.
//
// A rule is an object:
//   id        kebab-case, unique; it is the name used in reports, the baseline, the allowlist and `copy-lint-ignore`
//   level     'refuse' or 'warn', as the voice guide's appendix B draws them (docs/design/product-voice.md): a refuse rule
//             fails the lint on a new violation (existing ones sit in the baseline); a warn rule is listed, never fails and
//             is never baselined, because a hit is a reason for a person to read the sentence, not a verdict. Refuse what is
//             mechanical and always wrong; warn what has honest exceptions. One rule has one level.
//   summary   a short noun phrase for the report («a space where a half-space belongs»)
//   message   the default message, in English: what is wrong
//   fix       what to do about it, in English
//   scope     'persian' (the default: only strings with a Persian word) or 'any' (also separators such as « · »)
//   check(unit)       per string: return matches, each `{ index?, length?, text?, message?, fix? }`
//   checkAll(units)   per project (for rules that compare strings; units are sorted by file, then line): return
//                     `{ unit, text?, message?, fix? }`
//                     (give a rule either `check` or `checkAll`)
//   samples   { pass: [...], fail: [...] }: strings (or `{ text, kind, standalone }`; for `checkAll` rules `{ units:
//             [{ file, text }] }`) that must NOT and MUST produce a finding of this rule. test/rules.test.mjs runs
//             them all. Write a half-space as «~», a no-break space as «_» and a hole as «{}» (test/helpers.mjs).
//
// A unit (lib/extract.mjs) is { file, line, column, text, form, kind, key, attribute, element, standalone, persian, dot,
// hasHoles }: text with every `${...}` written as PLACEHOLDER (lib/persian.mjs), kind from lib/kinds.mjs.
// Rules that need a number or a list of words keep it in data/ (banned-phrases.mjs, allowed-latin.mjs) or in
// lib/kinds.mjs, so the list can be edited without touching the rule.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NOT_RULES = new Set(['index.mjs', 'util.mjs']);
export const LEVELS = ['refuse', 'warn'];

/** Every rule of the folder (`directory` is for the tests: a folder of rules that must be refused). */
export async function loadRules(directory = import.meta.dirname) {
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.mjs') && !NOT_RULES.has(file))
    .sort();
  const rules = [];
  for (const file of files) {
    const loaded = await import(pathToFileURL(path.join(directory, file)).href);
    const exported = loaded.default;
    for (const rule of Array.isArray(exported) ? exported : [exported]) rules.push({ ...rule, module: file });
  }
  const seen = new Set();
  for (const rule of rules) {
    const where = `${rule.module}: rule ${String(rule.id)}`;
    if (typeof rule.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id)) {
      throw new Error(`${where} needs a kebab-case id`);
    }
    if (seen.has(rule.id)) throw new Error(`${where} is defined twice`);
    seen.add(rule.id);
    if (!LEVELS.includes(rule.level)) {
      throw new Error(`${where} needs a level: ${LEVELS.map((level) => `'${level}'`).join(' or ')}`);
    }
    for (const field of ['summary', 'message', 'fix']) {
      if (typeof rule[field] !== 'string' || rule[field] === '') throw new Error(`${where} needs a ${field}`);
    }
    if ((typeof rule.check === 'function') === (typeof rule.checkAll === 'function')) {
      throw new Error(`${where} needs exactly one of check and checkAll`);
    }
  }
  return rules;
}
