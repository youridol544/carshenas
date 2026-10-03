import { describe, expect, test } from 'vitest';
import { readDecideCrawlRequestForm } from '@/features/admin/crawl-request-schemas';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('the decision form', () => {
  const base = { requestId: '31', seenState: 'pending', decision: 'approved', reason: '' };

  test('an approval has no reason, a decline has one', () => {
    expect(readDecideCrawlRequestForm(form(base))).toEqual({
      requestId: 31,
      seenState: 'pending',
      decision: 'approved',
      reason: null,
    });
    expect(
      readDecideCrawlRequestForm(form({ ...base, decision: 'declined', reason: '  خارج از   بازار تهران ' })),
    ).toMatchObject({ decision: 'declined', reason: 'خارج از بازار تهران' });
    expect(readDecideCrawlRequestForm(form({ ...base, decision: 'declined' }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...base, reason: 'چرا؟' }))).toBeUndefined();
  });

  test('a reason is one plain line of at most 300 characters', () => {
    const decline = { ...base, decision: 'declined' };
    expect(readDecideCrawlRequestForm(form({ ...decline, reason: 'ا'.repeat(301) }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...decline, reason: 'ا'.repeat(300) }))).toBeDefined();
    expect(
      readDecideCrawlRequestForm(form({ ...decline, reason: `دلیل${String.fromCharCode(0x202e)}معکوس` })),
    ).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...decline, reason: 'نیم‌فاصله می‌ماند' }))).toBeDefined();
  });

  test('nothing but this screen’s own fields is accepted', () => {
    expect(readDecideCrawlRequestForm(form({ ...base, requestId: '0' }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...base, requestId: '1e3' }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...base, decision: 'fulfilled' }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...base, seenState: 'approved' }))).toBeUndefined();
    expect(readDecideCrawlRequestForm(form({ ...base, seenState: 'fulfilled' }))).toBeUndefined();
  });
});
