#!/usr/bin/env node
// pnpm copy:lint: finds objectively wrong product text (docs/runbooks/copy-lint.md).
//
//   pnpm copy:lint                        check against the baseline: exit 1 on a new violation or a worse count
//   pnpm copy:lint <file|folder>...       the same, for these files only (cross-file rules see only these files)
//   pnpm copy:lint --all                  list every violation, by file; the exit code still follows the baseline
//   pnpm copy:lint --rule <id>            only this rule (repeatable)
//   pnpm copy:lint --update-baseline      lower the baseline to the current counts; refuses if anything is worse
//   pnpm copy:lint --baseline-rule <id>   record the current violations of a NEW or tightened rule (the one way a count
//                                         goes up; `all` for every rule: only when the baseline is first made)
//   pnpm copy:lint --report <file.md>     write the markdown report (by rule, area and file)
//   pnpm copy:lint --json                 machine-readable output
//   pnpm copy:lint --list-rules           the rules; --list-files: the copy files and their string counts
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { areaLabelOf } from './areas.mjs';
import {
  compareToBaseline,
  countFindings,
  keyOf,
  loadBaseline,
  nextBaseline,
  splitKey,
  writeBaseline,
} from './lib/baseline.mjs';
import { BASELINE_FILE, REPO_ROOT, relativeToRepo } from './lib/paths.mjs';
import { formatMarkdown, formatRules, formatText } from './lib/report.mjs';
import { lintRepository } from './lib/run.mjs';
import { listSourceFiles, scan } from './lib/scope.mjs';
import { loadRules } from './rules/index.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean' },
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
  process.exit(0);
}

const rules = await loadRules();
const ruleIds = new Set(rules.map((rule) => rule.id));
const rulesById = new Map(rules.map((rule) => [rule.id, rule]));

if (values['list-rules']) {
  console.log(formatRules(rules));
  process.exit(0);
}

const only = values.rule === undefined ? undefined : new Set(values.rule.flatMap((id) => id.split(',')));
for (const id of only ?? [])
  if (!ruleIds.has(id)) usage(`unknown rule «${id}»; \`pnpm copy:lint --list-rules\` lists them.`);

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

if (values['list-files']) {
  const result = scan(files === undefined ? {} : { files });
  for (const entry of result.copy) {
    const strings = entry.units.filter((unit) => unit.persian).length;
    console.log(`${String(strings).padStart(5)}  ${entry.via.padEnd(6)}  ${entry.file}`);
  }
  process.exit(0);
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

const complete = result.complete;
const current = countFindings(result.findings);
let baseline = loadBaseline(BASELINE_FILE);

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
  if (!complete) usage('updating the baseline needs a full run: no file arguments and no --rule.');
  if (result.meta.length > 0) {
    console.error(formatText({ result, shown: [], comparison: undefined, timing: timing.wall }));
    console.error('\ncopy-lint: the baseline is not updated while the setup has problems (above).');
    process.exit(1);
  }
  const accepted = new Set(
    (values['baseline-rule'] ?? []).flatMap((id) => (id === 'all' ? [...ruleIds] : id.split(','))),
  );
  for (const id of accepted) if (!ruleIds.has(id)) usage(`unknown rule «${id}».`);
  const whole = loadBaseline(BASELINE_FILE);
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
  writeBaseline(BASELINE_FILE, next);
  const before = [...whole.values()].reduce((sum, count) => sum + count, 0);
  const after = [...next.values()].reduce((sum, count) => sum + count, 0);
  console.log(`copy-lint: baseline written: ${next.size} entries, ${after} violations (was ${before}).`);
  process.exit(0);
}

const comparison = compareToBaseline(current, baseline);
const worseKeys = new Set(comparison.worse.map((entry) => keyOf(entry.file, entry.rule)));
const shown = values.all
  ? result.findings
  : result.findings.filter((finding) => worseKeys.has(keyOf(finding.file, finding.rule)));
const failing = comparison.worse.length > 0 || result.meta.length > 0;

if (values.report !== undefined) {
  if (!complete) usage('a report needs a full run: no file arguments and no --rule.');
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
        suppressed: result.suppressed,
        worse: comparison.worse,
        better: comparison.better,
        meta: result.meta,
        findings: shown,
      },
      null,
      2,
    ),
  );
} else {
  console.log(formatText({ result, shown, comparison, timing: timing.wall }));
}
process.exitCode = failing ? 1 : 0;
