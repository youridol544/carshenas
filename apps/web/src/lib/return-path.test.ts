// @vitest-environment node
import { expect, test } from 'vitest';
import { isAdminPath, landingAfterSignIn, safeReturnPath, withReturnPath } from '@/lib/return-path';

test('a path on this site is kept, with its query and fragment', () => {
  expect(safeReturnPath('/')).toBe('/');
  expect(safeReturnPath('/account')).toBe('/account');
  expect(safeReturnPath('/search?make=peugeot&page=2#results')).toBe('/search?make=peugeot&page=2#results');
});

test('anything that could leave the site is dropped', () => {
  for (const value of [
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/',
    'javascript:alert(1)',
    'account',
    `/${'a'.repeat(2_048)}`,
    '/\t/evil.example',
    undefined,
    42,
  ]) {
    expect(safeReturnPath(value)).toBeUndefined();
  }
});

test('the sign-in and sign-up pages are never a place to return to', () => {
  expect(safeReturnPath('/sign-in')).toBeUndefined();
  expect(safeReturnPath('/sign-up?next=%2Faccount')).toBeUndefined();
});

test('a superadmin lands on the dashboard unless next points inside it; a buyer never lands there', () => {
  expect(landingAfterSignIn(undefined, true)).toBe('/admin');
  expect(landingAfterSignIn('/search?make=saipa', true)).toBe('/admin');
  expect(landingAfterSignIn('/admin/sources', true)).toBe('/admin/sources');
  expect(landingAfterSignIn('/search?make=saipa', false)).toBe('/search?make=saipa');
  expect(landingAfterSignIn('/admin', false)).toBe('/');
  expect(landingAfterSignIn(undefined, false)).toBe('/');
  expect(isAdminPath('/administration')).toBe(false);
});

test('links to sign-in and sign-up keep a return path worth keeping', () => {
  expect(withReturnPath('/sign-in', '/search?make=saipa')).toBe('/sign-in?next=%2Fsearch%3Fmake%3Dsaipa');
  expect(withReturnPath('/sign-up', '/')).toBe('/sign-up');
  expect(withReturnPath('/sign-in', '//evil.example')).toBe('/sign-in');
  expect(withReturnPath('/sign-in', undefined)).toBe('/sign-in');
});
