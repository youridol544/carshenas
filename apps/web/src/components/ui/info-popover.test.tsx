import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { InfoPopover, type InfoContent } from '@/components/ui/info-popover';

// The info control (the owner's request of 2026-10-01): a button with a Farsi name that opens a popover with the words it
// is given, and closes with Escape. Hovering is for a mouse and is covered in the browser tests.

const NAME = 'توضیح درباره‌ی «کم‌کارکرد»';
const CLOSE = 'بستن توضیح';
const CONTENT: InfoContent = {
  title: 'کم‌کارکرد',
  sections: [
    { id: 'what', paragraphs: ['خودرویی که کمتر از معمول کار کرده است.'] },
    { id: 'rule', heading: 'معیار دقیق', paragraphs: ['حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو.'] },
    { id: 'rows', heading: 'گزینه‌ها', rows: [{ label: 'عالی', text: 'دست‌کم ۱۰٪ کمتر از ارزش بازار' }] },
  ],
};

function renderInfo() {
  return render(<InfoPopover label={NAME} closeLabel={CLOSE} content={CONTENT} />);
}

test('is a button with a Farsi name, and nothing is shown until it is pressed', () => {
  renderInfo();
  expect(screen.getByRole('button', { name: NAME })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a tap opens the explanation: its title, each section and each row', async () => {
  const user = userEvent.setup();
  renderInfo();
  await user.click(screen.getByRole('button', { name: NAME }));
  const popup = await screen.findByRole('dialog', { name: CONTENT.title });
  expect(popup).toHaveTextContent('خودرویی که کمتر از معمول کار کرده است.');
  expect(popup).toHaveTextContent('معیار دقیق');
  expect(popup).toHaveTextContent('حداکثر ۱۲٬۰۰۰ کیلومتر برای هر سال عمر خودرو.');
  expect(popup).toHaveTextContent('عالی');
  expect(popup).toHaveTextContent('دست‌کم ۱۰٪ کمتر از ارزش بازار');
});

test('Escape closes it and focus goes back to the button', async () => {
  const user = userEvent.setup();
  renderInfo();
  const button = screen.getByRole('button', { name: NAME });
  await user.click(button);
  await screen.findByRole('dialog', { name: CONTENT.title });
  await user.keyboard('{Escape}');
  await waitForClosed();
  expect(button).toHaveFocus();
});

test('the close button closes it too', async () => {
  const user = userEvent.setup();
  renderInfo();
  await user.click(screen.getByRole('button', { name: NAME }));
  await user.click(await screen.findByRole('button', { name: CLOSE }));
  await waitForClosed();
  expect(screen.getByRole('button', { name: NAME })).toHaveFocus();
});

async function waitForClosed() {
  await vi.waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}
