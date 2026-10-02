// @vitest-environment node
import { expect, test } from 'vitest';
import { listingLink } from '@/features/search/listing-link';

test('a card leads to the ad on its source, in a new tab, until the listing page exists', () => {
  expect(listingLink({ id: 7, url: 'https://divar.ir/v/ga5yk91_' })).toEqual({
    href: 'https://divar.ir/v/ga5yk91_',
    external: true,
  });
});

test('a card without a usable address is not a link, never a dead one', () => {
  expect(listingLink({ id: 7, url: '' })).toBeNull();
  expect(listingLink({ id: 7, url: 'not an address' })).toBeNull();
  expect(listingLink({ id: 7, url: 'javascript:alert(1)' })).toBeNull();
  expect(listingLink({ id: 7, url: 'http://divar.ir/v/x' })).toBeNull();
});
