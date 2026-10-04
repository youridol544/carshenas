// The TypeScript compiler API, only to read source files into a syntax tree (ts.createSourceFile: no program, no type
// check, so it takes milliseconds a file). The tool adds no dependency of its own: it uses the version apps/web
// already pins (the `typescript` entry of the pnpm catalog), found from that package's folder.
import * as nodeModule from 'node:module';
import path from 'node:path';
import { REPO_ROOT } from './paths.mjs';

// V8 compiles the 9 MB compiler on every start; a cache on disk (in node_modules, which git ignores) halves that. Node 22.1
// and later; skipped without a word where it is missing or the folder cannot be written.
nodeModule.enableCompileCache?.(path.join(REPO_ROOT, 'node_modules', '.cache', 'copy-lint'));

const require = nodeModule.createRequire(path.join(REPO_ROOT, 'apps', 'web', 'package.json'));

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
