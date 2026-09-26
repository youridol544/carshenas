// path: src/features/lint-selftest/components/bad-test.test.tsx
// expect: testing-library/no-node-access, testing-library/prefer-user-event, vitest/no-focused-tests,
// expect: jest-dom/prefer-to-have-text-content, testing-library/no-container
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

function Counter() {
  return <button type="button">صفر</button>;
}

it.only('counts', () => {
  const { container } = render(<Counter />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  expect(button.textContent).toBe('صفر');
  expect(container.querySelector('button')).not.toBeNull();
});
