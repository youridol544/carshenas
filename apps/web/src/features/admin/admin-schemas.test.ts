// @vitest-environment node
import { expect, test } from 'vitest';
import { readChangeJobStateForm, readChangeSourceStateForm } from '@/features/admin/admin-schemas';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const PAUSE = { sourceId: 'divar', seenState: 'enabled', seenStoppedAt: '', chosen: 'paused' };
const STOP = '2026-09-29 13:13:44.123456+00';

test('the form the sources screen renders is read as sent, with no stop as null', () => {
  expect(readChangeSourceStateForm(form(PAUSE))).toEqual({
    sourceId: 'divar',
    seenState: 'enabled',
    seenStoppedAt: null,
    chosen: 'paused',
  });
});

test("a stopped source's stop travels as the database's text, exact to the microsecond", () => {
  for (const seenStoppedAt of [STOP, '2026-09-29 13:13:44+00', '2026-09-29 16:43:44.5+03:30']) {
    expect(
      readChangeSourceStateForm(
        form({ sourceId: 'divar', seenState: 'stopped_on_block', seenStoppedAt, chosen: 'enabled' }),
      ),
    ).toMatchObject({ seenStoppedAt });
  }
});

test('anything else is refused before it reaches the database', () => {
  const refused: Record<string, string>[] = [
    { ...PAUSE, sourceId: 'Divar' },
    { ...PAUSE, sourceId: 'x' },
    { ...PAUSE, sourceId: "divar'; drop table source; --" },
    { ...PAUSE, seenState: 'running' },
    { ...PAUSE, chosen: 'stopped_on_block' },
    { ...PAUSE, chosen: '' },
    // A stop comes with a stopped source, and only with one.
    { ...PAUSE, seenStoppedAt: STOP },
    { ...PAUSE, seenState: 'stopped_on_block' },
    // A JavaScript Date's text, or anything that is not the database's own, is not a stop the page showed.
    { ...PAUSE, seenState: 'stopped_on_block', seenStoppedAt: '2026-09-29T13:13:44.123Z' },
    { ...PAUSE, seenState: 'stopped_on_block', seenStoppedAt: 'yesterday' },
  ];
  for (const fields of refused) expect(readChangeSourceStateForm(form(fields))).toBeUndefined();
  const missing = form(PAUSE);
  missing.delete('chosen');
  expect(readChangeSourceStateForm(missing)).toBeUndefined();
  const file = form(PAUSE);
  file.set('sourceId', new Blob(['divar']));
  expect(readChangeSourceStateForm(file)).toBeUndefined();
});

const RETRY = {
  queue: 'crawl.divar',
  jobId: '4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  seenState: 'failed',
  action: 'retry',
};

test('the job form is read as sent: a failed job retried, a job waiting to run again cancelled (CS-41)', () => {
  expect(readChangeJobStateForm(form(RETRY))).toEqual(RETRY);
  expect(readChangeJobStateForm(form({ ...RETRY, seenState: 'retry', action: 'cancel' }))).toEqual({
    ...RETRY,
    seenState: 'retry',
    action: 'cancel',
  });
});

test('a job form the section never renders is refused before it reaches the database', () => {
  for (const fields of [
    { ...RETRY, action: 'cancel' },
    { ...RETRY, seenState: 'retry' },
    { ...RETRY, seenState: 'active', action: 'cancel' },
    { ...RETRY, action: 'delete' },
    { ...RETRY, jobId: 'not-a-uuid' },
    { ...RETRY, queue: 'Crawl Divar' },
    { ...RETRY, queue: '' },
  ]) {
    expect(readChangeJobStateForm(form(fields))).toBeUndefined();
  }
});
