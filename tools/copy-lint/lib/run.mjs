// One lint run: scan the copy files, run every rule, apply the inline directives and the allowlist.
import { ALLOWLIST_FILE } from './paths.mjs';
import { applyAllowlist, loadAllowlist, staleFindings, validateAllowlist } from './allowlist.mjs';
import { applyDirectives, directiveFindings, findDirectives } from './directives.mjs';
import { runRules } from './engine.mjs';
import { scan } from './scope.mjs';
import { compareText } from './sort.mjs';
import { loadRules } from '../rules/index.mjs';

export const UNCLASSIFIED_RULE = 'unclassified-file';

/** Rules that report on the setup itself: never baselined, never exempted. */
export const META_RULES = ['ignore-directive', 'allowlist-entry', UNCLASSIFIED_RULE];

const byFileThenLine = (a, b) => compareText(a.file, b.file) || a.line - b.line || a.column - b.column;

/**
 * Options: `files` (repository-relative paths to scan instead of the whole repository), `only` (a Set of rule ids),
 * `allowlist` (an object instead of the file), `rules`, `scanResult` (an earlier `scan()`).
 * Returns { findings, meta, suppressed: { directive, allowlist }, scan, rules } where `findings` are the rule violations
 * still standing and `meta` the problems with the setup (unclassified files, bad directives, a stale allowlist).
 */
export async function lintRepository(options = {}) {
  const rules = options.rules ?? (await loadRules());
  const known = new Set(rules.map((rule) => rule.id));
  const scanResult = options.scanResult ?? scan(options.files === undefined ? {} : { files: options.files });
  const complete = options.files === undefined && options.only === undefined;
  const meta = [];

  for (const file of scanResult.unclassified) {
    meta.push({
      rule: UNCLASSIFIED_RULE,
      meta: true,
      file: file.file,
      line: 1,
      column: 1,
      endLine: 1,
      text: `${file.strings} strings`,
      unitText: '',
      message: 'This file has Persian text but is neither a copy file nor excluded.',
      fix: 'Add it to SHARED_TEXT (it shows text) or EXCLUDED (it does not, say why) in tools/copy-lint/copy-files.mjs.',
    });
  }

  const units = scanResult.copy.flatMap((entry) => entry.units).sort(byFileThenLine);
  const raw = runRules(rules, units, { only: options.only });

  const byFile = new Map();
  for (const finding of raw) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }
  const afterDirectives = [];
  let suppressedByDirective = 0;
  for (const entry of scanResult.copy) {
    const directives = findDirectives(entry.text, entry.sourceFile);
    const { kept, suppressed } = applyDirectives(byFile.get(entry.file) ?? [], directives);
    afterDirectives.push(...kept);
    suppressedByDirective += suppressed.length;
    if (options.only === undefined) meta.push(...directiveFindings(entry.file, directives, known));
  }

  const allowlist = options.allowlist ?? loadAllowlist(ALLOWLIST_FILE);
  meta.push(...validateAllowlist(allowlist, known));
  const { kept, allowed, unused } = applyAllowlist(afterDirectives, allowlist);
  if (complete) meta.push(...staleFindings(allowlist, unused));

  return {
    findings: kept.sort(byFileThenLine),
    meta: meta.sort(byFileThenLine),
    suppressed: { directive: suppressedByDirective, allowlist: allowed.length },
    scan: scanResult,
    rules,
    complete,
  };
}
