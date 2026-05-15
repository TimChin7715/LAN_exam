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
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY apps/web apps/web
COPY apps/server apps/server
RUN pnpm --filter @lan-exam/web build \
  && pnpm --filter @lan-exam/server build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod --filter @lan-exam/server
COPY --from=build /app/apps/server/dist apps/server/dist
EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0
CMD ["node", "apps/server/dist/index.js"]
