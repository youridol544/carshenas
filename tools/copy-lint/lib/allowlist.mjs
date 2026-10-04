// The central allowlist (tools/copy-lint/allowlist.json): findings that are allowed to stay, each with a reason.
//
//   { "entries": [
//     { "rule": "english-word", "file": "apps/web/src/features/x/x-copy.ts", "text": "Telegram",
//       "reason": "The brand is written in Latin letters on its own site." }
//   ] }
//
// `rule` is a rule id. `file` is a path or a glob. `text` is optional: when given, the entry covers only findings whose
// matched text or whole string contains it. `reason` is required. An entry that covers nothing on a full run is reported
// as stale, so the list cannot rot (rule `allowlist-entry`, which can be neither baselined nor exempted).
// Prefer a fix to an entry, and an inline `copy-lint-ignore` comment to an entry that covers one line.
import fs from 'node:fs';
import { matchesGlob } from './glob.mjs';

export const META_RULE = 'allowlist-entry';

export function loadAllowlist(file) {
  if (!fs.existsSync(file)) return { entries: [] };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
}

const metaFinding = (index, message) => ({
  rule: META_RULE,
  meta: true,
  file: 'tools/copy-lint/allowlist.json',
  line: 1,
  column: 1,
  endLine: 1,
  text: `entry ${index + 1}`,
  unitText: '',
  message,
  fix: 'Fix or remove the entry in tools/copy-lint/allowlist.json.',
});

/** Problems in the allowlist itself, before it is applied. */
export function validateAllowlist(allowlist, knownRules) {
  const problems = [];
  allowlist.entries.forEach((entry, index) => {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      problems.push(metaFinding(index, 'An allowlist entry needs a reason.'));
    }
    if (!knownRules.has(entry.rule)) {
      problems.push(metaFinding(index, `An allowlist entry names an unknown rule: ${String(entry.rule)}.`));
    }
    if (typeof entry.file !== 'string' || entry.file === '') {
      problems.push(metaFinding(index, 'An allowlist entry needs a file (a path or a glob).'));
    }
  });
  return problems;
}

/** Splits findings into the ones an entry allows and the rest. Returns `{ kept, allowed, unused }` (entry indexes). */
export function applyAllowlist(findings, allowlist) {
  const used = new Set();
  const kept = [];
  const allowed = [];
  for (const finding of findings) {
    const index = allowlist.entries.findIndex(
      (entry) =>
        entry.rule === finding.rule &&
        typeof entry.file === 'string' &&
        matchesGlob(finding.file, entry.file) &&
        (entry.text === undefined ||
          finding.text.includes(entry.text) ||
          finding.unitText.includes(entry.text)),
    );
    if (index === -1) kept.push(finding);
    else {
      used.add(index);
      allowed.push(finding);
    }
  }
  const unused = allowlist.entries.map((_, index) => index).filter((index) => !used.has(index));
  return { kept, allowed, unused };
}

export function staleFindings(allowlist, unused) {
  return unused.map((index) =>
    metaFinding(
      index,
      `This allowlist entry (${String(allowlist.entries[index].rule)} in ${String(allowlist.entries[index].file)}) covers nothing: remove it.`,
    ),
  );
}
