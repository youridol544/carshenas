#!/usr/bin/env node
// pnpm copy:inventory: regenerates docs/design/copy-rewrite-plan.md, the list of every file with user-visible text, its
// string count and its rewrite area (tools/copy-lint/areas.mjs). Fails (exit 1) when a copy file is in no area or in two.
//
//   pnpm copy:inventory                write docs/design/copy-rewrite-plan.md
//   pnpm copy:inventory --stdout       print it instead
//   pnpm copy:inventory --strings <A>  print every string of one area (A to E, or CS-115) as a table: the "before" a
//                                      rewrite lane reviews and counts
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import { PLAN_FILE, relativeToRepo } from './lib/paths.mjs';
import { AREAS, OWNED_ELSEWHERE } from './areas.mjs';
import { buildPlan, buildStringTable } from './lib/inventory.mjs';
import { lintRepository } from './lib/run.mjs';
import { scan } from './lib/scope.mjs';

const { values } = parseArgs({ options: { stdout: { type: 'boolean' }, strings: { type: 'string' } } });

const scanResult = scan();

if (values.strings !== undefined) {
  const area = values.strings.toUpperCase().replace(/^CS-/, 'CS-');
  if (AREAS[area] === undefined && OWNED_ELSEWHERE[area] === undefined) {
    console.error(
      `copy-inventory: unknown area «${values.strings}»; use ${[...Object.keys(AREAS), ...Object.keys(OWNED_ELSEWHERE)].join(', ')}.`,
    );
    process.exit(2);
  }
  const { rows, markdown } = buildStringTable({ scanResult, area });
  process.stdout.write(
    `${markdown}\n${rows.length} strings in ${new Set(rows.map((row) => row.file)).size} files.\n`,
  );
  process.exit(0);
}

const result = await lintRepository({ scanResult });
const date = new Date().toISOString().slice(0, 10);
const { markdown, partition } = buildPlan({ scanResult, findings: result.findings, date });

const problems = [];
for (const file of partition.unassigned) problems.push(`in no area: ${file}`);
for (const entry of partition.multiple)
  problems.push(`in several areas (${entry.areas.join(', ')}): ${entry.file}`);
if (problems.length > 0) {
  console.error('copy-inventory: the area assignment is incomplete (tools/copy-lint/areas.mjs):');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

if (values.stdout) process.stdout.write(markdown);
else {
  fs.writeFileSync(PLAN_FILE, markdown);
  const files = scanResult.copy.length;
  const strings = scanResult.copy.reduce(
    (sum, entry) => sum + entry.units.filter((unit) => unit.persian).length,
    0,
  );
  console.log(`copy-inventory: ${relativeToRepo(PLAN_FILE)} written (${files} files, ${strings} strings).`);
}
