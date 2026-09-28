import 'server-only';
import { open, readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload, type SourceOrigin } from 'node:module';
import path from 'node:path';
import type { LoadedSourceMap, SourceMapLookup } from '@carshenas/observability/stack';

// The build's browser source maps, read from disk to symbolicate a browser error's stack (ADR-0016). A frame names a
// chunk the browser loaded, under /_next/static; the chunk's last line names its map (Turbopack gives a map its own
// hashed name), and scripts/browser-source-maps.mjs moved every map from .next/static to .next/browser-source-maps,
// which is never served. Only a JavaScript file inside the static folder and a map inside the private one are ever
// read, so a report cannot make the server read anything else.

const STATIC_PATH = '/_next/static/';
const FRAME_URL = /https?:\/\/[^\s()]+?\/_next\/static\/[^\s():]+\.js/g;
const MAP_REFERENCE = /\/\/# sourceMappingURL=([^\s'"]+)\s*$/;
const TAIL_BYTES = 512;
const MAX_CACHED = 20;

type LineTable = readonly ([number, number] | null)[];
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
 * The map, with the lines the React Compiler moved put back: a compiled line placed by the build step reports our
 * file's line; one it could not place reports the compiled line, marked `(compiled)`, rather than a wrong line.
 */
function withOriginalLines(
  map: SourceMap,
  tables: Readonly<Record<string, LineTable>>,
): Pick<SourceMap, 'findOrigin'> {
  return {
    findOrigin(line, column) {
      const origin = map.findOrigin(line, column);
      if (!('fileName' in origin)) return origin;
      const table = tables[origin.fileName];
      if (!table) return origin;
      const placed = table[origin.lineNumber - 1];
      if (!placed) return { ...origin, fileName: `${origin.fileName} (compiled)` } satisfies SourceOrigin;
      const [lineNumber, columnShift] = placed;
      return { ...origin, lineNumber, columnNumber: Math.max(1, origin.columnNumber + columnShift) };
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
      x_carshenas_original_lines?: Record<string, LineTable>;
    };
    const map = new SourceMap(payload);
    const tables = payload.x_carshenas_original_lines;
    remember(chunk, { map: tables ? withOriginalLines(map, tables) : map, directory: path.dirname(mapFile) });
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
