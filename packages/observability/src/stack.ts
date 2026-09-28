import { existsSync } from 'node:fs';
import { findSourceMap, type SourceMap } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Stack traces that point at the code as written: `apps/web/src/app/page.tsx:14:9`, not a line in a minified
// bundle. Next.js sets Error.prepareStackTrace so that `error.stack` is never source-mapped (it maps only when it
// prints an error), so the logger maps each frame itself through the source maps Node has loaded: enable them with
// `--enable-source-maps` or `process.setSourceMapsEnabled(true)` before the code loads. The same frame mapping
// symbolicates browser stacks with the build's browser source maps. Node only.

/** A source map and the directory its relative `sources` are resolved against. */
export type LoadedSourceMap = { map: Pick<SourceMap, 'findOrigin'>; directory: string };

/** Finds the source map for the file or URL a stack frame names, if there is one. */
export type SourceMapLookup = (file: string) => LoadedSourceMap | undefined;

// V8 (Node, Chrome, Edge): `    at render (file:///x.js:1:2)` or `    at file:///x.js:1:2`.
const V8_FRAME = /^(\s*at (?:(.+?) \()?)(.+?):(\d+):(\d+)(\)?)\s*$/;
// Firefox and Safari: `render@https://host/x.js:1:2`.
const AT_SIGN_FRAME = /^(\s*)(?:(.*?)@)(.+?):(\d+):(\d+)\s*$/;
const TURBOPACK_PROJECT = 'turbopack:///[project]/';

let cachedRoot: string | undefined;

/** The nearest directory above the working directory with a pnpm-workspace.yaml: paths are shown from there. */
function displayRoot(): string {
  if (cachedRoot !== undefined) return cachedRoot;
  let directory = process.cwd();
  while (!existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(directory);
    if (parent === directory) {
      directory = process.cwd();
      break;
    }
    directory = parent;
  }
  cachedRoot = directory;
  return directory;
}

/** `apps/web/src/app/page.tsx` for our code, `node_modules/next/dist/…` for a dependency. */
function displayPath(source: string, directory: string): string {
  let file: string;
  if (source.startsWith('file://')) file = fileURLToPath(source);
  else if (source.startsWith(TURBOPACK_PROJECT))
    file = path.join(displayRoot(), source.slice(TURBOPACK_PROJECT.length));
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) return source;
  else file = path.resolve(directory, decodeURIComponent(source));
  const dependency = file.lastIndexOf(`${path.sep}node_modules${path.sep}`);
  if (dependency !== -1) return file.slice(dependency + 1);
  return path.relative(displayRoot(), file);
}

type Frame = {
  line: string;
  style: 'v8' | 'at-sign';
  indent: string;
  /** The function name as the generated (possibly minified) code has it. */
  name: string | undefined;
  /** `file:line:column` in the original source, when a source map covers the frame. */
  where?: string;
  /** The original name of the function this frame *calls*: the identifier at its call site. */
  callee?: string;
};

function parseFrame(line: string, lookup: SourceMapLookup): Frame | undefined {
  const v8 = V8_FRAME.exec(line);
  const atSign = v8 ? undefined : AT_SIGN_FRAME.exec(line);
  const match = v8 ?? atSign;
  if (!match) return undefined;
  const [, prefix = '', name, file = '', lineText = '', columnText = ''] = match;
  const frame: Frame = {
    line,
    style: v8 ? 'v8' : 'at-sign',
    indent: /^\s*/.exec(prefix)?.[0] ?? '',
    name: name === '' ? undefined : name,
  };
  const loaded = lookup(file);
  if (!loaded) return frame;
  const origin = loaded.map.findOrigin(Number(lineText), Number(columnText));
  if (!('fileName' in origin)) return frame;
  frame.where = `${displayPath(origin.fileName, loaded.directory)}:${origin.lineNumber}:${origin.columnNumber}`;
  frame.callee = origin.name;
  return frame;
}

function formatFrame(frame: Frame, name: string | undefined): string {
  if (frame.where === undefined) return frame.line;
  if (frame.style === 'at-sign') return `${frame.indent}${name ?? ''}@${frame.where}`;
  return name ? `${frame.indent}at ${name} (${frame.where})` : `${frame.indent}at ${frame.where}`;
}

/**
 * The stack with every frame a source map covers rewritten to its original file, line and column. A frame's
 * original function name is the identifier at the call site of the frame below it (its caller), as Node's own
 * --enable-source-maps reads it; the name recorded at a frame's own position is the function it calls.
 */
export function mapStackFrames(stack: string, lookup: SourceMapLookup): string {
  const lines = stack.split('\n');
  const frames = lines.map((line) => {
    try {
      return parseFrame(line, lookup);
    } catch {
      return undefined;
    }
  });
  return lines
    .map((line, index) => {
      const frame = frames[index];
      if (!frame) return line;
      return formatFrame(frame, frames[index + 1]?.callee ?? frame.name);
    })
    .join('\n');
}

function loadedModuleMap(file: string): LoadedSourceMap | undefined {
  const map = findSourceMap(file);
  if (!map) return undefined;
  const filePath = file.startsWith('file://') ? fileURLToPath(file) : file;
  return { map, directory: path.dirname(filePath) };
}

/** Maps a stack through the source maps of the modules this process has loaded. */
export function sourceMappedStack(stack: string): string {
  return mapStackFrames(stack, loadedModuleMap);
}
