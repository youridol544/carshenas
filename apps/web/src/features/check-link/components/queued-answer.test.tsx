import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CHECK_COPY } from '@/features/check-link/check-copy';
import type { CheckAnswer } from '@/features/check-link/check-link-types';
import { QueuedAnswer } from '@/features/check-link/components/queued-answer';

// The answer for a car Carshenas reads whose ad is not read yet (CS-115): what happens and when to look again, with no
// time it cannot keep, the best deals meanwhile, and the link to all of the model's ads once, not twice.

const COPY = CHECK_COPY.queued;
const CAR = { key: 'peugeot.206', name: 'پژو ۲۰۶', href: '/models/peugeot/206' };
const DEAL = {
  id: 11,
  name: 'پژو ۲۰۶ تیپ ۵',
  modelYearSh: 1398,
  mileageKm: 120_000,
  mileageAssumed: false,
  askingPriceToman: 640_000_000,
  dealRating: null,
  priceGapPct: null,
  photoUrl: null,
};

function queued(overrides: Partial<Extract<CheckAnswer, { kind: 'queued' }>> = {}) {
  return {
    kind: 'queued',
    car: CAR,
    crawlPaused: false,
    grantedToViewer: false,
    seen: false,
    sourceUrl: null,
    suggestions: [DEAL],
    ...overrides,
  } satisfies Extract<CheckAnswer, { kind: 'queued' }>;
}

const card = () => screen.getByRole('region', { name: COPY.title });
const allOf = () => screen.getAllByRole('link', { name: COPY.allOf(CAR.name) });

test('with deals to show, the link to all of the model’s ads is the one the deals end with, and the card does not repeat it', () => {
  render(<QueuedAnswer answer={queued()} />);
  expect(allOf()).toHaveLength(1);
  const deals = screen.getByRole('region', { name: COPY.deals(CAR.name) });
  expect(within(deals).getByRole('link', { name: COPY.allOf(CAR.name) })).toHaveAttribute(
    'href',
    expect.stringMatching(/^\/search\?.*peugeot\.206/),
  );
  expect(within(card()).queryByRole('link')).not.toBeInTheDocument();
});

test('with no deals to show, the card offers the link itself, as its one action', () => {
  render(<QueuedAnswer answer={queued({ suggestions: [] })} />);
  expect(allOf()).toHaveLength(1);
  expect(within(card()).getByRole('link', { name: COPY.allOf(CAR.name) })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: COPY.deals(CAR.name) })).not.toBeInTheDocument();
});

test('it says what happens, with the car named and no time promised; while nothing is read it says that instead', () => {
  const view = render(<QueuedAnswer answer={queued()} />);
  expect(within(card()).getByText(COPY.running(CAR.name))).toBeInTheDocument();
  // No figure it cannot keep: not a number of minutes or hours, in either wording.
  expect(COPY.running('X')).not.toMatch(/[0-9۰-۹]/u);
  expect(COPY.paused('X')).not.toMatch(/[0-9۰-۹]/u);
  view.unmount();
  render(<QueuedAnswer answer={queued({ crawlPaused: true })} />);
  expect(within(card()).getByText(COPY.paused(CAR.name))).toBeInTheDocument();
});

test('a buyer whose request added the model is told so; nobody else is', () => {
  const view = render(<QueuedAnswer answer={queued({ grantedToViewer: true })} />);
  expect(within(card()).getByText(COPY.granted)).toBeInTheDocument();
  view.unmount();
  render(<QueuedAnswer answer={queued()} />);
  expect(within(card()).queryByText(COPY.granted)).not.toBeInTheDocument();
});

test('an ad we have seen offers its page on the source in a new tab, as the card’s only action when deals follow', () => {
  render(
    <QueuedAnswer answer={queued({ seen: true, sourceUrl: 'https://divar.ir/v/%D9%BE-206/gX1mAYqN' })} />,
  );
  const open = within(card()).getByRole('link', { name: new RegExp(CHECK_COPY.result.open('دیوار')) });
  expect(open).toHaveAttribute('target', '_blank');
  expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'));
  expect(within(card()).getAllByRole('link')).toHaveLength(1);
  expect(allOf()).toHaveLength(1);
});
