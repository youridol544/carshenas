import { describe, expect, test } from 'vitest';
import {
  canonicalDivarAddress,
  MAX_PASTE_LENGTH,
  MAX_SLUG_LENGTH,
  readLinkParam,
  readPastedLink,
} from '@/lib/pasted-link';

const listing = (token: string, slug: string | null = null) => ({ kind: 'divar_listing', token, slug });

describe('a Divar listing link, written any of the ways buyers copy it', () => {
  test.each([
    ['the short form', 'https://divar.ir/v/ga-KQbyn', 'ga-KQbyn'],
    ['no scheme', 'divar.ir/v/ga-KQbyn', 'ga-KQbyn'],
    ['with www', 'https://www.divar.ir/v/AaDUdTuq', 'AaDUdTuq'],
    ['the phone site', 'http://m.divar.ir/v/AaDUdTuq?utm_source=share#top', 'AaDUdTuq'],
    ['a slug with the title before the token', 'https://divar.ir/v/پژو-۲۰۶-تیپ-۲/gX1mAYqN', 'gX1mAYqN'],
    ['the same slug, percent-encoded', 'https://divar.ir/v/%D9%BE%DA%98%D9%88/gX1mAYqN', 'gX1mAYqN'],
    ['a trailing slash', 'https://divar.ir/v/gX1mAYqN/', 'gX1mAYqN'],
    ['a message around it', 'سلام، این ماشین چطوره؟ https://divar.ir/v/gX1mAYqN ممنون', 'gX1mAYqN'],
    ['closing punctuation after it', '(https://divar.ir/v/gX1mAYqN).', 'gX1mAYqN'],
    ['invisible marks and blanks', '\u200F  https://divar.ir/v/gX1mAYqN\u200E \n', 'gX1mAYqN'],
    ['an upper-case host', 'HTTPS://DIVAR.IR/v/gX1mAYqN', 'gX1mAYqN'],
  ])('%s', (_name, text, token) => {
    expect(readPastedLink(text)).toMatchObject({ kind: 'divar_listing', token });
  });

  test('the short form carries no title; the long form carries it, as written, decoded', () => {
    expect(readPastedLink('https://divar.ir/v/ga-KQbyn')).toEqual(listing('ga-KQbyn'));
    expect(readPastedLink('https://divar.ir/v/پژو-۲۰۶-تیپ-۲-مدل-۱۳۹۸/gX1mAYqN')).toEqual(
      listing('gX1mAYqN', 'پژو-206-تیپ-2-مدل-1398'),
    );
    expect(
      readPastedLink('https://divar.ir/v/%D9%BE%DA%98%D9%88-%DB%B2%DB%B0%DB%B6/gX1mAYqN?utm_source=share'),
    ).toEqual(listing('gX1mAYqN', 'پژو-206'));
    expect(readPastedLink('divar.ir/v/%E0%A4%A/gX1mAYqN')).toEqual(listing('gX1mAYqN', '%E0%A4%A'));
  });

  test('a title is kept to its first words and cleaned of marks that render as nothing', () => {
    const long = 'پژو-'.repeat(150);
    const reading = readPastedLink(`https://divar.ir/v/${long}/gX1mAYqN`);
    expect(reading).toMatchObject({ kind: 'divar_listing', token: 'gX1mAYqN' });
    expect(reading.kind === 'divar_listing' ? (reading.slug?.length ?? 0) : 0).toBeLessThanOrEqual(
      MAX_SLUG_LENGTH,
    );
    expect(readPastedLink('https://divar.ir/v/\u200Fپژو\u200E-۲۰۶/gX1mAYqN')).toEqual(
      listing('gX1mAYqN', 'پژو-206'),
    );
  });

  test('the canonical address reads back as the same listing, with its title when it had one', () => {
    expect(readPastedLink(canonicalDivarAddress('ga-KQbyn'))).toEqual(listing('ga-KQbyn'));
    const long = readPastedLink('https://divar.ir/v/پژو-۲۰۶-تیپ-۲-مدل-۱۳۹۸/gX1mAYqN');
    if (long.kind !== 'divar_listing') throw new Error('a listing link was expected');
    const address = canonicalDivarAddress(long);
    expect(address).toMatch(/^https:\/\/divar\.ir\/v\/%[0-9A-F]{2}[^/]*\/gX1mAYqN$/);
    expect(readPastedLink(address)).toEqual(long);
    expect(canonicalDivarAddress({ token: 'ga-KQbyn', slug: null })).toBe('https://divar.ir/v/ga-KQbyn');
  });
});

describe('what is not a listing link says why', () => {
  test('nothing', () => {
    expect(readPastedLink('')).toEqual({ kind: 'empty' });
    expect(readPastedLink(' ‌\n ')).toEqual({ kind: 'empty' });
    expect(readLinkParam(undefined)).toEqual({ kind: 'empty' });
  });

  test('text with no address', () => {
    expect(readPastedLink('پژو ۲۰۶ تیپ ۵')).toEqual({ kind: 'not_a_link' });
    expect(readPastedLink('https://')).toEqual({ kind: 'not_a_link' });
    expect(readPastedLink('v/gX1mAYqN')).toEqual({ kind: 'not_a_link' });
  });

  test('another site: only Divar is supported, and a known site is named', () => {
    expect(readPastedLink('https://bama.ir/car/detail-abc123-peugeot-206')).toEqual({
      kind: 'other_site',
      host: 'bama.ir',
      name: 'باما',
    });
    expect(readPastedLink('https://www.sheypoor.com/v/123')).toMatchObject({
      kind: 'other_site',
      name: 'شیپور',
    });
    expect(readPastedLink('https://example.com/x')).toEqual({
      kind: 'other_site',
      host: 'example.com',
      name: null,
    });
  });

  test('a look-alike host is another site, never Divar', () => {
    for (const text of [
      'https://divar.ir.evil.com/v/gX1mAYqN',
      'https://notdivar.ir/v/gX1mAYqN',
      'https://evil.com/divar.ir/v/gX1mAYqN',
    ]) {
      expect(readPastedLink(text)).toMatchObject({ kind: 'other_site' });
    }
  });

  test('a Divar address that is not one listing', () => {
    for (const text of [
      'https://divar.ir',
      'https://divar.ir/s/tehran/car',
      'https://divar.ir/v/',
      'https://divar.ir/v/ab',
      'https://divar.ir/v/bad token/x y',
    ]) {
      expect(readPastedLink(text).kind).toBe('divar_other');
    }
  });
});

test('it is total and fast on hostile input', () => {
  const started = performance.now();
  for (const text of [
    'a.'.repeat(MAX_PASTE_LENGTH),
    `${'a-'.repeat(1000)}.`,
    '%'.repeat(5000),
    `https://divar.ir/v/${'%E0%A4%A'.repeat(300)}`,
    '\u0000￿'.repeat(2000),
  ]) {
    expect(() => readPastedLink(text)).not.toThrow();
  }
  expect(performance.now() - started).toBeLessThan(500);
});
