// Browser source maps after `next build` (ADR-0016), run by next.config.ts's runAfterProductionCompile.
//
// 1. Private: the build writes each chunk's map next to it in .next/static, which Next.js (or any web server in front
//    of it) serves to anyone. They move to .next/browser-source-maps, which is never served; the server reads them
//    there to symbolicate browser errors (src/server/observability/browser-source-maps.ts).
// 2. Right lines: the React Compiler rewrites client components with Babel, and Turbopack keeps Babel's output, not
//    our file, as the map's "original" (checked on Next.js 16.3.5: the map's content starts with `const $ = _c(3)`).
//    For each such file, the line of our source that every compiled line came from is found by its text and stored in
//    the map as `x_carshenas_original_lines`; a compiled line no original line matches stays unplaced.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRIVATE_MAPS_DIRECTORY = 'browser-source-maps';
const TURBOPACK_PROJECT = 'turbopack:///[project]/';
const COMPILED_MARKER = 'react/compiler-runtime';
// Shorter lines (`}`, `return t2;`) are too common to place by their text alone.
const MIN_MATCH_LENGTH = 4;
const MIN_CONTAINED_LENGTH = 12;

function indent(line) {
  return line.length - line.trimStart().length;
}

/**
 * For each line of the compiled text, `[originalLine, columnShift]` (1-based line; add the shift to a compiled
 * column) when exactly one original line matches it, or `null`. A compiled line matches an original line that reads
 * the same, or one that contains it (the compiler splits `if (x) throw …` into a block, leaving `throw …` alone).
 *
 * @param {string} compiled
 * @param {string} original
 * @returns {([number, number] | null)[]}
 */
export function lineTable(compiled, original) {
  const originalLines = original.split('\n');
  const trimmed = originalLines.map((line) => line.trim());
  const count = new Map();
  for (const text of trimmed) count.set(text, (count.get(text) ?? 0) + 1);
  return compiled.split('\n').map((line) => {
    const text = line.trim();
    if (text.length < MIN_MATCH_LENGTH) return null;
    if (count.get(text) === 1) {
      const index = trimmed.indexOf(text);
      return [index + 1, indent(originalLines[index]) - indent(line)];
    }
    if (text.length < MIN_CONTAINED_LENGTH) return null;
    const containing = [];
    for (const [index, candidate] of trimmed.entries()) if (candidate.includes(text)) containing.push(index);
    if (containing.length !== 1) return null;
    const [index] = containing;
    return [index + 1, originalLines[index].indexOf(text) - indent(line)];
  });
}

function sourcesOf(payload) {
  const maps = Array.isArray(payload.sections) ? payload.sections.map((section) => section.map) : [payload];
  return maps.flatMap((map) =>
    (map.sources ?? []).map((source, index) => ({ source, content: map.sourcesContent?.[index] })),
  );
}

async function originalLines(payload, workspaceRoot) {
  const tables = {};
  for (const { source, content } of sourcesOf(payload)) {
    if (typeof content !== 'string' || !content.includes(COMPILED_MARKER)) continue;
    if (!source.startsWith(TURBOPACK_PROJECT)) continue;
    try {
      const original = await readFile(
        path.join(workspaceRoot, source.slice(TURBOPACK_PROJECT.length)),
        'utf8',
      );
      tables[source] = lineTable(content, original);
    } catch {
      // The file is gone or unreadable: its frames keep the compiled lines, marked as such.
    }
  }
  return Object.keys(tables).length > 0 ? tables : undefined;
}

async function mapFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.map'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Moves every map out of `<distDir>/static` into `<distDir>/browser-source-maps`, with its line tables.
 *
 * @param {{ distDir: string; workspaceRoot: string }} options
 * @returns {Promise<number>} how many maps were moved
 */
export async function keepBrowserSourceMapsPrivate({ distDir, workspaceRoot }) {
  const staticDirectory = path.join(distDir, 'static');
  const privateDirectory = path.join(distDir, PRIVATE_MAPS_DIRECTORY);
  await rm(privateDirectory, { recursive: true, force: true });
  let moved = 0;
  for (const file of await mapFiles(staticDirectory)) {
    const payload = JSON.parse(await readFile(file, 'utf8'));
    const tables = await originalLines(payload, workspaceRoot);
    if (tables) payload.x_carshenas_original_lines = tables;
    const target = path.join(privateDirectory, path.relative(staticDirectory, file));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(payload));
    await rm(file);
    moved += 1;
  }
  return moved;
}
