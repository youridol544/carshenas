import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { HeroSearch } from '@/features/home/components/hero-search';
import { HOME_COPY } from '@/features/home/home-copy';
import { ASK_FAILED_MESSAGE, type AskState } from '@/lib/search-sentence';

// The hero's search box (CS-63, CS-111): one box, one button, the example sentences under it submit by themselves, and
// the buyer lands on the address the server's action answers with. The action is the server's, stubbed here with what it
// would answer; what it reads and settles is tested with it (search-understanding-actions.test.ts).

const router = vi.hoisted(() => ({ push: vi.fn() }));
const action = vi.hoisted(() => ({ ask: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/search-understanding/search-understanding-actions', () => ({
  askSearchAction: action.ask,
}));

const COPY = HOME_COPY.hero;
const HREF = '/search?make=pride&ask=x';
const FOUND: AskState = { status: 'found', href: HREF };

afterEach(() => {
  router.push.mockReset();
  action.ask.mockReset();
});

/** What the action was sent, as the page's script sends it: the fields of the form and the mark that says it is the script. */
function sent(call: number): { ask: string | null; example: string | null; by: string | null } {
  const [, form] = action.ask.mock.calls[call] as [AskState, FormData];
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };
  return { ask: read('ask'), example: read('example'), by: read('by') };
}

test('Enter sends the typed sentence, and the page goes to the address the action answers with', async () => {
  action.ask.mockResolvedValue(FOUND);
  const user = userEvent.setup();
  render(<HeroSearch />);
  await user.type(screen.getByRole('searchbox', { name: COPY.searchLabel }), 'پراید زیر ۲۰۰ میلیون{Enter}');
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith(HREF);
  });
  // Enter presses the one button, never an example chip: the example field is not part of what was sent.
  expect(sent(0)).toEqual({ ask: 'پراید زیر ۲۰۰ میلیون', example: null, by: 'script' });
  expect(action.ask).toHaveBeenCalledTimes(1);
});

test('the one button does the same as Enter', async () => {
  action.ask.mockResolvedValue(FOUND);
  const user = userEvent.setup();
  render(<HeroSearch />);
  await user.type(screen.getByRole('searchbox', { name: COPY.searchLabel }), 'پراید');
  await user.click(screen.getByRole('button', { name: COPY.submit }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledTimes(1);
  });
  expect(sent(0).ask).toBe('پراید');
});

test('an example chip submits at once, puts its sentence in the box, and sends it as the example', async () => {
  action.ask.mockResolvedValue(FOUND);
  const user = userEvent.setup();
  render(<HeroSearch />);
  const [first] = COPY.examples;
  await user.click(screen.getByRole('button', { name: first }));
  await waitFor(() => {
    expect(router.push).toHaveBeenCalledTimes(1);
  });
  // The chip's own sentence is what is sent as the example, which the action reads before the box's text.
  expect(sent(0)).toMatchObject({ example: first, by: 'script' });
  expect(screen.getByRole('searchbox', { name: COPY.searchLabel })).toHaveValue(first);
});

test('the form has one button of its own, then the examples; no second step', () => {
  render(<HeroSearch />);
  const form = screen.getByRole('search');
  const buttons = within(form).getAllByRole('button');
  expect(buttons.map((button) => button.textContent)).toEqual([COPY.submit, ...COPY.examples]);
  expect(buttons.every((button) => button.getAttribute('type') === 'submit')).toBe(true);
  expect(within(form).getByRole('list', { name: COPY.examplesLabel })).toBeInTheDocument();
});

test('a failure is said for that sentence only, the sentence stays, and typing again clears it', async () => {
  action.ask.mockResolvedValue({ status: 'failed', message: ASK_FAILED_MESSAGE, sentence: 'پراید' });
  const user = userEvent.setup();
  render(<HeroSearch />);
  const box = screen.getByRole('searchbox', { name: COPY.searchLabel });
  await user.type(box, 'پراید{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent(ASK_FAILED_MESSAGE);
  expect(box).toHaveValue('پراید');
  expect(router.push).not.toHaveBeenCalled();
  await user.type(box, ' ۱۳۱');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a second press while the first is on its way sends nothing more', async () => {
  action.ask.mockReturnValue(new Promise<AskState>(() => undefined));
  const user = userEvent.setup();
  render(<HeroSearch />);
  const box = screen.getByRole('searchbox', { name: COPY.searchLabel });
  await user.type(box, 'پراید{Enter}');
  await waitFor(() => {
    expect(action.ask).toHaveBeenCalledTimes(1);
  });
  await user.type(box, '{Enter}');
  await user.click(screen.getByRole('button', { name: COPY.submit }));
  expect(action.ask).toHaveBeenCalledTimes(1);
});
