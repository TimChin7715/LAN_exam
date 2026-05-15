# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY prisma prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY apps/web apps/web
COPY apps/server apps/server
RUN pnpm exec prisma generate \
  && pnpm --filter @lan-exam/web build \
  && pnpm --filter @lan-exam/server build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY prisma prisma
COPY scripts/docker-entrypoint.sh scripts/docker-entrypoint.sh
RUN chmod +x scripts/docker-entrypoint.sh \
  && pnpm install --frozen-lockfile \
  && pnpm exec prisma generate
COPY --from=build /app/apps/server/dist apps/server/dist
COPY docs/templates docs/templates
EXPOSE 3101
ENV PORT=3101
ENV HOST=0.0.0.0
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
