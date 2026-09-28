import 'server-only';
import { open, readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload } from 'node:module';
import path from 'node:path';
import type { LoadedSourceMap, SourceMapLookup } from '@carshenas/observability/stack';

// The build's browser source maps (next.config.ts writes them; src/proxy.ts keeps them from being served), read
// from disk to symbolicate a browser error's stack (ADR-0016). A frame names a chunk the browser loaded; the chunk's
// last line names its map (Turbopack gives a map its own hashed name, so it is not the chunk's name plus .map).
// Only a JavaScript file under /_next/static, and a map inside the build's static folder, are ever read, so a report
// cannot make the server read anything else.

const STATIC_PATH = '/_next/static/';
const FRAME_URL = /https?:\/\/[^\s()]+?\/_next\/static\/[^\s():]+\.js/g;
const MAP_REFERENCE = /\/\/# sourceMappingURL=([^\s'"]+)\s*$/;
const TAIL_BYTES = 512;
const MAX_CACHED = 20;

// Parsed maps by chunk file, most recently used last; a chunk without a usable map is remembered as null.
const cache = new Map<string, LoadedSourceMap | null>();

/** The build's static folder, where `next build` wrote the browser chunks and their maps. */
export function buildStaticDirectory(): string {
  return path.join(process.cwd(), '.next', 'static');
}

function inside(root: string, file: string): boolean {
  return file.startsWith(root + path.sep);
}

function chunkFileFor(url: string, root: string): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
  if (!pathname.startsWith(STATIC_PATH) || !pathname.endsWith('.js')) return undefined;
  const file = path.join(root, pathname.slice(STATIC_PATH.length));
  return inside(root, file) ? file : undefined;
}

/** The map the chunk's `//# sourceMappingURL=` comment names, if it is a file inside the static folder. */
async function mapFileFor(chunk: string, root: string): Promise<string | undefined> {
  const handle = await open(chunk, 'r');
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, TAIL_BYTES);
    const tail = Buffer.alloc(length);
    await handle.read(tail, 0, length, size - length);
    const reference = MAP_REFERENCE.exec(tail.toString('utf8'))?.[1];
    if (reference === undefined || reference.startsWith('data:')) return undefined;
    const file = path.resolve(path.dirname(chunk), decodeURIComponent(reference));
    return inside(root, file) && file.endsWith('.map') ? file : undefined;
  } finally {
    await handle.close();
  }
}

function remember(chunk: string, loaded: LoadedSourceMap | null): void {
  cache.delete(chunk);
  cache.set(chunk, loaded);
  const oldest = cache.keys().next();
  if (cache.size > MAX_CACHED && !oldest.done) cache.delete(oldest.value);
}

async function load(chunk: string, root: string): Promise<void> {
  if (cache.has(chunk)) return;
  try {
    const mapFile = await mapFileFor(chunk, root);
    if (mapFile === undefined) {
      remember(chunk, null);
      return;
    }
    const payload = JSON.parse(await readFile(mapFile, 'utf8')) as SourceMapPayload;
    remember(chunk, { map: new SourceMap(payload), directory: path.dirname(mapFile) });
  } catch {
    remember(chunk, null);
  }
}

/**
 * Loads the maps the stacks' frames need, then returns a lookup that answers from them. Reading happens here,
 * asynchronously, so that mapping each frame does not block the server on a large file.
 */
export async function browserSourceMaps(
  stacks: readonly string[],
  directory = buildStaticDirectory(),
): Promise<SourceMapLookup> {
  const chunks = new Set<string>();
  for (const stack of stacks) {
    for (const [url] of stack.matchAll(FRAME_URL)) {
      const chunk = chunkFileFor(url, directory);
      if (chunk !== undefined) chunks.add(chunk);
    }
  }
  await Promise.all([...chunks].map((chunk) => load(chunk, directory)));
  return (url) => {
    const chunk = chunkFileFor(url, directory);
    return chunk === undefined ? undefined : (cache.get(chunk) ?? undefined);
  };
}
