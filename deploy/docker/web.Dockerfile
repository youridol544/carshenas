# syntax=docker/dockerfile:1
#
# The web app's production image (CS-119, docs/runbooks/deploy.md): Next.js 16 as a standalone server, run as an
# unprivileged user, with no setting, key or password inside. Everything it needs at run time comes from the
# environment. Build it from the repository root, with scripts/deploy.sh or by hand:
#
#   docker build -f deploy/docker/web.Dockerfile --build-arg CARSHENAS_RELEASE=<release> -t carshenas-web:<release> .
#
# The licensed typeface (apps/web/src/components/layout/fonts/YekanBakh-VF.woff2, ADR-0015) must be in the build
# context, and it ends up in this image: ship the image to your own server with `docker save | ssh ... docker load`,
# never push it to a registry.

# Behind a mirror (Docker Hub and npm can be slow or blocked from Iran): --build-arg NODE_IMAGE=<mirror>/library/node:22.23.3-bookworm-slim
# and --build-arg NPM_REGISTRY=<mirror url>.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim

# ---- Build: install the web app's workspace, build it as a standalone server -------------------------------------
FROM ${NODE_IMAGE} AS build
ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG CARSHENAS_RELEASE=unknown
ENV npm_config_registry=${NPM_REGISTRY} \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
# The version in package.json's packageManager field, installed without corepack, which would download it again.
RUN npm install --global --no-audit --no-fund pnpm@10.27.0
WORKDIR /app
COPY . .
RUN test -f apps/web/src/components/layout/fonts/YekanBakh-VF.woff2 \
    || { echo "The licensed typeface is missing from the build context: docs/runbooks/licensed-font.md says how to provide it." >&2; exit 1; }
RUN --mount=type=cache,id=carshenas-pnpm,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --filter "@carshenas/web..."
# The release every log line names (ADR-0016) is fixed into the build; CARSHENAS_STANDALONE asks next.config.ts for the
# standalone output. `next build` needs no database: every read happens when a visitor asks.
ENV CARSHENAS_RELEASE=${CARSHENAS_RELEASE} \
    CARSHENAS_STANDALONE=1
RUN pnpm --filter @carshenas/web build

# ---- Run: the standalone server and the files it serves, nothing else ----------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ARG CARSHENAS_RELEASE=unknown
LABEL org.opencontainers.image.title="carshenas-web" \
      org.opencontainers.image.revision="${CARSHENAS_RELEASE}" \
      org.opencontainers.image.source="https://github.com/youridol544/carshenas"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CARSHENAS_RELEASE=${CARSHENAS_RELEASE} \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# The server and its traced node_modules (the folder layout of the monorepo is kept: apps/web/server.js)...
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
# ...the browser's files, which the standalone server serves but does not copy by itself...
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# ...and the browser source maps, which the server reads to map a browser error's stack and never serves
# (docs/runbooks/logs-and-errors.md, "Source maps").
COPY --from=build --chown=node:node /app/apps/web/.next/browser-source-maps ./apps/web/.next/browser-source-maps
USER node
EXPOSE 3000
# server.js moves to its own folder first, so what the app calls the build directory and the repository root resolve.
CMD ["node", "apps/web/server.js"]
