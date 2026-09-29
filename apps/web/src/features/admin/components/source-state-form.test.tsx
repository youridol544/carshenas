import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { changeSourceStateAction } from '@/features/admin/admin-actions';
import { SOURCE_STATE_RESULT, SOURCES_COPY } from '@/features/admin/admin-copy';
import type { ChangeSourceStateState } from '@/features/admin/admin-types';
import { SourceStateForm } from '@/features/admin/components/source-state-form';

// The source state form on its own (CS-40): what it sends, what a pending answer looks like, and what the status line
// says. The action is replaced by one whose answer the test releases.

vi.mock('@/features/admin/admin-actions', () => ({ changeSourceStateAction: vi.fn() }));

const action = vi.mocked(changeSourceStateAction);

/** The status line is always there, one line tall, so an answer is its text once the answer has arrived. */
async function expectAnswer(text: string): Promise<void> {
  await vi.waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });
}

function heldAnswer() {
  let release: (state: ChangeSourceStateState) => void = () => undefined;
  const answer = new Promise<ChangeSourceStateState>((resolve) => {
    release = resolve;
  });
  return { answer, release };
}

function renderForm(
  crawlState: 'enabled' | 'paused' | 'stopped_on_block',
  stoppedAtText: string | null = null,
) {
  return render(
    <>
      <h2 id="source-divar">دیوار</h2>
      <SourceStateForm
        sourceId="divar"
        crawlState={crawlState}
        stoppedAtText={stoppedAtText}
        headingId="source-divar"
      />
    </>,
  );
}

test('pausing sends what the page showed and the chosen state, and a second press while it waits sends nothing', async () => {
  const user = userEvent.setup();
  const { answer, release } = heldAnswer();
  action.mockReturnValueOnce(answer);
  renderForm('enabled');
  const button = screen.getByRole('button', { name: SOURCES_COPY.pause, description: 'دیوار' });

  await user.click(button);
  await vi.waitFor(() => {
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
  expect(button).toHaveAttribute('data-pending');
  expect(button).toHaveTextContent(SOURCES_COPY.pause);
  await user.click(button);
  expect(action).toHaveBeenCalledOnce();
  const sent = action.mock.calls[0]?.[1];
  expect(Object.fromEntries(sent?.entries() ?? [])).toEqual({
    sourceId: 'divar',
    seenState: 'enabled',
    seenStoppedAt: '',
    chosen: 'paused',
  });

  release({ status: 'changed', submission: 1, chosen: 'paused' });
  await expectAnswer(SOURCE_STATE_RESULT.changed.paused);
  expect(button).toHaveAttribute('aria-disabled', 'false');
});

test('a stopped source resumes with the stop the page showed, and each answer has its words', async () => {
  const user = userEvent.setup();
  action.mockResolvedValueOnce({ status: 'stale', submission: 2, chosen: 'enabled' });
  renderForm('stopped_on_block', '2026-09-29 13:13:44.123456+00');

  await user.click(screen.getByRole('button', { name: SOURCES_COPY.resume }));
  expect(Object.fromEntries(action.mock.calls[0]?.[1].entries() ?? [])).toMatchObject({
    seenState: 'stopped_on_block',
    seenStoppedAt: '2026-09-29 13:13:44.123456+00',
    chosen: 'enabled',
  });
  await expectAnswer(SOURCE_STATE_RESULT.stale);
});

test('a database that did not answer is said in the status line', async () => {
  const user = userEvent.setup();
  action.mockResolvedValueOnce({ status: 'failed', submission: 3, chosen: 'enabled' });
  renderForm('paused');
  await user.click(screen.getByRole('button', { name: SOURCES_COPY.resume }));
  expect(action).toHaveBeenCalledOnce();
  await expectAnswer(SOURCE_STATE_RESULT.failed);
});
