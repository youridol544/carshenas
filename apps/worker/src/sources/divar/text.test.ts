import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { JsonObject } from '@carshenas/db/db-types';
import { jsonObjectOf } from './answers.ts';
import { divarListingText } from './text.ts';

// The text CS-52's extraction reads, on the snapshots made from three real posts (src/test-support/divar-snapshots,
// whose descriptions were replaced before they were committed) and on variants in the shapes real posts take.

function snapshotOf(name: string): JsonObject {
  const text = readFileSync(
    new URL(`../../test-support/divar-snapshots/${name}.json`, import.meta.url),
    'utf8',
  );
  const payload = jsonObjectOf(text);
  if (payload === undefined) throw new Error(`${name} is not a JSON object`);
  return payload;
}

const REPLACED = 'متن فروشنده در این نمونه نیامده است.';

/** The snapshot with its DESCRIPTION section's rows replaced by these texts. */
function withDescription(payload: JsonObject, ...texts: string[]): JsonObject {
  const copy = structuredClone(payload) as { sections: { section_name: string; widgets: unknown[] }[] };
  for (const section of copy.sections) {
    if (section.section_name !== 'DESCRIPTION') continue;
    section.widgets = [
      { widget_type: 'TITLE_ROW', data: { text: 'توضیحات' } },
      ...texts.map((text) => ({ widget_type: 'DESCRIPTION_ROW', data: { text, is_primary: true } })),
    ];
  }
  return copy as unknown as JsonObject;
}

test('the title and the description of a real post, and not the dates row of its title section', () => {
  const text = divarListingText(snapshotOf('private-206-both-calendars'));
  assert.ok(text);
  assert.equal(text.description, REPLACED);
  assert.notEqual(text.title, '');
  assert.doesNotMatch(text.description, /انتشار آگهی/);
});

test('every description row, one per line, trimmed, and empty rows left out', () => {
  const payload = withDescription(snapshotOf('dealer-206-swap-installments'), ' بدون رنگ ', '', 'قیمت مقطوع');
  assert.equal(divarListingText(payload)?.description, 'بدون رنگ\nقیمت مقطوع');
});

test('a post without a description has an empty one', () => {
  const payload = withDescription(snapshotOf('dealer-pickup-placeholder-price'));
  assert.equal(divarListingText(payload)?.description, '');
});

test('no title, or no post at all, is null', () => {
  const payload = structuredClone(snapshotOf('private-206-both-calendars')) as {
    sections: { section_name: string }[];
  };
  payload.sections = payload.sections.filter((section) => section.section_name !== 'TITLE');
  assert.equal(divarListingText(payload as unknown as JsonObject), null);
  assert.equal(divarListingText({ seo: {} }), null);
});
