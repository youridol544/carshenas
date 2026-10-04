// The rewrite areas have disjoint file lists and leave nothing unassigned (areas.mjs). The checks that matter run on the
// real repository; the small ones prove the check itself can fail.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AREAS, NOTES, OVERRIDES, OWNED_ELSEWHERE, assignFile, deadEntries, partition } from '../areas.mjs';
import { matchesGlob } from '../lib/glob.mjs';
import { buildStringTable } from '../lib/inventory.mjs';
import { listSourceFiles, scan } from '../lib/scope.mjs';

const scanResult = scan();
const copyFiles = scanResult.copy.map((entry) => entry.file);

test('every copy file is in exactly one area or in the CS-115 list', () => {
  const { unassigned, multiple } = partition(copyFiles);
  assert.deepEqual(
    unassigned,
    [],
    'These copy files belong to no area: add them to an area in tools/copy-lint/areas.mjs.',
  );
  assert.deepEqual(multiple, [], 'These copy files are in two areas: tighten a glob or add an override.');
});

test('the lists are disjoint and complete: the files of all areas add up to the copy files, each once', () => {
  const { byArea } = partition(copyFiles);
  const all = [...byArea.values()].flat().map((entry) => entry.file);
  assert.equal(all.length, copyFiles.length);
  assert.equal(new Set(all).size, copyFiles.length);
  assert.deepEqual([...all].sort(), [...copyFiles].sort());
});

test('there are five rewrite areas and the check-a-link list belongs to none of them', () => {
  assert.deepEqual(Object.keys(AREAS), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(Object.keys(OWNED_ELSEWHERE), ['CS-115']);
  for (const file of copyFiles.filter((file) => file.includes('/check-link/'))) {
    assert.equal(assignFile(file).area, 'CS-115', file);
  }
  assert.equal(assignFile('apps/web/src/features/check-link/check-copy.ts').area, 'CS-115');
});

test('the areas hold what the owner listed', () => {
  assert.equal(assignFile('apps/web/src/features/home/home-copy.ts').area, 'A');
  assert.equal(assignFile('apps/web/src/features/model/model-copy.ts').area, 'A');
  assert.equal(assignFile('apps/web/src/features/data-status/data-status-copy.ts').area, 'A');
  assert.equal(assignFile('apps/web/src/app/not-found.tsx').area, 'A');
  assert.equal(assignFile('apps/web/src/features/search/search-copy.ts').area, 'B');
  assert.equal(assignFile('apps/web/src/features/listing/listing-explanation.ts').area, 'B');
  assert.equal(assignFile('packages/search/src/understand/merge.ts').area, 'B');
  assert.equal(assignFile('apps/web/src/features/accounts/accounts-copy.ts').area, 'C');
  assert.equal(assignFile('packages/notifications/src/kinds.ts').area, 'C');
  assert.equal(assignFile('apps/web/src/features/search-files/search-files-copy.ts').area, 'C');
  assert.equal(assignFile('apps/web/src/lib/crawl-requests-copy.ts').area, 'C');
  assert.equal(assignFile('apps/web/src/features/admin/admin-copy.ts').area, 'D');
  assert.equal(assignFile('packages/search/src/filters.ts').area, 'E');
  assert.equal(assignFile('apps/web/src/lib/mileage-info.ts').area, 'E');
  assert.equal(assignFile('apps/web/src/features/model/model-info.ts').area, 'E');
});

test('an override beats the area globs and says why', () => {
  const assigned = assignFile('apps/web/src/features/model/model-info.ts');
  assert.equal(assigned.via, 'override');
  assert.ok(assigned.note.length > 20);
  for (const override of OVERRIDES)
    assert.ok(override.note.length > 20 && AREAS[override.area] !== undefined);
});

test('the check can fail: an unlisted file is unassigned and a doubly listed file is reported', () => {
  assert.equal(assignFile('apps/web/src/features/brand-new/brand-new-copy.ts').problem, 'unassigned');
  // admin owns apps/web/src/features/admin/**; a file also matched by another area's glob would be reported.
  const probe = 'packages/search/src/understand/merge.ts';
  const matching = [...Object.entries({ ...AREAS, ...OWNED_ELSEWHERE })]
    .filter(([, area]) => area.include.some((glob) => matchesGlob(probe, glob)))
    .map(([id]) => id);
  assert.deepEqual(matching, ['B']);
});

test('the check can fail: a glob that two areas share reports the files in both', () => {
  const home = 'apps/web/src/features/home/home-copy.ts';
  AREAS.B.include.push('apps/web/src/features/home/**');
  try {
    const { multiple } = partition([home]);
    assert.deepEqual(multiple, [{ file: home, areas: ['A', 'B'] }]);
    assert.equal(assignFile(home).problem, 'multiple');
  } finally {
    AREAS.B.include.pop();
  }
  assert.equal(assignFile(home).area, 'A');
});

test('no area glob, override or note is dead: each matches a real source file', () => {
  const files = listSourceFiles();
  assert.deepEqual(deadEntries(files), []);
  for (const entry of NOTES) {
    assert.ok(
      files.some((file) => matchesGlob(file, entry.glob)),
      `the note for ${entry.glob} matches no file`,
    );
  }
});

test('the string table of an area lists every string of its files, and the areas together list every string', () => {
  const total = scanResult.copy.reduce(
    (sum, entry) => sum + entry.units.filter((unit) => unit.persian).length,
    0,
  );
  let counted = 0;
  for (const area of [...Object.keys(AREAS), ...Object.keys(OWNED_ELSEWHERE)]) {
    const { rows, markdown } = buildStringTable({ scanResult, area });
    counted += rows.length;
    assert.ok(markdown.startsWith('| File:line | Kind | Key | Text |'));
    for (const row of rows)
      assert.ok(assignFile(row.file).area === area, `${row.file} is not in area ${area}`);
  }
  assert.equal(counted, total);
});
