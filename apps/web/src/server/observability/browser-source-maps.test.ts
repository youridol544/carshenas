// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mapStackFrames } from '@carshenas/observability/stack';
import { afterAll, expect, test } from 'vitest';
import { browserSourceMaps } from '@/server/observability/browser-source-maps';

// A build's static folder with browser chunks as Turbopack writes them: each chunk's last line names its map, which
// has a hash of its own. The map is the TypeScript compiler's output for listing-card.tsx, whose line 2 is
// `  return listing.price!.toFixed(0);`, kept as a literal so the test does not load the compiler: generated line 2
// is `    return listing.price.toFixed(0);`, and column 12 is `listing.price`.
const root = mkdtempSync(path.join(tmpdir(), 'carshenas-static-'));
const staticDirectory = path.join(root, 'static');
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});
const SOURCE_MAP = {
  version: 3,
  sources: ['turbopack:///[project]/apps/web/src/listing-card.tsx'],
  names: [],
  mappings:
    'AAAA,MAAM,UAAU,KAAK,CAAC,OAA2B;IAC/C,OAAO,OAAO,CAAC,KAAM,CAAC,OAAO,CAAC,CAAC,CAAC,CAAC;AACnC,CAAC',
};
mkdirSync(path.join(staticDirectory, 'chunks'), { recursive: true });
function chunk(name: string, lastLine: string) {
  writeFileSync(path.join(staticDirectory, 'chunks', name), `(()=>{})();\n${lastLine}\n`);
}
writeFileSync(path.join(staticDirectory, 'chunks', '3y_lez0yndito.js.map'), JSON.stringify(SOURCE_MAP));
chunk('23-cxwomf0no7.js', '//# sourceMappingURL=3y_lez0yndito.js.map');
chunk('no-map.js', '// nothing here');
chunk('escapes.js', '//# sourceMappingURL=../../outside.js.map');
writeFileSync(path.join(root, 'outside.js.map'), JSON.stringify(SOURCE_MAP));

const FRAME = (file: string) => `    at price (https://carshenas.ir/_next/static/chunks/${file}:2:12)`;

test('a browser frame maps through the map its chunk names, to the original file and line', async () => {
  const stack = `TypeError: Cannot read properties of undefined (reading 'toFixed')\n${FRAME('23-cxwomf0no7.js')}`;
  const lookup = await browserSourceMaps([stack], staticDirectory);
  expect(mapStackFrames(stack, lookup)).toContain('at price (apps/web/src/listing-card.tsx:2:10)');
});

test('a chunk that names no map, or a map outside the static folder, is left as it is', async () => {
  const stacks = [FRAME('no-map.js'), FRAME('escapes.js'), FRAME('missing.js')];
  const lookup = await browserSourceMaps(stacks, staticDirectory);
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
  const lookup = await browserSourceMaps(outside, staticDirectory);
  for (const url of outside) expect(lookup(url)).toBeUndefined();
});
