// Proves that `pnpm check` rejects what the rule packs forbid. Every file under eslint/samples/ declares
// where it would live (`// path: src/…`), which rule ids must fire (`// expect: …`, repeatable, or `(none)` for a
// sample that must lint clean) and optionally text a message must contain (`// expect-message: …`), which tells
// apart restrictions that share one rule id. Warnings count, because `pnpm lint` fails on them; an
// eslint-disable comment, which has no effect in src/, is reported as `no-inline-config`. Each sample is copied to that path inside src/, so every
// path-scoped rule and the TypeScript project service see it as real code, linted with the project config,
// and removed again. Run: `pnpm --filter @carshenas/web lint:selftest` (part of `pnpm check`).
import { ESLint } from 'eslint';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const samplesDir = path.join(root, 'eslint', 'samples');
const scratchDirs = new Set();

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
if (failed) {
  console.error(
    '\nlint self-test failed: a rule the packs rely on did not fire, or the clean sample was rejected.',
  );
  process.exit(1);
}
console.log(`\nlint self-test passed: ${files.length} samples.`);
