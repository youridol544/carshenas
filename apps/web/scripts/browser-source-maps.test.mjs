// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { keepBrowserSourceMapsPrivate, lineTable } from './browser-source-maps.mjs';

// The shape the React Compiler gives a client component (checked on Next.js 16.3.5): a memo cache inserted at the
// top, `if (x) throw …` split into a block, and event handlers hoisted to the end of the file.
const ORIGINAL = [
  'export function BrowserFailures() {',
  '  const [renderFails, setRenderFails] = useState(false);',
  '  if (renderFails) throw new TypeError(DIAGNOSTIC_MESSAGE);',
  '  return (',
  '    <div className="flex flex-wrap gap-3">',
  '      <button',
  '        onClick={() => {',
  '          throw new RangeError(DIAGNOSTIC_MESSAGE);',
  '        }}',
  '      >',
].join('\n');
const COMPILED = [
  'import { c as _c } from "react/compiler-runtime";',
  'export function BrowserFailures() {',
  '  const $ = _c(3);',
  '  const [renderFails, setRenderFails] = useState(false);',
  '  if (renderFails) {',
  '    throw new TypeError(DIAGNOSTIC_MESSAGE);',
  '  }',
  '  return t2;',
  '}',
  'function _temp() {',
  '  throw new RangeError(DIAGNOSTIC_MESSAGE);',
  '}',
].join('\n');

test('each compiled line is placed on the one original line it came from, or left unplaced', () => {
  const table = lineTable(COMPILED, ORIGINAL);
  expect(table[1]).toEqual([1, 0]);
  expect(table[2]).toBeNull();
  expect(table[3]).toEqual([2, 0]);
  expect(table[4]).toBeNull();
  // `throw` moved into a block: the original line holds it after `if (renderFails) `, 19 characters in.
  expect(table[5]).toEqual([3, 15]);
  expect(table[6]).toBeNull();
  expect(table[7]).toBeNull();
  // The hoisted handler goes back to the button's onClick.
  expect(table[10]).toEqual([8, 8]);
});

test('after the build, maps live only in the private folder, and compiled files carry their line tables', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'carshenas-build-'));
  try {
    const distDir = path.join(root, 'apps', 'web', '.next');
    await mkdir(path.join(distDir, 'static', 'chunks'), { recursive: true });
    await mkdir(path.join(distDir, 'static', 'css'), { recursive: true });
    await mkdir(path.join(root, 'apps', 'web', 'src'), { recursive: true });
    await writeFile(path.join(root, 'apps', 'web', 'src', 'failures.tsx'), ORIGINAL);
    const source = 'turbopack:///[project]/apps/web/src/failures.tsx';
    await writeFile(
      path.join(distDir, 'static', 'chunks', '3y_lez0yndito.js.map'),
      JSON.stringify({
        version: 3,
        sources: [source],
        sourcesContent: [COMPILED],
        names: [],
        mappings: 'AAAA',
      }),
    );
    await writeFile(
      path.join(distDir, 'static', 'chunks', '23-cxwomf0no7.js'),
      '//# sourceMappingURL=3y_lez0yndito.js.map\n',
    );
    await writeFile(
      path.join(distDir, 'static', 'css', 'app.css.map'),
      JSON.stringify({ version: 3, sources: [], mappings: '' }),
    );

    expect(await keepBrowserSourceMapsPrivate({ distDir, workspaceRoot: root })).toBe(2);
    expect(existsSync(path.join(distDir, 'static', 'chunks', '3y_lez0yndito.js.map'))).toBe(false);
    expect(existsSync(path.join(distDir, 'static', 'css', 'app.css.map'))).toBe(false);
    expect(existsSync(path.join(distDir, 'static', 'chunks', '23-cxwomf0no7.js'))).toBe(true);
    const moved = JSON.parse(
      await readFile(path.join(distDir, 'browser-source-maps', 'chunks', '3y_lez0yndito.js.map'), 'utf8'),
    );
    expect(moved.x_carshenas_original_lines[source][5]).toEqual([3, 15]);
    expect(existsSync(path.join(distDir, 'browser-source-maps', 'css', 'app.css.map'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
