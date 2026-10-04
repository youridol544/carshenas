'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icon';
import { HOME_COPY } from '@/features/home/home-copy';
import { heroFallbackSrc, heroSrcSet, type HeroSlide } from '@/features/home/hero-photos';

// The hero's photographs (CS-63): a slow cross-fade between Tehran photographs that sits behind the hero's text.
//
// - Only the first photograph is part of the page: its <img> is eager with fetchpriority high, in the server's HTML, in
//   a box whose size does not depend on it. The others are mounted, one ahead of the one showing, only after the page
//   has loaded and been idle for a moment, and each shows its blurred placeholder until its file arrives.
// - Each photograph is held for 6 s and fades over 1.2 s (the slide duration token). Nothing runs while the tab is
//   hidden, while the buyer has paused it (a pause button, WCAG 2.2.2: moving content longer than five seconds), while
//   a field of the hero has focus (typing in the search box), or under prefers-reduced-motion, which shows the first
//   photograph alone, with no timer and no other file requested.
// - The credit of the photograph showing is always on it (and in the footer's full list). It is a licence term for one
//   of the six (CC BY 2.0), so it is never conditional on the page's size.

const HOLD_MS = 6000;
/**
 * The photograph's width the browser plans for. On a desktop it is the window. On a phone the band is as tall as it is
 * wide, so the 16:9 photograph is cropped to about two thirds of its width: three quarters of the window is what the
 * eye gets of it, and the 960 px file is enough for it. This keeps the first photograph at 26 KB instead of 55 KB on a
 * phone, where the largest contentful paint is decided by what shares the connection with it.
 */
const SIZES = '(min-width: 64rem) 100vw, 75vw';
/** After the page has loaded, wait this long before the second photograph is requested: the first paint is not shared. */
const IDLE_MS = 1500;

function subscribeToMotion(notify: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', notify);
  return () => {
    query.removeEventListener('change', notify);
  };
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function subscribeToVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => {
    document.removeEventListener('visibilitychange', notify);
  };
}
const tabIsHidden = () => document.hidden;

type Position = { active: number; reached: number };

function advance(position: Position, count: number): Position {
  const next = (position.active + 1) % count;
  return { active: next, reached: Math.max(position.reached, next) };
}

type Props = { slides: readonly HeroSlide[] };

export function HeroPhotos({ slides }: Props) {
  const reduced = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => false);
  const hidden = useSyncExternalStore(subscribeToVisibility, tabIsHidden, () => false);
  const [position, step] = useReducer(advance, { active: 0, reached: 0 });
  const [armed, setArmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = slides.length;

  // Arm the slider once the page has loaded and been idle for a moment.
  useEffect(() => {
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(() => {
        setArmed(true);
      }, IDLE_MS);
    };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', arm);
    };
  }, []);

  // Typing in the search box is not the time for the picture behind it to change: the slider waits while a field of
  // the hero (the section this belongs to) has focus. The pause button and the links do not count: pressing «ادامه»
  // must go on.
  useEffect(() => {
    const hero = root.current?.closest('section');
    if (hero === null || hero === undefined) return;
    const enter = (event: FocusEvent) => {
      setFocusInside(event.target instanceof HTMLInputElement);
    };
    const leave = () => {
      setFocusInside(false);
    };
    hero.addEventListener('focusin', enter);
    hero.addEventListener('focusout', leave);
    return () => {
      hero.removeEventListener('focusin', enter);
      hero.removeEventListener('focusout', leave);
    };
  }, []);

  const playing = armed && !reduced && !hidden && !paused && !focusInside;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      step(count);
    }, HOLD_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [playing, count]);

  // One ahead of the one showing, once armed; never more than the first under reduced motion.
  const mounted = armed && !reduced ? Math.min(count, position.reached + 2) : 1;
  const showing = slides[position.active] ?? slides[0];
  if (showing === undefined) return null;

  return (
    <>
      <div
        ref={root}
        className="relative -z-10 col-start-1 row-start-1 overflow-hidden lg:row-end-3"
        style={{ backgroundColor: slides[0]?.colour }}
      >
        {slides.slice(0, mounted).map((slide, index) => (
          <div
            key={slide.id}
            data-testid="hero-slide"
            data-hero-slide={slide.id}
            data-active={index === position.active ? '' : undefined}
            aria-hidden={index === position.active ? undefined : true}
            className="absolute inset-0 bg-cover opacity-0 transition-opacity duration-slide ease-in-out data-active:opacity-100 motion-reduce:transition-none"
            style={{ backgroundColor: slide.colour, backgroundImage: `url(${slide.placeholder})` }}
          >
            <picture className="block size-full">
              <source type="image/avif" srcSet={heroSrcSet(slide.id, 'avif')} sizes={SIZES} />
              <source type="image/webp" srcSet={heroSrcSet(slide.id, 'webp')} sizes={SIZES} />
              <img
                src={heroFallbackSrc(slide.id)}
                alt={slide.alt}
                width={1920}
                height={1080}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                decoding="async"
                className={`size-full object-cover ${slide.position === 'right' ? 'object-right' : 'object-center'}`}
              />
            </picture>
          </div>
        ))}
        <div aria-hidden="true" className="absolute inset-0 hero-scrim" />
      </div>
      <div className="pointer-events-none absolute inset-x-4 top-2 z-10 flex items-center gap-3 lg:top-auto lg:bottom-2">
        <p
          data-testid="hero-credit"
          data-hero-credit={showing.id}
          className="pointer-events-auto flex min-h-11 min-w-0 items-center rounded-full bg-photo-scrim px-4 text-meta text-on-photo"
        >
          <span>
            <PhotoCredit slide={showing} />
          </span>
        </p>
        {armed && !reduced ? (
          <button
            type="button"
            aria-label={paused ? HOME_COPY.hero.play : HOME_COPY.hero.pause}
            onClick={() => {
              setPaused(!paused);
            }}
            className="pointer-events-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-photo-scrim text-on-photo"
          >
            <Icon icon={paused ? Play : Pause} size={16} />
          </button>
        ) : null}
      </div>
    </>
  );
}

/** «عکس از Name، CC BY 2.0»: the photographer links to the photograph's page, the licence to its text. */
function PhotoCredit({ slide }: { slide: HeroSlide }) {
  const { credit } = slide;
  return (
    <>
      {HOME_COPY.hero.photoBy}{' '}
      <a href={credit.page} rel="noreferrer" className="text-on-photo underline" lang="en">
        <bdi>{credit.photographer}</bdi>
      </a>
      {'، '}
      <a href={credit.licenceUrl} rel="noreferrer" className="text-on-photo underline" lang="en">
        <bdi>{credit.licence}</bdi>
      </a>
    </>
  );
}
