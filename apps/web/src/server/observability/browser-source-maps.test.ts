// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mapStackFrames } from '@carshenas/observability/stack';
import { afterAll, expect, test } from 'vitest';
import { browserSourceMaps } from '@/server/observability/browser-source-maps';

// A build folder as `next build` and scripts/browser-source-maps.mjs leave it: chunks in static/, each naming its map
// by a hash of its own, and the maps moved to browser-source-maps/. The mappings are the TypeScript compiler's for a
// two-line function (generated line 2, column 12 is `listing.price` on original line 2, column 10), kept as a literal
// so the test does not load the compiler.
const build = mkdtempSync(path.join(tmpdir(), 'carshenas-build-'));
afterAll(() => {
  rmSync(build, { recursive: true, force: true });
});
const MAPPINGS =
  'AAAA,MAAM,UAAU,KAAK,CAAC,OAA2B;IAC/C,OAAO,OAAO,CAAC,KAAM,CAAC,OAAO,CAAC,CAAC,CAAC,CAAC;AACnC,CAAC';
const OURS = 'turbopack:///[project]/apps/web/src/listing-card.tsx';
const COMPILED = 'turbopack:///[project]/apps/web/src/compiled-card.tsx';

function file(relative: string, content: string) {
  const target = path.join(build, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}
file('static/chunks/23-cxwomf0no7.js', '(()=>{})();\n//# sourceMappingURL=3y_lez0yndito.js.map\n');
file(
  'browser-source-maps/chunks/3y_lez0yndito.js.map',
  JSON.stringify({ version: 3, sources: [OURS], names: [], mappings: MAPPINGS }),
);
// A component the React Compiler rewrote: the build step placed compiled line 2 on original line 5, 3 columns in.
file('static/chunks/compiled.js', '(()=>{})();\n//# sourceMappingURL=compiled-hash.js.map\n');
file(
  'browser-source-maps/chunks/compiled-hash.js.map',
  JSON.stringify({
    version: 3,
    sources: [COMPILED],
    names: [],
    mappings: MAPPINGS,
    x_carshenas_original_lines: { [COMPILED]: [null, [5, 3]] },
  }),
);
file('static/chunks/unplaced.js', '//# sourceMappingURL=unplaced-hash.js.map\n');
file(
  'browser-source-maps/chunks/unplaced-hash.js.map',
  JSON.stringify({
    version: 3,
    sources: [COMPILED],
    names: [],
    mappings: MAPPINGS,
    x_carshenas_original_lines: { [COMPILED]: [null, null] },
  }),
);
file('static/chunks/no-map.js', '// nothing here\n');
file('static/chunks/escapes.js', '//# sourceMappingURL=../../../outside.js.map\n');
file('outside.js.map', JSON.stringify({ version: 3, sources: [OURS], names: [], mappings: MAPPINGS }));

const FRAME = (chunk: string) => `    at price (https://carshenas.ir/_next/static/chunks/${chunk}:2:12)`;

test('a browser frame maps through the map its chunk names, read from the private folder', async () => {
  const stack = `TypeError: Cannot read properties of undefined (reading 'toFixed')\n${FRAME('23-cxwomf0no7.js')}`;
  const lookup = await browserSourceMaps([stack], build);
  expect(mapStackFrames(stack, lookup)).toContain('at price (apps/web/src/listing-card.tsx:2:10)');
});

test("in a compiled component, a placed line reports our file's line; an unplaced one says it is compiled", async () => {
  const stacks = [FRAME('compiled.js'), FRAME('unplaced.js')];
  const lookup = await browserSourceMaps(stacks, build);
  expect(mapStackFrames(stacks[0] ?? '', lookup)).toBe('    at price (apps/web/src/compiled-card.tsx:5:13)');
  expect(mapStackFrames(stacks[1] ?? '', lookup)).toBe(
    '    at price (apps/web/src/compiled-card.tsx (compiled):2:10)',
  );
});

test('a chunk that names no map, or a map outside the build, is left as it is', async () => {
  const stacks = [FRAME('no-map.js'), FRAME('escapes.js'), FRAME('missing.js')];
  const lookup = await browserSourceMaps(stacks, build);
  for (const stack of stacks) expect(mapStackFrames(stack, lookup)).toBe(stack);
});

test('only JavaScript under /_next/static is looked at, and a path cannot leave the static folder', async () => {
  const outside = [
    'https://carshenas.ir/_next/static/chunks/app.css',
    'https://carshenas.ir/elsewhere/app.js',
    'https://carshenas.ir/_next/static/../../../../etc/passwd.js',
    'https://carshenas.ir/_next/static/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd.js',
    'not a url at all',
  ];
  const lookup = await browserSourceMaps(outside, build);
  for (const url of outside) expect(lookup(url)).toBeUndefined();
});
