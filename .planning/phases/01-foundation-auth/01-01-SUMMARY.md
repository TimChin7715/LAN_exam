---
phase: 01-foundation-auth
plan: 01-01
subsystem: infra
tags: [pnpm, fastify, vite, react, docker, compose, postgres]

requires: []
provides:
  - pnpm monorepo with @lan-exam/server and @lan-exam/web
  - GET /health returning {"status":"ok"}
  - Docker Compose (postgres:16 + app) and multi-stage Dockerfile
  - Dual-path deployment guide (路径 A / 路径 B)
affects: [01-02, 01-03]

tech-stack:
  added: [fastify@5, vite@6, react@19, tailwindcss@4, shadcn new-york/zinc]
  patterns: [pnpm workspace, Docker-first dev, API port 3001 / Web 5173]

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - apps/server/src/index.ts
    - apps/web/vite.config.ts
    - docker-compose.yml
    - Dockerfile
    - docs/DEPLOY.md
  modified:
    - README.md

key-decisions:
  - "API 3001 / Web 5173 with Vite /api proxy to server"
  - "Production entry: node apps/server/dist/index.js (tsx dev-only)"
  - "Deploy paths A (0.0.0.0 + firewall) vs B (127.0.0.1 + reverse proxy TLS)"

patterns-established:
  - "Docker-first local dev per D-08"
  - "Health-only /health for liveness (no business data)"

requirements-completed: [INFRA-01]

duration: 45min
completed: 2026-05-15
---

# Phase 01 Plan 01: Foundation Skeleton Summary

**Monorepo、/health、Docker Compose 与双路径部署文档就绪，为 Prisma 与认证计划铺好基础设施。**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-15
- **Tasks:** 2
- **Files modified:** 25+

## Accomplishments

- pnpm workspace：`@lan-exam/server`（Fastify 5）与 `@lan-exam/web`（Vite+React+TS+shadcn zinc）
- `GET /health` → `{"status":"ok"}`（本地与构建产物均已验证）
- `docker compose config` 通过；`postgres:16` + `app` 服务定义完成
- `docs/DEPLOY.md` 覆盖路径 A/B、防火墙、反代、健康检查与回滚要点

## Task Commits

1. **Task 1: 初始化 monorepo 与双应用骨架** - `0ebadcb` (feat)
2. **Task 2: Docker Compose、镜像与部署双路径文档** - `22940d2` (feat)

**Plan metadata:** `docs(01-01): complete plan`

## Files Created/Modified

- `apps/server/src/index.ts` - Fastify app with `/health`
- `apps/web/vite.config.ts` - `/api` proxy to :3001
- `docker-compose.yml` - db + app with healthcheck dependency
- `Dockerfile` - multi-stage build, `node apps/server/dist/index.js`
- `docs/DEPLOY.md` - 路径 A / 路径 B 与 TLS 假设

## Self-Check: PASSED

- [x] `pnpm install` && `pnpm -r build` succeed
- [x] `GET /health` returns ok
- [x] `docker compose config` succeeds
- [x] `docs/DEPLOY.md` contains 路径 A and 路径 B

## Deviations

None.

## Next Plan

01-02: PostgreSQL + Prisma schema, migrations, seed teacher account.
