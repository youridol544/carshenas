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

/**
 * Where a frame's source is, for a person: relative to `root`, a dependency from its node_modules folder. Turbopack
 * already names a source from its project root (`turbopack:///[project]/apps/web/src/app/page.tsx`), which
 * next.config.ts sets to the repository root; given that root, a server frame reads the same. Computed from strings
 * alone: a lookup on disk here would make Next.js's output tracing copy the whole project into the server build.
 */
function displayPath(source: string, directory: string, root: string): string {
  if (source.startsWith(TURBOPACK_PROJECT)) return source.slice(TURBOPACK_PROJECT.length);
  let file: string;
  if (source.startsWith('file://')) file = fileURLToPath(source);
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) return source;
  else file = path.resolve(directory, decodeURIComponent(source));
  const dependency = file.lastIndexOf(`${path.sep}node_modules${path.sep}`);
  if (dependency !== -1) return file.slice(dependency + 1);
  return path.relative(root, file);
}

type Frame = {
  line: string;
  style: 'v8' | 'at-sign';
  indent: string;
  /** The function name as the generated (possibly minified) code has it. */
  name: string | undefined;
  /** `file:line:column` in the original source, when a source map covers the frame. */
  where?: string;
  /** Whether the original source is ours rather than a dependency's. */
  ours?: boolean;
  /** The original name of the function this frame *calls*: the identifier at its call site. */
  callee?: string;
};

// A bundler's minifier renames functions to one or two characters (`i`, `aS`, `o1`); such a name says nothing.
const MINIFIED_NAME = /^[\w$]{1,2}$/;

function parseFrame(line: string, lookup: SourceMapLookup, root: string): Frame | undefined {
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
  const source = displayPath(origin.fileName, loaded.directory, root);
  frame.where = `${source}:${origin.lineNumber}:${origin.columnNumber}`;
  frame.ours = !source.startsWith('node_modules/');
  frame.callee = origin.name;
  return frame;
}

/**
 * The function name to show for a mapped frame. The identifier at the caller's call site is the name our code
 * called it by, as Node's own --enable-source-maps reads it; a framework's call site names its own variable
 * (`Component`), so only a caller in our code counts. Otherwise the generated name, unless it is minified.
 */
function nameFor(frame: Frame, caller: Frame | undefined): string | undefined {
  if (caller?.ours && caller.callee) return caller.callee;
  return frame.name === undefined || MINIFIED_NAME.test(frame.name) ? undefined : frame.name;
}

function formatFrame(frame: Frame, name: string | undefined): string {
  if (frame.where === undefined) return frame.line;
  if (frame.style === 'at-sign') return `${frame.indent}${name ?? ''}@${frame.where}`;
  return name ? `${frame.indent}at ${name} (${frame.where})` : `${frame.indent}at ${frame.where}`;
}

/**
 * The stack with every frame a source map covers rewritten to its original file, line and column. Paths are shown
 * relative to `root`: pass the repository root, so a file reads the same in every program's stacks and the
 * browser's.
 */
export function mapStackFrames(stack: string, lookup: SourceMapLookup, root = process.cwd()): string {
  const lines = stack.split('\n');
  const frames = lines.map((line) => {
    try {
      return parseFrame(line, lookup, root);
    } catch {
      return undefined;
    }
  });
  return lines
    .map((line, index) => {
      const frame = frames[index];
      if (!frame) return line;
      return formatFrame(frame, nameFor(frame, frames[index + 1]));
    })
    .join('\n');
}

function loadedModuleMap(file: string): LoadedSourceMap | undefined {
  const map = findSourceMap(file);
  if (!map) return undefined;
  const filePath = file.startsWith('file://') ? fileURLToPath(file) : file;
  return { map, directory: path.dirname(filePath) };
}

/** Maps a stack through the source maps of the modules this process has loaded; paths as in `mapStackFrames`. */
export function sourceMappedStack(stack: string, root = process.cwd()): string {
  return mapStackFrames(stack, loadedModuleMap, root);
}
