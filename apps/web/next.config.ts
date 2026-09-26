import path from 'node:path';
import type { NextConfig } from 'next';

// The workspace root (two levels up) is where pnpm hoists the lockfile; naming it keeps Turbopack and
// output tracing from guessing in a monorepo.
const workspaceRoot = path.join(import.meta.dirname, '..', '..');

const nextConfig: NextConfig = {
  // ADR-0004: the build, not a document, enforces the page shape a real backend will need.
  reactCompiler: true,
  typedRoutes: true,
  cacheComponents: true,
  // Every link to a route prefetches that route's one shared App Shell; a link that needs its URL-specific
  // content ready (an above-the-fold listing card whose photo morphs) asks for more with prefetch={true}.
  // Owner decision, 2026-09-26 (CS-27).
  partialPrefetching: true,
  // ADR-0008: listing photos are hotlinked from their source and never stored. Unoptimized images are served
  // as-is from their src, so the image optimizer never downloads, resizes or caches a copy on our server.
  // Owner decision, 2026-09-26 (CS-27).
  images: { unoptimized: true },
  // Tests and agents open the dev server as 127.0.0.1; without this the hot-reload socket is refused and
  // the browser console fills with errors.
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
