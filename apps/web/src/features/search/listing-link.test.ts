// @vitest-environment node
import { expect, test } from 'vitest';
import { listingLink } from '@/features/search/listing-link';

test('a card leads to its own listing page, in the same tab', () => {
  expect(listingLink({ id: 7 })).toEqual({ href: '/listings/7', external: false });
  expect(listingLink({ id: 1_234_567 })).toEqual({ href: '/listings/1234567', external: false });
});

test('a card without a usable id is not a link, never a dead one', () => {
  expect(listingLink({ id: 0 })).toBeNull();
  expect(listingLink({ id: -3 })).toBeNull();
  expect(listingLink({ id: 1.5 })).toBeNull();
  expect(listingLink({ id: Number.NaN })).toBeNull();
});
