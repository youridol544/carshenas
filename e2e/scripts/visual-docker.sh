#!/usr/bin/env bash
# Run (or update) @visual screenshot tests inside the official Playwright container so baselines
# are identical on every laptop and in CI. Usage: pnpm e2e:visual [--update-snapshots=all] [playwright args]
# A bare --update-snapshots rewrites only images that fail the comparison, and a change under the 1% tolerance
# (a glyph moving) passes it, so an intended change regenerates every baseline with =all.
# The application is built and served inside the container (playwright.config.ts starts it), from the mounted
# workspace. It needs the licensed typeface in place (docs/runbooks/licensed-font.md): the container has no
# Persian font of its own, so without it every baseline would show FreeSerif.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"

font="$repo/apps/web/src/components/layout/fonts/YekanBakh-VF.woff2"
[ -f "$font" ] || { echo "Missing $font; see docs/runbooks/licensed-font.md." >&2; exit 1; }

VERSION=$(node -p "require('$repo/node_modules/@playwright/test/package.json').version")
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"

# The whole workspace is mounted because pnpm links e2e/node_modules into the root store.
exec docker run --rm --ipc=host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e E2E_VISUAL=1 -e NEXT_TELEMETRY_DISABLED=1 \
  -v "$repo":/work -w /work/e2e \
  "$IMAGE" \
  npx playwright test --grep @visual "$@"
