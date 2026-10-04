import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import { AskModel } from '@/features/check-link/components/ask-model';
import type { ModelRequest } from '@/features/check-link/check-link-types';

// «درخواست افزودن این مدل» (CS-115): what a signed-in buyer, a visitor and a buyer returning from signing in see and can do,
// and that the action is never offered once it is answered. The server action is the boundary: it is replaced, and its
// results (placed, declined, refused, signed out) are what the component is shown.

const askToAddModelAction = vi.hoisted(() => vi.fn());
vi.mock('@/features/check-link/check-link-actions', () => ({ askToAddModelAction }));

const COPY = CHECK_COPY.outside;
const LINK = 'https://divar.ir/v/%D9%BE-301/gX1mAYqN';
const MODELS = [
  { key: 'hyundai.elantra', name: 'هیوندای Elantra' },
  { key: 'hyundai.sonata', name: 'هیوندای Sonata' },
];
const NONE: ModelRequest = { status: 'none', mine: false, reason: null, fileId: null };
const NAMED = { kind: 'model', name: 'پژو ۳۰۱', request: NONE } as const;
const MAKE = { kind: 'make', models: MODELS, asked: [] } as const;

beforeEach(() => {
  askToAddModelAction.mockReset();
  window.sessionStorage.clear();
});

const ask = () => screen.getByRole('button', { name: COPY.ask });

test('a signed-in buyer presses once: the action runs with the link, and the answer shows the placed request, not the button', async () => {
  askToAddModelAction.mockResolvedValue({ status: 'asked', fileId: 7, madeFile: true });
  const user = userEvent.setup();
  render(<AskModel link={LINK} signedIn target={NAMED} />);
  await user.click(ask());
  expect(await screen.findByText(COPY.request.pending)).toBeInTheDocument();
  expect(askToAddModelAction).toHaveBeenCalledExactlyOnceWith({ link: LINK });
  expect(screen.queryByRole('button', { name: COPY.ask })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: COPY.request.file })).toHaveAttribute(
    'href',
    '/account/searches/7',
  );
});

test('a visitor is told why they must sign in, with a way in and a way to sign up that come back to this answer; nothing is asked', async () => {
  const user = userEvent.setup();
  render(<AskModel link={LINK} signedIn={false} target={NAMED} />);
  await user.click(ask());
  const group = screen.getByRole('group', { name: COPY.signIn.title });
  const signIn = screen.getByRole('link', { name: COPY.signIn.signIn });
  const signUp = screen.getByRole('link', { name: COPY.signIn.signUp });
  expect(group).toHaveTextContent(COPY.signIn.body);
  for (const link of [signIn, signUp]) {
    expect(link.getAttribute('href')).toContain(
      `next=${encodeURIComponent(`/check?link=${encodeURIComponent(LINK)}`)}`,
    );
  }
  expect(askToAddModelAction).not.toHaveBeenCalled();
  // Going to sign in or up leaves a note in this tab, which the answer they come back to places once.
  signUp.addEventListener('click', (event) => {
    event.preventDefault();
  });
  await user.click(signUp);
  expect(JSON.parse(window.sessionStorage.getItem('carshenas:ask-model') ?? 'null')).toMatchObject({
    link: LINK,
    modelKey: null,
  });
});

test('coming back signed in, the press made before is placed once, and only for the link it was made for', async () => {
  askToAddModelAction.mockResolvedValue({ status: 'asked', fileId: 9, madeFile: true });
  window.sessionStorage.setItem(
    'carshenas:ask-model',
    JSON.stringify({ link: 'https://divar.ir/v/other/abcdefgh', modelKey: null, at: Date.now() }),
  );
  const first = render(<AskModel link={LINK} signedIn target={NAMED} />);
  await waitFor(() => {
    expect(window.sessionStorage.getItem('carshenas:ask-model')).toBeNull();
  });
  expect(askToAddModelAction).not.toHaveBeenCalled();
  first.unmount();
  window.sessionStorage.setItem(
    'carshenas:ask-model',
    JSON.stringify({ link: LINK, modelKey: null, at: Date.now() }),
  );
  render(<AskModel link={LINK} signedIn target={NAMED} />);
  expect(await screen.findByText(COPY.request.pending)).toBeInTheDocument();
  expect(askToAddModelAction).toHaveBeenCalledExactlyOnceWith({ link: LINK });
});

test('a note older than half an hour places nothing', async () => {
  window.sessionStorage.setItem(
    'carshenas:ask-model',
    JSON.stringify({ link: LINK, modelKey: null, at: Date.now() - 31 * 60 * 1000 }),
  );
  render(<AskModel link={LINK} signedIn target={NAMED} />);
  await waitFor(() => {
    expect(window.sessionStorage.getItem('carshenas:ask-model')).toBeNull();
  });
  expect(askToAddModelAction).not.toHaveBeenCalled();
  expect(ask()).toBeInTheDocument();
});

test('when only the make is told the buyer must pick a model first, and the pick is what is asked', async () => {
  askToAddModelAction.mockResolvedValue({ status: 'asked', fileId: 3, madeFile: false });
  const user = userEvent.setup();
  render(<AskModel link={LINK} signedIn target={MAKE} />);
  const choose = () => screen.getByRole('button', { name: COPY.askChosen });
  await user.click(choose());
  expect(screen.getByText(COPY.chooseFirst)).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: COPY.chooser })).toHaveFocus();
  expect(askToAddModelAction).not.toHaveBeenCalled();
  await user.selectOptions(screen.getByRole('combobox', { name: COPY.chooser }), 'hyundai.sonata');
  expect(screen.queryByText(COPY.chooseFirst)).not.toBeInTheDocument();
  await user.click(choose());
  expect(await screen.findByText(COPY.request.pending)).toBeInTheDocument();
  expect(askToAddModelAction).toHaveBeenCalledExactlyOnceWith({ link: LINK, modelKey: 'hyundai.sonata' });
});

test('when only the make is told, the models already asked for are shown with their state and are not offered again', async () => {
  askToAddModelAction.mockResolvedValue({ status: 'asked', fileId: 4, madeFile: true });
  const asked = [
    {
      key: 'hyundai.elantra',
      name: 'هیوندای Elantra',
      request: { status: 'pending', mine: true, reason: null, fileId: 8 },
    },
  ] as const;
  const user = userEvent.setup();
  render(
    <AskModel
      link={LINK}
      signedIn
      target={{ kind: 'make', models: [{ key: 'hyundai.sonata', name: 'هیوندای Sonata' }], asked }}
    />,
  );
  expect(screen.getByText('هیوندای Elantra')).toBeInTheDocument();
  expect(screen.getByText(COPY.request.pending)).toBeInTheDocument();
  const chooser = screen.getByRole('combobox', { name: COPY.chooser });
  expect(chooser.querySelectorAll('option')).toHaveLength(2);
  await user.selectOptions(chooser, 'hyundai.sonata');
  await user.click(screen.getByRole('button', { name: COPY.askChosen }));
  expect(await screen.findAllByText(COPY.request.pending)).toHaveLength(2);
  // Every model of the make is answered: nothing is offered, no chooser and no button.
  expect(screen.queryByRole('combobox', { name: COPY.chooser })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: COPY.askChosen })).not.toBeInTheDocument();
});

test('a request already placed shows its state and the file, and offers nothing; so does an accepted one', () => {
  const asked: ModelRequest = { status: 'pending', mine: true, reason: null, fileId: 5 };
  const view = render(<AskModel link={LINK} signedIn target={{ ...NAMED, request: asked }} />);
  expect(screen.getByText(COPY.request.pending)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: COPY.ask })).not.toBeInTheDocument();
  view.unmount();
  render(<AskModel link={LINK} signedIn target={{ ...NAMED, request: { ...asked, status: 'approved' } }} />);
  expect(screen.getByText(COPY.request.approved)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: COPY.ask })).not.toBeInTheDocument();
});

test('a declined request shows its reason to anyone and offers nothing', () => {
  const declined: ModelRequest = {
    status: 'declined',
    mine: false,
    reason: 'خارج از بازار تهران',
    fileId: null,
  };
  render(<AskModel link={LINK} signedIn={false} target={{ ...NAMED, request: declined }} />);
  expect(screen.getByText(new RegExp(COPY.request.declined))).toBeInTheDocument();
  expect(screen.getByText(new RegExp('خارج از بازار تهران'))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: COPY.ask })).not.toBeInTheDocument();
});

test('a failure that trying again can help is said in a message with a way to try again that asks again', async () => {
  askToAddModelAction.mockResolvedValueOnce({ status: 'refused', message: COPY.errors.slow, retry: true });
  askToAddModelAction.mockResolvedValueOnce({ status: 'asked', fileId: 2, madeFile: true });
  const user = userEvent.setup();
  render(<AskModel link={LINK} signedIn target={NAMED} />);
  await user.click(ask());
  expect(await screen.findByText(COPY.errors.slow)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: COPY.errors.retry }));
  expect(await screen.findByText(COPY.request.pending)).toBeInTheDocument();
  expect(askToAddModelAction).toHaveBeenCalledTimes(2);
});

test('a limit of the account is said where the note was, with no way to try again, and the button stays', async () => {
  askToAddModelAction.mockResolvedValue({
    status: 'refused',
    message: COPY.errors.accountLimit,
    retry: false,
  });
  const user = userEvent.setup();
  render(<AskModel link={LINK} signedIn target={NAMED} />);
  await user.click(ask());
  // The count keeps its word through a no-break space, which Testing Library's own normalising of the page turns into a space.
  const spaced = (text: string) => text.replace(/\s+/g, ' ');
  expect(
    await screen.findByText((content) => spaced(content) === spaced(COPY.errors.accountLimit)),
  ).toBeInTheDocument();
  expect(screen.queryByText(COPY.answerComes)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: COPY.errors.retry })).not.toBeInTheDocument();
  expect(ask()).toBeInTheDocument();
});
