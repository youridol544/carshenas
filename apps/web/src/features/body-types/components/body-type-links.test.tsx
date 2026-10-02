import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BODY_TYPES } from '@/features/body-types/body-types';
import { BodyTypeLinks } from '@/features/body-types/components/body-type-links';

const [sedan, hatchback] = BODY_TYPES;

test('offers only the body types given, in the catalogue order, each a link to the search filtered by it', () => {
  render(
    <BodyTypeLinks
      available={[
        { code: 'hatchback', count: '۲ آگهی' },
        { code: 'sedan', count: '۳ آگهی' },
      ]}
    />,
  );
  const links = screen.getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/search?body=sedan',
    '/search?body=hatchback',
  ]);
  expect(screen.getByRole('link', { name: new RegExp(`^${sedan.labelFa}.*۳ آگهی`) })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: new RegExp(`^${hatchback.labelFa}.*۲ آگهی`) })).toBeInTheDocument();
});

test('is not shown when no body type has listings', () => {
  const { container } = render(<BodyTypeLinks available={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('ends with a tile that opens the search page for every body type', () => {
  render(
    <BodyTypeLinks
      available={[{ code: 'sedan', count: '۳ آگهی' }]}
      all={{ label: 'همه', hint: 'همه‌ی آگهی‌ها' }}
    />,
  );
  const links = screen.getAllByRole('link');
  expect(links.at(-1)).toHaveAttribute('href', '/search');
  expect(links.at(-1)).toHaveTextContent('همه');
});
