import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import HomePage from './page';

// The streamed parts read the database; the page's own shape (the hero, the three steps, the closing action) does not.
vi.mock('@/features/home/components/home-browse', () => ({
  HomeBrowse: () => null,
  HomeBrowseSkeleton: () => null,
}));
vi.mock('@/features/home/components/trust-figures', () => ({
  TrustFigures: () => null,
  TrustFiguresSkeleton: () => null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

test('the home page has one top-level heading, the motto, and the search box in its hero', () => {
  render(<HomePage />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ماشین درست را با قیمت درست بخرید');
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
});
