import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { EmptyIndex } from '@/features/search/components/empty-index';
import { IgnoredNotice } from '@/features/search/components/ignored-notice';
import { NoResults, type Relaxation } from '@/features/search/components/no-results';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { EMPTY_SEARCH, searchHref } from '@carshenas/search/search';

// The states of the results that are not results (CS-61): the index is empty, a search finds nothing and names what to
// remove, and an address had parts the shared schema could not use.

const COPY = SEARCH_COPY.noResults;
const plain = (text: string) => text.replace(/\s+/g, ' ');

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

afterEach(() => {
  router.push.mockReset();
});

function relaxation(key: string, text: string, count: number, exact = true): Relaxation {
  return { key, text, without: { filters: { deal: 'good' } }, total: { count, exact } };
}

function renderNoResults(props: Partial<Parameters<typeof NoResults>[0]> = {}) {
  return render(
    <SearchNavigationProvider search={EMPTY_SEARCH}>
      <NoResults wordsOnly={false} clear={null} relaxations={[]} {...props} />
    </SearchNavigationProvider>,
  );
}

test('an empty index says why, and offers nothing to remove', () => {
  render(<EmptyIndex />);
  expect(screen.getByRole('heading', { level: 2, name: SEARCH_COPY.emptyIndex.title })).toBeInTheDocument();
  expect(screen.getByText(plain(SEARCH_COPY.emptyIndex.body))).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a search that finds nothing offers the best removal first, with how many listings it would show', async () => {
  const user = userEvent.setup();
  const best = relaxation('paint_free', 'بدون رنگ', 42);
  const other: Relaxation = {
    ...relaxation('no_accident', 'بدون تصادف', 7),
    without: { filters: { paint_free: true } },
  };
  renderNoResults({ clear: { filters: {} }, relaxations: [best, other] });
  expect(screen.getByRole('heading', { level: 2, name: COPY.title })).toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: `${COPY.remove('بدون رنگ')} ${COPY.count(42, true)}` }),
  );
  expect(router.push).toHaveBeenLastCalledWith(searchHref(best.without), { scroll: false });
  await user.click(screen.getByRole('button', { name: new RegExp(COPY.remove('بدون تصادف')) }));
  expect(router.push).toHaveBeenLastCalledWith(searchHref(other.without), { scroll: false });
  await user.click(screen.getByRole('button', { name: COPY.clearAll }));
  expect(router.push).toHaveBeenLastCalledWith('/search', { scroll: false });
});

test('a count that is only a floor reads «بیش از …»', () => {
  renderNoResults({ relaxations: [relaxation('paint_free', 'قیمت', 1000, false)] });
  expect(screen.getByRole('button', { name: new RegExp('بیش از') })).toBeInTheDocument();
});

test('words alone that find nothing say so and have no filter to remove', () => {
  renderNoResults({ wordsOnly: true });
  expect(screen.getByText(COPY.onlyWords)).toBeInTheDocument();
  expect(screen.queryByText(COPY.lead)).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('an address part that could not be used is named in the filters’ own words', () => {
  render(<IgnoredNotice params={['year', 'sort', 'unknown-param']} />);
  const notice = screen.getByRole('status');
  expect(notice).toHaveTextContent(SEARCH_COPY.ignored.lead);
  expect(notice).toHaveTextContent('سال ساخت');
  expect(notice).toHaveTextContent(SEARCH_COPY.ignored.sort);
  expect(notice).not.toHaveTextContent('unknown-param');
});

test('nothing is said when nothing was ignored', () => {
  render(<IgnoredNotice params={[]} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
