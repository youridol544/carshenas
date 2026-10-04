import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RefineReading } from '@/features/search/components/refine-reading';
import { SEARCH_COPY } from '@/features/search/search-copy';

// The model reading what the code could not, in the background (CS-111, ADR-0043): the page has shown the code's results
// already; this asks the route once for the sentence, replaces the address when a model read more, and goes quiet. The
// route is stubbed, so no test reaches a language model.

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const fetchMock = vi.hoisted(() => ({ fn: vi.fn() }));

function answer(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(Response.json(body, { status }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock.fn);
  window.history.replaceState({}, '', '/search?make=pride&ask=%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF');
});

afterEach(() => {
  fetchMock.fn.mockReset();
  router.replace.mockReset();
  vi.unstubAllGlobals();
});

test('says in one quiet line that the rest of the sentence is being read, and goes quiet when it is done', async () => {
  fetchMock.fn.mockReturnValue(answer({ mode: 'with_model', href: '/search?make=pride&ask=a1' }));
  render(<RefineReading sentence="a1" />);
  expect(screen.getByRole('status')).toHaveTextContent(SEARCH_COPY.sentence.reading);
  await waitFor(() => {
    expect(screen.getByRole('status')).not.toHaveTextContent(SEARCH_COPY.sentence.reading);
  });
});

test('asks the route with the sentence, and replaces the address when the reading leads to another', async () => {
  fetchMock.fn.mockReturnValue(answer({ mode: 'with_model', href: '/search?make=pride&nopaint=1&ask=a2' }));
  render(<RefineReading sentence="a2" />);
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledWith('/search?make=pride&nopaint=1&ask=a2', { scroll: false });
  });
  const [url, init] = fetchMock.fn.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/search/understand');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({ q: 'a2' });
});

test('leaves the address alone when the model read nothing more', async () => {
  fetchMock.fn.mockReturnValue(answer({ href: '/search?make=pride&ask=%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF' }));
  render(<RefineReading sentence="a3" />);
  await waitFor(() => {
    expect(screen.getByRole('status')).not.toHaveTextContent(SEARCH_COPY.sentence.reading);
  });
  expect(router.replace).not.toHaveBeenCalled();
});

test('asks only once for a sentence, however many times it is shown', async () => {
  fetchMock.fn.mockReturnValue(answer({ href: '/search?make=pride&nopaint=1&ask=a4' }));
  const { rerender } = render(<RefineReading sentence="a4" />);
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
  rerender(<RefineReading sentence="a4" />);
  rerender(<RefineReading sentence="a5" />);
  rerender(<RefineReading sentence="a4" />);
  expect(
    fetchMock.fn.mock.calls.filter(([, init]) => (init as RequestInit).body === '{"q":"a4"}'),
  ).toHaveLength(1);
});

test('an answer that comes after the buyer has gone on is dropped', async () => {
  let release: (response: Response) => void = () => undefined;
  fetchMock.fn.mockReturnValue(
    new Promise<Response>((resolve) => {
      release = resolve;
    }),
  );
  const { unmount } = render(<RefineReading sentence="a6" />);
  unmount();
  release(Response.json({ href: '/search?make=pride&nopaint=1&ask=a6' }));
  await Promise.resolve();
  await Promise.resolve();
  expect(router.replace).not.toHaveBeenCalled();
});

test('a question that fails, or an answer that is not an address of this page, changes nothing', async () => {
  fetchMock.fn.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));
  const { unmount } = render(<RefineReading sentence="a7" />);
  await waitFor(() => {
    expect(screen.getByRole('status')).not.toHaveTextContent(SEARCH_COPY.sentence.reading);
  });
  unmount();
  fetchMock.fn.mockReturnValueOnce(answer({ href: 'https://example.com/search?x=1' }));
  render(<RefineReading sentence="a8" />);
  await waitFor(() => {
    expect(screen.getByRole('status')).not.toHaveTextContent(SEARCH_COPY.sentence.reading);
  });
  fetchMock.fn.mockReturnValueOnce(answer({ message: 'no' }, 400));
  render(<RefineReading sentence="a9" />);
  await waitFor(() => {
    expect(fetchMock.fn).toHaveBeenCalledTimes(3);
  });
  expect(router.replace).not.toHaveBeenCalled();
});
