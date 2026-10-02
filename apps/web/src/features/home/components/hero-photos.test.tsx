import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HeroPhotos } from '@/features/home/components/hero-photos';
import { HERO_SLIDES } from '@/features/home/hero-photos';
import { HOME_COPY } from '@/features/home/home-copy';

// The slider's rules (CS-63): one photograph at first, the next ones only after the page is idle, 6 s a photograph,
// nothing while the tab is hidden or the buyer paused it, and under reduced motion one still photograph.

let reduced = false;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  reduced = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? reduced : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

const slides = () => screen.getAllByTestId('hero-slide');
const showing = () => slides().find((slide) => slide.hasAttribute('data-active'))?.dataset.heroSlide;

async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

test('only the first photograph is on the page until the page has loaded and been idle', async () => {
  render(<HeroPhotos slides={HERO_SLIDES} />);
  expect(slides()).toHaveLength(1);
  const first = screen.getAllByRole('img', { hidden: true }).at(0);
  expect(first).toHaveAttribute('loading', 'eager');
  expect(first).toHaveAttribute('fetchpriority', 'high');
  await pass(1600);
  expect(slides()).toHaveLength(2);
  // the one ahead is lazy and has its placeholder
  expect(screen.getAllByRole('img', { hidden: true }).at(1)).toHaveAttribute('loading', 'lazy');
  expect(slides().at(1)?.style.backgroundImage).toContain('data:image/webp;base64');
});

test('each photograph is held for six seconds, and the credit follows the one showing', async () => {
  render(<HeroPhotos slides={HERO_SLIDES} />);
  await pass(1600);
  expect(showing()).toBe(HERO_SLIDES[0]?.id);
  await pass(5900);
  expect(showing()).toBe(HERO_SLIDES[0]?.id);
  await pass(200);
  expect(showing()).toBe(HERO_SLIDES[1]?.id);
  expect(screen.getByText(HERO_SLIDES[1]?.credit.photographer ?? '')).toBeInTheDocument();
  expect(slides()).toHaveLength(3);
});

test('the credit of the photograph that needs it is on the page while it shows', async () => {
  render(<HeroPhotos slides={HERO_SLIDES} />);
  await pass(1600);
  await pass(6000 * 4);
  expect(showing()).toBe('azadi-night-traffic');
  const credit = screen.getByTestId('hero-credit');
  expect(credit).toHaveTextContent('Thomas Jaehnel');
  expect(within(credit).getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute(
    'href',
    expect.stringContaining('creativecommons.org/licenses/by/2.0'),
  );
});

test('a paused slider stays where it is, and the button says it can go on', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<HeroPhotos slides={HERO_SLIDES} />);
  await pass(1600);
  await user.click(screen.getByRole('button', { name: HOME_COPY.hero.pause }));
  await pass(20_000);
  expect(showing()).toBe(HERO_SLIDES[0]?.id);
  await user.click(screen.getByRole('button', { name: HOME_COPY.hero.play }));
  await pass(6100);
  expect(showing()).toBe(HERO_SLIDES[1]?.id);
});

test('a hidden tab does not advance it', async () => {
  render(<HeroPhotos slides={HERO_SLIDES} />);
  await pass(1600);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pass(30_000);
  expect(showing()).toBe(HERO_SLIDES[0]?.id);
});

test('under reduced motion there is one still photograph, no timer, no pause button and no other file', async () => {
  reduced = true;
  render(<HeroPhotos slides={HERO_SLIDES} />);
  await pass(30_000);
  expect(slides()).toHaveLength(1);
  expect(showing()).toBe(HERO_SLIDES[0]?.id);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
