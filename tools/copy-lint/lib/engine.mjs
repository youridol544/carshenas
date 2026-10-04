// Runs rules over units and turns what they report into findings.
//
// A finding: { rule, level, file, line, column, endLine, text, message, fix, kind, key, form, unitText }
// (`level` is the rule's: 'refuse' fails the lint, 'warn' asks a person.)
// `text` is the part that matched (or the whole string for a rule about the whole string), `unitText` the whole string.
import { display, excerpt } from './persian.mjs';

/** Where in the file a match is: the line of the string, or of the match inside a string that spans lines. */
function locate(unit, match) {
  if (unit.endLine === unit.line || match.text === undefined || unit.raw === undefined) {
    return { line: unit.line, column: unit.column };
  }
  const at = unit.raw.indexOf(match.text.trim().split('\n')[0]);
  if (at === -1) return { line: unit.line, column: unit.column };
  const lines = unit.raw.slice(0, at).split('\n');
  return { line: unit.line + lines.length - 1, column: lines.length === 1 ? unit.column + at : 1 };
}

export function toFinding(rule, unit, match) {
  const { line, column } = locate(unit, match);
  const matched = match.text ?? unit.text;
  return {
    rule: rule.id,
    level: rule.level,
    file: unit.file,
    line,
    column,
    endLine: unit.endLine,
    text:
      match.index === undefined ? display(matched) : excerpt(unit.text, match.index, match.length ?? 0, 70),
    message: match.message ?? rule.message,
    fix: match.fix ?? rule.fix,
    kind: unit.kind,
    key: unit.key ?? unit.attribute ?? unit.element,
    form: unit.form,
    unitText: display(unit.text),
  };
}

/**
 * Every finding of `rules` over `units` (units sorted by file, then line). `only` is an optional Set of rule ids.
 * Rules that look at one string run on Persian strings, or on every unit when they declare scope 'any'.
 */
export function runRules(rules, units, { only } = {}) {
  const findings = [];
  const selected = rules.filter((rule) => only === undefined || only.has(rule.id));
  const perString = selected.filter((rule) => typeof rule.check === 'function');
  const perProject = selected.filter((rule) => typeof rule.checkAll === 'function');
  for (const unit of units) {
    for (const rule of perString) {
      if ((rule.scope ?? 'persian') === 'persian' && !unit.persian) continue;
      for (const match of rule.check(unit)) findings.push(toFinding(rule, unit, match));
    }
  }
  for (const rule of perProject) {
    for (const match of rule.checkAll(units)) findings.push(toFinding(rule, match.unit, match));
  }
  return findings;
}
