// Browser source maps after `next build` (ADR-0016), run by next.config.ts's runAfterProductionCompile.
//
// 1. Private: the build writes each chunk's map next to it in .next/static, which Next.js (or any web server in front
//    of it) serves to anyone. They move to .next/browser-source-maps, which is never served; the server reads them
//    there to symbolicate browser errors (src/server/observability/browser-source-maps.ts).
// 2. Right lines: the React Compiler rewrites client components with Babel, and Turbopack keeps Babel's output, not
//    our file, as the map's "original" (checked on Next.js 16.3.5: the map's content starts with `const $ = _c(3)`).
//    For each such file, Next.js's own React Compiler step runs again on our file with Babel's source maps on. When it
//    gives back, byte for byte, the code the map holds, Babel's map (that code to our file) is stored in the map as
//    `x_carshenas_compiled_maps`, and the server follows both maps. A file it cannot reproduce is stored as null: its
//    frames keep the compiled code's lines, marked as such, and the build prints a warning.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

export const PRIVATE_MAPS_DIRECTORY = 'browser-source-maps';
const TURBOPACK_PROJECT = 'turbopack:///[project]/';
const COMPILED_MARKER = 'react/compiler-runtime';

/**
 * @typedef {{ version: number; sources: string[]; names: string[]; mappings: string }} CompiledMap
 * @typedef {(original: string, file: string) => Promise<{ code: string; map: CompiledMap | null } | null>} Compile
 */

/**
 * Next.js's React Compiler step for browser code, as its build runs it: the same loader options (from
 * `getReactCompilerLoader`) through the same Babel transform, with source maps on. These are Next.js internals, so a
 * change there shows up as output that no longer matches, never as a wrong line.
 *
 * @param {{ projectDir: string; reactCompiler: boolean | object }} options
 * @returns {Compile}
 */
export function nextReactCompiler({ projectDir, reactCompiler }) {
  const require = createRequire(path.join(projectDir, 'package.json'));
  const { getReactCompilerLoader } = require('next/dist/build/get-babel-loader-config');
  const transform = require('next/dist/build/babel/loader/transform').default;
  const { trace } = require('next/dist/trace');
  const loader = getReactCompilerLoader(reactCompiler, projectDir, false, undefined, false);
  if (!loader) return () => Promise.resolve(null);
  const context = { sourceMap: true, target: 'web', emitWarning() {}, addDependency() {} };
  return (original, file) =>
    transform(
      context,
      original,
      undefined,
      loader.options,
      file,
      'web',
      trace('carshenas-browser-source-maps'),
    );
}

function sourcesOf(payload) {
  const maps = Array.isArray(payload.sections) ? payload.sections.map((section) => section.map) : [payload];
  return maps.flatMap((map) =>
    (map.sources ?? []).map((source, index) => ({ source, content: map.sourcesContent?.[index] })),
  );
}

/** For each file of ours the React Compiler rewrote: Babel's map from the compiled code, or null. */
async function compiledMaps(payload, { workspaceRoot, compile, unmatched }) {
  const maps = {};
  for (const { source, content } of sourcesOf(payload)) {
    if (typeof content !== 'string' || !content.includes(COMPILED_MARKER)) continue;
    if (!source.startsWith(TURBOPACK_PROJECT) || source in maps) continue;
    const file = path.join(workspaceRoot, source.slice(TURBOPACK_PROJECT.length));
    maps[source] = null;
    try {
      const result = await compile(await readFile(file, 'utf8'), file);
      if (result?.map && result.code === content) {
        const { version, names, mappings } = result.map;
        maps[source] = { version, sources: [source], names, mappings };
      }
    } catch {
      // Unreadable, or the transform failed: the frames keep the compiled lines, marked as such.
    }
    if (maps[source] === null) unmatched.add(source.slice(TURBOPACK_PROJECT.length));
  }
  return Object.keys(maps).length > 0 ? maps : undefined;
}

async function mapFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.map'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Moves every map out of `<distDir>/static` into `<distDir>/browser-source-maps`, with the React Compiler's maps.
 *
 * @param {{ distDir: string; workspaceRoot: string; compile: Compile }} options
 * @returns {Promise<{ moved: number; unmatched: string[] }>} the maps moved, and the compiled files not reproduced
 */
export async function keepBrowserSourceMapsPrivate({ distDir, workspaceRoot, compile }) {
  const staticDirectory = path.join(distDir, 'static');
  const privateDirectory = path.join(distDir, PRIVATE_MAPS_DIRECTORY);
  await rm(privateDirectory, { recursive: true, force: true });
  const unmatched = new Set();
  let moved = 0;
  for (const file of await mapFiles(staticDirectory)) {
    const payload = JSON.parse(await readFile(file, 'utf8'));
    const maps = await compiledMaps(payload, { workspaceRoot, compile, unmatched });
    if (maps) payload.x_carshenas_compiled_maps = maps;
    const target = path.join(privateDirectory, path.relative(staticDirectory, file));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(payload));
    await rm(file);
    moved += 1;
  }
  return { moved, unmatched: [...unmatched].sort() };
}
