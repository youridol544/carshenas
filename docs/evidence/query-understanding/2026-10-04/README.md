# The smart search in one step (CS-111, ADR-0043)

What is here, from the lane's run of 2026-10-04 (production build on the lane's copy of main's data, Playwright, phone and desktop):

- `explain-counts.md`: `EXPLAIN (ANALYZE, BUFFERS)` of every shape of the count the settling of unread words asks (0.06 to 0.6 ms each).
- `screenshots/`, written by `e2e/tests/app/plain-search.spec.ts` (`pnpm e2e tests/app/plain-search.spec.ts`); the wording of the lines was
  rewritten to the voice guide after they were taken, so the left-out line reads «آگهی‌ای با «…» پیدا نشد. بدون آن نشان می‌دهیم.» now:
  - `mobile-owner-sentence.png`, `desktop-owner-sentence.png`: the owner's own sentence («یک ماشین تمیز کم کار و بیدردسر می‌خوام که همه چیش از نظر
    فنی خوب باشه و تمیز باشه») typed on the search page and sent with Enter: the box still holds the sentence, one blue button, the
    catalogue «تمیز و بی‌دردسر» is the current one in the strip with its summary, and its eight filters are removable chips. On the phone the
    keyboard has gone with the box and the focus ring is on the count of the results («۲٬۱۸۳ آگهی»).
  - `mobile-words-kept-and-left-out.png`, `desktop-words-kept-and-left-out.png`: a sentence of two unread words and the model «پژو ۲۰۶»: the
    word the listings have is a quiet dashed chip beside the model chip (30 results), the word no listing has is left out and said, with
    «برگرداندن» under or beside the line. The extra line «در هیچ آگهی‌ای نبود» about the seeded word is the search's own notice (CS-59) that
    the test's seeded listings are not in the vocabulary the worker keeps; with real listings it does not appear for a word that finds them.

Timings of the action, from its one log line on a machine at load 31 to 36 with 6,683 searchable listings: 1 to 2 ms for a sentence with no
unread word, 18 to 480 ms when the counts are asked, 4 s for the first sentence of a process (the lexicon's nine reads, now served stale while
they refresh).
