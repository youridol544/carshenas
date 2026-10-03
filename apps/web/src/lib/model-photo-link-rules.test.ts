import { expect, test } from 'vitest';
import { MAX_PHOTO_LINK_LENGTH, photoLinkProblem } from '@/lib/model-photo-link-rules';

// The same addresses the schema test (model-photo-link-constraints.test.ts) offers the database: the form's early
// answer and the table's refusal agree.

test('an https address with a real host passes', () => {
  for (const url of [
    'https://images.example-cars.ir/pars/front.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/Peugeot_Pars.png?width=800',
    'https://CDN.Example.ir:8443/a/b.JPG?w=1',
    'https://cdn.example.ir:65535/a.jpg',
    `https://${'a'.repeat(63)}.example.ir/a.jpg`,
  ])
    expect(photoLinkProblem(url)).toBeNull();
});

test('everything else says what is wrong', () => {
  expect(photoLinkProblem('http://cdn.example.ir/a.jpg')).toBe('scheme');
  expect(photoLinkProblem('ftp://cdn.example.ir/a.jpg')).toBe('scheme');
  expect(photoLinkProblem('')).toBe('scheme');
  expect(photoLinkProblem('https://')).toBe('length');
  expect(photoLinkProblem('https://cdn.example.ir/a b.jpg')).toBe('plain');
  expect(photoLinkProblem('https://cdn.example.ir/a.jpg"onerror=1')).toBe('plain');
  expect(photoLinkProblem('https://cdn.example.ir/<a>.jpg')).toBe('plain');
  expect(photoLinkProblem(`https://cdn.example.ir/a${String.fromCharCode(0x200e)}.jpg`)).toBe('plain');
  expect(photoLinkProblem(`https://cdn.example.ir/${'a'.repeat(MAX_PHOTO_LINK_LENGTH)}.jpg`)).toBe('length');
  for (const url of [
    'https://user:pass@cdn.example.ir/a.jpg',
    'https://localhost/a.jpg',
    'https://intranet/a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://192.168.1.5:8080/a.jpg',
    'https://printer.local/a.jpg',
    'https://-bad.example.ir/a.jpg',
    'https://0x7f.0.0.1/a.jpg',
    'https://2130706433/a.jpg',
    'https://cdn.example.ir:0/a.jpg',
    'https://cdn.example.ir:65536/a.jpg',
    `https://${'a'.repeat(64)}.example.ir/a.jpg`,
    'https://123.example.ir/a.jpg',
    'https://cdn.example.1/a.jpg',
  ])
    expect(photoLinkProblem(url)).toBe('host');
});
