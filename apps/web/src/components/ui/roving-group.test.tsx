import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { RovingGroup } from '@/components/ui/roving-group';

// A group of controls that is one Tab stop (WAI-ARIA's toolbar): the first item has the stop, the arrow keys move along
// the group, in a right-to-left page the left arrow to the next, and Home and End jump to the ends.

function renderGroup(direction: 'ltr' | 'rtl') {
  return render(
    <div dir={direction} style={{ direction }}>
      <button type="button">before</button>
      <RovingGroup label="مجموعه‌ها">
        <a href="/one" data-roving-item="">
          one
        </a>
        <button type="button" data-roving-item="">
          two
        </button>
        <a href="/three" data-roving-item="">
          three
        </a>
      </RovingGroup>
      <button type="button">after</button>
    </div>,
  );
}

test('is a toolbar with a name, and only its first item is a Tab stop', () => {
  renderGroup('ltr');
  expect(screen.getByRole('toolbar', { name: 'مجموعه‌ها' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'one' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('button', { name: 'two' })).toHaveAttribute('tabindex', '-1');
  expect(screen.getByRole('link', { name: 'three' })).toHaveAttribute('tabindex', '-1');
});

test('Tab goes through the group in one stop', async () => {
  const user = userEvent.setup();
  renderGroup('ltr');
  await user.tab();
  expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('link', { name: 'one' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
});

test('the right arrow moves to the next item in a left-to-right page, and the stop follows focus', async () => {
  const user = userEvent.setup();
  renderGroup('ltr');
  await user.tab();
  await user.tab();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'two' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('link', { name: 'one' })).toHaveAttribute('tabindex', '-1');
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('link', { name: 'one' })).toHaveFocus();
});

test('in a right-to-left page the left arrow is the next item, and Home and End jump to the ends', async () => {
  const user = userEvent.setup();
  renderGroup('rtl');
  await user.tab();
  await user.tab();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
  await user.keyboard('{End}');
  expect(screen.getByRole('link', { name: 'three' })).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('link', { name: 'three' })).toHaveFocus();
  await user.keyboard('{Home}');
  expect(screen.getByRole('link', { name: 'one' })).toHaveFocus();
});

test('coming back to the group lands on the item that had focus last', async () => {
  const user = userEvent.setup();
  renderGroup('ltr');
  await user.tab();
  await user.tab();
  await user.keyboard('{ArrowRight}');
  await user.tab();
  expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
});
