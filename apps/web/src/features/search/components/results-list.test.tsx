import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MAX_SHOWN_RESULTS, ResultsList } from '@/features/search/components/results-list';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { listingCardFixture } from '@/features/search/search-fixtures';

// The results' paging (CS-61): the first page arrives rendered, «نمایش بیشتر» asks the API for the next with the same
// parameters and the cursor, appends it without repeating a card, announces how many came, moves focus to the first of
// them, says why when a page fails and tries again, and stops offering more at the cap.

const COPY = SEARCH_COPY.results;
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
// A count is joined to its noun by a no-break space; what a test reads from the page has plain spaces.
const plain = (text: string) => text.replace(/\s+/g, ' ');
const NOW = '2026-10-02T10:00:00.000Z';

function firstPage(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index + 1}>
      <a href={`#card-${String(index + 1)}`}>{`card ${String(index + 1)}`}</a>
    </li>
  ));
}

function renderList(
  overrides: { cursor?: string | null; shown?: number; total?: { count: number; exact: boolean } } = {},
) {
  const shown = overrides.shown ?? 2;
  return render(
    <ResultsList
      query="make=peugeot"
      initialCursor={overrides.cursor === undefined ? 'cursor-1' : overrides.cursor}
      initialIds={Array.from({ length: shown }, (_, index) => index + 1)}
      total={overrides.total ?? { count: 5, exact: true }}
      pageSize={2}
      now={NOW}
    >
      {firstPage(shown)}
    </ResultsList>,
  );
}

function answer(results: ReturnType<typeof listingCardFixture>[], nextCursor: string | null) {
  return new Response(
    JSON.stringify({ results, nextCursor, total: { count: 5, exact: true }, text: null, ignored: [] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

test('shows the first page, how many are shown of how many, and the button', () => {
  renderList();
  expect(screen.getAllByRole('link', { name: /^card/ })).toHaveLength(2);
  expect(screen.getByText(plain(COPY.shown(2, COPY.count(5, true))))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: COPY.more })).toBeInTheDocument();
});

test('asks for the next page with the same search, the cursor and the page size, then appends it', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(
    answer([listingCardFixture({ id: 3 }), listingCardFixture({ id: 4 })], 'cursor-2'),
  );
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  expect(fetchMock).toHaveBeenCalledOnce();
  const [address] = fetchMock.mock.calls[0] ?? [];
  expect(address).toBe('/api/search?make=peugeot&cursor=cursor-1&limit=2');
  const list = screen.getByRole('list', { name: COPY.listLabel });
  await vi.waitFor(() => {
    expect(within(list).getAllByRole('article')).toHaveLength(2);
  });
  expect(screen.getByText(plain(COPY.shown(4, COPY.count(5, true))))).toBeInTheDocument();
  expect(screen.getByRole('button', { name: COPY.more })).toBeInTheDocument();
});

test('announces how many arrived and moves focus to the first new card', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(answer([listingCardFixture({ id: 3, url: 'https://divar.ir/v/third' })], null));
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  await vi.waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(plain(COPY.added(1)));
  });
  expect(screen.getByRole('link', { name: /\/listings\/3|پژو/ })).toHaveFocus();
});

test('the last page has no button and says the list has ended', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(answer([listingCardFixture({ id: 3 })], null));
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  await vi.waitFor(() => {
    expect(screen.queryByRole('button', { name: COPY.more })).not.toBeInTheDocument();
  });
  expect(screen.getByText(COPY.end)).toBeInTheDocument();
});

test('a card the first page already shows is not shown twice', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(answer([listingCardFixture({ id: 2 }), listingCardFixture({ id: 9 })], null));
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  await vi.waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(plain(COPY.added(1)));
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

test('a failed page keeps what is shown, says so, and the same button tries again', async () => {
  const user = userEvent.setup();
  fetchMock.mockRejectedValueOnce(new TypeError('offline'));
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  expect(await screen.findByRole('alert')).toHaveTextContent(COPY.moreFailed);
  expect(screen.getAllByRole('link', { name: /^card/ })).toHaveLength(2);
  fetchMock.mockResolvedValue(answer([listingCardFixture({ id: 3 })], null));
  await user.click(screen.getByRole('button', { name: COPY.retry }));
  await vi.waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

test('the API’s own sentence is shown when it refuses a cursor', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ message: 'این فهرست از نو باز شد.' }), { status: 400 }),
  );
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  expect(await screen.findByRole('alert')).toHaveTextContent('این فهرست از نو باز شد.');
});

test('an answer that is not a page of results is a failure, not a crash', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  expect(await screen.findByRole('alert')).toHaveTextContent(COPY.moreFailed);
});

test('past the cap the list says so and offers no more', () => {
  renderList({ shown: MAX_SHOWN_RESULTS, total: { count: 800, exact: true } });
  expect(screen.queryByRole('button', { name: COPY.more })).not.toBeInTheDocument();
  expect(screen.getByText(plain(COPY.limit(MAX_SHOWN_RESULTS)))).toBeInTheDocument();
});

test('a total that is only counted up to a cap reads «بیش از …»', () => {
  renderList({ total: { count: 1000, exact: false } });
  expect(screen.getByText(plain(COPY.shown(2, COPY.count(1000, false))))).toBeInTheDocument();
});

test('a cursor the API refuses offers a fresh first page instead of the same request again', async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ message: 'این فهرست از نو باز شد.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  );
  renderList();
  await user.click(screen.getByRole('button', { name: COPY.more }));
  expect(await screen.findByRole('alert')).toHaveTextContent('این فهرست از نو باز شد.');
  await user.click(screen.getByRole('button', { name: COPY.reopen }));
  expect(router.refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
