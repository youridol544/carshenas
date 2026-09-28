import 'server-only';
import { open, readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload, type SourceOrigin } from 'node:module';
import path from 'node:path';
import type { LoadedSourceMap, SourceMapLookup } from '@carshenas/observability/stack';

// The build's browser source maps, read from disk to symbolicate a browser error's stack (ADR-0016). A frame names a
// chunk the browser loaded, under /_next/static; the chunk's last line names its map (Turbopack gives a map its own
// hashed name), and scripts/browser-source-maps.mjs moved every map from .next/static to .next/browser-source-maps,
// which is never served, adding the React Compiler's own maps. Only a JavaScript file inside the static folder and a
// map inside the private one are ever read, so a report cannot make the server read anything else.

const STATIC_PATH = '/_next/static/';
const FRAME_URL = /https?:\/\/[^\s()]+?\/_next\/static\/[^\s():]+\.js/g;
const MAP_REFERENCE = /\/\/# sourceMappingURL=([^\s'"]+)\s*$/;
const TAIL_BYTES = 512;
const MAX_CACHED = 20;

// Babel's map from the React Compiler's output to our file, by source; null where the build could not reproduce it.
type CompiledMaps = Readonly<Record<string, SourceMapPayload | null>>;
type Folders = { staticRoot: string; privateRoot: string };

// Parsed maps by chunk file, most recently used last; a chunk without a usable map is remembered as null.
const cache = new Map<string, LoadedSourceMap | null>();

/** The build's output folder, `.next` beside the app. */
export function buildDirectory(): string {
  return path.join(process.cwd(), '.next');
}

function inside(root: string, file: string): boolean {
  return file.startsWith(root + path.sep);
}

function chunkFileFor(url: string, { staticRoot }: Folders): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
  if (!pathname.startsWith(STATIC_PATH) || !pathname.endsWith('.js')) return undefined;
  const file = path.join(staticRoot, pathname.slice(STATIC_PATH.length));
  return inside(staticRoot, file) ? file : undefined;
}

/** Where the map the chunk's `//# sourceMappingURL=` names was moved to, if it stays inside the build's folders. */
async function mapFileFor(chunk: string, { staticRoot, privateRoot }: Folders): Promise<string | undefined> {
  const handle = await open(chunk, 'r');
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, TAIL_BYTES);
    const tail = Buffer.alloc(length);
    await handle.read(tail, 0, length, size - length);
    const reference = MAP_REFERENCE.exec(tail.toString('utf8'))?.[1];
    if (reference === undefined || reference.startsWith('data:')) return undefined;
    const named = path.resolve(path.dirname(chunk), decodeURIComponent(reference));
    if (!inside(staticRoot, named) || !named.endsWith('.map')) return undefined;
    return path.join(privateRoot, path.relative(staticRoot, named));
  } finally {
    await handle.close();
  }
}

/**
 * The map, followed through the React Compiler's map where it rewrote the file: a position in its output becomes the
 * position in our file it came from. Where there is no such map, or no mapping for the position, the frame keeps the
 * compiled code's position, marked `(compiled)`, rather than a line of ours that did not throw.
 */
function throughCompiledMaps(map: SourceMap, compiled: CompiledMaps): Pick<SourceMap, 'findOrigin'> {
  const inner = new Map<string, SourceMap | null>();
  function innerMap(fileName: string): SourceMap | null {
    let loaded = inner.get(fileName);
    if (loaded === undefined) {
      const payload = compiled[fileName];
      loaded = payload ? new SourceMap(payload) : null;
      inner.set(fileName, loaded);
    }
    return loaded;
  }
  return {
    findOrigin(line, column) {
      const origin = map.findOrigin(line, column);
      if (!('fileName' in origin) || !(origin.fileName in compiled)) return origin;
      const original = innerMap(origin.fileName)?.findOrigin(origin.lineNumber, origin.columnNumber);
      if (!original || !('fileName' in original)) {
        return { ...origin, fileName: `${origin.fileName} (compiled)` } satisfies SourceOrigin;
      }
      const { lineNumber, columnNumber, name } = original;
      return { ...origin, lineNumber, columnNumber, name: name ?? origin.name };
    },
  };
}

function remember(chunk: string, loaded: LoadedSourceMap | null): void {
  cache.delete(chunk);
  cache.set(chunk, loaded);
  const oldest = cache.keys().next();
  if (cache.size > MAX_CACHED && !oldest.done) cache.delete(oldest.value);
}

async function load(chunk: string, folders: Folders): Promise<void> {
  if (cache.has(chunk)) return;
  try {
    const mapFile = await mapFileFor(chunk, folders);
    if (mapFile === undefined) {
      remember(chunk, null);
      return;
    }
    // The maps are the build's own output, read where it left them; tracing them into the server bundle would pull in
    // the whole project, so the bundler is told to leave this read alone.
    const payload = JSON.parse(
      await readFile(/* turbopackIgnore: true */ mapFile, 'utf8'),
    ) as SourceMapPayload & {
      x_carshenas_compiled_maps?: CompiledMaps;
    };
    const map = new SourceMap(payload);
    const compiled = payload.x_carshenas_compiled_maps;
    remember(chunk, {
      map: compiled ? throughCompiledMaps(map, compiled) : map,
      directory: path.dirname(mapFile),
    });
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
  build = buildDirectory(),
): Promise<SourceMapLookup> {
  const folders: Folders = {
    staticRoot: path.join(build, 'static'),
    privateRoot: path.join(build, 'browser-source-maps'),
  };
  const chunks = new Set<string>();
  for (const stack of stacks) {
    for (const [url] of stack.matchAll(FRAME_URL)) {
      const chunk = chunkFileFor(url, folders);
      if (chunk !== undefined) chunks.add(chunk);
    }
  }
  await Promise.all([...chunks].map((chunk) => load(chunk, folders)));
  return (url) => {
    const chunk = chunkFileFor(url, folders);
    return chunk === undefined ? undefined : (cache.get(chunk) ?? undefined);
  };
}
