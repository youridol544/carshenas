// Inline exemptions: a comment that says which rule to ignore, and why.
//
//   // copy-lint-ignore english-word: the brand is written in Latin letters on its own site
//   title: 'Telegram',
//
//   {/* copy-lint-ignore middle-dot-join: both sides are words */}
//   <p>...</p>
//
//   label: 'Telegram', // copy-lint-ignore english-word: a brand name
//
// A comment on its own line covers the whole statement, property or element that starts on the next line (all of its
// lines); a comment after code covers its own line. Several rules may be named, separated by commas. The reason is
// required, a directive that names an unknown rule or suppresses nothing is itself reported (rule `ignore-directive`,
// which can neither be baselined nor exempted), and `*` is not accepted: name the rule.
import { ts } from './typescript.mjs';

const KEYWORD = 'copy-lint-ignore';
const DIRECTIVE = new RegExp(`${KEYWORD}(?<rest>[^\\n]*)`);
const WELL_FORMED =
  /^\s+(?<rules>[a-z0-9]+(?:-[a-z0-9]+)*(?:\s*,\s*[a-z0-9]+(?:-[a-z0-9]+)*)*)\s*:\s*(?<reason>\S.*?)\s*$/;

export const META_RULE = 'ignore-directive';

function outermostNodeAt(sourceFile, position) {
  let best;
  const visit = (node) => {
    if (node.getStart(sourceFile) === position && !ts.isSourceFile(node)) {
      if (best === undefined || node.end > best.end) best = node;
    }
    if (node.pos <= position && position < node.end) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return best;
}

/** Every directive in a file: `{ line, rules, reason, problem?, from, to, used }` (lines are 1-based). */
export function findDirectives(sourceText, sourceFile) {
  const lines = sourceText.split('\n');
  const directives = [];
  lines.forEach((lineText, index) => {
    const keyword = lineText.indexOf(KEYWORD);
    if (keyword === -1) return;
    const commentStart = Math.max(lineText.lastIndexOf('//', keyword), lineText.lastIndexOf('/*', keyword));
    if (commentStart === -1) return;
    const rest = DIRECTIVE.exec(lineText.slice(keyword)).groups.rest.replace(/\s*\*\/\s*\}?\s*$/, '');
    const parsed = WELL_FORMED.exec(rest);
    const before = lineText.slice(0, commentStart).trim();
    const trailing = before !== '' && before !== '{';
    const line = index + 1;
    let from = line;
    let to = line;
    if (!trailing) {
      let next = index + 1;
      while (next < lines.length && lines[next].trim() === '') next += 1;
      if (next < lines.length) {
        const offset = sourceFile.getPositionOfLineAndCharacter(next, lines[next].search(/\S/));
        const node = outermostNodeAt(sourceFile, offset);
        from = next + 1;
        to = node === undefined ? next + 1 : sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      }
    }
    directives.push({
      line,
      rules: parsed === null ? [] : parsed.groups.rules.split(/\s*,\s*/),
      reason: parsed === null ? '' : parsed.groups.reason,
      problem:
        parsed === null
          ? `A ${KEYWORD} comment is written «${KEYWORD} <rule-id>: <reason>», with a reason.`
          : undefined,
      from,
      to,
      used: false,
    });
  });
  return directives;
}

/** Splits findings into those a directive covers and the rest, marking the directives that were used. */
export function applyDirectives(findings, directives) {
  const kept = [];
  const suppressed = [];
  for (const finding of findings) {
    const directive = directives.find(
      (candidate) =>
        candidate.problem === undefined &&
        candidate.rules.includes(finding.rule) &&
        finding.line >= candidate.from &&
        finding.line <= candidate.to,
    );
    if (directive === undefined) kept.push(finding);
    else {
      directive.used = true;
      suppressed.push(finding);
    }
  }
  return { kept, suppressed };
}

/** Findings about the directives themselves: malformed, naming no known rule, or covering nothing. */
export function directiveFindings(file, directives, knownRules) {
  const found = [];
  const report = (directive, message) =>
    found.push({
      rule: META_RULE,
      meta: true,
      file,
      line: directive.line,
      column: 1,
      endLine: directive.line,
      text: `${KEYWORD} ${directive.rules.join(', ')}`.trim(),
      unitText: '',
      message,
      fix: `Write «${KEYWORD} <rule-id>: <reason>» with a rule id from \`pnpm copy:lint --list-rules\`, or remove the comment.`,
    });
  for (const directive of directives) {
    if (directive.problem !== undefined) report(directive, directive.problem);
    else {
      const unknown = directive.rules.filter((rule) => !knownRules.has(rule));
      if (unknown.length > 0) report(directive, `Unknown rule in ${KEYWORD}: ${unknown.join(', ')}.`);
      else if (!directive.used) report(directive, `This ${KEYWORD} comment suppresses nothing: remove it.`);
    }
  }
  return found;
}
