import 'server-only';
import { readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload } from 'node:module';
import path from 'node:path';
import type { LoadedSourceMap, SourceMapLookup } from '@carshenas/observability/stack';

// The build's browser source maps (next.config.ts writes them; src/proxy.ts keeps them from being served), read
// from disk to symbolicate a browser error's stack (ADR-0016). A frame names a URL the browser loaded; only a
// JavaScript file under /_next/static can map, and only to a file inside the build's static folder, so a report
// cannot make the server read anything else.

const STATIC_PATH = '/_next/static/';
const FRAME_URL = /https?:\/\/[^\s()]+?\/_next\/static\/[^\s():]+\.js/g;
const MAX_CACHED = 20;

// Parsed maps by file, most recently used last; a missing map is remembered as null.
const cache = new Map<string, LoadedSourceMap | null>();

/** The build's static folder, where `next build` wrote the browser chunks and their maps. */
export function buildStaticDirectory(): string {
  return path.join(process.cwd(), '.next', 'static');
}

function mapFileFor(url: string, root: string): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
  if (!pathname.startsWith(STATIC_PATH) || !pathname.endsWith('.js')) return undefined;
  const file = path.join(root, `${pathname.slice(STATIC_PATH.length)}.map`);
  return file.startsWith(root + path.sep) ? file : undefined;
}

function remember(file: string, loaded: LoadedSourceMap | null): void {
  cache.delete(file);
  cache.set(file, loaded);
  const oldest = cache.keys().next();
  if (cache.size > MAX_CACHED && !oldest.done) cache.delete(oldest.value);
}

async function load(file: string): Promise<void> {
  if (cache.has(file)) return;
  try {
    const payload = JSON.parse(await readFile(file, 'utf8')) as SourceMapPayload;
    remember(file, { map: new SourceMap(payload), directory: path.dirname(file) });
  } catch {
    remember(file, null);
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
  const files = new Set<string>();
  for (const stack of stacks) {
    for (const [url] of stack.matchAll(FRAME_URL)) {
      const file = mapFileFor(url, directory);
      if (file !== undefined) files.add(file);
    }
  }
  await Promise.all([...files].map(load));
  return (url) => {
    const file = mapFileFor(url, directory);
    return file === undefined ? undefined : (cache.get(file) ?? undefined);
  };
}
