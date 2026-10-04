// Which files are copy files (copy-files.mjs, lib/scope.mjs, lib/glob.mjs), and the live check that nothing with Persian
// text in the repository is left unclassified.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesGlob } from '../lib/glob.mjs';
import { classify, scan } from '../lib/scope.mjs';

const scanned = scan();

test('globs: * stays in a folder, ** crosses folders, {a,b} alternates, brackets and parentheses are literal', () => {
  assert.equal(matchesGlob('a/b/c.ts', 'a/*/c.ts'), true);
  assert.equal(matchesGlob('a/b/d/c.ts', 'a/*/c.ts'), false);
  assert.equal(matchesGlob('a/b/d/c.ts', 'a/**/c.ts'), true);
  assert.equal(matchesGlob('a/c.ts', 'a/**/c.ts'), true);
  assert.equal(matchesGlob('x/y.ts', 'x/{y,z}.ts'), true);
  assert.equal(matchesGlob('x/w.ts', 'x/{y,z}.ts'), false);
  assert.equal(matchesGlob('app/(site)/listings/[id]/page.tsx', 'app/(site)/listings/**'), true);
  assert.equal(matchesGlob('app/(site)/listings/[id]/page.tsx', 'app/(site)/listings/[id]/page.tsx'), true);
  assert.equal(matchesGlob('a/b.ts', 'a/?.ts'), true);
  assert.equal(matchesGlob('a/b.tsx', 'a/?.ts'), false);
});

test('a *-copy file under apps/web/src is copy by name', () => {
  assert.deepEqual(classify('apps/web/src/features/home/home-copy.ts').via, 'name');
});

test('any other file under apps/web/src with a Persian string is copy, inline', () => {
  const result = classify('apps/web/src/features/listing/listing-view.ts');
  assert.deepEqual([result.role, result.via], ['copy', 'inline']);
});

test('shared text modules in packages are copy', () => {
  for (const file of [
    'packages/search/src/filters.ts',
    'packages/search/src/understand/merge.ts',
    'packages/notifications/src/kinds.ts',
    'packages/locale/src/toman.ts',
  ]) {
    assert.equal(classify(file).via, 'shared', file);
  }
});

test('vocabulary, model instructions, the worker and reference pages are excluded, each with a reason', () => {
  for (const file of [
    'packages/search/src/understand/phrases.ts',
    'packages/ai/src/tasks/listing-facts.ts',
    'apps/worker/src/sources/divar/attributes.ts',
    'apps/web/src/features/design-language/components/colour-roles.tsx',
    'apps/web/src/app/design/page.tsx',
    'apps/web/src/features/listing/listing-fixtures.ts',
    'packages/locale/src/text.ts',
  ]) {
    const result = classify(file);
    assert.equal(result.role, 'excluded', file);
    assert.ok(result.reason.length > 20, file);
  }
});

test('a file in a package that nothing lists is unclassified', () => {
  assert.equal(classify('packages/search/src/brand-new.ts').role, 'unclassified');
  assert.equal(classify('packages/db/src/anything.ts').role, 'unclassified');
});

test('every file of the repository with Persian text is a copy file or excluded with a reason', () => {
  const result = scanned;
  assert.deepEqual(
    result.unclassified.map((entry) => entry.file),
    [],
    'Add each file to SHARED_TEXT (it shows text) or EXCLUDED (it does not) in tools/copy-lint/copy-files.mjs.',
  );
  assert.ok(
    result.copy.length > 40,
    `only ${result.copy.length} copy files were found: has the scan broken?`,
  );
});

test('the scan reaches the files that matter', () => {
  const copy = new Set(scanned.copy.map((entry) => entry.file));
  for (const file of [
    'apps/web/src/features/home/home-copy.ts',
    'apps/web/src/features/listing/listing-explanation.ts',
    'apps/web/src/features/admin/admin-copy.ts',
    'packages/search/src/filters.ts',
    'packages/notifications/src/kinds.ts',
  ]) {
    assert.ok(copy.has(file), `${file} should be a copy file`);
  }
});
