# syntax=docker/dockerfile:1
#
# The worker's production image (CS-119, docs/runbooks/deploy.md): the Node.js process that runs the crawler and every
# background job (apps/worker, ADR-0018), as an unprivileged user, with no setting, key or password inside. It is also
# the toolbox of the deployment: the migrations and dbmate, the superadmin command (@carshenas/accounts), and the
# commands of docs/runbooks/worker.md (`pnpm valuation:run`, `pnpm search:rebuild`, `pnpm derive:listings`, ...).
#
#   docker build -f deploy/docker/worker.Dockerfile --build-arg CARSHENAS_RELEASE=<release> -t carshenas-worker:<release> .
#
# The worker runs the TypeScript sources as they are, with Node's own type stripping (docs/runbooks/worker.md), so the
# image holds the workspace (apps/worker and packages/*) and its production dependencies, as pnpm links them: Node
# refuses to strip types from a file under node_modules, and the workspace links resolve to packages/. Nothing here
# copies a package into node_modules (`pnpm deploy` would).

# Behind a mirror: --build-arg NODE_IMAGE=<mirror>/library/node:22.23.3-bookworm-slim and --build-arg NPM_REGISTRY=<mirror url>.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim

# ---- dbmate: the migration tool, from the npm registry (its Linux binary is an optional package of it) -------------
FROM ${NODE_IMAGE} AS dbmate
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=${NPM_REGISTRY}
# The version of the repository's package.json, for the platform this image is built for.
RUN npm install --prefix /opt/dbmate --no-audit --no-fund dbmate@2.36.0 \
    && cp "$(node -p "require.resolve('@dbmate/' + process.platform + '-' + process.arch + '/bin/dbmate', { paths: ['/opt/dbmate'] })")" /usr/local/bin/dbmate \
    && dbmate --version

# ---- Install: the worker's workspace and what it depends on, production dependencies only ---------------------------
FROM ${NODE_IMAGE} AS install
ARG NPM_REGISTRY=https://registry.npmjs.org/
ENV npm_config_registry=${NPM_REGISTRY} \
    CI=1
RUN npm install --global --no-audit --no-fund pnpm@10.27.0
WORKDIR /app
COPY . .
# The worker, and @carshenas/accounts for `pnpm account:superadmin` (argon2 ships prebuilt binaries).
RUN --mount=type=cache,id=carshenas-pnpm,target=/pnpm-store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm-store \
        --filter "@carshenas/worker..." --filter "@carshenas/accounts..."

# ---- Run ----------------------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ARG CARSHENAS_RELEASE=unknown
ARG NPM_REGISTRY=https://registry.npmjs.org/
LABEL org.opencontainers.image.title="carshenas-worker" \
      org.opencontainers.image.revision="${CARSHENAS_RELEASE}" \
      org.opencontainers.image.source="https://github.com/youridol544/carshenas"
ENV NODE_ENV=production \
    CARSHENAS_RELEASE=${CARSHENAS_RELEASE}
# pnpm runs the repository's own scripts (`pnpm valuation:run`), so the commands in the runbooks read the same here.
RUN npm install --global --no-audit --no-fund --registry "${NPM_REGISTRY}" pnpm@10.27.0 \
    && npm cache clean --force
COPY --from=dbmate /usr/local/bin/dbmate /usr/local/bin/dbmate
WORKDIR /app
COPY --from=install --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=install --chown=node:node /app/node_modules ./node_modules
COPY --from=install --chown=node:node /app/apps/worker ./apps/worker
COPY --from=install --chown=node:node /app/packages ./packages
# The migrations dbmate applies (the worker image is what `scripts/deploy.sh` migrates with).
COPY --from=install --chown=node:node /app/db/migrations ./db/migrations
USER node
# The health endpoint on the loopback of the container (docs/runbooks/worker.md); compose's healthcheck asks it.
EXPOSE 3101
# The container's one process is node itself, so Docker's SIGTERM reaches the worker, which stops claiming jobs, lets the
# running ones finish for up to 30 seconds and exits 0 (apps/worker/src/main.ts).
CMD ["node", "--experimental-strip-types", "--no-warnings=ExperimentalWarning", "--enable-source-maps", "apps/worker/src/main.ts"]
