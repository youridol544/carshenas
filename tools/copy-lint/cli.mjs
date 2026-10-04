#!/usr/bin/env node
// pnpm copy:lint: finds objectively wrong product text (docs/runbooks/copy-lint.md).
//
// Rules have two levels (docs/design/product-voice.md, appendix B): `refuse` rules produce violations, which fail the lint
// when new or worse than the baseline; `warn` rules produce warnings, which never fail and are never baselined.
//
//   pnpm copy:lint                        check against the baseline: exit 1 on a new violation or a worse count
//   pnpm copy:lint <file|folder>...       the same, for these files only (cross-file rules see only these files)
//   pnpm copy:lint --all                  list every violation, by file; the exit code still follows the baseline
//   pnpm copy:lint --warnings             also list the warnings (a person reads each sentence; the exit code ignores them)
//   pnpm copy:lint --rule <id>            only this rule (repeatable); a warn rule lists its warnings
//   pnpm copy:lint --update-baseline      lower the baseline to the current counts; refuses if anything is worse
//   pnpm copy:lint --baseline-rule <id>   record the current violations of a NEW or tightened refuse rule (the one way a
//                                         count goes up; `all` for every refuse rule: only when the baseline is first made)
//   pnpm copy:lint --report <file.md>     write the markdown report (by rule, area and file)
//   pnpm copy:lint --json                 machine-readable output
//   pnpm copy:lint --list-rules           the rules; --list-files: the copy files and their string counts
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AREA_IDS, areaIdOf, areaLabelOf } from './areas.mjs';
import {
  compareToBaseline,
  countFindings,
  keyOf,
  loadBaseline,
  nextBaseline,
  splitKey,
  writeBaseline,
} from './lib/baseline.mjs';
import { finish } from './lib/exit.mjs';
import { BASELINE_DIR, REPO_ROOT, relativeToRepo } from './lib/paths.mjs';
import { formatMarkdown, formatRules, formatText } from './lib/report.mjs';
import { lintRepository } from './lib/run.mjs';
import { listSourceFiles, scan } from './lib/scope.mjs';
import { loadRules } from './rules/index.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean' },
    warnings: { type: 'boolean' },
    rule: { type: 'string', multiple: true },
    json: { type: 'boolean' },
    report: { type: 'string' },
    'update-baseline': { type: 'boolean' },
    'baseline-rule': { type: 'string', multiple: true },
    'list-rules': { type: 'boolean' },
    'list-files': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

function usage(message) {
  console.error(`copy-lint: ${message}`);
  console.error('Run `pnpm copy:lint --help` for the options.');
  process.exit(2);
}

if (values.help) {
  const lines = fs
    .readFileSync(import.meta.filename, 'utf8')
    .split('\n')
    .slice(1);
  const header = [];
  for (const line of lines) {
    if (!line.startsWith('//')) break;
    header.push(line.slice(3));
  }
  console.log(header.join('\n'));
  await finish(0);
}

const rules = await loadRules();
const ruleIds = new Set(rules.map((rule) => rule.id));
const rulesById = new Map(rules.map((rule) => [rule.id, rule]));

if (values['list-rules']) {
  console.log(formatRules(rules));
  await finish(0);
}

const only = values.rule === undefined ? undefined : new Set(values.rule.flatMap((id) => id.split(',')));
for (const id of only ?? [])
  if (!ruleIds.has(id)) usage(`unknown rule «${id}»; \`pnpm copy:lint --list-rules\` lists them.`);
// Warnings are listed when asked for (`--warnings`) or when a warn rule is named with `--rule`.
const showWarnings =
  values.warnings === true || [...(only ?? [])].some((id) => rulesById.get(id).level === 'warn');

// File and folder arguments: a folder means every source file in it. A path outside the scan roots is a usage error.
let files;
if (positionals.length > 0) {
  const known = listSourceFiles();
  files = [];
  for (const argument of positionals) {
    const relative = relativeToRepo(path.resolve(process.cwd(), argument));
    if (!fs.existsSync(path.join(REPO_ROOT, relative))) usage(`no such file: ${argument}`);
    const matching = known.filter((file) => file === relative || file.startsWith(`${relative}/`));
    if (matching.length === 0)
      usage(`${argument} is not a source file under the scan roots (tools/copy-lint/copy-files.mjs).`);
    files.push(...matching);
  }
  files = [...new Set(files)];
}

// Only a full run (every file, every rule) can write the baseline or a report. Say so, and refuse a warn rule, before the
// time of a lint run is spent.
const complete = files === undefined && only === undefined;
const refuseIds = rules.filter((rule) => rule.level === 'refuse').map((rule) => rule.id);
const accepted = new Set(
  (values['baseline-rule'] ?? []).flatMap((id) => (id === 'all' ? refuseIds : id.split(','))),
);
for (const id of accepted) {
  if (!ruleIds.has(id)) usage(`unknown rule «${id}»; \`pnpm copy:lint --list-rules\` lists them.`);
  if (rulesById.get(id).level === 'warn')
    usage(`«${id}» is a warn rule: warnings are never baselined (they never fail the lint).`);
}
if ((values['update-baseline'] || values['baseline-rule'] !== undefined) && !complete)
  usage('updating the baseline needs a full run: no file arguments and no --rule.');
if (values.report !== undefined && !complete)
  usage('a report needs a full run: no file arguments and no --rule.');

if (values['list-files']) {
  const result = scan(files === undefined ? {} : { files });
  for (const entry of result.copy) {
    const strings = entry.units.filter((unit) => unit.persian).length;
    console.log(`${String(strings).padStart(5)}  ${entry.via.padEnd(6)}  ${entry.file}`);
  }
  await finish(0);
}

const result = await lintRepository({ files, only, rules });
// Time and CPU since the process started, so the TypeScript compiler's load counts: it is what `pnpm copy:lint` costs.
const cpuUsed = process.cpuUsage();
const timing = {
  wall: performance.now() / 1000,
  cpu: (cpuUsed.user + cpuUsed.system) / 1e6,
  cores: os.availableParallelism(),
  load: os.loadavg()[0],
};

const current = countFindings(result.findings);
let baseline = loadBaseline(BASELINE_DIR);

// A partial run (some files, some rules) is judged only against the part of the baseline it covers.
if (!complete) {
  const scanned = new Set(result.scan.copy.map((entry) => entry.file));
  const restricted = new Map();
  for (const [key, count] of baseline) {
    const [file, rule] = splitKey(key);
    if ((files === undefined || scanned.has(file)) && (only === undefined || only.has(rule)))
      restricted.set(key, count);
  }
  baseline = restricted;
}

if (values['update-baseline'] || values['baseline-rule'] !== undefined) {
  if (result.meta.length > 0) {
    console.error(formatText({ result, shown: [], comparison: undefined, timing: timing.wall }));
    console.error('\ncopy-lint: the baseline is not updated while the setup has problems (above).');
    process.exit(1);
  }
  const whole = loadBaseline(BASELINE_DIR);
  // Entries of an accepted rule are replaced by the current counts; everything else may only go down.
  const kept = new Map([...whole].filter(([key]) => !accepted.has(splitKey(key)[1])));
  const { ok, next, refused } = nextBaseline(current, kept, accepted);
  if (!ok) {
    console.error('copy-lint: refusing to update the baseline: these are worse than it records.');
    for (const entry of refused) {
      console.error(`  ${entry.file}  ${entry.rule}: ${entry.count} (baseline ${entry.baseline})`);
    }
    console.error(
      '\nFix them, or, for a rule that is new or was tightened, record its violations once with `pnpm copy:lint --baseline-rule <id>` and say why in the commit.',
    );
    process.exit(1);
  }
  writeBaseline(BASELINE_DIR, next, areaIdOf, AREA_IDS);
  const before = [...whole.values()].reduce((sum, count) => sum + count, 0);
  const after = [...next.values()].reduce((sum, count) => sum + count, 0);
  console.log(`copy-lint: baseline written: ${next.size} entries, ${after} violations (was ${before}).`);
  await finish(0);
}

const comparison = compareToBaseline(current, baseline);
const worseKeys = new Set(comparison.worse.map((entry) => keyOf(entry.file, entry.rule)));
const shown = values.all
  ? result.findings
  : result.findings.filter((finding) => worseKeys.has(keyOf(finding.file, finding.rule)));
const shownWarnings = showWarnings ? result.warnings : [];
const failing = comparison.worse.length > 0 || result.meta.length > 0;

if (values.report !== undefined) {
  const command = ['pnpm copy:lint', ...(values.all ? ['--all'] : []), '--report', values.report].join(' ');
  const date = new Date().toISOString().slice(0, 10);
  const markdown = formatMarkdown({ result, areaOf: areaLabelOf, date, command, timing, rulesById });
  const target = path.resolve(process.cwd(), values.report);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, markdown);
  console.log(`copy-lint: report written to ${relativeToRepo(target)}`);
}

if (values.json) {
  console.log(
    JSON.stringify(
      {
        copyFiles: result.scan.copy.length,
        violations: result.findings.length,
        warnings: result.warnings.length,
        suppressed: result.suppressed,
        worse: comparison.worse,
        better: comparison.better,
        meta: result.meta,
        findings: shown,
        ...(showWarnings ? { warningFindings: shownWarnings } : {}),
      },
      null,
      2,
    ),
  );
} else {
  console.log(formatText({ result, shown, shownWarnings, comparison, timing: timing.wall }));
}
process.exitCode = failing ? 1 : 0;
