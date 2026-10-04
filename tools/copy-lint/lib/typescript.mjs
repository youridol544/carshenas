// The TypeScript compiler API, only to read source files into a syntax tree (ts.createSourceFile: no program, no type
// check, so it takes milliseconds a file). The tool adds no dependency of its own: it uses the version apps/web
// already pins (the `typescript` entry of the pnpm catalog), found from that package's folder.
import { createRequire } from 'node:module';
import path from 'node:path';
import { REPO_ROOT } from './paths.mjs';

const require = createRequire(path.join(REPO_ROOT, 'apps', 'web', 'package.json'));

let loaded;
try {
  loaded = require('typescript');
} catch (error) {
  throw new Error(
    'copy-lint needs the TypeScript compiler API that apps/web depends on: run `pnpm install` first. ' +
      String(error instanceof Error ? error.message : error),
    { cause: error },
  );
}

export const ts = loaded;
