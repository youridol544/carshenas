import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ListingCard, ListingCardSkeleton } from '@/features/search/components/listing-card';
import { SEARCH_COPY } from '@/features/search/search-copy';
import { listingCardFixture, thinListingCardFixture } from '@/features/search/search-fixtures';

// A result card (CS-61): what it shows, where it leads, and its states: a photo that is not there or does not load, no
// rating, no price, a listing only seen in a list. Layout is measured in the browser tests; here only what is said.

const COPY = SEARCH_COPY.card;
const NOW = '2026-10-02T10:00:00.000Z';
const plain = (text: string | null) => (text ?? '').replace(/\s+/g, ' ');

// The amounts are laid out in pieces (so a long one wraps at its thousands marks); the test reads them whole.
function amount(whole: string) {
  return screen.getByText(
    (_, element) =>
      element?.getAttribute('data-slot') === 'numeric-text' && plain(element.textContent) === whole,
  );
}

test('says the car, its price in full digits, its deal and the gap, its facts, its place and its source', () => {
  render(<ListingCard card={listingCardFixture()} now={NOW} />);
  // The title's trim name is written with Latin digits in the catalogue and shown with Persian ones.
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('پژو ۲۰۶ تیپ ۵، مدل ۱۳۹۵');
  expect(amount('۹۶۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
  expect(amount('۱٬۲۲۰٬۰۰۰٬۰۰۰ تومان،')).toBeInTheDocument();
  expect(screen.getByText('معامله‌ی عالی')).toBeInTheDocument();
  expect(screen.getByText(/زیر ارزش بازار/)).toBeInTheDocument();
  expect(screen.getByText(/۲۷۰٬۰۰۰/)).toBeInTheDocument();
  expect(screen.getByText('تهران، خانی آباد نو')).toBeInTheDocument();
  expect(screen.getByText('دیوار')).toBeInTheDocument();
  expect(screen.getByText(/بدون رنگ/)).toBeInTheDocument();
});

// The card's own link is the one that says it leads to the listing: the card also holds a small link to the model's page
// (CS-67), which sits above the stretched link and has its own name.
const listingLinkOf = () => screen.getByRole('link', { name: new RegExp(COPY.viewPage) });

test('the whole card is one link to the listing’s own page, in the same tab, and its name says so', () => {
  render(<ListingCard card={listingCardFixture({ id: 4321, url: 'https://divar.ir/v/abc' })} now={NOW} />);
  const link = listingLinkOf();
  expect(link).toHaveAttribute('href', '/listings/4321');
  expect(link).not.toHaveAttribute('target');
  expect(link).toHaveAccessibleName(expect.stringContaining(COPY.viewPage));
  expect(link.getAttribute('aria-label')).not.toContain(COPY.opensInNewTab);
});

test('a card does not depend on the source’s address: the listing page holds the click-out', () => {
  render(<ListingCard card={listingCardFixture({ url: '' })} now={NOW} />);
  expect(listingLinkOf()).toHaveAttribute('href', '/listings/1');
});

test('the card has a second, small link to the page of its model, named for the model, and the model page itself can leave it out', () => {
  const card = listingCardFixture();
  const { unmount } = render(<ListingCard card={card} now={NOW} />);
  const model = screen.getByRole('link', { name: new RegExp(COPY.modelPage) });
  expect(model).toHaveAttribute('href', `/models/${card.model?.key.replace('.', '/') ?? ''}`);
  expect(model).toHaveAccessibleName(COPY.modelPageOf(card.model?.name ?? ''));
  unmount();
  render(<ListingCard card={card} now={NOW} modelLink={false} />);
  expect(screen.queryByRole('link', { name: new RegExp(COPY.modelPage) })).not.toBeInTheDocument();
});

test('the photo comes from the source’s own address, with no referrer, and is not described twice', () => {
  render(<ListingCard card={listingCardFixture()} now={NOW} eager />);
  // An image with an empty description is presentational: the title and the facts already say what the card is.
  const photo = screen.getByRole('presentation');
  // The test environment has no Next.js config, so the address goes through the image route here; the build's
  // images.unoptimized (and the request the browser makes) is asserted in the browser test.
  expect(decodeURIComponent(photo.getAttribute('src') ?? '')).toContain(
    'https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/a/b.webp',
  );
  expect(photo).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(photo).toHaveAttribute('alt', '');
  expect(photo).toHaveAttribute('loading', 'eager');
});

test('a listing with no photo shows the placeholder in the same frame', () => {
  render(<ListingCard card={listingCardFixture({ photo: null })} now={NOW} />);
  expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  expect(screen.getByText(COPY.noPhoto)).toBeInTheDocument();
});

test('a photo that does not load gives way to the placeholder', () => {
  render(<ListingCard card={listingCardFixture()} now={NOW} />);
  fireEvent.error(screen.getByRole('presentation'));
  expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  expect(screen.getByText(COPY.noPhoto)).toBeInTheDocument();
});

test('a priced listing the valuation did not rate wears the neutral badge and no gap', () => {
  render(<ListingCard card={listingCardFixture({ valuation: null })} now={NOW} />);
  expect(screen.getByText(COPY.unrated)).toBeInTheDocument();
  expect(screen.queryByText(/زیر ارزش بازار/)).not.toBeInTheDocument();
});

test('a negotiable listing says so and has no badge', () => {
  render(
    <ListingCard
      card={listingCardFixture({ priceType: 'negotiable', askingPriceToman: null, valuation: null })}
      now={NOW}
    />,
  );
  expect(screen.getByText(COPY.negotiable)).toBeInTheDocument();
  expect(screen.queryByText(COPY.unrated)).not.toBeInTheDocument();
  expect(screen.queryByText('معامله‌ی عالی')).not.toBeInTheDocument();
});

test('a listing only seen in a list says where to read the rest', () => {
  render(<ListingCard card={thinListingCardFixture()} now={NOW} />);
  expect(screen.getByText(COPY.thinHint('دیوار'))).toBeInTheDocument();
  expect(screen.getByText(COPY.unknownPrice)).toBeInTheDocument();
});

test('a stated problem is shown in a warning, and a stated virtue plainly', () => {
  render(
    <ListingCard
      card={listingCardFixture({
        condition: {
          body: 'intact',
          engine: 'needs_repair',
          gearbox: 'sound',
          chassis: 'intact',
          paintFree: true,
          accident: 'had_accident',
        },
      })}
      now={NOW}
    />,
  );
  expect(screen.getByText('تصادفی')).toBeInTheDocument();
  expect(screen.getByText('موتور نیازمند تعمیر')).toBeInTheDocument();
});

test('the skeleton says nothing and has nothing to focus', () => {
  render(<ListingCardSkeleton />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  expect(screen.queryByText(/./)).not.toBeInTheDocument();
});
