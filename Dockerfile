# syntax=docker/dockerfile:1

# Builds the `mday` crawler CLI (apps/cli). Node runs the .ts sources directly (native TS
# support, no build step — see apps/cli/package.json), so this image just needs the pinned
# Node runtime, workspace deps, and a real Chrome for Cloudflare bypass (ADR 0009).
FROM node:24.19.0-bookworm

# Real Chrome (channel: "chrome" in browserSession.ts) is required for Cloudflare bypass — the
# Playwright-bundled Chromium is not enough. --with-deps installs the OS libraries Chrome needs
# to run headless on Debian. Version pinned to the pnpm-workspace.yaml catalog entry.
RUN npx --yes playwright@1.62.0 install --with-deps chrome

WORKDIR /app

# Manifests only, so this dependency layer is cached across source-only changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/cli/package.json apps/cli/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/db/package.json packages/db/package.json

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate \
  && pnpm install --frozen-lockfile --prod --filter @matchday/cli...

COPY tsconfig.json ./
COPY apps/cli apps/cli
COPY packages/domain packages/domain
COPY packages/db packages/db

# Chrome refuses to launch sandboxed as root without --no-sandbox, which browserSession.ts never
# passes — run as the non-root `node` user (built into the base image) instead.
RUN chown -R node:node /app
USER node

WORKDIR /app/apps/cli
ENV NODE_ENV=production
ENTRYPOINT ["node", "src/cli.ts"]
CMD ["--help"]
