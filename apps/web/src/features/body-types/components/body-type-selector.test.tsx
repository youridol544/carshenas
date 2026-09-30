import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BODY_TYPES } from '@/features/body-types/body-types';
import { BodyTypeSelector } from '@/features/body-types/components/body-type-selector';

const [sedan, hatchback] = BODY_TYPES;

test('offers only the body types that have listings, in the catalogue order', () => {
  render(<BodyTypeSelector available={['hatchback', 'sedan']} name="body-type" legend="بدنه" />);
  const radios = screen.getAllByRole('radio');
  expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['sedan', 'hatchback']);
  expect(screen.getByRole('radio', { name: sedan.labelFa })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: hatchback.labelFa })).toBeInTheDocument();
});

test('is not shown when no body type has listings', () => {
  const { container } = render(<BodyTypeSelector available={[]} name="body-type" legend="بدنه" />);
  expect(container).toBeEmptyDOMElement();
});

test('starts on the body type it is given', () => {
  render(<BodyTypeSelector available={['sedan', 'suv']} name="body-type" legend="بدنه" defaultValue="suv" />);
  expect(screen.getByRole('radio', { name: BODY_TYPES[3].labelFa })).toBeChecked();
});
