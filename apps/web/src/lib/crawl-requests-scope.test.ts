import { describe, expect, test } from 'vitest';
import { requestScopesOf } from '@/lib/crawl-requests-scope';

describe('what a search file asks a deeper crawl of', () => {
  test('a file naming only a make asks for nothing, because a crawl is chosen by model', () => {
    expect(requestScopesOf({ make: ['peugeot'] })).toEqual({ scopes: [], tooMany: false });
    expect(requestScopesOf({})).toEqual({ scopes: [], tooMany: false });
  });

  test('each model is a scope, in key order, once', () => {
    const { scopes } = requestScopesOf({ model: ['peugeot.405', 'peugeot.206', 'peugeot.206'] });
    expect(scopes.map((scope) => scope.key)).toEqual(['peugeot.206', 'peugeot.405']);
    expect(scopes[0]).toEqual({ key: 'peugeot.206', makeSlug: 'peugeot', modelSlug: '206', trimSlug: null });
  });

  test('a trim is its own scope and covers its model, which is not asked for twice', () => {
    const { scopes } = requestScopesOf({
      model: ['peugeot.206', 'peugeot.405'],
      trim: ['peugeot.206.type-5'],
    });
    expect(scopes.map((scope) => scope.key)).toEqual(['peugeot.206.type-5', 'peugeot.405']);
    expect(scopes[0]?.trimSlug).toBe('type-5');
  });

  test('more than three models and trims is too many for one file', () => {
    const many = requestScopesOf({ model: ['a.1', 'a.2', 'a.3', 'a.4'] });
    expect(many.tooMany).toBe(true);
    expect(requestScopesOf({ model: ['a.1', 'a.2', 'a.3'] }).tooMany).toBe(false);
  });
});
