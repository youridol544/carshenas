// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mapStackFrames } from '@carshenas/observability/stack';
import { afterAll, expect, test } from 'vitest';
import { browserSourceMaps } from '@/server/observability/browser-source-maps';

// A build's static folder with one browser chunk's source map. The map is the TypeScript compiler's output for
// listing-card.tsx, whose line 2 is `  return listing.price!.toFixed(0);`, kept as a literal so the test does not load
// the compiler: generated line 2 is `    return listing.price.toFixed(0);`, and column 12 is `listing.price`.
const staticDirectory = mkdtempSync(path.join(tmpdir(), 'carshenas-static-'));
afterAll(() => {
  rmSync(staticDirectory, { recursive: true, force: true });
});
const SOURCE_MAP = {
  version: 3,
  file: 'app.js',
  sources: ['turbopack:///[project]/apps/web/src/listing-card.tsx'],
  names: [],
  mappings:
    'AAAA,MAAM,UAAU,KAAK,CAAC,OAA2B;IAC/C,OAAO,OAAO,CAAC,KAAM,CAAC,OAAO,CAAC,CAAC,CAAC,CAAC;AACnC,CAAC',
};
mkdirSync(path.join(staticDirectory, 'chunks'), { recursive: true });
writeFileSync(path.join(staticDirectory, 'chunks', 'app.js.map'), JSON.stringify(SOURCE_MAP));

test("a browser frame in one of the build's chunks maps to its original file and line", async () => {
  const stack =
    "TypeError: Cannot read properties of undefined (reading 'toFixed')\n" +
    '    at price (https://carshenas.ir/_next/static/chunks/app.js:2:12)';
  const lookup = await browserSourceMaps([stack], staticDirectory);
  expect(mapStackFrames(stack, lookup)).toContain('at price (apps/web/src/listing-card.tsx:2:10)');
});

test('only JavaScript under /_next/static maps, and a path cannot leave the static folder', async () => {
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

test('a chunk without a map is left as it is', async () => {
  const stack = '    at x (https://carshenas.ir/_next/static/chunks/missing.js:1:1)';
  const lookup = await browserSourceMaps([stack], staticDirectory);
  expect(mapStackFrames(stack, lookup)).toBe(stack);
});
