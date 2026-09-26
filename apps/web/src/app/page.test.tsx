import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import HomePage from './page';

test('the home page names the product in a single top-level heading', () => {
  render(<HomePage />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('کارشناس');
});
