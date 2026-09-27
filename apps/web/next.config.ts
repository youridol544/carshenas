import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// The workspace root (two levels up) is where pnpm hoists the lockfile; naming it keeps Turbopack and
// output tracing from guessing in a monorepo.
const workspaceRoot = path.join(import.meta.dirname, '..', '..');

// Local settings live in the repository's .env (copied from example.env), shared with Docker Compose and dbmate.
// Next.js reads only apps/web/.env*, so the root file is loaded here; a variable already in the environment wins,
// which is how production sets them.
const rootEnvFile = path.join(workspaceRoot, '.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const nextConfig: NextConfig = {
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
