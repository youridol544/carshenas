import { createServer, type IncomingHttpHeaders } from 'node:http';

// A local stand-in for a listing source, for tests: it answers each request as scripted and records what it was
// sent and when, so a test can prove what the crawler sent, how far apart, and how it took each answer. Nothing in
// the tests ever reaches a real source.

export type StubAnswer = {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Waits this long before answering. */
  readonly delayMs?: number;
  /** Drops the connection instead of answering. */
  readonly hangUp?: boolean;
};

export type StubRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  /** The request's body as text, read in full before the answer. */
  readonly body: string;
  /** performance.now() when the request arrived and when its answer was finished. */
  readonly receivedAt: number;
  answeredAt: number | undefined;
};

/** Chooses the answer to one request: `index` counts every request the stub received before it. */
export type StubHandler = (request: StubRequest, index: number) => StubAnswer;

export type StubSource = {
  readonly url: string;
  readonly requests: readonly StubRequest[];
  close(): Promise<void>;
};

/** Answers in order from `script` (once it runs out, the last answer repeats), or as `script` decides per request. */
export async function startStubSource(script: readonly StubAnswer[] | StubHandler): Promise<StubSource> {
  const requests: StubRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const record: StubRequest = {
        method: request.method ?? 'GET',
        path: request.url ?? '/',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
        receivedAt: performance.now(),
        answeredAt: undefined,
      };
      const index = requests.length;
      requests.push(record);
      const answer =
        typeof script === 'function'
          ? script(record, index)
          : (script[Math.min(index, script.length - 1)] ?? { status: 200 });
      const reply = () => {
        if (answer.hangUp) {
          request.socket.destroy();
          return;
        }
        response.writeHead(answer.status, { 'content-type': 'application/json', ...answer.headers });
        response.end(answer.body ?? '{}', () => {
          record.answeredAt = performance.now();
        });
      };
      if (answer.delayMs) setTimeout(reply, answer.delayMs);
      else reply();
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('the stub source has no port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
