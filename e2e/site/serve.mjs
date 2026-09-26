#!/usr/bin/env node
// Zero-dependency static server for the fixture site. PORT and HOST are optional.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://${host}`);
  const relative = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, relative);
  if (!file.startsWith(root)) file = join(root, 'index.html');
  if (pathname.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    const headers = {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    };
    // Fake session cookie for the site-capture redaction test.
    if (file.endsWith('index.html'))
      headers['set-cookie'] = 'fixture_session=fixture-secret-cookie-789; HttpOnly; SameSite=Lax';
    response.writeHead(200, headers);
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
}).listen(port, host, () => console.log(`fixture site on http://${host}:${port}`));
