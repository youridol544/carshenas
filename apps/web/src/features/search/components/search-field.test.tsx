import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { SearchField } from '@/features/search/components/search-field';
import { SearchNavigationProvider } from '@/features/search/components/search-navigation';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { ASK_FAILED_MESSAGE, type AskState } from '@/lib/search-sentence';
import type { AskAction } from '@/lib/use-sentence-form';
import { EMPTY_SEARCH, type Search } from '@carshenas/search/search';

// The search box (CS-61, CS-111): one box for a sentence, a word or a link. Enter or the one button hands the text to the
// action the route gives, which answers with the address of the results, and the page goes there; the box shows the
// sentence the address keeps (or the words the address searches), a draft survives every change that is not to the
// sentence, and the clear button hands focus back to the box instead of dropping it to the top of the page.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

afterEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
});

const BAR = SEARCH_COPY.bar;

const FOUND: AskState = { status: 'found', href: '/search?make=pride&ask=%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF' };

/** An action that answers at once and remembers what it was sent. */
function recordingAsk(answer: AskState = FOUND) {
  const asked: { ask: string; by: string }[] = [];
  const ask: AskAction = (_previous, formData) => {
    const text = (name: string) => {
      const value = formData.get(name);
      return typeof value === 'string' ? value : '';
    };
    asked.push({ ask: text('ask'), by: text('by') });
    return Promise.resolve(answer);
  };
  return { ask, asked };
}

function Page({
  search = EMPTY_SEARCH,
  sentence,
  ask,
}: {
  search?: Search;
  sentence?: string;
  ask: AskAction;
}) {
  return (
    <SearchNavigationProvider search={search} sentence={sentence}>
      <SearchField ask={ask} />
    </SearchNavigationProvider>
  );
}

test('Enter hands the sentence to the action, and the page goes to the address it answers with', async () => {
  const user = userEvent.setup();
  const { ask, asked } = recordingAsk();
  render(<Page ask={ask} />);
  await user.type(screen.getByRole('searchbox', { name: BAR.label }), 'پژو ۲۰۶ زیر ۷۰۰ میلیون{Enter}');
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledTimes(1);
  });
  // The script says it is the one that sent it, so the server answers with the address instead of redirecting.
  expect(asked).toEqual([{ ask: 'پژو ۲۰۶ زیر ۷۰۰ میلیون', by: 'script' }]);
  expect(router.push).toHaveBeenCalledWith('/search?make=pride&ask=%D9%BE%D8%B1%D8%A7%DB%8C%D8%AF', {
    scroll: false,
  });
});

test('the one button asks too, and it is the only button that submits', async () => {
  const user = userEvent.setup();
  const { ask, asked } = recordingAsk();
  render(<Page ask={ask} />);
  await user.type(screen.getByRole('searchbox', { name: BAR.label }), 'پراید');
  await user.click(screen.getByRole('button', { name: BAR.submit }));
  await waitFor(() => {
    expect(asked.map((one) => one.ask)).toEqual(['پراید']);
  });
  const submitters = screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('type') === 'submit');
  expect(submitters).toHaveLength(1);
});

test('the box shows the sentence the address keeps', () => {
  const { ask } = recordingAsk();
  render(<Page ask={ask} sentence="پژو ۲۰۶ بدون رنگ" search={{ filters: { paint_free: true } }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveValue('پژو ۲۰۶ بدون رنگ');
});

test('an address with words and no sentence (an old link) shows its words', () => {
  const { ask } = recordingAsk();
  render(<Page ask={ask} search={{ ...EMPTY_SEARCH, q: 'سمند' }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveValue('سمند');
});

test('clearing empties the box, keeps focus in it and lets go of the sentence the address kept', async () => {
  const user = userEvent.setup();
  const { ask } = recordingAsk();
  render(<Page ask={ask} sentence="سمند" search={{ filters: { deal: 'good' } }} />);
  await user.click(screen.getByRole('button', { name: BAR.clear }));
  // The mocked router never changes the address, so the box returns to the applied sentence; the real one follows it.
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveFocus();
  expect(router.replace).toHaveBeenCalledWith('/search?deal=good', { scroll: false });
  expect(router.push).not.toHaveBeenCalled();
});

test('clearing words that were only typed changes nothing in the address', async () => {
  const user = userEvent.setup();
  const { ask } = recordingAsk();
  render(<Page ask={ask} />);
  await user.type(screen.getByRole('searchbox', { name: BAR.label }), 'پژو');
  await user.click(screen.getByRole('button', { name: BAR.clear }));
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveFocus();
  expect(router.replace).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

test('an empty box asks nothing, and only lets go of the sentence the address kept', async () => {
  const user = userEvent.setup();
  const { ask, asked } = recordingAsk();
  render(<Page ask={ask} sentence="سمند" search={{ filters: { deal: 'good' } }} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.clear(box);
  await user.type(box, '{Enter}');
  expect(asked).toEqual([]);
  expect(router.replace).toHaveBeenCalledWith('/search?deal=good', { scroll: false });
});

test('new applied text replaces the text without replacing the box, and a draft survives other changes', async () => {
  const user = userEvent.setup();
  const { ask } = recordingAsk();
  const { rerender } = render(<Page ask={ask} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'پراید');
  // Something else changed (a filter), the sentence did not: the draft stays.
  rerender(<Page ask={ask} search={{ filters: { deal: 'good' } }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toHaveValue('پراید');
  // The sentence changed (Back, a new search): the same box shows it.
  rerender(<Page ask={ask} sentence="تیبا" search={{ filters: { deal: 'good' } }} />);
  expect(screen.getByRole('searchbox', { name: BAR.label })).toBe(box);
  expect(box).toHaveValue('تیبا');
});

test('a Divar link turns the button into the link check and goes to its answer, never to the action', async () => {
  const user = userEvent.setup();
  const { ask, asked } = recordingAsk();
  render(<Page ask={ask} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'https://divar.ir/v/پژو-۲۰۶/AbCdEf12{Enter}');
  expect(screen.getByRole('button', { name: BAR.checkLink })).toBeInTheDocument();
  expect(screen.getByText(BAR.linkHint)).toBeInTheDocument();
  expect(asked).toEqual([]);
  expect(router.push).toHaveBeenCalledTimes(1);
  const [href] = router.push.mock.calls[0] as [string];
  // The ad's title stays in the address (digits as Latin ones): the answer reads the car from it (CS-115).
  expect(href).toBe(
    `/check?link=${encodeURIComponent(`https://divar.ir/v/${encodeURIComponent('پژو-206')}/AbCdEf12`)}`,
  );
});

test('a failed reading is said for that sentence only, and typing again clears it', async () => {
  const user = userEvent.setup();
  const { ask } = recordingAsk({ status: 'failed', message: 'جست‌وجو انجام نشد', sentence: 'پراید' });
  render(<Page ask={ask} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'پراید{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('جست‌وجو انجام نشد');
  expect(box).toHaveValue('پراید');
  expect(router.push).not.toHaveBeenCalled();
  await user.type(box, ' ۱۳۱');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a request that never arrives is said under the box like any failure, and nothing reaches an error screen', async () => {
  const user = userEvent.setup();
  const ask: AskAction = () => Promise.reject(new TypeError('Failed to fetch'));
  render(<Page ask={ask} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'پراید{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent(ASK_FAILED_MESSAGE);
  expect(box).toHaveValue('پراید');
  expect(router.push).not.toHaveBeenCalled();
});

test('a second press while the first is on its way asks nothing more', async () => {
  const user = userEvent.setup();
  const asked: string[] = [];
  const ask: AskAction = () => {
    asked.push('asked');
    return new Promise<AskState>(() => undefined);
  };
  render(<Page ask={ask} />);
  const box = screen.getByRole('searchbox', { name: BAR.label });
  await user.type(box, 'پراید{Enter}');
  await waitFor(() => {
    expect(asked).toHaveLength(1);
  });
  await user.type(box, '{Enter}');
  await user.click(screen.getByRole('button', { name: BAR.submit }));
  expect(asked).toHaveLength(1);
});
