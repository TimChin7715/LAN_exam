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
ARG VITE_ADMIN_ALLOW_REMOTE=false
ENV VITE_ADMIN_AUTH_MODE=disabled
ENV VITE_ADMIN_ALLOW_REMOTE=${VITE_ADMIN_ALLOW_REMOTE}
RUN pnpm exec prisma generate \
  && pnpm --filter @lan-exam/web build \
  && pnpm --filter @lan-exam/server build

FROM base AS production
WORKDIR /app
ENV ADMIN_AUTH_MODE=disabled
ENV ADMIN_API_LOOPBACK_ONLY=true
ENV LOCAL_ADMIN_USERNAME=local_exam_admin
ENV LISTEN_HOST=0.0.0.0
ENV WEB_PORT=5180
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY prisma prisma
COPY scripts/docker-entrypoint.sh scripts/docker-entrypoint.sh
RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh \
  && chmod +x scripts/docker-entrypoint.sh \
  && pnpm install --frozen-lockfile \
  && pnpm exec prisma generate
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY templates templates
EXPOSE 5180
ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]
