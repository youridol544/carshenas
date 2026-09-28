// @vitest-environment node
import type { CaptureContext } from '@carshenas/observability/capture';
import { expect, test, vi } from 'vitest';
import { digestOf, reportRequestError } from '@/server/observability/request-error';

const { captureError } = vi.hoisted(() => ({
  captureError: vi.fn<(error: unknown, context?: CaptureContext) => void>(),
}));
vi.mock('@/server/observability/logger', () => ({ captureError }));

const PAGE_CONTEXT = {
  routerKind: 'App Router',
  routePath: '/listings/[id]',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
} as const;

function request(path: string, headers: Record<string, string> = {}) {
  return { path, method: 'GET', headers };
}

test('a page error is captured once with the route, method, path, query and reference code', () => {
  const error = Object.assign(new Error('listing 42 has no price'), { digest: '2847193056' });
  reportRequestError(
    error,
    request('/listings/42?_rsc=1a2b&from=search', {
      'user-agent': 'Mozilla/5.0 (Linux; Android 14)',
      cookie: 'session=secret',
      authorization: 'Bearer token',
    }),
    PAGE_CONTEXT,
  );
  expect(captureError).toHaveBeenCalledOnce();
  const [captured, context] = captureError.mock.calls[0] ?? [];
  expect(captured).toBe(error);
  expect(context).toEqual({
    message: 'request failed',
    tags: { 'next.route_path': '/listings/[id]', 'next.route_type': 'render' },
    fields: {
      reference: '2847193056',
      'http.request.method': 'GET',
      'url.path': '/listings/42',
      'url.query': 'from=search',
      'next.router_kind': 'App Router',
      'next.render_source': 'react-server-components',
      'next.revalidate_reason': undefined,
      'user_agent.original': 'Mozilla/5.0 (Linux; Android 14)',
    },
  });
  expect(JSON.stringify(context)).not.toMatch(/secret|Bearer/);
});

test('errors Next.js uses for control flow are not captured', () => {
  for (const digest of [
    'NEXT_REDIRECT;replace;/login;307;',
    'NEXT_HTTP_ERROR_FALLBACK;404',
    'DYNAMIC_SERVER_USAGE',
    'NEXT_PRERENDER_INTERRUPTED',
    'HANGING_PROMISE_REJECTION',
    'BAILOUT_TO_CLIENT_SIDE_RENDERING',
  ]) {
    reportRequestError(Object.assign(new Error(digest), { digest }), request('/'), PAGE_CONTEXT);
  }
  expect(captureError).not.toHaveBeenCalled();
});

test('a Route Handler error without a digest and a thrown string are both captured', () => {
  reportRequestError(new TypeError('body is not JSON'), request('/api/search'), {
    ...PAGE_CONTEXT,
    routePath: '/api/search',
    routeType: 'route',
    renderSource: undefined,
  });
  reportRequestError('plain string', request('/'), PAGE_CONTEXT);
  expect(captureError).toHaveBeenCalledTimes(2);
  expect(captureError.mock.calls[0]?.[1]?.fields).toMatchObject({
    reference: undefined,
    'url.path': '/api/search',
  });
  expect(captureError.mock.calls[1]?.[0]).toBe('plain string');
});

test('a very long user agent is cut, and only a string digest counts', () => {
  reportRequestError(new Error('x'), request('/', { 'user-agent': 'A'.repeat(1_000) }), PAGE_CONTEXT);
  expect(String(captureError.mock.calls[0]?.[1]?.fields?.['user_agent.original'])).toHaveLength(300);
  expect(digestOf(Object.assign(new Error('x'), { digest: 42 }))).toBeUndefined();
  expect(digestOf(Object.assign(new Error('x'), { digest: '' }))).toBeUndefined();
  expect(digestOf(null)).toBeUndefined();
});
