---
phase: 01-foundation-auth
plan: 01-02
subsystem: database
tags: [prisma, postgresql, argon2, docker, migrate, seed]

requires:
  - phase: 01-foundation-auth
    plan: 01-01
    provides: monorepo, Compose, /health skeleton
provides:
  - Teacher model with migrations and argon2 seed (teacher_admin)
  - PrismaClient singleton and startup DB ping
  - docker-entrypoint migrate deploy + db seed before app
affects: [01-03]

tech-stack:
  added: [prisma@6, @prisma/client, argon2]
  patterns: [root-level Prisma, SEED_ADMIN_PASSWORD env-only secret, SELECT 1 health depth]

key-files:
  created:
    - prisma/schema.prisma
    - prisma/migrations/20260515083816_init_teacher/migration.sql
    - prisma/seed.ts
    - apps/server/src/lib/prisma.ts
    - scripts/docker-entrypoint.sh
    - .env.example
  modified:
    - docker-compose.yml
    - Dockerfile
    - docs/DEPLOY.md
    - apps/server/src/index.ts
    - package.json

key-decisions:
  - "Seed username teacher_admin constant; password only via SEED_ADMIN_PASSWORD"
  - "Compose entrypoint fails fast if SEED_ADMIN_PASSWORD unset"
  - "Health and startup both run SELECT 1 via Prisma"

patterns-established:
  - "Postgres host db in Compose; localhost:5432 in .env.example for host-side pnpm"
  - "No role table in v1 (D-01); comment marks RBAC extension point"

requirements-completed: [INFRA-01]

duration: 35min
completed: 2026-05-15
---

# Phase 01 Plan 02: PostgreSQL + Prisma Summary

**Teacher 表迁移与 argon2 种子账号、Compose 启动时 migrate/seed，以及 Prisma SELECT 1 启动与深度健康检查。**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-15
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- `Teacher` 模型：`username` 唯一、`passwordHash`、`mustChangePassword` 默认 true
- `init_teacher` 迁移含 `CREATE TABLE "Teacher"`
- `prisma/seed.ts` upsert `teacher_admin`，口令来自 `SEED_ADMIN_PASSWORD`（禁止入库）
- `scripts/docker-entrypoint.sh`：`migrate deploy` → `db seed` → `node`；失败非 0 退出
- 启动与 `GET /health` 均执行 `SELECT 1`，DB 不可达时进程退出或健康失败

## Task Commits

1. **Task 1: Prisma schema、迁移与 Teacher 表** - `99e479d` (feat)
2. **Task 2: Compose 集成 migrate + seed 与启动顺序** - `432e330` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified

- `prisma/schema.prisma` - Teacher model, D-01 RBAC comment
- `prisma/migrations/20260515083816_init_teacher/migration.sql` - initial migration
- `prisma/seed.ts` - argon2 seed for teacher_admin
- `apps/server/src/lib/prisma.ts` - singleton + disconnect on close
- `scripts/docker-entrypoint.sh` - migrate, seed, start server
- `docs/DEPLOY.md` - seed password, teacher_admin, migration failure behavior

## Decisions Made

None beyond plan — followed CONTEXT D-01/D-02 and RESEARCH conventions.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- 本机 `127.0.0.1:5432` 被 Windows 保留/占用，Compose `db` 无法绑定；验收使用临时 Postgres `5434` 跑通 `migrate`/`seed`/`/health`（不影响 compose 内 `db:5432` 设计）。

## Next Phase Readiness

- 持久化与种子教师就绪，01-03 可实现登录、Session 与首登改密
- 生产部署须设置 `SEED_ADMIN_PASSWORD` 且勿写入 git

## Self-Check: PASSED

- [x] `pnpm exec prisma validate` exit 0
- [x] `prisma/migrations` 含 `CREATE TABLE "Teacher"`
- [x] `pnpm exec prisma migrate deploy` + `pnpm exec prisma db seed` 成功
- [x] `GET /health` → `{"status":"ok"}`（DB ping 成功）
- [x] `.env.example` 含 `DATABASE_URL` 与 `SEED_ADMIN_PASSWORD`

---
*Phase: 01-foundation-auth*
*Completed: 2026-05-15*
