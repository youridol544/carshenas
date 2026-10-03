'use client';

import { useEffect } from 'react';

// When an answer arrives because the buyer asked for it (the box on this page sent the link), focus goes to its heading (a
// heading takes focus with tabIndex -1), so a screen reader reads the answer and a phone scrolls to it; a keyboard user
// continues from there. A page opened on an address (a shared link, a reload, Back) keeps focus where the document puts it,
// at the top: moving it would skip the form and the header for someone who tabs in.

export const answerFocus = { expected: false };

export function AnswerFocus() {
  useEffect(() => {
    if (!answerFocus.expected) return;
    answerFocus.expected = false;
    document.getElementById('check-answer-title')?.focus();
  }, []);
  return null;
}
