// Proves that `pnpm check` rejects what the rule packs forbid. Every file under eslint/samples/ declares
// where it would live (`// path: src/…`), which rule ids must fire (`// expect: …`, repeatable, or `(none)` for a
// sample that must lint clean) and optionally text a message must contain (`// expect-message: …`), which tells
// apart restrictions that share one rule id. Warnings count, because `pnpm lint` fails on them; an
// eslint-disable comment, which has no effect in src/, is reported as `no-inline-config`. Each sample is copied to that path inside src/, so every
// path-scoped rule and the TypeScript project service see it as real code, linted with the project config,
// and removed again. Run: `pnpm --filter @carshenas/web lint:selftest` (part of `pnpm check`).
//
// It also lints the way VS Code does (CS-31). `pnpm lint` gives each workspace package its own process, but the
// editor's ESLint server lints every package in one, and typescript-eslint keeps process-wide state across the
// configs it loads. So every package's config is loaded before the samples run, and afterwards each package's
// files outside src/ must lint clean in that same process, as they do under `pnpm lint`.
import { ESLint } from 'eslint';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(root, '..', '..');
const samplesDir = path.join(root, 'eslint', 'samples');
const scratchDirs = new Set();

// The folders pnpm-workspace.yaml lists (`apps/*`, `e2e` …) that have an ESLint config of their own.
async function lintedPackages() {
  const workspace = await readFile(path.join(repo, 'pnpm-workspace.yaml'), 'utf8');
  const entries = /^packages:\n((?:[ \t]+- .+\n)+)/m.exec(workspace)?.[1] ?? '';
  const dirs = [];
  for (const [, glob] of entries.matchAll(/- (.+)/g)) {
    const pattern = glob.trim().replace(/^['"]|['"]$/g, '');
    if (pattern.endsWith('/*')) {
      const parent = path.join(repo, pattern.slice(0, -2));
      const children = await readdir(parent, { withFileTypes: true }).catch(() => []);
      dirs.push(...children.filter((c) => c.isDirectory()).map((c) => path.join(parent, c.name)));
    } else dirs.push(path.join(repo, pattern));
  }
  const linted = [];
  for (const dir of dirs.sort()) {
    const names = await readdir(dir).catch(() => []);
    const config = names.find((name) => /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/.test(name));
    if (config) linted.push({ dir, config: path.join(dir, config) });
  }
  return linted;
}

function parseHeader(source, file) {
  const target = /^\/\/ path: (src\/\S+)$/m.exec(source)?.[1];
  if (!target) throw new Error(`${file}: missing "// path: src/…" header`);
  const expected = [...source.matchAll(/^\/\/ expect: (.+)$/gm)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim())
    .filter((s) => s && s !== '(none)');
  const messages = [...source.matchAll(/^\/\/ expect-message: (.+)$/gm)].map((m) => m[1].trim());
  return { target, expected, messages };
}

async function lintSample(eslint, file) {
  const source = await readFile(path.join(samplesDir, file), 'utf8');
  const { target, expected, messages: expectedMessages } = parseHeader(source, file);
  const absolute = path.join(root, target);
  await mkdir(path.dirname(absolute), { recursive: true });
  scratchDirs.add(path.dirname(absolute));
  await writeFile(absolute, source);
  try {
    const [result] = await eslint.lintFiles([absolute]);
    const idOf = (m) => m.ruleId ?? (m.fatal ? 'fatal' : 'no-inline-config');
    const fired = new Set(result.messages.map(idOf));
    const missing = [
      ...expected.filter((id) => !fired.has(id)),
      ...expectedMessages
        .filter((text) => !result.messages.some((m) => m.message.includes(text)))
        .map((text) => `message "${text}"`),
    ];
    const extra = [...fired].filter((id) => !expected.includes(id));
    return {
      file,
      target,
      expected: [...expected, ...expectedMessages],
      fired,
      missing,
      extra,
      messages: result.messages,
    };
  } finally {
    await rm(absolute, { force: true });
  }
}

// One linter per package, each loading its config now, so the samples below already run in the editor's state.
const packages = (await lintedPackages()).map(({ dir, config }) => ({
  dir,
  config,
  eslint: new ESLint({ cwd: dir, ignorePatterns: ['src/**'], errorOnUnmatchedPattern: false }),
}));
for (const { eslint, config } of packages) await eslint.calculateConfigForFile(config);

const eslint = new ESLint({ cwd: root });
const files = (await readdir(samplesDir)).filter((f) => /\.(ts|tsx)$/.test(f)).sort();
let failed = false;
try {
  for (const file of files) {
    const r = await lintSample(eslint, file);
    const clean = r.expected.length === 0;
    const ok = clean ? r.fired.size === 0 : r.missing.length === 0;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${file} -> ${r.target}`);
    if (clean) {
      if (!ok)
        for (const m of r.messages)
          console.log(`       unexpected ${m.ruleId}: ${m.message} (line ${m.line})`);
      else console.log('       lints clean, as it must');
    } else {
      console.log(`       fired ${r.fired.size} rule(s), expected ${r.expected.length}`);
      for (const id of r.missing) console.log(`       MISSING ${id}`);
      if (r.extra.length) console.log(`       also fired: ${r.extra.join(', ')}`);
    }
  }
} finally {
  // Remove the throwaway folders inside src/ (deepest first), never anything that held other files.
  for (const dir of [...scratchDirs].sort((a, b) => b.length - a.length)) {
    for (
      let d = dir;
      d.startsWith(path.join(root, 'src') + path.sep) && d !== path.join(root, 'src');
      d = path.dirname(d)
    ) {
      if ((await readdir(d).catch(() => ['x'])).length === 0) await rm(d, { recursive: true, force: true });
      else break;
    }
  }
}

for (const { dir, eslint } of packages) {
  const results = await eslint.lintFiles(['.']);
  const problems = results.flatMap((r) => r.messages.map((m) => ({ file: r.filePath, ...m })));
  const name = path.relative(repo, dir);
  failed ||= problems.length > 0;
  console.log(
    `${problems.length ? 'FAIL' : 'ok  '} ${name}: ${results.length} file(s) outside src/, one process`,
  );
  for (const m of problems) {
    const where = `${path.relative(repo, m.file)}${m.line ? `:${m.line}` : ''}`;
    console.log(`       ${where} ${m.ruleId ?? 'fatal'}: ${m.message.split('\n')[0]}`);
  }
}

if (failed) {
  console.error(
    '\nlint self-test failed: a rule the packs rely on did not fire, the clean sample was rejected, or a package lints differently when every package is linted in one process (as in VS Code).',
  );
  process.exit(1);
}
console.log(
  `\nlint self-test passed: ${files.length} samples; ${packages.length} packages linted in one process.`,
);
