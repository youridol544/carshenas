'use client';

import { useEffect, useRef } from 'react';
import { revealEnd } from '@/features/check-link/reveal-end';

// When an answer arrives because the buyer asked for it (the box on this page sent the link), focus goes to its heading (a
// heading takes focus with tabIndex -1), so a screen reader reads the answer, and a phone, where the answer starts below
// the box, shows the whole of an answer that fits the screen: the way forward of an answer is at its end (reveal-end.ts).
// An answer taller than the screen stays where it is, its heading in view. A page opened on an address (a shared link, a
// reload, Back) keeps focus where the document puts it, at the top: moving it would skip the form and the header for
// someone who tabs in.
//
// It sits right after the answer and finds the answer from there, never by an id: Next.js keeps the pages you left in the
// document, hidden, so an id of one answer can be on two pages and `getElementById` may return the one nobody sees.

export const answerFocus = { expected: false };

export function AnswerFocus() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!answerFocus.expected) return;
    answerFocus.expected = false;
    const answer = marker.current?.previousElementSibling;
    const heading = answer?.querySelector<HTMLElement>('[data-answer-title]');
    if (heading === null || heading === undefined) return;
    heading.focus({ preventScroll: true });
    const panel = heading.closest('section');
    if (panel !== null) revealEnd(panel);
  }, []);
  return <span ref={marker} hidden />;
}
