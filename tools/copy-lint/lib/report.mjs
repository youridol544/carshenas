// What the lint prints: the terminal text, the markdown evidence report and the rule list.
import { excerpt } from './persian.mjs';

const number = (value) => value.toLocaleString('en-US');

export function summarize(findings) {
  const byRule = new Map();
  const byFile = new Map();
  for (const finding of findings) {
    byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1);
    if (!byFile.has(finding.file)) byFile.set(finding.file, new Map());
    const rules = byFile.get(finding.file);
    rules.set(finding.rule, (rules.get(finding.rule) ?? 0) + 1);
  }
  return { byRule, byFile };
}

const sortedByCount = (map) =>
  [...map].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

function findingLine(finding, genericFix) {
  const where = `${finding.line}:${finding.column}`.padEnd(7);
  const specific = finding.fix !== genericFix ? `\n${' '.repeat(28)}instead: ${finding.fix}` : '';
  return `  ${where} ${finding.rule.padEnd(18)} ${finding.message} «${excerpt(finding.text, 0, 0, 90)}»${specific}`;
}

/** The text for the terminal. `shown` is the findings to list; `comparison` is from compareToBaseline (or undefined). */
export function formatText({ result, shown, comparison, timing }) {
  const lines = [];
  const fixOf = new Map(result.rules.map((rule) => [rule.id, rule.fix]));
  const files = new Map();
  for (const finding of [...result.meta, ...shown]) {
    if (!files.has(finding.file)) files.set(finding.file, []);
    files.get(finding.file).push(finding);
  }
  for (const [file, list] of files) {
    lines.push(file);
    for (const finding of list) lines.push(findingLine(finding, fixOf.get(finding.rule)));
    lines.push('');
  }
  const fixes = new Map();
  for (const finding of [...result.meta, ...shown]) {
    if (!fixes.has(finding.rule)) fixes.set(finding.rule, fixOf.get(finding.rule) ?? finding.fix);
  }
  if (fixes.size > 0) {
    lines.push('How to fix, by rule:');
    for (const [rule, fix] of fixes) lines.push(`  ${rule}: ${fix}`);
    lines.push('');
  }
  const strings = result.scan.copy.reduce(
    (sum, entry) => sum + entry.units.filter((unit) => unit.persian).length,
    0,
  );
  const total = result.findings.length;
  const head = `copy-lint: ${number(result.scan.copy.length)} copy files, ${number(strings)} strings, ${number(total)} violations`;
  const suppressed = result.suppressed.directive + result.suppressed.allowlist;
  const tail = [
    suppressed > 0
      ? `${suppressed} allowed (${result.suppressed.directive} by comment, ${result.suppressed.allowlist} by allowlist)`
      : undefined,
    timing === undefined ? undefined : `${timing.toFixed(1)} s`,
  ]
    .filter(Boolean)
    .join(', ');
  lines.push(`${head}${tail === '' ? '' : ` (${tail})`}`);
  if (comparison !== undefined) {
    if (comparison.worse.length > 0) {
      lines.push('', 'Worse than the baseline:');
      for (const entry of comparison.worse) {
        lines.push(`  ${entry.file}  ${entry.rule}: ${entry.count} (baseline ${entry.baseline})`);
      }
    }
    if (comparison.worse.length > 0 || result.meta.length > 0) {
      lines.push(
        '',
        'FAIL: fix the violations above. For a justified exception add `// copy-lint-ignore <rule>: <reason>` or an allowlist entry with a reason; the baseline is never raised by hand.',
      );
    } else lines.push('ok: nothing new or worse than the baseline.');
    if (comparison.better.length > 0) {
      lines.push(
        `${comparison.better.length} baseline entries are higher than the code now: run \`pnpm copy:lint --update-baseline\` and commit tools/copy-lint/baseline.json to lock the improvement in.`,
      );
    }
  }
  return lines.join('\n');
}

export function formatRules(rules) {
  return rules
    .map(
      (rule) =>
        `${rule.id.padEnd(18)} ${rule.summary}\n${' '.repeat(19)}${rule.message}\n${' '.repeat(19)}fix: ${rule.fix}`,
    )
    .join('\n\n');
}

const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

/**
 * The markdown evidence report: violations by rule, by area and by file, with counts and examples.
 * `areaOf(file)` returns an area label for a file (or undefined).
 */
export function formatMarkdown({ result, areaOf, date, command, timing, rulesById }) {
  const { byRule, byFile } = summarize(result.findings);
  const strings = result.scan.copy.reduce(
    (sum, entry) => sum + entry.units.filter((unit) => unit.persian).length,
    0,
  );
  const lines = [];
  lines.push('# Copy lint: the baseline report');
  lines.push('');
  lines.push(
    `Produced on ${date} by \`${command}\` (CS-105) over today's copy, before any rewrite lane (CS-106 to CS-110) has changed a string. It is the evidence for the lint's first run; the live numbers are in \`tools/copy-lint/baseline.json\`, and \`docs/design/copy-rewrite-plan.md\` says which area owns each file.`,
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    `- Copy files scanned: ${number(result.scan.copy.length)}, holding ${number(strings)} strings with a Persian word.`,
  );
  lines.push(
    `- Persian text in files that are not copy (vocabulary, fixtures, tests excluded, reference pages): ${number(result.scan.excluded.length)} files, listed in \`docs/design/copy-rewrite-plan.md\`.`,
  );
  lines.push(`- Rules: ${number(rulesById.size)}.`);
  lines.push(`- Violations: **${number(result.findings.length)}** in ${number(byFile.size)} files.`);
  lines.push(
    `- Allowed by comment or allowlist: ${number(result.suppressed.directive + result.suppressed.allowlist)}.`,
  );
  if (timing !== undefined)
    lines.push(
      `- Time for the whole repository: ${timing.wall.toFixed(1)} s wall clock, ${timing.cpu.toFixed(1)} s of CPU (budget: 10 s).`,
    );
  lines.push('');
  lines.push('## By rule');
  lines.push('');
  lines.push('| Rule | What it finds | Violations | Files |');
  lines.push('|---|---|---:|---:|');
  for (const rule of rulesById.values()) {
    const files = [...byFile.values()].filter((rules) => rules.has(rule.id)).length;
    lines.push(
      `| \`${rule.id}\` | ${cell(rule.summary)} | ${number(byRule.get(rule.id) ?? 0)} | ${number(files)} |`,
    );
  }
  lines.push('');
  const clean = [...rulesById.values()]
    .filter((rule) => !byRule.has(rule.id))
    .map((rule) => `\`${rule.id}\``);
  if (clean.length > 0) {
    lines.push(
      `Rules at zero (${clean.join(', ')}): today's copy already follows them, so they have no baseline entry and any new violation fails.`,
    );
    lines.push('');
  }

  if (areaOf !== undefined) {
    const areas = new Map();
    for (const finding of result.findings) {
      const area = areaOf(finding.file) ?? 'unassigned';
      if (!areas.has(area)) areas.set(area, new Map());
      areas.get(area).set(finding.rule, (areas.get(area).get(finding.rule) ?? 0) + 1);
    }
    const ruleIds = [...rulesById.keys()].filter((id) => byRule.has(id));
    lines.push('## By rewrite area');
    lines.push('');
    lines.push(`| Area | ${ruleIds.map((id) => `\`${id}\``).join(' | ')} | Total |`);
    lines.push(`|---|${ruleIds.map(() => '---:').join('|')}|---:|`);
    for (const [area, rules] of [...areas].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      const total = [...rules.values()].reduce((sum, count) => sum + count, 0);
      lines.push(
        `| ${cell(area)} | ${ruleIds.map((id) => rules.get(id) ?? '').join(' | ')} | ${number(total)} |`,
      );
    }
    lines.push('');
  }

  lines.push('## By file');
  lines.push('');
  lines.push('| File | Total | Rules (count) |');
  lines.push('|---|---:|---|');
  const files = [...byFile].map(([file, rules]) => [
    file,
    rules,
    [...rules.values()].reduce((sum, count) => sum + count, 0),
  ]);
  files.sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
  for (const [file, rules, total] of files) {
    const list = sortedByCount(rules)
      .map(([rule, count]) => `${rule} ${count}`)
      .join(', ');
    lines.push(`| \`${file}\` | ${number(total)} | ${list} |`);
  }
  lines.push('');

  lines.push('## Examples, by rule');
  lines.push('');
  for (const rule of rulesById.values()) {
    const found = result.findings.filter((finding) => finding.rule === rule.id);
    if (found.length === 0) continue;
    lines.push(`### \`${rule.id}\` (${number(found.length)})`);
    lines.push('');
    lines.push(`${rule.message} Fix: ${rule.fix}`);
    lines.push('');
    for (const finding of found.slice(0, 3)) {
      lines.push(
        `- \`${finding.file}:${finding.line}\`: ${cell(finding.message)} «${cell(excerpt(finding.text, 0, 0, 100))}»`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
