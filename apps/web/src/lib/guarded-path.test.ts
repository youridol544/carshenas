// @vitest-environment node
import { expect, test } from 'vitest';
import { isGuardedPath } from '@/lib/guarded-path';

test('the account, the superadmin section, listings and models are guarded, with everything under them', () => {
  const paths = [
    '/account',
    '/account/marked',
    '/admin',
    '/admin/sources',
    '/listings',
    '/listings/123',
    '/models',
    '/models/peugeot/206',
  ];
  expect(paths.filter((path) => !isGuardedPath(path))).toEqual([]);
});

test('a path that only starts with the same letters is not guarded', () => {
  const paths = ['/', '/search', '/status', '/accounting', '/administrator', '/models-list', '/api/health'];
  expect(paths.filter((path) => isGuardedPath(path))).toEqual([]);
});

test('the letter case of the path does not slip past the guard', () => {
  expect(isGuardedPath('/Admin/Sources')).toBe(true);
  expect(isGuardedPath('/ACCOUNT')).toBe(true);
});
