import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { EmptyIndex } from '@/features/search/components/empty-index';
import { IgnoredNotice } from '@/features/search/components/ignored-notice';
import { NoResults } from '@/features/search/components/no-results';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The states of the results that are not results (CS-61): the index is empty, a search finds nothing and names what to
// remove, and an address had parts the shared schema could not use.

const COPY = SEARCH_COPY.noResults;
const plain = (text: string) => text.replace(/\s+/g, ' ');

test('an empty index says why, and offers nothing to remove', () => {
  render(<EmptyIndex />);
  expect(screen.getByRole('heading', { level: 2, name: SEARCH_COPY.emptyIndex.title })).toBeInTheDocument();
  expect(screen.getByText(plain(SEARCH_COPY.emptyIndex.body))).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('a search that finds nothing offers the best removal first, with how many listings it would show', () => {
  render(
    <NoResults
      wordsOnly={false}
      clearHref="/search"
      relaxations={[
        { key: 'paint_free', text: 'بدون رنگ', href: '/search?deal=good', total: { count: 42, exact: true } },
        {
          key: 'deal',
          text: 'معامله‌ی خوب یا بهتر',
          href: '/search?nopaint=1',
          total: { count: 7, exact: true },
        },
      ]}
    />,
  );
  expect(screen.getByRole('heading', { level: 2, name: COPY.title })).toBeInTheDocument();
  const best = screen.getByRole('link', {
    name: `${COPY.remove('بدون رنگ')} ${COPY.count(42, true)}`,
  });
  expect(best).toHaveAttribute('href', '/search?deal=good');
  expect(screen.getByRole('link', { name: new RegExp(COPY.remove('معامله‌ی خوب یا بهتر')) })).toHaveAttribute(
    'href',
    '/search?nopaint=1',
  );
  expect(screen.getByRole('link', { name: COPY.clearAll })).toHaveAttribute('href', '/search');
});

test('a count that is only a floor reads «بیش از …»', () => {
  render(
    <NoResults
      wordsOnly={false}
      clearHref={null}
      relaxations={[{ key: 'a', text: 'قیمت', href: '/search', total: { count: 1000, exact: false } }]}
    />,
  );
  expect(screen.getByRole('link', { name: new RegExp('بیش از') })).toBeInTheDocument();
});

test('words alone that find nothing say so and have no filter to remove', () => {
  render(<NoResults wordsOnly clearHref={null} relaxations={[]} />);
  expect(screen.getByText(COPY.onlyWords)).toBeInTheDocument();
  expect(screen.queryByText(COPY.lead)).not.toBeInTheDocument();
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
