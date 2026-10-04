import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { AppliedChips } from '@/features/search/components/applied-chips';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { Search } from '@carshenas/search/search';

// The applied filters as removable chips, and the words of the sentence among them (CS-111): a quiet chip with its own
// accessible name, taken off like any; «clear» takes off every chip, the words and the sentence with them, and keeps
// only the order the buyer chose.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  router.push.mockReset();
});

const search: Search = { filters: { make: ['pride'] }, q: 'خوشگل', sort: 'price_asc' };
const chips = [
  { key: 'make:pride', text: 'پراید', without: { filters: {}, q: 'خوشگل', sort: 'price_asc' as const } },
  {
    key: 'q',
    text: SEARCH_COPY.chips.words('خوشگل'),
    words: 'خوشگل',
    label: SEARCH_COPY.chips.remove('خوشگل'),
    without: { filters: { make: ['pride'] }, sort: 'price_asc' as const },
    quiet: true,
  },
];

function show() {
  return render(
    <SearchNavigationProvider search={search} sentence="پراید خوشگل">
      <AppliedChips chips={chips} />
    </SearchNavigationProvider>,
  );
}

test('a word chip shows the words in quotes, is named «برداشتن «…»» once, and is drawn quieter', () => {
  show();
  const word = screen.getByRole('button', { name: SEARCH_COPY.chips.remove('خوشگل') });
  expect(word).toHaveTextContent('«خوشگل»');
  expect(word).toHaveClass('border-dashed');
  expect(screen.getByText('خوشگل', { selector: 'bdi' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: SEARCH_COPY.chips.remove('پراید') })).not.toHaveClass(
    'border-dashed',
  );
});

test('taking a word off keeps the sentence in the address, like any chip', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: SEARCH_COPY.chips.remove('خوشگل') }));
  expect(router.push).toHaveBeenCalledWith(
    `/search?make=pride&sort=price_asc&${new URLSearchParams({ ask: 'پراید خوشگل' }).toString()}`,
    {
      scroll: false,
    },
  );
});

test('«clear» takes off every chip, the words and the sentence, and keeps the chosen order', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: SEARCH_COPY.controls.clearFilters }));
  expect(router.push).toHaveBeenCalledWith('/search?sort=price_asc', { scroll: false });
});
