import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import { keepBrowserSourceMapsPrivate } from './scripts/browser-source-maps.mjs';

// The workspace root (two levels up) is where pnpm hoists the lockfile; naming it keeps Turbopack and
// output tracing from guessing in a monorepo.
const workspaceRoot = path.join(import.meta.dirname, '..', '..');

// Local settings live in the repository's .env (copied from example.env), shared with Docker Compose and dbmate.
// Next.js reads only apps/web/.env*, so the root file is loaded here; a variable already in the environment wins,
// which is how production sets them.
const rootEnvFile = path.join(workspaceRoot, '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

// The build every log line names (ADR-0016): CARSHENAS_RELEASE when the deployment sets it, otherwise the commit,
// marked -dirty when tracked files had uncommitted changes, so a line leads to the exact code that wrote it.
function release(): string {
  const fromEnvironment = process.env.CARSHENAS_RELEASE;
  if (fromEnvironment) return fromEnvironment;
  try {
    const commit = git('rev-parse', '--short=12', 'HEAD');
    return git('status', '--porcelain', '--untracked-files=no') === '' ? commit : `${commit}-dirty`;
  } catch {
    return 'unknown';
  }
}

const nextConfig: NextConfig = {
  // Fixed into the server code at build time; src/server/env.ts reads it.
  env: { CARSHENAS_RELEASE: release() },
  // Browser source maps, so a browser error's stack is logged with its original file and line (ADR-0016). They are
  // for the server only: right after compiling, scripts/browser-source-maps.mjs moves them out of the folder that is
  // served and corrects the lines the React Compiler moved.
  productionBrowserSourceMaps: true,
  compiler: {
    runAfterProductionCompile: async ({ distDir, projectDir }) => {
      await keepBrowserSourceMapsPrivate({ distDir: path.resolve(projectDir, distDir), workspaceRoot });
    },
  },
  // ADR-0004: the build, not a document, enforces the page shape a real backend will need.
  reactCompiler: true,
  typedRoutes: true,
  cacheComponents: true,
  // Partial Prefetching stays off (owner, 2026-09-27, CS-28): a listing page reads its id at the top and answers a
  // real 404 for a missing listing, which a shared App Shell with params behind Suspense cannot do.
  // Listing photos are our copies in ArvanCloud Object Storage (ADR-0010). They are served as stored until CS-29
  // decides how they are resized: stored variants served as-is, or Next.js's optimizer reading from the bucket.
  images: { unoptimized: true },
  // Tests and agents open the dev server as 127.0.0.1; without this the hot-reload socket is refused and
  // the browser console fills with errors.
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
