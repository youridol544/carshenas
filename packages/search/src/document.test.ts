import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areCountsStale, fullRebuildDue, isVocabularyStale, type BuildState } from './document.ts';

// What the worker decides from the times the search tables were built (CS-59): a part built before the rows last
// changed is stale, and a full rebuild is due when the table is empty, none was ever completed or the last is old.

const NOW = new Date('2026-10-02T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const FRESH: BuildState = {
  documents: 3_000,
  documentsChangedAt: hoursAgo(2),
  countsBuiltAt: hoursAgo(1),
  vocabularyBuiltAt: hoursAgo(1),
  fullRebuildAt: hoursAgo(10),
  now: NOW,
};

test('the vocabulary and the counts are fresh when built after the rows last changed', () => {
  assert.equal(isVocabularyStale(FRESH), false);
  assert.equal(areCountsStale(FRESH), false);
});

test('a part never built, or built before the last change, is stale: a run that failed after its rows is repaired', () => {
  assert.equal(isVocabularyStale({ ...FRESH, vocabularyBuiltAt: null }), true);
  assert.equal(areCountsStale({ ...FRESH, countsBuiltAt: null }), true);
  assert.equal(isVocabularyStale({ ...FRESH, documentsChangedAt: hoursAgo(0.5) }), true);
  assert.equal(areCountsStale({ ...FRESH, documentsChangedAt: hoursAgo(0.5) }), true);
  // Rows that never changed leave a built part fresh.
  assert.equal(isVocabularyStale({ ...FRESH, documentsChangedAt: null }), false);
});

test('a full rebuild is due when the table is empty, none was completed, or the last is over 26 hours old', () => {
  assert.equal(fullRebuildDue(FRESH), undefined);
  assert.equal(fullRebuildDue({ ...FRESH, documents: 0 }), 'empty');
  assert.equal(fullRebuildDue({ ...FRESH, fullRebuildAt: null }), 'never');
  assert.equal(fullRebuildDue({ ...FRESH, fullRebuildAt: hoursAgo(26) }), undefined);
  assert.equal(fullRebuildDue({ ...FRESH, fullRebuildAt: hoursAgo(26.1) }), 'old');
  // Empty wins over the rest: an empty table is filled whenever the last rebuild was.
  assert.equal(fullRebuildDue({ ...FRESH, documents: 0, fullRebuildAt: null }), 'empty');
});
