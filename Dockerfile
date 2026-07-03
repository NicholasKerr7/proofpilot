# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG DATABASE_URL="postgresql://proofpilot:proofpilot@localhost:5432/proofpilot?schema=public"
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
RUN pnpm --filter @proofpilot/database db:generate
RUN pnpm exec turbo run build --filter=@proofpilot/api... --filter=@proofpilot/worker...

FROM base AS api
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build --chown=node:node /app /app
EXPOSE 4000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.PORT || 4000; fetch('http://127.0.0.1:' + port + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));"
CMD ["node", "apps/api/dist/main.js"]

FROM base AS worker
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
CMD ["node", "apps/worker/dist/main.js"]
