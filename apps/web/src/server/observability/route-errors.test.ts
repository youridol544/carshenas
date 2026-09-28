// @vitest-environment node
import type { CaptureContext } from '@carshenas/observability/capture';
import { expect, test, vi } from 'vitest';
import {
  ROUTE_ERROR_MESSAGE,
  withErrorReference,
  type RouteErrorBody,
} from '@/server/observability/route-errors';

const { captureError } = vi.hoisted(() => ({
  captureError: vi.fn<(error: unknown, context?: CaptureContext) => void>(),
}));
vi.mock('@/server/observability/logger', () => ({ captureError }));

function get(url: string) {
  return new Request(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14)', cookie: 'session=secret' },
  });
}

test('an error answers 500 with a Farsi message and a reference code that is also on the log line', async () => {
  const failure = new Error('search index is not ready');
  const GET = withErrorReference('/api/search', () => Promise.reject(failure));
  const response = await GET(get('https://carshenas.ir/api/search?q=%D9%BE%DA%98%D9%88'), undefined);
  expect(response.status).toBe(500);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = (await response.json()) as RouteErrorBody;
  expect(body.message).toBe(ROUTE_ERROR_MESSAGE);
  expect(body.reference).toMatch(/^\d{10}$/);
  expect(JSON.stringify(body)).not.toContain('search index');
  expect(captureError).toHaveBeenCalledOnce();
  const [captured, context] = captureError.mock.calls[0] ?? [];
  expect(captured).toBe(failure);
  expect(context).toEqual({
    message: 'request failed',
    tags: { 'next.route_path': '/api/search', 'next.route_type': 'route' },
    fields: {
      reference: body.reference,
      'http.request.method': 'GET',
      'url.path': '/api/search',
      'url.query': 'q=پژو',
      'user_agent.original': 'Mozilla/5.0 (Linux; Android 14)',
    },
  });
  expect(JSON.stringify(context)).not.toContain('secret');
});

test('a redirect or a not-found from the handler passes through to Next.js', async () => {
  const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/;307;' });
  const GET = withErrorReference('/api/old', () => Promise.reject(redirect));
  await expect(GET(get('https://carshenas.ir/api/old'), undefined)).rejects.toBe(redirect);
  expect(captureError).not.toHaveBeenCalled();
});

test('a redirect wrapped as the cause of another error still reaches Next.js as the redirect', async () => {
  const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/;307;' });
  const GET = withErrorReference('/api/old', () =>
    Promise.reject(new Error('lookup failed', { cause: redirect })),
  );
  await expect(GET(get('https://carshenas.ir/api/old'), undefined)).rejects.toBe(redirect);
  expect(captureError).not.toHaveBeenCalled();
});

test('a handler that succeeds answers as it wrote', async () => {
  const GET = withErrorReference('/api/ok', () => Response.json({ ok: true }, { status: 201 }));
  const response = await GET(get('https://carshenas.ir/api/ok'), undefined);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ ok: true });
  expect(captureError).not.toHaveBeenCalled();
});
