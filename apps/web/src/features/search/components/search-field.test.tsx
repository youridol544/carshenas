import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { SearchField } from '@/features/search/components/search-field';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { EMPTY_SEARCH, fromSearchParams, type Search } from '@carshenas/search/search';

// The search box (CS-61): words go in the address beside the filters, the box shows the words that are applied, and the
// clear button hands focus back to the box instead of dropping it to the top of the page.

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

afterEach(() => {
  router.push.mockReset();
});

// The page the box is on: the address it pushes is the search it is given back, as the server does once it has answered.
function Box({ initial }: { initial: Search }) {
  const [search, setSearch] = useState(initial);
  useEffect(() => {
    router.push.mockImplementation((href: string) => {
      setSearch(fromSearchParams(new URL(href, 'https://x.test').searchParams).search);
    });
  }, []);
  return <Page search={search} />;
}

// The page as its server renders it: the search comes in as a prop.
function Page({ search }: { search: Search }) {
  return (
    <SearchNavigationProvider search={search}>
      <SearchField />
    </SearchNavigationProvider>
  );
}

const BAR = SEARCH_COPY.bar;

test('submitting puts the trimmed words in the address and keeps the filters', async () => {
  const user = userEvent.setup();
  render(<Box initial={{ filters: { deal: 'good' } }} />);
  await user.type(screen.getByRole('searchbox', { name: BAR.label }), '  پژو ۲۰۶ {Enter}');
  expect(router.push).toHaveBeenCalledTimes(1);
  const [href] = router.push.mock.calls[0] as [string];
  const params = new URL(href, 'https://x.test').searchParams;
  expect(params.get('q')).toBe('پژو ۲۰۶');
  expect(params.get('deal')).toBe('good');
});

test('words that are applied show in the box', () => {
  render(<Box initial={{ ...EMPTY_SEARCH, q: 'سمند' }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveValue('سمند');
});

test('clearing empties the box, keeps focus in it and removes the words from the address', async () => {
  const user = userEvent.setup();
  render(<Box initial={{ ...EMPTY_SEARCH, q: 'سمند' }} />);
  await user.click(screen.getByRole('button', { name: BAR.clear }));
  // The mocked router never changes the address, so the box returns to the applied words; the real one follows it.
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveFocus();
  expect(router.push).toHaveBeenCalledWith('/search', { scroll: false });
});

test('clearing words that were only typed changes nothing in the address', async () => {
  const user = userEvent.setup();
  render(<Box initial={EMPTY_SEARCH} />);
  await user.type(screen.getByRole('searchbox', { name: BAR.label }), 'پژو');
  await user.click(screen.getByRole('button', { name: BAR.clear }));
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveFocus();
  expect(router.push).not.toHaveBeenCalled();
});

test('new applied words replace the text without replacing the box, and a draft survives other changes', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Page search={EMPTY_SEARCH} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'پراید');
  // Something else changed (a filter), the words did not: the draft stays.
  rerender(<Page search={{ filters: { deal: 'good' } }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveValue('پراید');
  // The applied words changed (Back, a chip, a suggestion): the same box shows them.
  rerender(<Page search={{ filters: {}, q: 'تیبا' }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toBe(box);
  expect(box).toHaveValue('تیبا');
});
