// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { keepBrowserSourceMapsPrivate, nextReactCompiler } from './browser-source-maps.mjs';

const APP_DIR = path.join(import.meta.dirname, '..');
const workspace = await mkdtemp(path.join(tmpdir(), 'carshenas-build-'));
afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

// A client component whose lines the React Compiler moves and reprints: a string literal in a throw, and JSX.
const COMPONENT = [
  "'use client';",
  '',
  "import { useState } from 'react';",
  '',
  'export function PriceTag({ price }: { price?: number }) {',
  '  const [shown, setShown] = useState(false);',
  "  if (price === undefined) throw new Error('listing has no price');",
  '  return (',
  '    <button type="button" onClick={() => setShown(true)}>',
  "      {shown ? 'قیمت' : 'نمایش'}",
  '    </button>',
  '  );',
  '}',
  '',
].join('\n');

/** 1-based line and column of `text` in `code`. */
function positionOf(code, text) {
  const before = code.slice(0, code.indexOf(text)).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

/** A build folder with one chunk whose map says `compiled` is the source of `apps/web/src/price-tag.tsx`. */
async function buildWith(compiled) {
  const root = await mkdtemp(path.join(workspace, 'root-'));
  const distDir = path.join(root, 'apps', 'web', '.next');
  await mkdir(path.join(distDir, 'static', 'chunks'), { recursive: true });
  await mkdir(path.join(distDir, 'static', 'css'), { recursive: true });
  await mkdir(path.join(root, 'apps', 'web', 'src'), { recursive: true });
  await writeFile(path.join(root, 'apps', 'web', 'src', 'price-tag.tsx'), COMPONENT);
  const source = 'turbopack:///[project]/apps/web/src/price-tag.tsx';
  await writeFile(
    path.join(distDir, 'static', 'chunks', '3y_lez0yndito.js.map'),
    JSON.stringify({
      version: 3,
      sources: [source],
      sourcesContent: [compiled],
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
  const moved = async () =>
    JSON.parse(
      await readFile(path.join(distDir, 'browser-source-maps', 'chunks', '3y_lez0yndito.js.map'), 'utf8'),
    );
  return { root, distDir, source, moved };
}

const COMPILED = 'import { c as _c } from "react/compiler-runtime";\nexport function PriceTag() {}';
const BABEL_MAP = {
  version: 3,
  sources: ['/abs/price-tag.tsx'],
  names: [],
  mappings: ';AAIA',
  sourcesContent: ['…'],
};

test('after the build, maps live only in the private folder, and a reproduced file carries the compiler’s map', async () => {
  const { root, distDir, source, moved } = await buildWith(COMPILED);
  const result = await keepBrowserSourceMapsPrivate({
    distDir,
    workspaceRoot: root,
    compile: () => Promise.resolve({ code: COMPILED, map: BABEL_MAP }),
  });
  expect(result).toEqual({ moved: 2, unmatched: [] });
  expect(existsSync(path.join(distDir, 'static', 'chunks', '3y_lez0yndito.js.map'))).toBe(false);
  expect(existsSync(path.join(distDir, 'static', 'css', 'app.css.map'))).toBe(false);
  expect(existsSync(path.join(distDir, 'static', 'chunks', '23-cxwomf0no7.js'))).toBe(true);
  expect(existsSync(path.join(distDir, 'browser-source-maps', 'css', 'app.css.map'))).toBe(true);
  // Named by the source the outer map uses, without our file's text (the private map already holds the compiled code).
  expect((await moved()).x_carshenas_compiled_maps).toEqual({
    [source]: { version: 3, sources: [source], names: [], mappings: ';AAIA' },
  });
});

test('a file whose compiled code cannot be reproduced exactly is stored as null and reported', async () => {
  const { root, distDir, source, moved } = await buildWith(COMPILED);
  const result = await keepBrowserSourceMapsPrivate({
    distDir,
    workspaceRoot: root,
    compile: () => Promise.resolve({ code: `${COMPILED}\n// a newer compiler`, map: BABEL_MAP }),
  });
  expect(result.unmatched).toEqual(['apps/web/src/price-tag.tsx']);
  expect((await moved()).x_carshenas_compiled_maps).toEqual({ [source]: null });
});

test("Next.js's own React Compiler step maps a reprinted string literal and JSX back to our lines", async () => {
  const file = path.join(workspace, 'price-tag.tsx');
  await writeFile(file, COMPONENT);
  const result = await nextReactCompiler({ projectDir: APP_DIR, reactCompiler: true })(COMPONENT, file);
  expect(result?.code).toContain('react/compiler-runtime');
  const map = new SourceMap(result?.map);
  const code = result?.code ?? '';
  // The compiler reprints the literal with double quotes, so matching lines by their text could not place it.
  const thrown = positionOf(code, 'throw new Error("listing has no price")');
  expect(map.findOrigin(thrown.line, thrown.column)).toMatchObject({ lineNumber: 7, columnNumber: 28 });
  const label = positionOf(code, 'shown ?');
  expect(map.findOrigin(label.line, label.column)).toMatchObject({ lineNumber: 10 });
});
