#!/usr/bin/env bash
# Run (or update) @visual screenshot tests inside the official Playwright container so baselines
# are identical on every laptop and in CI. Usage: pnpm e2e:visual [--update-snapshots] [playwright args]
# Only the fixture projects have visual tests today, so the application is not built inside the container.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"

VERSION=$(node -p "require('$repo/node_modules/@playwright/test/package.json').version")
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

# The whole workspace is mounted because pnpm links e2e/node_modules into the root store.
exec docker run --rm --ipc=host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e E2E_VISUAL=1 -e E2E_ONLY_FIXTURE=1 \
  -v "$repo":/work -w /work/e2e \
  "$IMAGE" \
  npx playwright test --grep @visual "$@"
