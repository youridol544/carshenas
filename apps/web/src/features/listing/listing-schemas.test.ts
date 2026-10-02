// @vitest-environment node
import { expect, test } from 'vitest';
import { readListingId, recheckSchema } from '@/features/listing/listing-schemas';

test('an address segment is a listing id only when it is plain Latin digits without a leading zero', () => {
  expect(readListingId('1')).toBe(1);
  expect(readListingId('23752')).toBe(23_752);
  for (const bad of [
    '',
    '0',
    '01',
    '-5',
    '+5',
    '1e3',
    '12.5',
    'abc',
    '۱۲',
    '12 ',
    ' 12',
    '99999999999999999999',
  ]) {
    expect(readListingId(bad)).toBeUndefined();
  }
});

test('the re-check action takes exactly one positive whole id and nothing else', () => {
  expect(recheckSchema.safeParse({ id: 5 }).success).toBe(true);
  expect(recheckSchema.safeParse({ id: 0 }).success).toBe(false);
  expect(recheckSchema.safeParse({ id: 5.5 }).success).toBe(false);
  expect(recheckSchema.safeParse({ id: '5' }).success).toBe(false);
  expect(recheckSchema.safeParse({ id: 5, extra: 1 }).success).toBe(false);
  expect(recheckSchema.safeParse(null).success).toBe(false);
});
