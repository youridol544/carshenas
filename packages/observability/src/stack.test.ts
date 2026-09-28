import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { SourceMap, type SourceMapPayload, type SourceOrigin } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { mapStackFrames, type SourceMapLookup } from './stack.ts';

// Real generated code and a real source map from the TypeScript compiler: `render` on line 7 of the original calls
// `priceOf`, which throws on line 3.
const ORIGINAL = [
  'type Listing = { price?: number };',
  'export function priceOf(listing: Listing): number {',
  "  if (listing.price === undefined) throw new TypeError('listing has no price');",
  '  return listing.price;',
  '}',
  'export function render(listing: Listing): string {',
  '  return String(priceOf(listing));',
  '}',
].join('\n');
const THROW_COLUMN = (ORIGINAL.split('\n')[2]?.indexOf('throw') ?? 0) + 1;

const workspace = mkdtempSync(path.join(tmpdir(), 'carshenas-stack-'));
after(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function compile(fileName: string) {
  const output = ts.transpileModule(ORIGINAL, {
    fileName,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, sourceMap: true },
  });
  const payload = JSON.parse(output.sourceMapText ?? '{}') as SourceMapPayload;
  return { code: output.outputText, payload };
}

/** 1-based line and column of `text` in the generated code. */
function positionOf(code: string, text: string) {
  const before = code.slice(0, code.indexOf(text)).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

test('V8 frames in generated code point at the original file, line and column', () => {
  const { code, payload } = compile('listing-price.ts');
  const thrown = positionOf(code, "throw new TypeError('listing has no price')");
  const called = positionOf(code, 'priceOf(listing))');
  const bundle = path.join(workspace, 'chunks', 'bundle.js');
  const lookup: SourceMapLookup = (file) =>
    file === bundle ? { map: new SourceMap(payload), directory: path.join(workspace, 'src') } : undefined;
  const stack = [
    'TypeError: listing has no price',
    `    at a (${bundle}:${thrown.line}:${thrown.column})`,
    `    at b (${bundle}:${called.line}:${called.column})`,
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
  ].join('\n');
  const [message, first, second, internal] = mapStackFrames(stack, lookup).split('\n');
  assert.equal(message, 'TypeError: listing has no price');
  assert.match(first ?? '', new RegExp(String.raw`^ {4}at a \(.*src/listing-price\.ts:3:${THROW_COLUMN}\)$`));
  assert.match(second ?? '', /^ {4}at b \(.*src\/listing-price\.ts:7:17\)$/);
  assert.equal(
    internal,
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
  );
});

test("a frame takes its original function name from its caller's call site, as Node's source maps do", () => {
  // Minified code: the functions are `a` and `b`, and the map records the original identifier at each call site.
  const origins: Record<string, SourceOrigin> = {
    '1:10': { name: 'TypeError', fileName: 'src/price.ts', lineNumber: 3, columnNumber: 42 },
    '1:50': { name: 'priceOf', fileName: 'src/price.ts', lineNumber: 7, columnNumber: 17 },
  };
  const lookup: SourceMapLookup = () => ({
    map: { findOrigin: (line, column) => origins[`${line}:${column}`] ?? {} },
    directory: workspace,
  });
  const [, thrower, caller] = mapStackFrames(
    ['TypeError: no price', '    at a (/b.js:1:10)', '    at b (/b.js:1:50)'].join('\n'),
    lookup,
  ).split('\n');
  // `a` is what `b` called at 7:17, which the map names priceOf; `b` has no caller here and keeps its own name.
  assert.match(thrower ?? '', /^ {4}at priceOf \(.*src\/price\.ts:3:42\)$/);
  assert.match(caller ?? '', /^ {4}at b \(.*src\/price\.ts:7:17\)$/);
});

test('Firefox and Safari frames are mapped too', () => {
  const { code, payload } = compile('listing-price.ts');
  const thrown = positionOf(code, "throw new TypeError('listing has no price')");
  const url = 'https://carshenas.ir/_next/static/chunks/app.js';
  const lookup: SourceMapLookup = (file) =>
    file === url ? { map: new SourceMap(payload), directory: workspace } : undefined;
  const mapped = mapStackFrames(`priceOf@${url}:${thrown.line}:${thrown.column}`, lookup);
  assert.match(mapped, new RegExp(String.raw`^priceOf@.*listing-price\.ts:3:${THROW_COLUMN}$`));
});

test('Turbopack project sources show from the workspace root, dependencies from node_modules', () => {
  const { code, payload } = compile('ignored.ts');
  const thrown = positionOf(code, "throw new TypeError('listing has no price')");
  const lookup =
    (source: string): SourceMapLookup =>
    () => ({
      map: new SourceMap({ ...payload, sources: [source] }),
      directory: '/srv/carshenas/apps/web/.next/server/chunks',
    });
  const frame = `    at x (/srv/bundle.js:${thrown.line}:${thrown.column})`;
  assert.match(
    mapStackFrames(frame, lookup('turbopack:///[project]/apps/web/src/app/page.tsx')),
    new RegExp(String.raw`\(apps/web/src/app/page\.tsx:3:${THROW_COLUMN}\)$`),
  );
  assert.match(
    mapStackFrames(
      frame,
      lookup('../../../../../node_modules/.pnpm/kysely@0.29.6/node_modules/kysely/dist/index.js'),
    ),
    new RegExp(String.raw`\(node_modules/kysely/dist/index\.js:3:${THROW_COLUMN}\)$`),
  );
});

test('a frame no source map covers, and a line that is no frame, stay as they are', () => {
  const stack = 'Error: boom\n    at run (/srv/app.js:1:1)\nsome other text';
  assert.equal(
    mapStackFrames(stack, () => undefined),
    stack,
  );
});

test('with source maps enabled at run time, the maps Node loaded map an unmapped stack', () => {
  const { code, payload } = compile(path.join(workspace, 'src', 'listing-price.ts'));
  const bundle = path.join(workspace, 'bundle.cjs');
  writeFileSync(`${bundle}.map`, JSON.stringify(payload));
  writeFileSync(
    bundle,
    `${code.replace(/\/\/# sourceMappingURL=.*$/m, '')}\n//# sourceMappingURL=bundle.cjs.map\n`,
  );
  const script = path.join(workspace, 'run.ts');
  writeFileSync(
    script,
    [
      `import { createRequire } from 'node:module';`,
      `import { sourceMappedStack } from ${JSON.stringify(fileURLToPath(new URL('stack.ts', import.meta.url)))};`,
      // What register() does in the web app, before the app's code loads.
      `process.setSourceMapsEnabled(true);`,
      // An unmapped stack, as Next.js leaves error.stack: generated file, line and column of each frame.
      // An unmapped stack, as Next.js leaves error.stack: each frame's generated file, line and column.
      `const sites = (error) => { const saved = Error.prepareStackTrace; Error.prepareStackTrace = (_, callSites) => callSites; const list = error.stack; Error.prepareStackTrace = saved; return list; };`,
      `const { render } = createRequire(import.meta.url)(${JSON.stringify(bundle)});`,
      `try { render({}); } catch (error) {`,
      `  const stack = String(error) + sites(error).map((site) => '\\n    at ' + site.getFunctionName() + ' (' + site.getFileName() + ':' + site.getLineNumber() + ':' + site.getColumnNumber() + ')').join('');`,
      `  console.log(JSON.stringify({ raw: stack, mapped: sourceMappedStack(stack) })); }`,
    ].join('\n'),
  );
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', script],
    {
      encoding: 'utf8',
      cwd: workspace,
    },
  );
  assert.equal(result.stderr, '');
  const { raw, mapped } = JSON.parse(result.stdout) as { raw: string; mapped: string };
  assert.match(raw, /at priceOf \(.*bundle\.cjs:\d+:\d+\)/);
  assert.match(mapped, /at priceOf \(.*listing-price\.ts:3:\d+\)/);
  assert.match(mapped, /at render \(.*listing-price\.ts:7:17\)/);
});
