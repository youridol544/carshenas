// Finds the source files, reads the ones that hold a Persian word, and decides what each one is
// (copy-files.mjs says how). One scan serves the lint, the inventory and the tests.
import fs from 'node:fs';
import path from 'node:path';
import { EXCLUDED, SCAN_ROOTS, SHARED_TEXT, TEST_FILE } from '../copy-files.mjs';
import { extractUnits, parseSource } from './extract.mjs';
import { matchesGlob } from './glob.mjs';
import { REPO_ROOT } from './paths.mjs';

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);
const SOURCE_FILE = /\.(?:ts|tsx)$/;
const DECLARATION_FILE = /\.d\.ts$/;
const COPY_NAME = /-copy\.(?:ts|tsx)$/;
// Cheap test before parsing: a file can only hold a unit if it has a Persian letter or a middle dot somewhere.
const MAYBE_TEXT = /[\p{Script=Arabic}&&\p{L}]|[·•⋅∙]/v;

function expandRoot(root) {
  const star = root.indexOf('*');
  if (star === -1) return [root];
  const parent = root.slice(0, star);
  const rest = root.slice(star + 1);
  const absolute = path.join(REPO_ROOT, parent);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => `${parent}${entry.name}${rest}`)
    .filter((dir) => fs.existsSync(path.join(REPO_ROOT, dir)));
}

function* walk(directory) {
  for (const entry of fs.readdirSync(path.join(REPO_ROOT, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(relative);
    else if (SOURCE_FILE.test(entry.name) && !DECLARATION_FILE.test(entry.name)) yield relative;
  }
}

/** Every `.ts` and `.tsx` file under the scan roots that is not a test, as repository-relative paths, sorted. */
export function listSourceFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    for (const directory of expandRoot(root)) {
      for (const file of walk(directory)) if (!TEST_FILE.test(file)) files.push(file);
    }
  }
  return files.sort();
}

/** What a file with Persian text is: `{ role: 'copy', via }`, `{ role: 'excluded', reason }` or `{ role: 'unclassified' }`. */
export function classify(file) {
  const shared = SHARED_TEXT.find((entry) => matchesGlob(file, entry.glob));
  if (shared !== undefined) return { role: 'copy', via: 'shared', reason: shared.reason };
  if (file.startsWith('apps/web/src/') && COPY_NAME.test(file)) {
    return { role: 'copy', via: 'name', reason: 'a *-copy file: the feature keeps its words in one place' };
  }
  const excluded = EXCLUDED.find((entry) => matchesGlob(file, entry.glob));
  if (excluded !== undefined) return { role: 'excluded', reason: excluded.reason, glob: excluded.glob };
  if (file.startsWith('apps/web/src/')) {
    return { role: 'copy', via: 'inline', reason: 'inline Persian text in apps/web/src' };
  }
  return { role: 'unclassified' };
}

/**
 * The scan: every source file with a Persian letter in it, its units, and its role. A file whose only Persian is in
 * comments has no unit and is not reported.
 * Returns { copy: [{ file, via, units, text, sourceFile }], excluded: [{ file, reason, strings }], unclassified: [...] }.
 */
export function scan({
  files = listSourceFiles(),
  read = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'),
} = {}) {
  const copy = [];
  const excluded = [];
  const unclassified = [];
  for (const file of files) {
    if (TEST_FILE.test(file)) continue;
    const text = read(file);
    if (!MAYBE_TEXT.test(text)) continue;
    const sourceFile = parseSource(file, text);
    const units = extractUnits(file, text, sourceFile);
    // A file holds text when it has a string with a Persian word, or joins what it shows with a middle dot (the dot
    // rules need those files too: a component that only lays out «a · b» has no Persian string of its own).
    const persian = units.filter((unit) => unit.persian);
    if (persian.length === 0 && !units.some((unit) => unit.dot)) continue;
    const role = classify(file);
    if (role.role === 'copy')
      copy.push({ file, via: role.via, reason: role.reason, units, text, sourceFile });
    else if (role.role === 'excluded')
      excluded.push({ file, reason: role.reason, glob: role.glob, strings: persian.length });
    else unclassified.push({ file, strings: persian.length });
  }
  return { copy, excluded, unclassified };
}
