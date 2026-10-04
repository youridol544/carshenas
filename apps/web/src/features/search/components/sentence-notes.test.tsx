import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { SentenceNotes } from '@/features/search/components/sentence-notes';
import { SEARCH_COPY } from '@/features/search/search-copy';
import type { SentenceView } from '@/lib/search-sentence';
import { EMPTY_SEARCH, type Search } from '@carshenas/search/search';

// What the page says about the sentence (CS-111): quiet lines, a word left out with one tap to put it back, a reading a
// model was not sure of with one tap to add it, and the one line while a model reads more. Never a step to confirm.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// The background reading asks the route: not in this file, which is about what the page says.
vi.mock('@/features/search/components/refine-reading', () => ({
  RefineReading: ({ sentence }: { sentence: string }) => <p role="status">reading {sentence}</p>,
}));

afterEach(() => {
  router.push.mockReset();
});

const COPY = SEARCH_COPY.sentence;
const NOTHING: SentenceView = { notes: [], dropped: [], suggestions: [], refine: false, labels: {} };

function show(view: Partial<SentenceView>, options: { empty?: boolean; sentence?: string } = {}) {
  const search: Search = { filters: { make: ['pride'] } };
  return render(
    <SearchNavigationProvider search={search} sentence={options.sentence}>
      <SentenceNotes
        view={{ ...NOTHING, ...view }}
        sentence={options.sentence}
        empty={options.empty ?? false}
      />
    </SearchNavigationProvider>,
  );
}

test('says nothing when there is nothing to say', () => {
  show({});
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('says each note in one quiet line', () => {
  show({ notes: ['«اصفهان» را ندارم؛ فعلاً فقط بازار تهران در کارشناس است.', 'یک نکته‌ی دیگر'] });
  const region = screen.getByRole('region', { name: COPY.label });
  expect(region).toHaveTextContent('«اصفهان» را ندارم');
  expect(region).toHaveTextContent('یک نکته‌ی دیگر');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a word left out is said with the one tap that puts it back, and the tap searches with it', async () => {
  const user = userEvent.setup();
  const put: Search = { ...EMPTY_SEARCH, filters: { make: ['pride'] }, q: 'خوشگل' };
  show({ dropped: [{ words: 'خوشگل', put }] }, { sentence: 'پراید خوشگل' });
  expect(screen.getByRole('status')).toHaveTextContent(COPY.dropped('خوشگل'));
  // The buyer's words are their own run inside the sentence: a Latin word keeps its direction and its quotes.
  expect(screen.getByText('خوشگل', { selector: 'bdi' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: COPY.putBackName('خوشگل') }));
  expect(router.push).toHaveBeenCalledWith(
    `/search?q=${encodeURIComponent('خوشگل')}&make=pride&${new URLSearchParams({ ask: 'پراید خوشگل' }).toString()}`,
    { scroll: false },
  );
});

test('with no results the no-results panel speaks, and the left-out words are not said twice', () => {
  show({ dropped: [{ words: 'خوشگل', put: EMPTY_SEARCH }] }, { empty: true });
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('a reading a model was not sure of is a suggestion with one tap, never applied', async () => {
  const user = userEvent.setup();
  const add: Search = { filters: { make: ['pride'], paint_free: true } };
  show({ suggestions: [{ key: 'paint_free', text: 'بدون رنگ', add }] });
  await user.click(screen.getByRole('button', { name: COPY.add('بدون رنگ') }));
  expect(router.push).toHaveBeenCalledWith('/search?make=pride&nopaint=1', { scroll: false });
});

test('while a model reads more, one quiet line says so; never without a sentence', () => {
  show({ refine: true }, { sentence: 'پراید خوشگل' });
  expect(screen.getByRole('status')).toHaveTextContent('reading پراید خوشگل');
});

test('the background reading is not started for a page that has no sentence', () => {
  show({ refine: true });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
