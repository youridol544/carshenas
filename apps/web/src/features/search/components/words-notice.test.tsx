import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { WordsNotice } from '@/features/search/components/words-notice';
import { SEARCH_COPY } from '@/features/search/search-copy';

test('says which word was replaced and which found nothing', () => {
  render(
    <WordsNotice
      text={{ searchable: true, corrections: [{ from: 'پرایت', to: 'پراید' }], unknown: ['زاپاس'] }}
    />,
  );
  const note = screen.getByRole('status');
  expect(note).toHaveTextContent(SEARCH_COPY.words.corrected('پرایت', 'پراید'));
  expect(note).toHaveTextContent(SEARCH_COPY.words.unknown('زاپاس'));
});

test('says nothing when the words were fine, absent or not searchable', () => {
  const { rerender } = render(<WordsNotice text={null} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(<WordsNotice text={{ searchable: true, corrections: [], unknown: [] }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  rerender(<WordsNotice text={{ searchable: false, corrections: [], unknown: ['x'] }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('with no results the unknown words are left to the no-results panel', () => {
  render(<WordsNotice empty text={{ searchable: true, corrections: [], unknown: ['ززززز'] }} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
