# Walking Skeleton — 局域网考试系统（LAN Exam）

**Phase:** 1  
**生成日期:** 2026-05-15

## Capability Proven End-to-End

教师使用种子账号在 **局域网内** 通过浏览器完成 **登录 →（若需）强制改密 → 进入管理端仪表盘占位页**；未登录访问管理 API 与受保护路由返回 **401** 并被引导至登录页；`GET /health` 返回 **200**；数据层对 **教师账号** 至少完成 **一次读 + 一次写**（登录/改密触达数据库）。

## Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm，`apps/web` + `apps/server` | 前后端版本锁步、Compose 单仓构建 |
| 前端 | React + Vite + Tailwind v4 + shadcn/ui | 与已批准 `01-UI-SPEC.md` 一致 |
| 后端 | Fastify + Prisma | 轻量、类型友好、迁移与种子一体 |
| 数据 | PostgreSQL | 会话与业务共用、便于后续阶段扩展 |
| 认证 | 服务端 Session + HttpOnly Cookie + PG session store | 满足 CONTEXT D-04 与考场重启可恢复会话 |
| 部署 | Docker Compose 为默认交付 | CONTEXT D-05、D-08 |
| 目录约定 | `apps/server/src/routes/api/*`，`apps/web/src/*`，`prisma/*` 在仓库根 | 执行期可按 PLAN 微调，但须在 SUMMARY 中记录 |

## Stack Touched in Phase 1

- [ ] 项目脚手架（pnpm、ESLint/TS、根 README）
- [ ] 路由 — `/`、`/admin/*`（前端）+ `/api/*` 与 `/health`（后端）
- [ ] 数据库 — Prisma schema、migrate、seed、登录/改密读写
- [ ] UI — 登录、改密、仪表盘占位、路由四态（见 UI-SPEC）
- [ ] 部署 — `docker-compose.yml` + 双路径部署文档（D-06）

## Out of Scope（本骨架之后）

- 学生强绑定登录（AUTH-02，Phase 3）
- 题库/名单/考试业务（Phase 2–4）
- 自助找回密码（D-03 明确不做）
- 高级防作弊与多租户 SaaS

## Subsequent Slice Plan

- Phase 2：题库导入（QBANK-*）
- Phase 3：名单 + 学生入场（ROST-01, AUTH-02）
- Phase 4：考试、提交与导出（EXAM-*, EXPR-*）
