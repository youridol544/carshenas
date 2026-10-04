#!/usr/bin/env node
// pnpm copy:inventory: regenerates docs/design/copy-rewrite-plan.md, the list of every file with user-visible text, its
// string count and its rewrite area (tools/copy-lint/areas.mjs). Fails (exit 1) when a copy file is in no area or in two.
//
//   pnpm copy:inventory            write docs/design/copy-rewrite-plan.md
//   pnpm copy:inventory --stdout   print it instead
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import { PLAN_FILE, relativeToRepo } from './lib/paths.mjs';
import { buildPlan } from './lib/inventory.mjs';
import { lintRepository } from './lib/run.mjs';
import { scan } from './lib/scope.mjs';

const { values } = parseArgs({ options: { stdout: { type: 'boolean' } } });

const scanResult = scan();
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
