#!/usr/bin/env node
// Seeded, time-boxed random abuse of the app (tests/chaos/gorilla.spec.ts). From the repo root:
//
//   pnpm gorilla                                  every page in fixtures/app-pages.ts, random seed, phone
//   pnpm gorilla / --scope main --budget 120      one page, one feature scope, two minutes
//   pnpm gorilla --seed 20260921 --project both   a fixed seed on phone and desktop (what CI runs on PRs)
//   pnpm gorilla '/' --seed 42 --path '7:1:0'     replay the exact failure a previous run printed
//   pnpm gorilla --selfcheck                      prove the oracles on the lab page with planted defects
//
// The seed is printed first. A failure prints the problems, the minimal action sequence and the replay command,
// replays itself once to prove it, and leaves that replay's trace and the action log (gorilla-seed-<seed>.json)
// in e2e/test-results/. A replay you start with --path writes to e2e/test-results-replay/ instead, so the
// original run's log and trace stay where they are.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const USAGE = `usage: pnpm gorilla [url] [--scope <css>] [--seed <n|random>] [--path <replay path>]
                    [--budget <seconds>] [--runs <n>] [--actions <n>] [--project mobile|desktop|both]
       pnpm gorilla --selfcheck`;

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      scope: { type: 'string' },
      seed: { type: 'string', default: 'random' },
      path: { type: 'string' },
      budget: { type: 'string' },
      runs: { type: 'string' },
      actions: { type: 'string' },
      project: { type: 'string', default: 'mobile' },
      selfcheck: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
const { values, positionals } = parsed;
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const e2e = fileURLToPath(new URL('..', import.meta.url));
const playwright = (args, env) =>
  spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], {
    cwd: e2e,
    env,
    stdio: 'inherit',
  });

if (values.selfcheck) {
  // The lab page with planted defects lives on the fixture site; the app is not needed.
  console.log('[gorilla] self-check: every planted defect in e2e/site/lab/ must be found and replayed');
  const run = playwright(['tests/harness/gorilla-selfcheck.spec.ts', '--project=fixture-mobile'], {
    ...process.env,
    E2E_ONLY_FIXTURE: '1',
    GORILLA_SELFCHECK: '1',
  });
  process.exit(run.status ?? 1);
}

const seed = values.seed === 'random' ? String(Math.floor(Math.random() * 2 ** 31)) : values.seed;
if (!/^\d+$/.test(seed)) {
  console.error(`--seed must be a non-negative integer or "random", got "${values.seed}"\n${USAGE}`);
  process.exit(2);
}
const projects = {
  mobile: ['chaos-mobile'],
  desktop: ['chaos-desktop'],
  both: ['chaos-mobile', 'chaos-desktop'],
}[values.project];
if (!projects) {
  console.error(`--project must be mobile, desktop or both, got "${values.project}"\n${USAGE}`);
  process.exit(2);
}

const env = { ...process.env, GORILLA_SEED: seed };
if (positionals[0]) env.GORILLA_URL = positionals[0];
const knobs = {
  scope: 'GORILLA_SCOPE',
  path: 'GORILLA_PATH',
  budget: 'GORILLA_BUDGET_S',
  runs: 'GORILLA_RUNS',
  actions: 'GORILLA_ACTIONS',
};
for (const [flag, name] of Object.entries(knobs)) if (values[flag] !== undefined) env[name] = values[flag];

console.log(
  `[gorilla] seed ${seed}${values.path ? `, replaying path ${values.path}` : ''} ` +
    `(${positionals[0] ?? 'every app page'}, ${projects.join(' and ')}). Repeat this run with --seed ${seed}.`,
);

// Each gorilla test is time-boxed by its own budget; the suite-wide 30-minute CI limit would cut a long nightly
// run off in the middle of shrinking a finding, so it is lifted here.
const run = playwright(
  [
    'tests/chaos',
    ...projects.map((name) => `--project=${name}`),
    '--global-timeout=0',
    ...(values.path ? ['--output=test-results-replay'] : []),
  ],
  env,
);
process.exit(run.status ?? 1);
